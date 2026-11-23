"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { ingredientPercentages } from "../domain/formula";

export function IngredientOrder({ index, count, amounts, missingPrice, onMove, onRemove }: {
  index: number; count: number; amounts: string[]; missingPrice: boolean; onMove: (to: number) => void; onRemove?: () => void;
}) {
  const percent = ingredientPercentages(amounts)[index];
  const actionClass = "inline-flex min-h-control min-w-control items-center justify-center rounded-control text-muted transition-colors hover:bg-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-30";
  return <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
    <div className="grid gap-0.5">
      <span className="text-xs text-muted">{percent === null ? "Proporción pendiente" : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(percent)} % de la mezcla`}</span>
      {missingPrice && <span className="text-xs text-warn-ink">Sin precio por kg</span>}
    </div>
    <div className="ml-auto flex items-center gap-1">
      <button type="button" className={actionClass} disabled={index === 0} onClick={() => onMove(index - 1)} aria-label={`Subir ingrediente ${index + 1}`}><ArrowUp size={16} aria-hidden="true" /></button>
      <button type="button" className={actionClass} disabled={index === count - 1} onClick={() => onMove(index + 1)} aria-label={`Bajar ingrediente ${index + 1}`}><ArrowDown size={16} aria-hidden="true" /></button>
      {onRemove && <button type="button" className={`${actionClass} ml-1 border-l border-line hover:text-danger`} onClick={onRemove} aria-label={`Quitar hierba ${index + 1}`}><Trash2 size={16} aria-hidden="true" /></button>}
    </div>
  </div>;
}
