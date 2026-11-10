import assert from "node:assert/strict";
import { test } from "node:test";
import type { AgendaBooking } from "./agenda.ts";
import { levelOf, preferencesOf, topHours, weekOrder } from "./preferences.ts";

// 15:00 in Buenos Aires, Saturday 7 November 2026.
const now = "2026-11-07T18:00:00Z";
let next = 0;
const booking = (startsAt: string, patch: Partial<AgendaBooking> = {}): AgendaBooking => ({
  id: String(++next), token: "t", status: "confirmed", kind: "shared", seats: 1, priceCents: 10_000, discountCents: 0, depositCents: 0,
  expiresAt: null, needsRefund: false, createdAt: now, customerName: "Ana", customerWhatsapp: null, roomId: "r", typeName: "Turno",
  startsAt, endsAt: startsAt, movements: [], code: null, fromPack: false, planName: null, planPurchaseId: null, planTurns: null, ...patch,
});

const cell = (result: ReturnType<typeof preferencesOf>, weekday: number, hour: number) =>
  result.rows[result.hours.indexOf(hour)][weekOrder.indexOf(weekday as (typeof weekOrder)[number])];

test("cuenta reservas por día de la semana y hora de Buenos Aires", () => {
  const result = preferencesOf([
    booking("2026-11-07T22:00:00Z", { seats: 2 }), // Saturday 19:00
    booking("2026-10-31T22:30:00Z", { status: "completed" }), // Saturday 19:30
    booking("2026-11-04T13:00:00Z", { status: "no_show" }), // Wednesday 10:00
  ], now);
  assert.deepEqual(result.hours, [10, 19]);
  assert.equal(cell(result, 6, 19).bookings, 2);
  assert.equal(cell(result, 6, 19).people, 3);
  assert.equal(cell(result, 3, 10).bookings, 1, "quien no vino igual dice cuándo quería ir");
  assert.equal(result.total, 3);
  assert.equal(result.most, 2);
  assert.equal(result.topDay, 6);
  assert.equal(result.topHour, 19);
  assert.equal(result.days[weekOrder.indexOf(6)].bookings, 2);
});

test("una reserva de madrugada en Buenos Aires cae en su día local, no en el de UTC", () => {
  // 01:00 UTC Sunday is 22:00 Saturday in Buenos Aires.
  const result = preferencesOf([booking("2026-11-08T01:00:00Z")], now);
  assert.equal(cell(result, 6, 22).bookings, 1);
});

test("no cuentan las canceladas ni las retenciones vencidas", () => {
  const result = preferencesOf([
    booking("2026-11-07T22:00:00Z", { status: "cancelled" }),
    booking("2026-11-07T22:00:00Z", { status: "expired" }),
    booking("2026-11-07T22:00:00Z", { status: "held", expiresAt: "2026-11-07T17:00:00Z" }),
  ], now);
  assert.equal(result.total, 0);
  assert.equal(result.topDay, null);
  assert.equal(result.topHour, null);
});

test("las franjas de horario dan filas aunque no haya reservas", () => {
  const result = preferencesOf([], now, [{ from: "10:00", to: "12:30" }, { from: "22:00", to: "00:00" }]);
  assert.deepEqual(result.hours, [10, 11, 12, 22, 23]);
  assert.equal(result.most, 0);
});

test("los cinco horarios más reservados, en orden de hora", () => {
  const result = preferencesOf([
    booking("2026-11-07T22:00:00Z"), booking("2026-10-31T22:00:00Z"), // 19 h twice
    booking("2026-11-04T13:00:00Z"), // 10 h
    booking("2026-11-05T23:00:00Z"), booking("2026-11-06T23:00:00Z"), // 20 h twice
  ], now, [{ from: "09:00", to: "22:00" }]);
  const hours = topHours(result);
  assert.equal(hours.length, 5);
  assert.deepEqual(hours.filter(hour => [10, 19, 20].includes(hour)), [10, 19, 20]);
  assert.deepEqual(hours, [9, 10, 11, 19, 20], "sin más reservas, completan las primeras horas abiertas");
  assert.deepEqual(topHours(preferencesOf([], now)), []);
});

test("el color sube por escalones según la casilla más llena", () => {
  assert.equal(levelOf(0, 8), 0);
  assert.equal(levelOf(1, 8), 1);
  assert.equal(levelOf(4, 8), 2);
  assert.equal(levelOf(8, 8), 4);
  assert.equal(levelOf(3, 0), 0);
});
