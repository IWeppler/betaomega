import assert from "node:assert/strict";
import { test } from "node:test";
import { checkCode, countUses, normalizeCode, type DiscountCode } from "./codes.ts";

const NOW = "2026-11-10T15:00:00.000Z";
const turn = { roomId: "sala-1", turnTypeId: "tipo-1" };
const none = { total: 0, byCustomer: 0 };
const code = (over: Partial<DiscountCode> = {}): DiscountCode => ({
  id: "c1", code: "VERANO", type: "percent", value: 10, active: true, validFrom: null, validUntil: null,
  maxUses: null, maxUsesPerCustomer: null, roomId: null, turnTypeId: null, ...over,
});

test("un código se escribe sin distinguir mayúsculas ni espacios", () => {
  assert.equal(normalizeCode("  verano "), "VERANO");
  assert.equal(normalizeCode("VeRaNo"), normalizeCode("verano"));
});

test("un código activo y sin límites se acepta", () => {
  assert.equal(checkCode(code(), turn, none, NOW), null);
});

test("un código inactivo se rechaza", () => {
  assert.equal(checkCode(code({ active: false }), turn, none, NOW), "code_inactive");
});

test("un código vale solo dentro de su vigencia, bordes incluidos", () => {
  assert.equal(checkCode(code({ validFrom: "2026-11-11T00:00:00.000Z" }), turn, none, NOW), "code_not_started");
  assert.equal(checkCode(code({ validUntil: "2026-11-10T14:59:59.000Z" }), turn, none, NOW), "code_expired");
  assert.equal(checkCode(code({ validFrom: NOW, validUntil: NOW }), turn, none, NOW), null);
});

test("un código restringido solo vale en su sala o su tipo de turno", () => {
  assert.equal(checkCode(code({ roomId: "sala-2" }), turn, none, NOW), "code_wrong_slot");
  assert.equal(checkCode(code({ roomId: "sala-1" }), turn, none, NOW), null);
  assert.equal(checkCode(code({ turnTypeId: "tipo-2" }), turn, none, NOW), "code_wrong_slot");
  assert.equal(checkCode(code({ turnTypeId: "tipo-1" }), turn, none, NOW), null);
});

test("el último uso disponible se acepta y el siguiente no", () => {
  assert.equal(checkCode(code({ maxUses: 3 }), turn, { total: 2, byCustomer: 0 }, NOW), null);
  assert.equal(checkCode(code({ maxUses: 3 }), turn, { total: 3, byCustomer: 0 }, NOW), "code_exhausted");
});

test("el límite por persona se aplica aparte del límite total", () => {
  assert.equal(checkCode(code({ maxUsesPerCustomer: 1 }), turn, { total: 9, byCustomer: 0 }, NOW), null);
  assert.equal(checkCode(code({ maxUsesPerCustomer: 1 }), turn, { total: 9, byCustomer: 1 }, NOW), "code_customer_limit");
});

const uses = [
  { status: "confirmed", expiresAt: null, customerId: "ana" },
  { status: "held", expiresAt: "2026-11-10T15:10:00.000Z", customerId: "ana" },
  { status: "completed", expiresAt: null, customerId: "beto" },
] as const;

test("cuentan como uso las reservas vigentes, de cada persona y en total", () => {
  assert.deepEqual(countUses(uses, "ana", NOW), { total: 3, byCustomer: 2 });
  assert.deepEqual(countUses(uses, "carla", NOW), { total: 3, byCustomer: 0 });
  assert.deepEqual(countUses(uses, null, NOW), { total: 3, byCustomer: 0 }, "alguien que todavía no es cliente no tiene usos");
});

test("una reserva cancelada o vencida devuelve el uso del código", () => {
  const released = [
    { status: "cancelled", expiresAt: null, customerId: "ana" },
    { status: "expired", expiresAt: "2026-11-10T14:00:00.000Z", customerId: "ana" },
    { status: "held", expiresAt: "2026-11-10T14:59:00.000Z", customerId: "ana" }, // lapsed: no one flipped its status
  ] as const;
  const counted = countUses(released, "ana", NOW);
  assert.deepEqual(counted, { total: 0, byCustomer: 0 });
  assert.equal(checkCode(code({ maxUses: 1, maxUsesPerCustomer: 1 }), turn, counted, NOW), null);
});

test("cuando vence la retención el uso vuelve a estar disponible", () => {
  const held = [{ status: "held", expiresAt: "2026-11-10T15:10:00.000Z", customerId: "ana" }] as const;
  assert.equal(countUses(held, "ana", NOW).total, 1);
  assert.equal(countUses(held, "ana", "2026-11-10T15:10:00.000Z").total, 0);
});
