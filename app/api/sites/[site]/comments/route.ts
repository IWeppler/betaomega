import { isAdmin } from "@/lib/auth";
import { listComments } from "@/lib/comment-store";
import { failure, notFound, recipeSite, type SiteParams } from "../recipes/helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The panel's list of comments, every status.
export async function GET(_request: Request, { params }: SiteParams) {
  if (!await isAdmin()) return Response.json({ error: "Ingresá como administrador." }, { status: 401 });
  const site = await recipeSite(params);
  if (!site) return notFound();
  try {
    return Response.json(await listComments(site.id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error, "leer los comentarios"); }
}
