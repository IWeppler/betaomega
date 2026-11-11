"use client";

import { formulaPrice, type FormulaHerb, type FormulaIngredient } from "../domain/pricing";
import { formatCents } from "@/platform/money";

export function FormulaPricing({ herbs, ingredients, grams, onChange }: {
  herbs: FormulaHerb[]; ingredients: FormulaIngredient[]; grams?: number; onChange: (grams: number | undefined) => void;
}) {
  const result = grams === undefined ? null : formulaPrice(herbs, ingredients, grams);
  return <fieldset className="flex min-w-0 flex-col gap-3 rounded-card border border-line p-4">
    <legend className="px-2 font-medium">Precio del tónico</legend>
    <label className="flex min-h-control items-center gap-2">
      <input type="checkbox" checked={grams !== undefined} onChange={event => onChange(event.target.checked ? 1000 : undefined)} />
      Calcular según las hierbas
    </label>
    {grams === undefined ? <p className="text-sm text-muted">Se conserva el precio de venta cargado. Activá el cálculo para elegir una presentación por peso.</p> : <>
      <label className="flex flex-col gap-2"><span>Peso de la presentación (g)</span>
        <input name="presentationWeightGrams" type="number" inputMode="numeric" min={1} max={1000000} step={1} required
          className="min-h-control w-full rounded-field border border-line bg-surface px-3 text-ink"
          value={grams || ""} onChange={event => onChange(Number(event.target.value))} />
      </label>
      <div aria-live="polite" className="flex flex-col gap-2">
        {result && "error" in result ? <p className="text-sm text-warn-ink">Pendiente de calcular: {result.error}</p> : result && <>
          <ul className="flex flex-col gap-2 text-sm">{result.contributions.map((row, index) => <li key={index} className="flex flex-wrap justify-between gap-2"><span>{row.name}</span><span>{formatCents(row.perKgCents)} por kg de mezcla</span></li>)}</ul>
          <p className="border-t border-line pt-2">Total por kg: <strong>{formatCents(result.perKgCents)}</strong></p>
          <p>Precio por {grams === 1000 ? "1 kg" : `${grams} g`}: <strong>{formatCents(result.presentationCents)}</strong></p>
        </>}
      </div>
      <p className="text-sm text-muted">Suma proporcional de las hierbas.</p>
    </>}
  </fieldset>;
}
