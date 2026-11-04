"use client";

import { useId, useState } from "react";
import { X } from "@phosphor-icons/react";
import { cleanKeywords } from "@/lib/products";

/** The "Para qué sirve" list: Enter or a comma adds a word or phrase, and a pasted list adds one per line or comma. */
export function KeywordInput({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const id = useId();
  const add = (typed: string) => {
    setDraft("");
    const parts = typed.split(/[,\n]/);
    if (parts.some(part => part.trim())) onChange(cleanKeywords([...value, ...parts]));
  };
  return <div className="field">
    <label htmlFor={id}>Para qué sirve</label>
    <div className="category-input">
      {value.map(keyword => <span className="category-chip" key={keyword}>
        {keyword}
        <button type="button" aria-label={`Quitar ${keyword}`} onClick={() => onChange(value.filter(v => v !== keyword))}><X size={12} weight="bold" aria-hidden="true" /></button>
      </span>)}
      <input id={id} value={draft} maxLength={120} autoComplete="off" aria-describedby={`${id}-hint`}
        placeholder={value.length ? "Agregar otra" : "Escribí una palabra o frase"}
        onChange={e => setDraft(e.target.value)}
        onPaste={e => { const pasted = e.clipboardData.getData("text"); if (/[,\n]/.test(pasted)) { e.preventDefault(); add(draft + pasted); } }}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); }
          else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => add(draft)} />
    </div>
    <small id={`${id}-hint`}>Enter o coma para agregar. En el sitio público, la gente lo encuentra buscando estas frases.</small>
  </div>;
}
