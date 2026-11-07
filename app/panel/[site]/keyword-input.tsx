"use client";

import { useId, useState } from "react";
import { Plus, X } from "@phosphor-icons/react";
import { normalize } from "@/lib/catalog";
import { cleanKeywords } from "@/lib/products";

/**
 * The "Para qué sirve" list as a combobox: focusing it lists the phrases already used on the site, typing filters them,
 * and when none matches it offers to create the new one. Enter or a comma adds, and a pasted list adds one per line or comma.
 */
export function KeywordInput({ value, onChange, suggestions }: { value: string[]; onChange: (value: string[]) => void; suggestions: string[] }) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();
  const add = (typed: string) => {
    setDraft("");
    setActive(0);
    const parts = typed.split(/[,\n]/);
    if (parts.some(part => part.trim())) onChange(cleanKeywords([...value, ...parts]));
  };
  const key = normalize(draft);
  const taken = new Set(value.map(normalize));
  const seen = new Set<string>();
  const matches = suggestions.filter(s => {
    const k = normalize(s);
    if (!k || seen.has(k) || taken.has(k) || !k.includes(key)) return false;
    seen.add(k);
    return true;
  });
  const creatable = key !== "" && !taken.has(key) && !seen.has(key) && !suggestions.some(s => normalize(s) === key);
  const options = matches.length === 0 && creatable ? [{ label: draft.replace(/\s+/g, " ").trim(), create: true }] : matches.map(label => ({ label, create: false }));
  const current = Math.min(active, Math.max(options.length - 1, 0));
  return <div className="field">
    <label htmlFor={`${id}-input`}>Para qué sirve</label>
    <div className="category-input combo">
      {value.map(keyword => <span className="category-chip" key={keyword}>
        {keyword}
        <button type="button" aria-label={`Quitar ${keyword}`} onClick={() => onChange(value.filter(v => v !== keyword))}><X size={12} weight="bold" aria-hidden="true" /></button>
      </span>)}
      <input id={`${id}-input`} role="combobox" aria-expanded={open && options.length > 0} aria-controls={`${id}-list`} aria-autocomplete="list"
        aria-activedescendant={open && options.length > 0 ? `${id}-opt-${current}` : undefined}
        value={draft} maxLength={120} autoComplete="off" aria-describedby={`${id}-hint`}
        placeholder={value.length ? "Agregar otra" : "Escribí una palabra o frase"}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={e => { setDraft(e.target.value); setActive(0); setOpen(true); }}
        onPaste={e => { const pasted = e.clipboardData.getData("text"); if (/[,\n]/.test(pasted)) { e.preventDefault(); add(draft + pasted); } }}
        onKeyDown={e => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive(Math.min(current + 1, options.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive(Math.max(current - 1, 0)); }
          else if (e.key === "Escape") { if (open) { e.preventDefault(); e.stopPropagation(); setOpen(false); } }
          else if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            if (e.key === "Enter" && open && options[current]) add(options[current].label); else add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => { setOpen(false); add(draft); }} />
      {open && options.length > 0 && <ul className="combo-list" id={`${id}-list`} role="listbox" aria-label="Para qué sirve">
        {options.map((option, n) => <li key={option.label} id={`${id}-opt-${n}`} role="option" aria-selected={n === current} className={n === current ? "active" : undefined}
          onMouseDown={e => e.preventDefault()} onMouseEnter={() => setActive(n)} onClick={() => add(option.label)}>
          {option.create ? <><Plus size={14} weight="bold" aria-hidden="true" /> Crear «{option.label}»</> : option.label}
        </li>)}
      </ul>}
    </div>
    <small id={`${id}-hint`}>Enter o coma para agregar. En el sitio público, la gente lo encuentra buscando estas frases.</small>
  </div>;
}
