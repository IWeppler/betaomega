import test from "node:test";
import assert from "node:assert/strict";
import { adaptLegacyCatalog, legacyWeightGrams } from "./legacy-adaptation.ts";

test("solo las unidades métricas inequívocas se convierten a gramos", () => {
  for (const [unit, grams] of [["100 g", 100], ["1 kg", 1000], ["0,25 kg", 250], ["por kilogramo", 1000], ["250 gramos", 250]] as const) assert.equal(legacyWeightGrams(unit), grams);
  for (const unit of ["", "bolsita", "frasco 100", "100 ml", "1.000 g", "1/4 kg", "0 g", "0,5 g"]) assert.equal(legacyWeightGrams(unit), null);
});
test("se agrega precio por kg sin modificar los precios de venta anteriores ni sobrescribir datos nuevos", () => {
  const catalog = { plants: [
    { id: "a", name: "A", price: 2500, priceUnit: "100 g" },
    { id: "b", name: "B", price: 1000, priceUnit: "bolsita" },
    { id: "c", name: "C", price: 400, priceUnit: "100 g", pricePerKgCents: 999 },
    { id: "d", name: "D", price: 0, priceUnit: "kg" },
    { id: "e", name: "E", price: 0.001, priceUnit: "kg" },
  ], preparations: [] };
  const result = adaptLegacyCatalog(catalog);
  assert.equal(result.catalog.plants[0].pricePerKgCents, 2500000);
  assert.equal(result.catalog.plants[0].price, 2500);
  assert.equal(result.catalog.plants[1].pricePerKgCents, undefined);
  assert.equal(result.catalog.plants[2].pricePerKgCents, 999);
  assert.equal(result.catalog.plants[3].pricePerKgCents, 0);
  assert.equal(result.catalog.plants[4].pricePerKgCents, undefined);
  assert.equal(result.convertedKgPrices, 2);
  assert.equal(result.issues.length, 2);
  assert.equal(catalog.plants[0].pricePerKgCents, undefined);
});
test("la preparación anterior se conserva exactamente en un paso y los datos ambiguos quedan identificados", () => {
  const catalog = { plants: [{ id: "a", name: "A" }], preparations: [
    { id: "t", name: "T", instructions: " Mezclar.\n\nReposar. ", ingredients: [{ plantId: "a", amount: "2 partes" }] },
    { id: "u", name: "U", instructions: "", ingredients: [{ plantId: "a", amount: "" }] },
  ] };
  const result = adaptLegacyCatalog(catalog);
  assert.deepEqual(result.catalog.preparations[0].steps, [catalog.preparations[0].instructions]);
  assert.equal(result.catalog.preparations[1].steps, undefined);
  assert.equal(result.catalog.preparations[0].presentationWeightGrams, undefined);
  assert.equal(result.addedSteps, 1);
  assert.equal(result.recognizedFormulas, 1);
  assert.ok(result.issues.some(issue => issue.id === "u" && issue.field === "proporciones"));
  assert.ok(result.issues.some(issue => issue.id === "u" && issue.field === "preparación"));
  assert.deepEqual(adaptLegacyCatalog(result.catalog).catalog, result.catalog);
  assert.equal(adaptLegacyCatalog(result.catalog).addedSteps, 0);
});
test("el peso confirmado se aplica a las presentaciones faltantes y no reemplaza una ya configurada", () => {
  const catalog = { plants: [], preparations: [
    { id: "a", name: "A", instructions: "Mezclar.", ingredients: [] },
    { id: "b", name: "B", instructions: "Reposar.", ingredients: [], presentationWeightGrams: 250 },
  ] };
  const result = adaptLegacyCatalog(catalog, { presentationGrams: 1000 });
  assert.equal(result.catalog.preparations[0].presentationWeightGrams, 1000);
  assert.equal(result.catalog.preparations[1].presentationWeightGrams, 250);
  assert.equal(result.assignedPresentations, 1);
  assert.ok(!result.issues.some(issue => issue.field === "presentación"));
  assert.equal(adaptLegacyCatalog(result.catalog, { presentationGrams: 1000 }).assignedPresentations, 0);
  assert.throws(() => adaptLegacyCatalog(catalog, { presentationGrams: 0 }));
});
