import assert from "node:assert/strict";
import { test } from "node:test";
import { agendaByDay, agendaRange, bookingActions, isDayClosed, moneyState, moveAgenda, peopleOf, type AgendaBooking } from "./agenda.ts";

const NOW = "2026-11-10T15:00:00.000Z";
const booking = (over: Partial<AgendaBooking> = {}): AgendaBooking => ({
  id: "b", token: "t", status: "confirmed", kind: "shared", seats: 2, priceCents: 2000000, discountCents: 0, depositCents: 600000, expiresAt: null, needsRefund: false,
  createdAt: NOW, customerName: "Ana", customerWhatsapp: "5491123456789", roomId: "sala", typeName: "Turno 60", startsAt: "2026-11-10T23:00:00.000Z", endsAt: "2026-11-11T00:00:00.000Z", movements: [], ...over,
});

test("sin pagos se debe todo y falta la seña", () => {
  assert.deepEqual(moneyState(booking()), { totalCents: 2000000, paidCents: 0, owedCents: 2000000, depositDueCents: 600000 });
});

test("el descuento baja lo que hay que cobrar", () => {
  assert.equal(moneyState(booking({ discountCents: 500000 })).owedCents, 1500000);
});

test("una seña pagada deja el saldo y un reintegro vuelve a abrirlo", () => {
  const paid = moneyState(booking({ movements: [{ kind: "deposit", amountCents: 600000 }] }));
  assert.deepEqual([paid.owedCents, paid.depositDueCents], [1400000, 0]);
  const refunded = moneyState(booking({ movements: [{ kind: "deposit", amountCents: 600000 }, { kind: "refund", amountCents: 600000 }] }));
  assert.deepEqual([refunded.paidCents, refunded.depositDueCents], [0, 600000]);
});

test("cobrar de más no deja un saldo negativo", () => {
  assert.equal(moneyState(booking({ movements: [{ kind: "deposit", amountCents: 9000000 }] })).owedCents, 0);
});

test("una retención vigente se puede confirmar o cancelar; una vencida no", () => {
  assert.deepEqual(bookingActions(booking({ status: "held", expiresAt: "2026-11-10T15:10:00.000Z" }), NOW), { confirm: true, attendance: false, cancel: true });
  assert.deepEqual(bookingActions(booking({ status: "held", expiresAt: "2026-11-10T14:00:00.000Z" }), NOW), { confirm: false, attendance: false, cancel: false });
});

test("la asistencia se marca solo cuando el turno ya empezó", () => {
  assert.equal(bookingActions(booking(), NOW).attendance, false);
  assert.equal(bookingActions(booking({ startsAt: NOW }), NOW).attendance, true);
  assert.deepEqual(bookingActions(booking({ status: "completed", startsAt: NOW }), NOW), { confirm: false, attendance: false, cancel: false });
});

test("cada vista abarca su período", () => {
  assert.deepEqual(agendaRange("day", "2026-11-11"), { from: "2026-11-11", to: "2026-11-11" });
  assert.deepEqual(agendaRange("week", "2026-11-11"), { from: "2026-11-09", to: "2026-11-15" });
  assert.deepEqual(agendaRange("month", "2026-11-11"), { from: "2026-10-26", to: "2026-12-06" });
});

test("avanzar y retroceder respeta el largo de cada mes", () => {
  assert.equal(moveAgenda("day", "2026-11-30", 1), "2026-12-01");
  assert.equal(moveAgenda("week", "2026-11-11", -1), "2026-11-04");
  assert.equal(moveAgenda("month", "2026-01-31", 1), "2026-02-28");
  assert.equal(moveAgenda("month", "2026-01-15", -1), "2025-12-15");
});

test("la agenda muestra las reservas vigentes y no las canceladas ni vencidas", () => {
  const days = agendaByDay([
    booking({ id: "a" }),
    booking({ id: "c", status: "cancelled" }),
    booking({ id: "h", status: "held", expiresAt: "2026-11-10T14:00:00.000Z" }),
  ], NOW);
  const [entry] = days.get("2026-11-10")!;
  assert.deepEqual(entry.bookings.map(item => item.id), ["a"]);
  assert.equal(peopleOf(days.get("2026-11-10")!), 2);
});

test("dos tipos a la misma hora son dos turnos", () => {
  const [first, second] = agendaByDay([booking({ id: "a" }), booking({ id: "b", typeName: "Turno 45" }), booking({ id: "c" })], NOW).get("2026-11-10")!;
  assert.deepEqual([first.bookings.map(item => item.id), second.bookings.map(item => item.id)], [["a", "c"], ["b"]]);
});

test("los turnos se agrupan por día de Buenos Aires y en orden", () => {
  const late = booking({ id: "tarde", startsAt: "2026-11-11T02:00:00.000Z" }); // 23:00 of the 10th in Buenos Aires
  const early = booking({ id: "temprano", startsAt: "2026-11-10T12:00:00.000Z" });
  const days = agendaByDay([late, early], NOW);
  assert.deepEqual([...days.keys()], ["2026-11-10"]);
  assert.deepEqual(days.get("2026-11-10")!.map(entry => entry.bookings[0].id), ["temprano", "tarde"]);
});

test("una misma hora se reconoce aunque esté escrita distinto", () => {
  const days = agendaByDay([booking({ id: "a", startsAt: "2026-11-10T20:00:00-03:00" }), booking({ id: "b", startsAt: "2026-11-10T23:00:00.000Z" })], NOW);
  assert.equal(days.get("2026-11-10")!.length, 1);
});

test("un cierre marca los días que toca, aunque sea en parte", () => {
  const closures = [{ startsAt: "2026-11-10T20:00:00.000Z", endsAt: "2026-11-11T03:00:00.000Z" }];
  assert.equal(isDayClosed("2026-11-10", closures), true);
  assert.equal(isDayClosed("2026-11-11", closures), false, "termina justo a la medianoche de Buenos Aires");
  assert.equal(isDayClosed("2026-11-09", closures), false);
  assert.equal(isDayClosed("2026-11-10", []), false);
});
