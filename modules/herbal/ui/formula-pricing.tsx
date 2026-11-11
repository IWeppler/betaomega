"use client";

import { formulaPrice, type FormulaHerb, type FormulaIngredient } from "../domain/pricing";
import { formatCents } from "@/platform/money";

/** The tonic's single price: the kilogram price of its formula. The seller sets the quantity in /equipo. */
export function FormulaPricing({ herbs, ingredients }: { herbs: FormulaHerb[]; ingredients: FormulaIngredient[] }) {
  const result = formulaPrice(herbs, ingredients, 1000);
  return <fieldset className="flex min-w-0 flex-col gap-3 rounded-card border border-line p-4">
    <legend className="px-2 font-medium">Precio del tónico</legend>
    <div aria-live="polite" className="flex flex-col gap-2">
      {"error" in result ? <p className="text-sm text-warn-ink">Pendiente de calcular: {result.error}</p> : <>
        <ul className="flex flex-col gap-2 text-sm">{result.contributions.map((row, index) => <li key={index} className="flex flex-wrap justify-between gap-2"><span>{row.name}</span><span>{formatCents(row.perKgCents)} por kg de mezcla</span></li>)}</ul>
        <p className="border-t border-line pt-2">Precio por kg: <strong>{formatCents(result.perKgCents)}</strong></p>
      </>}
    </div>
    <p className="text-sm text-muted">Suma proporcional de las hierbas. Es el único precio del tónico; el vendedor elige la cantidad en el equipo.</p>
  </fieldset>;
}
