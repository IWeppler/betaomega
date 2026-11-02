"use client";

import { useId, useState } from "react";
import { ClipboardText } from "@phosphor-icons/react";

/** "Pegar lista" button that opens a text box. `count` says how many rows the text would make; `onApply` adds them or replaces the existing ones. */
export function PasteList({ noun, nouns, hint, placeholder, count, hasRows, onApply }: {
  noun: string; nouns: string; hint: string; placeholder: string;
  count: (text: string) => number; hasRows: boolean; onApply: (text: string, replace: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const id = useId();
  const found = open ? count(text) : 0;
  const close = () => { setOpen(false); setText(""); };
  if (!open) return <button className="button" type="button" onClick={() => setOpen(true)}><ClipboardText size={16} aria-hidden="true" />Pegar lista</button>;
  const apply = (replace: boolean) => { onApply(text, replace); close(); };
  return <div className="paste-list">
    <label htmlFor={id}>Pegá {nouns} (por ejemplo, desde WhatsApp)</label>
    <textarea id={id} value={text} rows={6} placeholder={placeholder} autoFocus onChange={e => setText(e.target.value)} />
    <small>{hint}</small>
    <p className="paste-list-count" aria-live="polite">{found === 0 ? `Todavía no hay ${nouns} para agregar.` : `${found} ${found === 1 ? noun : nouns} para agregar.`}</p>
    <div className="form-actions">
      <button className="button" type="button" onClick={close}>Cancelar</button>
      {hasRows && <button className="button" type="button" disabled={!found} onClick={() => apply(true)}>Reemplazar los actuales</button>}
      <button className="button primary" type="button" disabled={!found} onClick={() => apply(false)}>{hasRows ? "Agregar al final" : "Agregar"}</button>
    </div>
  </div>;
}
