import { isCents } from "../../../platform/money/index.ts";
import { partsOf } from "./pricing.ts";

type LegacyHerb = { id: string; name: string; price?: number; priceUnit?: string; pricePerKgCents?: number };
type LegacyTonic = { id: string; name: string; instructions: string; steps?: string[]; ingredients: { plantId: string; amount: string }[]; presentationWeightGrams?: number };
export type AdaptationIssue = { kind: "hierba" | "tónico"; id: string; name: string; field: string; reason: string };

/** Only explicit metric weights. Dots and fractions are ambiguous in historic free-text units. */
export function legacyWeightGrams(unit: string): number | null {
  const match = /^(?:por\s+)?(?:(\d{1,7}(?:,\d{1,3})?)\s*)?(kg|kilo|kilos|kilogramo|kilogramos|g|gr|gramo|gramos)$/i.exec(unit.trim());
  if (!match) return null;
  const [whole, fraction = ""] = (match[1] ?? "1").split(",");
  const thousandths = BigInt(whole) * BigInt(1000) + BigInt(fraction.padEnd(3, "0"));
  const grams = /^k/i.test(match[2]) ? thousandths : thousandths % BigInt(1000) === BigInt(0) ? thousandths / BigInt(1000) : BigInt(0);
  return grams >= BigInt(1) && grams <= BigInt(1000000) ? Number(grams) : null;
}

export function adaptLegacyCatalog<T extends { plants: LegacyHerb[]; preparations: LegacyTonic[] }>(catalog: T, options: { presentationGrams?: number } = {}) {
  if (options.presentationGrams !== undefined && (!Number.isSafeInteger(options.presentationGrams) || options.presentationGrams < 1 || options.presentationGrams > 1000000)) throw new Error("El peso confirmado debe ser un entero entre 1 y 1.000.000 gramos.");
  const issues: AdaptationIssue[] = [];
  let convertedKgPrices = 0;
  let addedSteps = 0;
  let recognizedFormulas = 0;
  let assignedPresentations = 0;
  const plants = catalog.plants.map(herb => {
    if (herb.pricePerKgCents !== undefined) return { ...herb };
    const issue = (reason: string) => issues.push({ kind: "hierba", id: herb.id, name: herb.name, field: "precio por kg", reason });
    if (herb.price === undefined) { issue("Falta cargar el precio por kg; no hay precio anterior para convertir."); return { ...herb }; }
    const grams = legacyWeightGrams(herb.priceUnit ?? "");
    if (grams === null) { issue("La unidad anterior no identifica un peso métrico inequívoco."); return { ...herb }; }
    const cents = Math.round(herb.price * 100);
    if (!isCents(cents) || cents / 100 !== herb.price) { issue("El precio anterior no representa centavos enteros válidos."); return { ...herb }; }
    const numerator = BigInt(cents) * BigInt(1000);
    const perKg = Number((numerator * BigInt(2) + BigInt(grams)) / (BigInt(grams) * BigInt(2)));
    if (!isCents(perKg)) { issue("El precio convertido supera el límite admitido."); return { ...herb }; }
    convertedKgPrices++;
    return { ...herb, pricePerKgCents: perKg };
  });
  const preparations = catalog.preparations.map(tonic => {
    const issue = (field: string, reason: string) => issues.push({ kind: "tónico", id: tonic.id, name: tonic.name, field, reason });
    const adapted = { ...tonic };
    if (tonic.steps === undefined) {
      if (tonic.instructions.trim()) { adapted.steps = [tonic.instructions]; addedSteps++; }
      else issue("preparación", "Falta cargar la preparación; no se inventaron pasos.");
    }
    const invalid = tonic.ingredients.filter(ingredient => partsOf(ingredient.amount) === null);
    if (tonic.ingredients.length && !invalid.length) recognizedFormulas++;
    else issue("proporciones", "Faltan partes o hay cantidades ambiguas; revisar cada ingrediente.");
    if (tonic.presentationWeightGrams === undefined) {
      if (options.presentationGrams === undefined) issue("presentación", "Confirmar el peso antes de activar el cálculo automático; se conserva el modo anterior.");
      else { adapted.presentationWeightGrams = options.presentationGrams; assignedPresentations++; }
    }
    return adapted;
  });
  return { catalog: { ...catalog, plants, preparations }, issues, convertedKgPrices, addedSteps, recognizedFormulas, assignedPresentations };
}
