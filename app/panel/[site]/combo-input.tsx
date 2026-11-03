"use client";

import { useId, useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { categoryKey } from "@/lib/recipes";

/**
 * Single-value text field with the same combobox as the type chips: focusing it lists the existing values,
 * typing filters them, and when none matches it offers to create the typed one. The value is submitted with the form under `name`.
 */
export function ComboInput({ label, name, value, onChange, suggestions, placeholder, hint, maxLength = 40, createLabel = "Crear" }: {
  label: string; name: string; value: string; onChange: (value: string) => void; suggestions: string[];
  placeholder?: string; hint?: string; maxLength?: number; createLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const key = categoryKey(value);
  const matches = suggestions.filter(s => categoryKey(s).includes(key));
  const exact = suggestions.some(s => categoryKey(s) === key);
  const options = matches.length === 0 && key !== "" && !exact
    ? [{ label: value.replace(/\s+/g, " ").trim(), create: true }]
    : matches.map(s => ({ label: s, create: false }));
  const current = Math.min(active, Math.max(options.length - 1, 0));
  const pick = (picked: string) => { onChange(picked); setOpen(false); setActive(0); };
  return <div className="field">
    <label htmlFor={`${listId}-input`}>{label}</label>
    <div className="combo-field">
      <input id={`${listId}-input`} name={name} role="combobox" aria-expanded={open && options.length > 0} aria-controls={`${listId}-list`} aria-autocomplete="list"
        aria-activedescendant={open && options.length > 0 ? `${listId}-opt-${current}` : undefined}
        value={value} maxLength={maxLength} autoComplete="off" placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={e => { onChange(e.target.value); setActive(0); setOpen(true); }}
        onBlur={() => setOpen(false)}
        onKeyDown={e => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive(Math.min(current + 1, options.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive(Math.max(current - 1, 0)); }
          else if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
          else if (e.key === "Enter" && open && options[current]) { e.preventDefault(); pick(options[current].label); }
        }} />
      {open && options.length > 0 && <ul className="combo-list" id={`${listId}-list`} role="listbox" aria-label={label}>
        {options.map((option, n) => <li key={option.label} id={`${listId}-opt-${n}`} role="option" aria-selected={n === current} className={n === current ? "active" : undefined}
          onMouseDown={e => e.preventDefault()} onMouseEnter={() => setActive(n)} onClick={() => pick(option.label)}>
          {option.create ? <><Plus size={14} weight="bold" aria-hidden="true" /> {createLabel} «{option.label}»</> : option.label}
        </li>)}
      </ul>}
    </div>
    {hint && <small>{hint}</small>}
  </div>;
}
