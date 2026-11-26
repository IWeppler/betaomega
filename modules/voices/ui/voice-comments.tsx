"use client";

import { Send } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { maxCommentBody, maxCommentName, type VoiceComment } from "../domain/comments";

const when = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" });
const field = "w-full rounded-field border border-line bg-white px-4 text-lg text-ink transition-[border-color,box-shadow] duration-150 outline-none hover:border-line-strong focus:border-ink focus:ring-4 focus:ring-ink/8";

/**
 * The comments of a voice: the approved ones, the oldest first, and the form. A new comment waits for the panel's approval, so the form says so
 * and the list does not change at once. The name is required.
 */
export function VoiceComments({ siteId, voiceId, comments }: { siteId: string; voiceId: string; comments: Pick<VoiceComment, "id" | "name" | "body" | "createdAt">[] }) {
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  // When the form was shown: a script that sends it at once is not a person (the server checks).
  const startedAt = useRef(0);
  const honeypot = useRef<HTMLInputElement>(null);
  useEffect(() => { startedAt.current = Date.now(); }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setResult(null);
    try {
      const response = await fetch(`/api/sites/${siteId}/voices/comments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId, name, body, startedAt: startedAt.current, website: honeypot.current?.value ?? "" }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string; message?: string };
      if (!response.ok) { setResult({ ok: false, text: data.error || "No pudimos enviar tu comentario. Probá de nuevo." }); return; }
      setResult({ ok: true, text: data.message || "¡Gracias! Tu comentario se va a ver cuando lo revisemos." });
      setBody("");
      startedAt.current = Date.now();
    } catch { setResult({ ok: false, text: "No hay conexión. Probá de nuevo en un momento." }); } finally { setSending(false); }
  };

  return <section className="grid gap-8 border-t border-line pt-10" aria-labelledby="voice-comments">
    <h2 id="voice-comments" className="m-0 font-display text-3xl font-bold">Comentarios{comments.length > 0 && <span className="text-muted"> · {comments.length}</span>}</h2>
    {comments.length > 0
      ? <ol className="m-0 grid max-w-prose list-none gap-6 p-0">
        {comments.map(comment => <li key={comment.id} className="grid gap-1">
          <p className="m-0 flex flex-wrap items-baseline gap-x-3"><strong className="text-ink">{comment.name}</strong><time className="text-sm text-muted" dateTime={comment.createdAt}>{when(comment.createdAt)}</time></p>
          <p className="m-0 text-lg whitespace-pre-line">{comment.body}</p>
        </li>)}
      </ol>
      : <p className="m-0 text-lg text-muted">Todavía no hay comentarios. Podés dejar el primero.</p>}

    <form className="grid max-w-prose gap-4" onSubmit={event => void submit(event)}>
      <h3 className="m-0 font-display text-2xl font-bold">Dejá tu comentario</h3>
      <label className="grid gap-1.5">
        <span className="font-semibold text-ink">Tu nombre</span>
        <input className={`${field} h-12`} value={name} onChange={event => setName(event.target.value)} maxLength={maxCommentName} autoComplete="name" required />
      </label>
      <label className="grid gap-1.5">
        <span className="font-semibold text-ink">Comentario</span>
        <textarea className={`${field} py-3`} value={body} onChange={event => setBody(event.target.value)} rows={4} maxLength={maxCommentBody} required />
        <span className="justify-self-end text-sm text-muted">{body.length} / {maxCommentBody}</span>
      </label>
      {/* Honeypot: hidden from people and from screen readers; scripts tend to fill every field. */}
      <div className="absolute -left-[9999px] size-px overflow-hidden" aria-hidden="true"><label>No completar<input ref={honeypot} name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <p className="m-0 text-sm text-muted">Los comentarios se publican después de revisarlos. No se aceptan enlaces.</p>
      <div>
        <button type="submit" disabled={sending || !name.trim() || body.trim().length < 2}
          className="inline-flex min-h-14 items-center gap-3 rounded-full bg-ink px-8 text-lg font-semibold text-white transition-[background-color,scale] duration-150 hover:bg-ink/85 active:scale-[0.98] disabled:opacity-50 motion-reduce:active:scale-100">
          <Send size={20} aria-hidden="true" />{sending ? "Enviando…" : "Enviar comentario"}
        </button>
      </div>
      {result && <p className={`m-0 text-base font-semibold ${result.ok ? "text-success" : "text-danger"}`} role={result.ok ? "status" : "alert"}>{result.text}</p>}
    </form>
  </section>;
}
