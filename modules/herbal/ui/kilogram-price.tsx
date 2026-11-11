"use client";

import { useState } from "react";
import { centsFromPesos, pesosFromCents } from "@/platform/money";

export function HerbKilogramPrice({ cents }: { cents?: number }) {
  const [value, setValue] = useState(cents === undefined ? "" : pesosFromCents(cents));
  const invalid = Boolean(value.trim()) && centsFromPesos(value) === null;
  return <label className="flex flex-col gap-2 text-ink">
    <span className="font-medium">Precio por kg ($)</span>
    <input name="pricePerKg" inputMode="decimal" value={value} maxLength={24}
      aria-invalid={invalid} aria-describedby="kilogram-price-hint"
      className="min-h-control rounded-field border border-line bg-surface px-3 text-ink"
      onChange={event => setValue(event.target.value)} placeholder="Ej: 20000,50" />
    <small id="kilogram-price-hint" className={invalid ? "text-danger" : "text-muted"}>
      {invalid ? "Ingresá un importe con hasta dos decimales." : value.trim() ? "Valor de referencia por 1 kg para la fórmula del tónico." : "Sin precio por kg: los tónicos que usen esta hierba quedarán pendientes de calcular."}
    </small>
  </label>;
}
