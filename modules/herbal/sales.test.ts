import test from "node:test";
import assert from "node:assert/strict";
import { seedCatalog } from "../../platform/catalog/index.ts";
import { resolveCart, orderMessage } from "../../platform/catalog/store.ts";
import { buildHerbalShop, sellerCatalog } from "./sales.ts";
import { cleanOrderRequest } from "./order-request.ts";

const today = "2026-11-11";
function fixture() {
  const catalog = structuredClone(seedCatalog);
  catalog.plants = catalog.plants.slice(0, 3).map((herb, index) => ({ ...herb, pricePerKgCents: [2000000, 3000000, 4000000][index] }));
  catalog.preparations = [{ ...catalog.preparations[0], presentationWeightGrams: 1000, price: 1, calculatedPriceCents: 1, priceUnit: "incorrecto" }];
  return catalog;
}
test("tienda, equipo y pedido comparten el precio recalculado por kg e ignoran el importe guardado obsoleto", () => {
  const catalog = fixture();
  const shop = buildHerbalShop(catalog, today);
  const tonic = shop.items.find(item => item.id === "prep-1")!;
  assert.equal(tonic.pricing.price, 27500);
  assert.equal(tonic.pricing.unit, "kg");
  assert.equal(sellerCatalog(catalog, today).preparations[0].price, 27500);
  const order = resolveCart([{ key: "p:prep-1", qty: 2 }], shop.offers);
  assert.equal(order.total, 55000);
  assert.match(orderMessage(order, { name: "Ana", delivery: "pickup", address: "", note: "" }), /55\.000/);
  catalog.plants[0].pricePerKgCents = 4000000;
  assert.equal(buildHerbalShop(catalog, today).offers.find(offer => offer.key === "p:prep-1")!.price, 37500);
  assert.equal(catalog.preparations[0].price, 1, "la proyección no modifica el documento");
});
test("las hierbas sin presentación anterior se venden por kg y las presentaciones manuales se conservan", () => {
  const catalog = fixture();
  let shop = buildHerbalShop(catalog, today);
  assert.equal(shop.offers.find(offer => offer.key === "p:plant-1")!.price, 20000);
  assert.equal(shop.offers.find(offer => offer.key === "p:plant-1")!.unit, "kg");
  Object.assign(catalog.plants[0], { price: 2500, priceUnit: "100 g" });
  shop = buildHerbalShop(catalog, today);
  assert.equal(shop.offers.find(offer => offer.key === "p:plant-1")!.price, 2500);
  assert.equal(shop.offers.find(offer => offer.key === "p:plant-1")!.unit, "100 g");
});
test("precios faltantes permanecen a confirmar y no reutilizan importes u ofertas anteriores", () => {
  const catalog = fixture();
  catalog.plants[0].pricePerKgCents = undefined;
  catalog.preparations[0].promoPrice = 0;
  const shop = buildHerbalShop(catalog, today);
  assert.equal(shop.offers.find(offer => offer.key === "p:prep-1")!.price, undefined);
  const order = resolveCart([{ key: "p:prep-1", qty: 1 }], shop.offers);
  assert.equal(order.pending, 1);
  assert.match(orderMessage(order, { name: "Ana", delivery: "pickup", address: "", note: "" }), /precio a confirmar/);
});
test("ofertas, vencimientos y ahorro de combos usan el nuevo precio regular", () => {
  const catalog = fixture();
  Object.assign(catalog.preparations[0], { promoPrice: 25000, promoUntil: "2026-11-12" });
  catalog.combos = [{ id: "combo-test", name: "Dúo", description: "", active: true, price: 50000, items: [{ productId: "prep-1", qty: 2 }, { productId: "plant-1", qty: 1 }] }];
  const shop = buildHerbalShop(catalog, today);
  assert.equal(shop.offers.find(offer => offer.key === "p:prep-1")!.price, 25000);
  assert.equal(sellerCatalog(catalog, today).preparations[0].price, 25000);
  assert.equal(shop.combos[0].savings?.includes("25.000"), true);
  assert.equal(buildHerbalShop(catalog, "2026-11-13").offers.find(offer => offer.key === "p:prep-1")!.price, 27500);
  assert.ok(!JSON.stringify(shop.offers).includes(catalog.preparations[0].instructions));
});
test("el pedido acepta solo cantidades válidas y descarta los precios y totales del navegador", () => {
  const details = { name: "Ana", delivery: "pickup", address: "", note: "" };
  assert.deepEqual(cleanOrderRequest({ cart: [{ key: "p:prep-1", qty: 2, price: 1, subtotal: 1 }], details, total: 1 }), { cart: [{ key: "p:prep-1", qty: 2 }], details });
  for (const cart of [[], [{ key: "p:a", qty: 0 }], [{ key: "p:a", qty: 1.5 }], [{ key: "p:a", qty: 100 }], [{ key: "bad", qty: 1 }], [{ key: "p:a", qty: 1 }, { key: "p:a", qty: 1 }]]) {
    assert.throws(() => cleanOrderRequest({ cart, details }));
  }
  assert.throws(() => cleanOrderRequest({ cart: [{ key: "p:a", qty: 1 }], details: { ...details, name: "" } }));
  assert.throws(() => cleanOrderRequest({ cart: [{ key: "p:a", qty: 1 }], details: { ...details, delivery: "delivery" } }));
});
