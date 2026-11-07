import assert from "node:assert/strict";
import { test } from "node:test";
import { discountFor, priceFor, PricingError, quote, type SlotPrices } from "./pricing.ts";

const slot: SlotPrices = { priceCents: 1000000, privatePriceCents: 5000000, depositPercent: 30 };

test("un turno compartido cobra por lugar y la sala completa tiene su propio precio", () => {
  assert.equal(priceFor(slot, "shared", 1), 1000000);
  assert.equal(priceFor(slot, "shared", 3), 3000000);
  assert.equal(priceFor(slot, "private", 6), 5000000, "la sala cuesta lo mismo sin importar cuántos lugares ocupe");
});

test("pedir un tipo de reserva que el turno no ofrece es un error", () => {
  assert.throws(() => priceFor({ ...slot, privatePriceCents: null }, "private", 6), PricingError);
  assert.throws(() => priceFor({ ...slot, priceCents: null }, "shared", 1), PricingError);
});

test("una cantidad de lugares inválida es un error", () => {
  for (const seats of [0, -1, 1.5]) assert.throws(() => priceFor(slot, "shared", seats), PricingError);
});

test("sin código la seña sale del precio completo", () => {
  assert.deepEqual(quote(slot, "shared", 2, null), {
    priceCents: 2000000, discountCents: 0, totalCents: 2000000, depositCents: 600000, balanceCents: 1400000, confirmsAtOnce: false,
  });
});

test("la seña se calcula sobre el precio ya descontado", () => {
  const result = quote(slot, "shared", 1, { type: "percent", value: 20 });
  assert.equal(result.discountCents, 200000);
  assert.equal(result.totalCents, 800000);
  assert.equal(result.depositCents, 240000, "30 % de 8.000, no de 10.000");
  assert.equal(result.balanceCents, 560000);
});

test("el descuento en porcentaje redondea igual que todo el dinero", () => {
  assert.equal(discountFor({ type: "percent", value: 15 }, 1033), 155); // 154,95
  assert.equal(discountFor({ type: "percent", value: 50 }, 333), 167); // 166,50
});

test("un descuento fijo resta su monto y nunca deja el precio por debajo de cero", () => {
  assert.equal(quote(slot, "shared", 1, { type: "fixed", value: 300000 }).totalCents, 700000);
  const excessive = quote(slot, "shared", 1, { type: "fixed", value: 9000000 });
  assert.equal(excessive.discountCents, 1000000);
  assert.equal(excessive.totalCents, 0);
  assert.equal(excessive.confirmsAtOnce, true);
});

test("un código sin seña confirma sin cobrar y deja todo a pagar en el lugar", () => {
  assert.deepEqual(quote(slot, "shared", 1, { type: "no_deposit", value: 0 }), {
    priceCents: 1000000, discountCents: 0, totalCents: 1000000, depositCents: 0, balanceCents: 1000000, confirmsAtOnce: true,
  });
});

test("un pase gratis deja el precio en cero y confirma sin cobrar", () => {
  assert.deepEqual(quote(slot, "private", 6, { type: "free", value: 0 }), {
    priceCents: 5000000, discountCents: 5000000, totalCents: 0, depositCents: 0, balanceCents: 0, confirmsAtOnce: true,
  });
});

test("un turno con seña del 0 % se confirma sin cobro", () => {
  const result = quote({ ...slot, depositPercent: 0 }, "shared", 1, null);
  assert.equal(result.depositCents, 0);
  assert.equal(result.confirmsAtOnce, true);
});

test("con seña del 100 % no queda saldo", () => {
  const result = quote({ ...slot, depositPercent: 100 }, "shared", 1, null);
  assert.equal(result.depositCents, 1000000);
  assert.equal(result.balanceCents, 0);
});

test("seña y saldo siempre suman el total, también al redondear", () => {
  for (const priceCents of [1, 33, 99, 101, 1033, 99999]) {
    for (const depositPercent of [0, 1, 15, 33, 50, 99, 100]) {
      const result = quote({ priceCents, privatePriceCents: null, depositPercent }, "shared", 1, null);
      assert.equal(result.depositCents + result.balanceCents, result.totalCents);
      assert.ok(Number.isInteger(result.depositCents));
    }
  }
});
