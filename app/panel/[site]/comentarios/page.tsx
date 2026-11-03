"use client";

import { useState } from "react";
import { ArrowSquareOut, Check, EyeSlash, Trash, ArrowCounterClockwise } from "@phosphor-icons/react";
import { commentStatuses, displayName, type CommentStatus, type RecipeComment } from "@/lib/comments";
import { findSite } from "@/lib/sites";
import { useParams } from "next/navigation";
import { EmptyState } from "../list-tools";
import { usePanel } from "../panel-context";
import { useRecipes } from "../recipes-context";
import { PageHeader } from "../shell";

const when = (iso: string) => new Date(iso).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" });

export default function CommentsPage() {
  const { site: siteId } = useParams<{ site: string }>();
  const site = findSite(siteId);
  const { recipes, comments, commentsError, moderate, removeComment } = useRecipes();
  const { busy, error } = usePanel();
  const [status, setStatus] = useState<CommentStatus>("pending");
  // The comment waiting for a second click on "Eliminar".
  const [confirming, setConfirming] = useState("");
  if (!recipes || !site) return null;
  if (commentsError) return <>
    <PageHeader title="Comentarios" />
    <div className="alert error" role="alert">{commentsError}</div>
  </>;
  if (!comments) return null;
  const count = (s: CommentStatus) => comments.filter(c => c.status === s).length;
  const rows = comments.filter(c => c.status === status);
  const recipeOf = (comment: RecipeComment) => recipes.find(r => r.id === comment.recipeId);
  const empty: Record<CommentStatus, string> = {
    pending: "No hay comentarios para revisar. Los nuevos aparecen acá antes de verse en el sitio.",
    approved: "Todavía no aprobaste ningún comentario.",
    hidden: "No hay comentarios ocultos.",
  };
  return <>
    <PageHeader title="Comentarios" description="Lo que escriben los lectores en las recetas. Nada se ve en el sitio hasta que lo aprobás." />
    <section className="panel-card" aria-label="Lista de comentarios">
      <div className="choice-chips" role="group" aria-label="Estado">
        {commentStatuses.map(s => <button type="button" key={s.id} aria-pressed={status === s.id} onClick={() => { setStatus(s.id); setConfirming(""); }}>
          {s.label} ({count(s.id)})
        </button>)}
      </div>
      {error && <div className="alert error" role="alert">{error}</div>}
      {rows.length > 0
        ? <ul className="panel-comments">{rows.map(comment => {
          const recipe = recipeOf(comment);
          return <li key={comment.id}>
            <header>
              <strong>{displayName(comment)}</strong>
              <time dateTime={comment.createdAt}>{when(comment.createdAt)}</time>
              {recipe
                ? <a href={`${site.url}/${recipe.slug}`} target="_blank" rel="noopener noreferrer">{recipe.title}<ArrowSquareOut size={13} aria-label="(se abre en otra pestaña)" /></a>
                : <span className="panel-muted">Receta eliminada</span>}
            </header>
            <p>{comment.body}</p>
            <div className="panel-comment-actions">
              {comment.status !== "approved" && <button type="button" className="button primary" disabled={busy} onClick={() => void moderate(comment.id, "approved")}><Check size={16} weight="bold" aria-hidden="true" />Aprobar</button>}
              {comment.status === "pending" && <button type="button" className="button" disabled={busy} onClick={() => void moderate(comment.id, "hidden")}><EyeSlash size={16} aria-hidden="true" />Ocultar</button>}
              {comment.status === "approved" && <button type="button" className="button" disabled={busy} onClick={() => void moderate(comment.id, "hidden")}><EyeSlash size={16} aria-hidden="true" />Ocultar del sitio</button>}
              {comment.status === "hidden" && <button type="button" className="button" disabled={busy} onClick={() => void moderate(comment.id, "pending")}><ArrowCounterClockwise size={16} aria-hidden="true" />Volver a pendiente</button>}
              {confirming === comment.id
                ? <>
                  <button type="button" className="button danger" disabled={busy} onClick={async () => { if (await removeComment(comment.id)) setConfirming(""); }}><Trash size={16} aria-hidden="true" />Sí, eliminar</button>
                  <button type="button" className="button" disabled={busy} onClick={() => setConfirming("")}>Cancelar</button>
                </>
                : <button type="button" className="button" disabled={busy} onClick={() => setConfirming(comment.id)}><Trash size={16} aria-hidden="true" />Eliminar</button>}
            </div>
          </li>;
        })}</ul>
        : <EmptyState title="Nada por acá" text={empty[status]} />}
    </section>
  </>;
}
