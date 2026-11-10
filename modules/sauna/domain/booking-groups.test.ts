import assert from "node:assert/strict";
import { test } from "node:test";
import type { AgendaBooking } from "./agenda.ts";
import { chargeOf, groupBookings, groupMoney, pageOf, rowsOf, statusCounts, viewCounts, viewsOf } from "./booking-groups.ts";

const NOW = "2026-11-10T15:00:00.000Z";
const booking = (over: Partial<AgendaBooking> = {}): AgendaBooking => ({
  id: "b", token: "t", status: "confirmed", kind: "shared", seats: 1, priceCents: 2000000, discountCents: 0, depositCents: 600000, expiresAt: null, needsRefund: false,
  createdAt: NOW, customerName: "Ana", customerWhatsapp: "5491123456789", roomId: "sala", typeName: "Turno 60", startsAt: "2026-11-12T23:00:00.000Z", endsAt: "2026-11-13T00:00:00.000Z",
  movements: [], code: null, fromPack: false, planName: null, planPurchaseId: null, planTurns: null, ...over,
});
const plan = (id: string, startsAt: string, over: Partial<AgendaBooking> = {}) =>
  booking({ id, startsAt, planName: "Plan Ideal", planPurchaseId: "p1", planTurns: 3, createdAt: "2026-11-09T12:00:00.000Z", ...over });

test("los turnos de un plan son una sola fila, con sus turnos en orden", () => {
  const groups = groupBookings([
    booking({ id: "suelta", createdAt: "2026-11-10T10:00:00.000Z" }),
    plan("c", "2026-11-20T23:00:00.000Z"), plan("a", "2026-11-12T23:00:00.000Z"), plan("b", "2026-11-15T23:00:00.000Z"),
    booking({ id: "vieja", createdAt: "2026-11-01T10:00:00.000Z" }),
  ]);
  assert.deepEqual(groups.map(group => group.key), ["suelta", "p1", "vieja"]);
  assert.deepEqual(groups[1].plan, { name: "Plan Ideal", turns: 3 });
  assert.deepEqual(groups[1].bookings.map(item => item.id), ["a", "b", "c"]);
  assert.equal(groups[0].plan, null);
});

test("la paginación nunca muestra una página vacía", () => {
  const items = Array.from({ length: 45 }, (_, index) => index);
  assert.deepEqual(pageOf(items, 1, 20), { items: items.slice(0, 20), page: 1, pages: 3, total: 45 });
  assert.deepEqual(pageOf(items, 3, 20).items, [40, 41, 42, 43, 44]);
  assert.equal(pageOf(items, 9, 20).page, 3, "una página que ya no existe muestra la última");
  assert.equal(pageOf(items, 0, 20).page, 1);
  assert.equal(pageOf(items, Number.NaN, 20).page, 1);
  assert.deepEqual(pageOf([], 1, 20), { items: [], page: 1, pages: 1, total: 0 });
});

test("el estado de un plan se cuenta por turno, primero lo que necesita atención", () => {
  const turns = [
    plan("a", "2026-11-12T23:00:00.000Z", { status: "cancelled" }),
    plan("b", "2026-11-15T23:00:00.000Z"),
    plan("c", "2026-11-20T23:00:00.000Z"),
    plan("d", "2026-11-21T23:00:00.000Z", { status: "held", expiresAt: "2026-11-10T14:00:00.000Z" }),
    plan("e", "2026-11-22T23:00:00.000Z", { status: "pending_transfer", expiresAt: "2026-11-11T14:00:00.000Z" }),
  ];
  assert.deepEqual(statusCounts(turns, NOW), [
    { status: "pending_transfer", count: 1 }, { status: "confirmed", count: 2 }, { status: "expired", count: 1 }, { status: "cancelled", count: 1 },
  ]);
});

test("lo que falta cobrar cuenta solo los turnos vigentes", () => {
  const turns = [
    plan("a", "2026-11-12T23:00:00.000Z", { status: "cancelled" }),
    plan("b", "2026-11-15T23:00:00.000Z", { movements: [{ kind: "deposit", amountCents: 600000 }] }),
    plan("c", "2026-11-20T23:00:00.000Z", { status: "held", expiresAt: "2026-11-10T16:00:00.000Z" }),
    plan("d", "2026-11-21T23:00:00.000Z", { status: "held", expiresAt: "2026-11-10T14:00:00.000Z" }),
  ];
  assert.deepEqual(groupMoney(turns, NOW), { depositDueCents: 600000, owedCents: 1400000 + 2000000, refund: false });
  assert.equal(groupMoney([booking({ status: "cancelled", needsRefund: true })], NOW).refund, true);
});

