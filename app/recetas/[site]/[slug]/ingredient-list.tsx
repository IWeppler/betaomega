"use client";

import { useState } from "react";
import type { Ingredient } from "@/lib/recipes";

/** Ingredients as a checklist: tick what is already on the counter. Nothing is stored. */
export function IngredientList({ ingredients }: { ingredients: Ingredient[] }) {
  const [done, setDone] = useState<Set<number>>(new Set());
  const toggle = (n: number) => setDone(current => {
    const next = new Set(current);
    if (next.has(n)) next.delete(n); else next.add(n);
    return next;
  });
  return <ul className="r-checklist">
    {ingredients.map((item, n) => <li key={n}>
      <label>
        <input type="checkbox" checked={done.has(n)} onChange={() => toggle(n)} />
        <span>{item.amount && <strong>{item.amount}</strong>} {item.name}</span>
      </label>
    </li>)}
  </ul>;
}
