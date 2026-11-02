"use client";

import { useId, useState } from "react";
import { X } from "@phosphor-icons/react";
import { categoryKey, canonicalCategory } from "@/lib/recipes";

const maxCategories = 12;

/** Category chips. What is typed is matched with the site's existing categories (ignoring case and accents), so the same category is never created twice. */
export function CategoryInput({ value, onChange, suggestions }: { value: string[]; onChange: (value: string[]) => void; suggestions: string[] }) {
  const [draft, setDraft] = useState("");
  const listId = useId();
  const add = (typed: string) => {
    const label = canonicalCategory(typed, suggestions.concat(value));
    setDraft("");
    if (!label || value.some(v => categoryKey(v) === categoryKey(label))) return;
    if (value.length < maxCategories) onChange([...value, label]);
  };
  const available = suggestions.filter(s => !value.some(v => categoryKey(v) === categoryKey(s)));
  return <div className="field">
    <label htmlFor={`${listId}-input`}>Categorías</label>
    <div className="category-input">
      {value.map(label => <span className="category-chip" key={label}>
        {label}
        <button type="button" aria-label={`Quitar la categoría ${label}`} onClick={() => onChange(value.filter(v => v !== label))}><X size={12} weight="bold" aria-hidden="true" /></button>
      </span>)}
      <input id={`${listId}-input`} list={listId} value={draft} maxLength={40} disabled={value.length >= maxCategories} autoComplete="off"
        placeholder={value.length ? "Agregar otra" : "Postres, sin TACC…"}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); }
          else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => add(draft)} />
      <datalist id={listId}>{available.map(s => <option key={s} value={s} />)}</datalist>
    </div>
    <small>Escribí y apretá Enter o coma. Si ya existe una parecida (Postres, postres), se usa esa.</small>
  </div>;
}
