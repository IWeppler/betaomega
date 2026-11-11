"use client";

import { useState } from "react";
import { storeToday, type Plant, type Preparation } from "@/lib/catalog";

// Form pieces shared by the panel and the team page.
export const proportions = [
  "0.5 partes",
  "1 parte",
  "1.5 partes",
  "2 partes",
  "2.5 partes",
  "3 partes",
  "4 partes",
  "5 partes",
  "6 partes",
  "7 partes",
  "8 partes",
  "9 partes",
  "10 partes",
];
export const splitTags = (text: string) => [
  ...new Set(
    text
      .split(/[,\n]/)
      .map((t) => t.trim())
      .filter(Boolean),
  ),
];
export const blankTonic = (): Preparation => ({
  id: crypto.randomUUID(),
  name: "",
  uses: [],
  aliases: [],
  ingredients: [],
  instructions: "",
  warnings: "",
  notes: "",
  published: false,
  avoid: [],
});
export const newHerb = (name: string): Plant => ({
  id: crypto.randomUUID(),
  name,
  scientificName: "",
  properties: "",
  uses: [],
  aliases: [],
  warnings: "",
  notes: "",
  published: true,
});

export const parsePrice = (value: string) => {
  const number = Number(value.replace(",", "."));
  return value.trim() && Number.isFinite(number) && number >= 0
    ? number
    : undefined;
};
export function PriceFields({
  item,
  automatic = false,
}: {
  automatic?: boolean;
  item: {
    price?: number;
    priceUnit?: string;
    promoPrice?: number;
    promoUntil?: string;
    hidden?: boolean;
  };
}) {
  const [price, setPrice] = useState(String(item.price ?? ""));
  const [promo, setPromo] = useState(String(item.promoPrice ?? ""));
  const [until, setUntil] = useState(item.promoUntil ?? "");
  const base = parsePrice(price);
  const sale = parsePrice(promo);
  // Saved anyway (so lowering prices in bulk never blocks a save), but it does not apply.
  const promoWarning = automatic
    ? ""
    : sale === undefined
      ? ""
      : base === undefined
        ? "Esta oferta no se aplica porque el producto no tiene precio."
        : sale >= base
          ? "Esta oferta no se aplica: tiene que ser menor al precio de venta."
          : until && until < storeToday()
            ? "Esta oferta ya venció: no se muestra en la tienda."
            : "";
  return (
    <>
      <div className={automatic ? "hidden" : "form-grid"}>
        <label className="field">
          <span>Precio de venta ($)</span>
          <input
            name="price"
            disabled={automatic}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Ej: 2500"
          />
        </label>
        <label className="field">
          <span>El precio es por</span>
          <input
            name="priceUnit"
            disabled={automatic}
            defaultValue={item.priceUnit ?? ""}
            maxLength={50}
            placeholder="Ej: 100 g, bolsita"
          />
          <small>Opcional. Sin precio, la ficha no muestra ninguno.</small>
        </label>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>Precio de oferta ($)</span>
          <input
            name="promoPrice"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={promo}
            onChange={(e) => setPromo(e.target.value)}
            placeholder="Opcional"
            aria-describedby="promo-hint"
          />
          <small
            id="promo-hint"
            className={promoWarning ? "field-warning" : undefined}
          >
            {promoWarning ||
              (automatic
                ? "La oferta se compara con el precio calculado al guardar."
                : "Opcional. Se muestra el precio normal tachado. Solo aplica a compras sueltas, no dentro de un combo.")}
          </small>
        </label>
        <label className="field">
          <span>Oferta válida hasta</span>
          <input
            name="promoUntil"
            type="date"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
          <small>Vacío: sin fecha de fin.</small>
        </label>
      </div>
      <label className="check store-visible">
        <input type="checkbox" name="visible" defaultChecked={!item.hidden} />
        Visible en la tienda
      </label>
    </>
  );
}
export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "No se pudo completar la operación.");
  return data;
}
export function Field({
  label,
  name,
  value = "",
  multiline = false,
  required = false,
  hint,
  rows = 3,
}: {
  label: string;
  name: string;
  value?: string;
  multiline?: boolean;
  required?: boolean;
  hint?: string;
  rows?: number;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <span className="required-tag">Obligatorio</span>}
      </span>
      {multiline ? (
        <textarea
          name={name}
          defaultValue={value}
          rows={rows}
          maxLength={10000}
          required={required}
        />
      ) : (
        <input
          name={name}
          defaultValue={value}
          maxLength={10000}
          required={required}
        />
      )}
      {hint && <small>{hint}</small>}
    </label>
  );
}
