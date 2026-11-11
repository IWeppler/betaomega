import test from "node:test";
import assert from "node:assert/strict";
import { seedCatalog, validateCatalog } from "../lib/catalog.ts";
import { importTonics, exportTonics } from "../lib/csv.ts";

test("el catálogo anterior sigue siendo válido sin precio por kg ni pasos", () => {
  assert.doesNotThrow(() => validateCatalog(structuredClone(seedCatalog)));
});
test("el peso de la presentación es entero y la importación CSV conserva el cálculo automático", () => {
  const catalog = structuredClone(seedCatalog);
  catalog.preparations[0].presentationWeightGrams = 250;
  assert.doesNotThrow(() => validateCatalog(catalog));
  assert.equal(importTonics(catalog, exportTonics(catalog)).catalog.preparations[0].presentationWeightGrams, 250);
  for (const grams of [0, -1, 1.5, "100", null, 1000001]) {
    catalog.preparations[0].presentationWeightGrams = grams;
    assert.throws(() => validateCatalog(catalog), /peso/);
  }
});
test("el precio por kg se valida en centavos enteros y permite cero o ausencia", () => {
  for (const price of [undefined, 0, 250050]) {
    const catalog = structuredClone(seedCatalog);
    catalog.plants[0].pricePerKgCents = price;
    assert.doesNotThrow(() => validateCatalog(catalog));
  }
  for (const price of [-1, 1.5, "2000", null, 90_000_000_000_001]) {
    const catalog = structuredClone(seedCatalog);
    catalog.plants[0].pricePerKgCents = price;
    assert.throws(() => validateCatalog(catalog), /kilogramo/);
  }
});
test("los pasos deben ser válidos y coincidir con el texto usado por el equipo", () => {
  const catalog = structuredClone(seedCatalog);
  const tonic = catalog.preparations[0];
  tonic.steps = ["Mezclar las hierbas.", "Dejar reposar."];
  tonic.instructions = tonic.steps.join("\n\n");
  assert.doesNotThrow(() => validateCatalog(catalog));
  tonic.instructions = "Otro texto";
  assert.throws(() => validateCatalog(catalog), /coincide/);
  for (const steps of [[], [""], ["x".repeat(10001)], Array(101).fill("Mezclar")]) {
    tonic.steps = steps;
    tonic.instructions = steps.join("\n\n");
    assert.throws(() => validateCatalog(catalog));
  }
});