const money = (cents: number) => `$${cents / 100}`;

test("cada reserva cae en la pestaña de lo que pide", () => {
  const views = (over: Partial<AgendaBooking>) => viewsOf(booking(over), NOW).filter(view => view !== "all");
  assert.deepEqual(views({ status: "pending_transfer", expiresAt: "2026-11-10T18:00:00.000Z" }), ["attention"]);
  assert.deepEqual(views({ status: "held", expiresAt: "2026-11-10T14:00:00.000Z" }), ["closed"], "una retención vencida ya no pide nada");
  assert.deepEqual(views({}), ["upcoming"]);
  assert.deepEqual(views({ startsAt: "2026-11-10T14:00:00.000Z" }), ["attention"], "un turno que empezó sin asistencia marcada");
  assert.deepEqual(views({ status: "completed", startsAt: "2026-11-09T14:00:00.000Z" }), ["past"]);
  assert.deepEqual(views({ status: "cancelled" }), ["closed"]);
  assert.deepEqual(views({ status: "cancelled", needsRefund: true }), ["attention"], "un pago para devolver no se esconde");
});

test("un plan está en todas las pestañas de sus turnos y se cuenta una vez", () => {
  const groups = groupBookings([
    plan("a", "2026-11-12T23:00:00.000Z", { status: "pending_transfer", expiresAt: "2026-11-10T18:00:00.000Z" }),
    plan("b", "2026-11-15T23:00:00.000Z"),
    booking({ id: "s", status: "cancelled" }),
  ]);
  assert.deepEqual(viewCounts(groups, NOW), { attention: 1, upcoming: 1, past: 0, closed: 1, all: 2 });
});

test("lo que hay que resolver va primero por lo que vence antes; lo próximo por fecha; lo pasado al revés", () => {
  const groups = groupBookings([
    booking({ id: "tarde", status: "held", expiresAt: "2026-11-10T19:00:00.000Z", startsAt: "2026-11-11T12:00:00.000Z" }),
    booking({ id: "pronto", status: "pending_transfer", expiresAt: "2026-11-10T16:00:00.000Z", startsAt: "2026-11-20T12:00:00.000Z" }),
    booking({ id: "lejos", startsAt: "2026-11-30T12:00:00.000Z" }),
    booking({ id: "cerca", startsAt: "2026-11-11T12:00:00.000Z" }),
    booking({ id: "ayer", status: "completed", startsAt: "2026-11-09T12:00:00.000Z" }),
    booking({ id: "antes", status: "no_show", startsAt: "2026-11-01T12:00:00.000Z" }),
  ]);
  assert.deepEqual(rowsOf(groups, "attention", NOW).map(group => group.key), ["pronto", "tarde"]);
  assert.deepEqual(rowsOf(groups, "upcoming", NOW).map(group => group.key), ["cerca", "lejos"]);
  assert.deepEqual(rowsOf(groups, "past", NOW).map(group => group.key), ["ayer", "antes"]);
  assert.deepEqual(rowsOf(groups, "all", NOW).map(group => group.key), ["tarde", "cerca", "pronto", "lejos", "ayer", "antes"], "todas: lo que viene por fecha, después lo pasado");
});

test("el cobro se dice en una frase: devolver, seña, saldo o pagado", () => {
  const one = (over: Partial<AgendaBooking>) => chargeOf(groupBookings([booking(over)])[0], NOW, money);
  assert.deepEqual(one({ status: "cancelled", needsRefund: true }), { tone: "danger", text: "Devolver un pago" });
  assert.deepEqual(one({ status: "held", expiresAt: "2026-11-10T18:00:00.000Z" }), { tone: "warn", text: "Falta la seña: $6000" });
  assert.deepEqual(one({ movements: [{ kind: "deposit", amountCents: 600000 }] }), { tone: "plain", text: "Cobrar $14000 en el lugar" });
  assert.deepEqual(one({ movements: [{ kind: "deposit", amountCents: 2000000 }] }), { tone: "accent", text: "Pagado" });
  assert.deepEqual(one({ status: "cancelled" }), { tone: "none", text: "Sin cobro" });
});
