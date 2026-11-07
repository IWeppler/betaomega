import assert from "node:assert/strict";
import { test } from "node:test";
import { checkCode, cleanCode, countUses, describeCode, isCodeText, normalizeCode, type DiscountCode } from "./codes.ts";
import { SetupError } from "./setup.ts";

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

const draft = { code: " verano-10 ", type: "percent", value: 10 };

test("el panel guarda el código en mayúsculas, sin espacios y con sus límites", () => {
  const clean = cleanCode({ ...draft, maxUses: 50, maxUsesPerCustomer: 1, note: " regalo ", turnTypeId: "tipo-1" }, ["tipo-1"]);
  assert.equal(clean.code, "VERANO-10");
  assert.deepEqual([clean.type, clean.value, clean.maxUses, clean.maxUsesPerCustomer, clean.turnTypeId, clean.note, clean.active], ["percent", 10, 50, 1, "tipo-1", "regalo", true]);
  assert.equal(cleanCode({ ...draft, maxUses: "" }, []).maxUses, null);
});

test("la vigencia abarca días completos de Buenos Aires, con los dos extremos", () => {
  const clean = cleanCode({ ...draft, validFrom: "2026-12-01", validUntil: "2026-12-31" }, []);
  assert.equal(clean.validFrom, "2026-12-01T03:00:00.000Z");
  assert.equal(clean.validUntil, "2027-01-01T02:59:59.999Z");
  assert.equal(checkCode(code({ validUntil: clean.validUntil }), turn, none, "2027-01-01T02:59:00.000Z"), null);
  assert.equal(checkCode(code({ validUntil: clean.validUntil }), turn, none, "2027-01-01T03:00:00.000Z"), "code_expired");
});

test("los tipos sin valor guardan cero y el monto fijo va en centavos", () => {
  assert.equal(cleanCode({ ...draft, type: "no_deposit", value: 99 }, []).value, 0);
  assert.equal(cleanCode({ ...draft, type: "fixed", value: 500_000 }, []).value, 500_000);
  assert.equal(cleanCode({ ...draft, type: "free", value: 7, maxUses: 1 }, []).value, 0);
});

test("un código mal escrito, sin valor o gratis sin límite se rechaza", () => {
  for (const bad of [
    { code: "ab" }, { code: "con espacio" }, { code: "AÑO" }, { code: "A_B" }, { code: "A%B" }, { type: "otro" }, { value: 0 }, { value: 101 }, { value: 12.5 },
    { type: "fixed", value: 0 }, { type: "free", value: 0 }, { maxUses: 0 }, { maxUsesPerCustomer: -1 }, { validFrom: "2026-12-31", validUntil: "2026-12-01" },
    { validFrom: "31/12/2026" }, { turnTypeId: "tipo-borrado" }, { note: "x".repeat(201) }, { id: "3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b" },
  ]) {
    assert.throws(() => cleanCode({ ...draft, ...bad }, ["tipo-1"]), SetupError, JSON.stringify(bad));
  }
});

test("solo letras sin tilde, números y guiones forman un código", () => {
  assert.equal(isCodeText("VERANO-10"), true);
  assert.equal(isCodeText("verano"), false, "se normaliza antes");
  assert.equal(isCodeText("A*"), false);
});

test("cada tipo de código se describe en pocas palabras", () => {
  assert.equal(describeCode({ type: "percent", value: 15 }), "15 % de descuento");
  assert.match(describeCode({ type: "fixed", value: 500_000 }), /5\.000/);
  assert.equal(describeCode({ type: "no_deposit", value: 0 }), "Reserva sin seña");
  assert.equal(describeCode({ type: "free", value: 0 }), "Sesión sin cargo");
});
