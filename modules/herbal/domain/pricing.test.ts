import test from "node:test";
import assert from "node:assert/strict";
import { formulaPrice, resolveCatalogPrices } from "./pricing.ts";

const herbs = [
  { id: "a", name: "Menta", pricePerKgCents: 2000000 },
  { id: "b", name: "Manzanilla", pricePerKgCents: 3000000 },
  { id: "c", name: "Melisa", pricePerKgCents: 4000000 },
];
const ingredients = [{ plantId: "a", amount: "2 partes" }, { plantId: "b", amount: "1 parte" }, { plantId: "c", amount: "1 parte" }];

test("el tónico suma los aportes por kg y aplica el peso de su presentación", () => {
  const result = formulaPrice(herbs, ingredients, 100);
  assert.ok(!("error" in result));
  assert.equal(result.perKgCents, 2750000);
  assert.equal(result.presentationCents, 275000);
  assert.deepEqual(result.contributions.map(row => row.perKgCents), [1000000, 750000, 1000000]);
  const quarter = formulaPrice(herbs, ingredients, 250);
  assert.ok(!("error" in quarter));
  assert.equal(quarter.presentationCents, 687500);
});
test("la falta de precios o proporciones deja el precio pendiente y cero es válido", () => {
  assert.ok("error" in formulaPrice([{ ...herbs[0], pricePerKgCents: undefined }], [ingredients[0]], 100));
  for (const amount of ["", "a gusto", "0 partes", "-1 parte", "1 kg", "1.0000001 partes"]) {
    assert.ok("error" in formulaPrice(herbs, [{ plantId: "a", amount }], 100));
  }
  const free = formulaPrice([{ ...herbs[0], pricePerKgCents: 0 }], [ingredients[0]], 100);
  assert.ok(!("error" in free));
  assert.equal(free.presentationCents, 0);
});
test("las partes decimales se calculan exactamente y se redondea medio centavo hacia arriba", () => {
  const result = formulaPrice([{ ...herbs[0], pricePerKgCents: 1 }, { ...herbs[1], pricePerKgCents: 2 }], [{ plantId: "a", amount: "0,5 partes" }, { plantId: "b", amount: "0.5 partes" }], 1000);
  assert.ok(!("error" in result));
  assert.equal(result.presentationCents, 2);
  assert.equal(result.contributions.reduce((sum, row) => sum + row.perKgCents, 0), result.perKgCents);
});
test("la presentación no reutiliza el precio por kg ya redondeado", () => {
  const result = formulaPrice([{ ...herbs[0], pricePerKgCents: 1 }, { ...herbs[1], pricePerKgCents: 0 }], [{ plantId: "a", amount: "2 partes" }, { plantId: "b", amount: "1 parte" }], 500);
  assert.ok(!("error" in result));
  assert.equal(result.perKgCents, 1);
  assert.equal(result.presentationCents, 0);
});
test("pesos inválidos, hierbas inexistentes, duplicadas y montos fuera de rango no generan precio", () => {
  for (const grams of [0, -1, 0.5, NaN, Infinity, 1000001]) assert.ok("error" in formulaPrice(herbs, ingredients, grams));
  assert.ok("error" in formulaPrice(herbs, [], 100));
  assert.ok("error" in formulaPrice(herbs, [{ plantId: "missing", amount: "1 parte" }], 100));
  assert.ok("error" in formulaPrice(herbs, [ingredients[0], ingredients[0]], 100));
  assert.ok("error" in formulaPrice([{ ...herbs[0], pricePerKgCents: 90000000000000 }], [ingredients[0]], 1000));
});
test("el servidor reemplaza precio y unidad enviados por el navegador y recalcula todos los tónicos", () => {
  const catalog = { plants: herbs, preparations: [
    { id: "automatic", ingredients, presentationWeightGrams: 100, calculatedPriceCents: 1, price: 1, priceUnit: "precio inventado" },
    { id: "manual", ingredients, price: 77, priceUnit: "bolsita" },
  ] };
  const result = resolveCatalogPrices(catalog);
  for (const tonic of result.preparations) {
    assert.equal(tonic.price, 27500);
    assert.equal(tonic.calculatedPriceCents, 2750000);
    assert.equal(tonic.priceUnit, "kg");
  }
  assert.equal(catalog.preparations[0].price, 1);
  const changed = resolveCatalogPrices({ ...result, plants: herbs.map(herb => herb.id === "a" ? { ...herb, pricePerKgCents: 4000000 } : herb) });
  assert.equal(changed.preparations[0].price, 37500);
  const missing = resolveCatalogPrices({ ...changed, plants: herbs.map(herb => ({ ...herb, pricePerKgCents: undefined })) });
  assert.equal(missing.preparations[0].price, undefined);
  assert.equal(missing.preparations[0].calculatedPriceCents, undefined);
  assert.equal(missing.preparations[1].price, undefined);
});
test("todo tónico tiene un único precio: el del kilogramo, sin importar la presentación guardada", () => {
  const tonic: { ingredients: typeof ingredients; presentationWeightGrams?: number; priceUnit?: string; calculatedPriceCents?: number } = { ingredients, presentationWeightGrams: 250 };
  const result = resolveCatalogPrices({ plants: herbs, preparations: [tonic, { ingredients }] });
  for (const item of result.preparations) {
    assert.equal(item.priceUnit, "kg");
    assert.equal(item.calculatedPriceCents, 2750000);
  }
});
