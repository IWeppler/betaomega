import { sameOrigin } from "@/lib/auth";
import { addComment, hashAddress, recentBodies } from "@/lib/comment-store";
import { cleanComment, maxCommentsPerHour, sentTooFast } from "@/lib/comments";
import { isLiveRecipe } from "@/lib/recipe-store";
import { isRecipeId } from "@/lib/recipes";
import { failure, notFound, recipeSite } from "../../helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Params = { params: Promise<{ site: string; id: string }> };

const thanks = () => Response.json({ ok: true, message: "¡Gracias! Tu comentario se va a ver cuando lo revisemos." }, { status: 201 });
const refuse = (error: string, status: number) => Response.json({ error }, { status });

/** A visitor leaves a comment. It is stored as pending: nothing shows on the site until the panel approves it. */
export async function POST(request: Request, { params }: Params) {
  if (!sameOrigin(request)) return refuse("Origen no permitido.", 403);
  const site = await recipeSite(params);
  const { id } = await params;
  if (!site || !isRecipeId(id)) return notFound();
  try {
    const text = await request.text();
    if (text.length > 6000) return refuse("El comentario es demasiado largo.", 413);
    const data: unknown = JSON.parse(text);
    const extra = data && typeof data === "object" ? data as Record<string, unknown> : {};
    // The honeypot is a field people never see: a filled one is a script. It gets the same answer as a real comment, so it learns nothing.
    if (typeof extra.website === "string" && extra.website.trim()) return thanks();
    if (sentTooFast(extra.startedAt)) return refuse("Esperá un instante antes de enviar el comentario.", 429);
    const comment = cleanComment(data);
    if (!await isLiveRecipe(site.id, id)) return notFound();
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ipHash = hashAddress(forwarded || request.headers.get("x-real-ip") || "local");
    const recent = await recentBodies(site.id, ipHash);
    // The same text twice in an hour is a double click: answered as saved, stored once.
    if (recent.includes(comment.body)) return thanks();
    if (recent.length >= maxCommentsPerHour) return refuse("Ya enviaste varios comentarios. Probá de nuevo en un rato.", 429);
    await addComment(site.id, id, comment, ipHash);
    return thanks();
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      console.error("[comments] save failed:", error);
      return refuse("No pudimos guardar tu comentario. Probá de nuevo en unos minutos.", 500);
    }
    if (error instanceof SyntaxError) return refuse("Comentario inválido.", 400);
    return failure(error, "guardar el comentario");
  }
}
