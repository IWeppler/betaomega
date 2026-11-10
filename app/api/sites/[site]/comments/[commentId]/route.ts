import { isAdmin, sameOrigin } from "@/lib/auth";
import { deleteComment, setCommentStatus } from "@/lib/comment-store";
import { isCommentStatus } from "@/lib/comments";
import { isRecipeId } from "@/lib/recipes";
import { publicTags, refreshPublic } from "@/platform/sites/server";
import { failure, forbidden, notFound, recipeSite } from "../../recipes/helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Params = { params: Promise<{ site: string; commentId: string }> };

/** Approves, hides or returns to pending one comment. */
export async function PATCH(request: Request, { params }: Params) {
  if (!sameOrigin(request) || !await isAdmin()) return forbidden();
  const site = await recipeSite(params);
  const { commentId } = await params;
  if (!site || !isRecipeId(commentId)) return notFound();
  try {
    const body: unknown = await request.json();
    const status = body && typeof body === "object" ? (body as { status?: unknown }).status : undefined;
    if (!isCommentStatus(status)) return Response.json({ error: "Estado inválido." }, { status: 400 });
    const updated = await setCommentStatus(site.id, commentId, status);
    // Approved comments are part of the recipe page's cached HTML, which carries the recipes tag.
    if (updated) refreshPublic(publicTags.recipes);
    return updated ? Response.json(updated) : Response.json({ error: "El comentario ya no existe. Recargá la página." }, { status: 404 });
  } catch (error) { return failure(error, "actualizar el comentario"); }
}

export async function DELETE(request: Request, { params }: Params) {
  if (!sameOrigin(request) || !await isAdmin()) return forbidden();
  const site = await recipeSite(params);
  const { commentId } = await params;
  if (!site || !isRecipeId(commentId)) return notFound();
  try {
    await deleteComment(site.id, commentId);
    refreshPublic(publicTags.recipes);
    return new Response(null, { status: 204 });
  } catch (error) { return failure(error, "eliminar el comentario"); }
}
