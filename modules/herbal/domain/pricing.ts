import { isCents } from "../../../platform/money/index.ts";

export type FormulaHerb = { id: string; name: string; pricePerKgCents?: number };
export type FormulaIngredient = { plantId: string; amount: string };
type FormulaTonic = { ingredients: FormulaIngredient[]; presentationWeightGrams?: number; calculatedPriceCents?: number; price?: number; priceUnit?: string };
export type FormulaPrice = { error: string } | { perKgCents: number; presentationCents: number; contributions: { name: string; perKgCents: number }[] };

/** Decimal parts become exact integer weights with up to six decimal places. */
export function partsOf(amount: string): bigint | null {
  const match = /^(\d{1,6})(?:[.,](\d{1,6}))?\s+partes?$/i.exec(amount.trim());
  if (!match) return null;
  const parts = BigInt(match[1]) * BigInt(1000000) + BigInt((match[2] ?? "").padEnd(6, "0"));
  return parts > BigInt(0) ? parts : null;
}
const rounded = (numerator: bigint, denominator: bigint) => (numerator * BigInt(2) + denominator) / (denominator * BigInt(2));

export function formulaPrice(herbs: FormulaHerb[], ingredients: FormulaIngredient[], grams: number): FormulaPrice {
  if (!Number.isSafeInteger(grams) || grams < 1 || grams > 1000000) return { error: "Ingresá un peso entero entre 1 y 1.000.000 g." };
  if (!ingredients.length || ingredients.length > 100) return { error: "Agregá entre 1 y 100 hierbas." };
  const rows: { name: string; parts: bigint; cents: bigint }[] = [];
  const seen = new Set<string>();
  for (const ingredient of ingredients) {
    const herb = herbs.find(item => item.id === ingredient.plantId);
    if (!herb) return { error: "Elegí una hierba existente y cargá su precio por kg." };
    if (seen.has(herb.id)) return { error: "Hay una hierba repetida en la fórmula." };
    seen.add(herb.id);
    if (!isCents(herb.pricePerKgCents)) return { error: `Cargá el precio por kg de ${herb.name}.` };
    const parts = partsOf(ingredient.amount);
    if (parts === null) return { error: `Revisá las partes de ${herb.name}: usá un número positivo con hasta seis decimales.` };
    rows.push({ name: herb.name, parts, cents: BigInt(herb.pricePerKgCents) });
  }
  const totalParts = rows.reduce((sum, row) => sum + row.parts, BigInt(0));
  const numerator = rows.reduce((sum, row) => sum + row.cents * row.parts, BigInt(0));
  const perKg = rounded(numerator, totalParts);
  // Round the presentation directly from the exact formula, never from the rounded kilogram price.
  const presentation = rounded(numerator * BigInt(grams), totalParts * BigInt(1000));
  if (presentation > BigInt(10000000000)) return { error: "El precio calculado supera el máximo admitido por el catálogo." };
  const contributions = rows.map(row => ({ name: row.name, cents: row.cents * row.parts / totalParts, remainder: row.cents * row.parts % totalParts }));
  let remaining = perKg - contributions.reduce((sum, row) => sum + row.cents, BigInt(0));
  // Distribute rounding cents so the displayed contributions add up to the kilogram total.
  for (const row of [...contributions].sort((a, b) => a.remainder > b.remainder ? -1 : a.remainder < b.remainder ? 1 : 0)) {
    if (remaining === BigInt(0)) break;
    row.cents++;
    remaining--;
  }
  return { perKgCents: Number(perKg), presentationCents: Number(presentation), contributions: contributions.map(row => ({ name: row.name, perKgCents: Number(row.cents) })) };
}

/**
 * Recompute every tonic after any catalogue edit, ignoring browser-supplied prices and units.
 * A tonic has a single price: the kilogram price of its formula. The seller picks the quantity in /equipo.
 */
export function resolveCatalogPrices<T extends { plants: FormulaHerb[]; preparations: FormulaTonic[] }>(catalog: T): T {
  return { ...catalog, preparations: catalog.preparations.map(tonic => {
    const result = formulaPrice(catalog.plants, tonic.ingredients, 1000);
    const calculatedPriceCents = "error" in result ? undefined : result.perKgCents;
    return { ...tonic, calculatedPriceCents, price: calculatedPriceCents === undefined ? undefined : calculatedPriceCents / 100, priceUnit: "kg" };
  }) };
}
