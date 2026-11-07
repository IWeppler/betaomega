import { listApprovedComments } from "@/lib/comment-store";
import { displayName } from "@/lib/comments";
import { CommentForm } from "./comment-form";

const when = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { dateStyle: "long", timeZone: "America/Argentina/Buenos_Aires" });

/** Approved comments of a recipe and the form to add one. There are no ratings: only words. */
export async function RecipeComments({ siteId, recipeId }: { siteId: string; recipeId: string }) {
  let comments;
  try { comments = await listApprovedComments(siteId, recipeId); } catch (error) {
    // Until supabase/schema.sql is run the table does not exist: the recipe shows without a comments section.
    console.warn("[recetas] no se pudieron leer los comentarios:", error);
    return null;
  }
  return <section className="r-comments no-print" aria-labelledby="comments-title">
    <h2 id="comments-title">Comentarios{comments.length > 0 && <span> ({comments.length})</span>}</h2>
    {comments.length > 0
      ? <ul className="r-comment-list">{comments.map(c => <li key={c.id}>
        <p className="r-comment-head"><strong>{displayName(c)}</strong><time dateTime={c.createdAt}>{when(c.createdAt)}</time></p>
        <p className="r-comment-body">{c.body}</p>
      </li>)}</ul>
      : <p className="r-comment-empty">Todavía no hay comentarios. ¡Contanos cómo te salió!</p>}
    <CommentForm siteId={siteId} recipeId={recipeId} />
  </section>;
}
