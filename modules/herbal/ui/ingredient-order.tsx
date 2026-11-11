"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { ingredientPercentages } from "../domain/formula";

export function IngredientOrder({ index, count, amounts, missingPrice, onMove }: {
  index: number; count: number; amounts: string[]; missingPrice: boolean; onMove: (to: number) => void;
}) {
  const percent = ingredientPercentages(amounts)[index];
  return <div className="flex items-center gap-2">
    <span className="text-sm text-muted">{percent === null ? "Proporción pendiente" : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(percent)} %`}</span>
    {missingPrice && <span className="text-sm text-warn-ink">Sin precio por kg</span>}
    <button type="button" className="inline-flex min-h-control min-w-control items-center justify-center rounded-control border border-line" disabled={index === 0} onClick={() => onMove(index - 1)} aria-label={`Subir ingrediente ${index + 1}`}><ArrowUp size={16} aria-hidden="true" /></button>
    <button type="button" className="inline-flex min-h-control min-w-control items-center justify-center rounded-control border border-line" disabled={index === count - 1} onClick={() => onMove(index + 1)} aria-label={`Bajar ingrediente ${index + 1}`}><ArrowDown size={16} aria-hidden="true" /></button>
  </div>;
}
