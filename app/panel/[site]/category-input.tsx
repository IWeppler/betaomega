"use client";

import { useId, useState } from "react";
import { Plus, X } from "@phosphor-icons/react";
import { categoryKey, canonicalCategory } from "@/lib/recipes";

const maxCategories = 12;

/**
 * Type chips with a combobox: opening it lists the site's existing types, typing filters them, and when none matches
 * it offers to create the new one. Types are stored in capitals; what is typed is matched ignoring case and accents,
 * so the same type is never created twice.
 */
export function CategoryInput({ value, onChange, suggestions }: { value: string[]; onChange: (value: string[]) => void; suggestions: string[] }) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const add = (typed: string) => {
    const label = canonicalCategory(typed, suggestions.concat(value));
    setDraft("");
    setActive(0);
    if (!label || value.some(v => categoryKey(v) === categoryKey(label))) return;
    if (value.length < maxCategories) onChange([...value, label]);
  };
  const key = categoryKey(draft);
  const taken = (label: string) => value.some(v => categoryKey(v) === categoryKey(label));
  const seen = new Set<string>();
  const matches = suggestions
    .map(s => s.toLocaleUpperCase("es"))
    .filter(s => { const k = categoryKey(s); if (seen.has(k) || taken(s) || !categoryKey(s).includes(key)) return false; seen.add(k); return true; });
  const creatable = key !== "" && !taken(draft) && !suggestions.some(s => categoryKey(s) === key);
  const options = matches.length === 0 && creatable ? [{ label: draft.replace(/\s+/g, " ").trim().toLocaleUpperCase("es"), create: true }] : matches.map(label => ({ label, create: false }));
  const current = Math.min(active, Math.max(options.length - 1, 0));
  const full = value.length >= maxCategories;
  return <div className="field">
    <label htmlFor={`${listId}-input`}>Tipos</label>
    <div className="category-input combo">
      {value.map(label => <span className="category-chip" key={label}>
        {label}
        <button type="button" aria-label={`Quitar el tipo ${label}`} onClick={() => onChange(value.filter(v => v !== label))}><X size={12} weight="bold" aria-hidden="true" /></button>
      </span>)}
      <input id={`${listId}-input`} role="combobox" aria-expanded={open && options.length > 0} aria-controls={`${listId}-list`} aria-autocomplete="list"
        aria-activedescendant={open && options.length > 0 ? `${listId}-opt-${current}` : undefined}
        value={draft} maxLength={40} disabled={full} autoComplete="off"
        placeholder={value.length ? "Agregar otro" : "Salsas, Pastas, Panes…"}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={e => { setDraft(e.target.value); setActive(0); setOpen(true); }}
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
      {open && !full && options.length > 0 && <ul className="combo-list" id={`${listId}-list`} role="listbox" aria-label="Tipos">
        {options.map((option, n) => <li key={option.label} id={`${listId}-opt-${n}`} role="option" aria-selected={n === current} className={n === current ? "active" : undefined}
          onMouseDown={e => e.preventDefault()} onMouseEnter={() => setActive(n)} onClick={() => { add(option.label); }}>
          {option.create ? <><Plus size={14} weight="bold" aria-hidden="true" /> Crear tipo «{option.label}»</> : option.label}
        </li>)}
      </ul>}
    </div>
    <small>Tocá el campo para ver los tipos que ya existen. Se guardan en mayúsculas.</small>
  </div>;
}
