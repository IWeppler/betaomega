import assert from "node:assert/strict";
import { test } from "node:test";
import type { AgendaBooking } from "./agenda.ts";
import { newBookings, summaryOf } from "./summary.ts";

// 15:00 in Buenos Aires, Saturday 7 November 2026.
const now = "2026-11-07T18:00:00Z";
let next = 0;
const booking = (patch: Partial<AgendaBooking>): AgendaBooking => ({
  id: String(++next), token: "t", status: "confirmed", kind: "shared", seats: 1, priceCents: 10_000, discountCents: 0, depositCents: 0,
  expiresAt: null, needsRefund: false, createdAt: now, customerName: "Ana", customerWhatsapp: null, roomId: "r", typeName: "Turno",
  startsAt: "2026-11-07T20:00:00Z", endsAt: "2026-11-07T21:00:00Z", movements: [], code: null, fromPack: false, planName: null, planPurchaseId: null, planTurns: null, ...patch,
});

test("el día de hoy suma personas, reservas y lo que falta cobrar", () => {
  const summary = summaryOf([
    booking({ seats: 2 }),
    booking({ startsAt: "2026-11-07T13:00:00Z", endsAt: "2026-11-07T14:00:00Z", status: "completed" }),
    booking({ status: "cancelled" }),
    booking({ startsAt: "2026-11-07T13:00:00Z", endsAt: "2026-11-07T14:00:00Z", status: "no_show" }),
  ], now);
  assert.equal(summary.today.length, 2);
  assert.equal(summary.peopleToday, 4);
  assert.equal(summary.bookingsToday, 3);
  assert.equal(summary.owedTodayCents, 20_000, "el que no vino no cuenta como cobro pendiente");
  assert.equal(summary.nextTurnKey, summary.today[1].key, "el turno de la mañana ya terminó");
});

test("para resolver: devoluciones, asistencias y reservas sin confirmar, en ese orden", () => {
  const summary = summaryOf([
    booking({ status: "held", expiresAt: "2026-11-07T19:00:00Z", startsAt: "2026-11-09T20:00:00Z", endsAt: "2026-11-09T21:00:00Z" }),
    booking({ status: "held", expiresAt: "2026-11-07T17:00:00Z" }),
    booking({ startsAt: "2026-11-06T20:00:00Z", endsAt: "2026-11-06T21:00:00Z" }),
    booking({ status: "cancelled", needsRefund: true }),
    booking({}),
  ], now);
  assert.deepEqual(summary.pending.map(item => item.reason), ["refund", "attendance", "confirm"], "la retención vencida no se resuelve");
});

test("la semana arranca hoy y cuenta solo reservas vigentes", () => {
  const summary = summaryOf([
    booking({ startsAt: "2026-11-09T20:00:00Z", endsAt: "2026-11-09T21:00:00Z", seats: 3 }),
    booking({ startsAt: "2026-11-09T20:00:00Z", endsAt: "2026-11-09T21:00:00Z", status: "expired" }),
    booking({ startsAt: "2026-11-20T20:00:00Z", endsAt: "2026-11-20T21:00:00Z" }),
  ], now);
  assert.equal(summary.week.length, 7);
  assert.equal(summary.week[0].day, "2026-11-07");
  assert.deepEqual(summary.week[2], { day: "2026-11-09", people: 3, bookings: 1 });
  assert.equal(summary.week.reduce((sum, day) => sum + day.people, 0), 3);
  assert.equal(summary.nextTurnKey, null);
  assert.equal(summary.nextDay?.day, "2026-11-09", "el próximo día con reservas, para cuando hoy no hay");
});

test("una reserva nueva se avisa una vez, y no al abrir el panel", () => {
  const old = booking({ id: "old" });
  const fresh = booking({ id: "fresh", createdAt: "2026-11-07T17:59:00Z" });
  assert.deepEqual(newBookings(null, [old, fresh], now), [], "la primera carga no avisa");
  assert.deepEqual(newBookings(new Set(["old"]), [old, fresh], now).map(item => item.id), ["fresh"]);
  assert.deepEqual(newBookings(new Set(["old", "fresh"]), [old, fresh], now), []);
  assert.deepEqual(newBookings(new Set(), [booking({ status: "cancelled" }), booking({ status: "held", expiresAt: "2026-11-07T17:00:00Z" })], now), [], "ni canceladas ni retenciones vencidas");
});
