"use client";

import { Check, ExternalLink, EyeOff, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, PageHeader, useSite } from "@/platform/panel";
import { offerUndo } from "@/shared/ui/undo";
import { commentStatuses, type CommentStatus, type VoiceComment } from "../domain/comments";
import { Button, Choice, Notice } from "./panel-controls";

type Data = { comments: VoiceComment[]; voices: { id: string; name: string; slug: string }[] };
const when = (iso: string) => new Date(iso).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" });

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(data?.error ?? "No se pudo completar. Probá de nuevo.");
  return data as T;
}

const empty: Record<CommentStatus, string> = {
  pending: "No hay comentarios para revisar. Los nuevos aparecen acá antes de verse en el sitio.",
  approved: "Todavía no aprobaste ningún comentario.",
  hidden: "No hay comentarios ocultos.",
};

/** The panel's comments of the voces sagradas: nothing shows on the site until it is approved here. Every change offers Deshacer. */
export function CommentsScreen() {
  const site = useSite();
  const base = `/api/sites/${site.id}/voices/comments`;
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<CommentStatus>("pending");
  const [busy, setBusy] = useState(false);
  // The comment waiting for a second click on "Eliminar".
  const [confirming, setConfirming] = useState("");

  const load = useCallback(async () => {
    try { setData(await call<Data>(base)); setError(""); } catch (failure) { setError((failure as Error).message); }
  }, [base]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const setTo = async (comment: VoiceComment, next: CommentStatus, message: string) => {
    setBusy(true);
    try {
      const patch = (to: CommentStatus) => call<VoiceComment>(`${base}/${comment.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: to }) });
      await patch(next);
      await load();
      offerUndo(message, async () => { await patch(comment.status); await load(); });
    } catch (failure) { setError((failure as Error).message); } finally { setBusy(false); }
  };
  const remove = async (comment: VoiceComment) => {
    setBusy(true);
    try {
      await call(`${base}/${comment.id}`, { method: "DELETE" });
      setConfirming("");
      await load();
    } catch (failure) { setError((failure as Error).message); } finally { setBusy(false); }
  };

  const comments = data?.comments ?? [];
  const rows = comments.filter(comment => comment.status === status);
  const voiceOf = (comment: VoiceComment) => data?.voices.find(voice => voice.id === comment.voiceId);
  return <>
    <PageHeader title="Comentarios" description="Lo que escriben los lectores en las voces sagradas. Nada se ve en el sitio hasta que lo aprobás." />
    {error && <div className="mb-3 grid justify-items-start gap-2"><Notice>{error}</Notice><Button onClick={() => void load()}>Reintentar</Button></div>}
    {!data && !error && <p className="text-muted" aria-busy="true">Cargando…</p>}
    {data && <section className="grid gap-4" aria-label="Lista de comentarios">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Estado">
        {commentStatuses.map(each => <Choice key={each.id} pressed={status === each.id} onClick={() => { setStatus(each.id); setConfirming(""); }}>
          {each.label} ({comments.filter(comment => comment.status === each.id).length})
        </Choice>)}
      </div>
      {rows.length === 0
        ? <EmptyState title="Nada por acá" text={empty[status]} />
        : <ul className="m-0 grid list-none gap-3 p-0">
          {rows.map(comment => {
            const voice = voiceOf(comment);
            return <li key={comment.id} className="grid gap-3 rounded-card border border-line bg-surface p-4">
              <p className="m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <strong className="text-ink">{comment.name}</strong>
                <time className="text-sm text-muted" dateTime={comment.createdAt}>{when(comment.createdAt)}</time>
                {voice
                  ? <a href={`${site.url}/${voice.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-accent-text underline">{voice.name}<ExternalLink size={13} aria-label="(se abre en otra pestaña)" /></a>
                  : <span className="text-sm text-muted">Voz no publicada</span>}
              </p>
              <p className="m-0 whitespace-pre-line text-ink">{comment.body}</p>
              <div className="flex flex-wrap gap-2">
                {comment.status !== "approved" && <Button variant="primary" disabled={busy} onClick={() => void setTo(comment, "approved", "Se aprobó el comentario.")}><Check size={16} aria-hidden="true" />Aprobar</Button>}
                {comment.status !== "hidden" && <Button disabled={busy} onClick={() => void setTo(comment, "hidden", "Se ocultó el comentario.")}><EyeOff size={16} aria-hidden="true" />{comment.status === "approved" ? "Ocultar del sitio" : "Ocultar"}</Button>}
                {comment.status === "hidden" && <Button disabled={busy} onClick={() => void setTo(comment, "pending", "El comentario volvió a pendientes.")}><RotateCcw size={16} aria-hidden="true" />Volver a pendiente</Button>}
                {confirming === comment.id
                  ? <>
                    <Button variant="danger" disabled={busy} onClick={() => void remove(comment)}><Trash2 size={16} aria-hidden="true" />Sí, eliminar</Button>
                    <Button disabled={busy} onClick={() => setConfirming("")}>Cancelar</Button>
                  </>
                  : <Button disabled={busy} onClick={() => setConfirming(comment.id)}><Trash2 size={16} aria-hidden="true" />Eliminar</Button>}
              </div>
            </li>;
          })}
        </ul>}
    </section>}
  </>;
}
