"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { PaperPlaneTilt } from "@phosphor-icons/react";
import { maxCommentBody, maxCommentName } from "@/lib/comments";

/** Leave a comment. The result appears right under the button; the comment shows on the page once it is approved. */
export function CommentForm({ siteId, recipeId }: { siteId: string; recipeId: string }) {
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
      const response = await fetch(`/api/sites/${siteId}/recipes/${recipeId}/comments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, body, startedAt: startedAt.current, website: honeypot.current?.value ?? "" }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string; message?: string };
      if (!response.ok) { setResult({ ok: false, text: data.error || "No pudimos enviar tu comentario. Probá de nuevo." }); return; }
      setResult({ ok: true, text: data.message || "¡Gracias! Tu comentario se va a ver cuando lo revisemos." });
      setBody("");
      startedAt.current = Date.now();
    } catch { setResult({ ok: false, text: "No hay conexión. Probá de nuevo en un momento." }); } finally { setSending(false); }
  };
  return <form className="r-comment-form" onSubmit={e => void submit(e)}>
    <h3>Dejá tu comentario</h3>
    <label>
      <span>Tu nombre <small>(opcional)</small></span>
      <input value={name} onChange={e => setName(e.target.value)} maxLength={maxCommentName} autoComplete="given-name" />
    </label>
    <label>
      <span>Comentario</span>
      <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} maxLength={maxCommentBody} required placeholder="¿Cómo te salió? ¿Le cambiaste algo?" />
      <small>{body.length} / {maxCommentBody}</small>
    </label>
    {/* Honeypot: hidden from people and from screen readers; scripts tend to fill every field. */}
    <div className="r-hp" aria-hidden="true"><label>No completar<input ref={honeypot} name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <button type="submit" className="r-button r-primary" disabled={sending || body.trim().length < 2}>
      <PaperPlaneTilt size={18} aria-hidden="true" />{sending ? "Enviando…" : "Enviar comentario"}
    </button>
    <p className={result?.ok ? "r-form-ok" : "r-form-error"} role={result?.ok === false ? "alert" : "status"}>{result?.text}</p>
  </form>;
}
