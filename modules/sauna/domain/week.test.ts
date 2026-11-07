import assert from "node:assert/strict";
import { test } from "node:test";
import type { AgendaBooking } from "./agenda.ts";
import type { ClosureEntry } from "./setup.ts";
import { nowPosition, toneOf, weekBlocks } from "./week.ts";

// Monday 2026-11-09 to Sunday 2026-11-15. Buenos Aires is UTC−3: 10:00 there is 13:00Z.
const FROM = "2026-11-09";
const NOW = "2026-11-10T15:00:00.000Z"; // Tuesday 12:00
const ROWS = ["10:00", "10:30", "11:00", "11:30", "12:00", "12:30"];
const booking = (over: Partial<AgendaBooking> = {}): AgendaBooking => ({
  id: "b", token: "t", status: "confirmed", kind: "shared", seats: 1, priceCents: 1000000, discountCents: 0, depositCents: 300000, expiresAt: null, needsRefund: false,
  createdAt: NOW, customerName: "Ana", customerWhatsapp: "5491123456789", roomId: "sala", typeName: "Turno 60",
  startsAt: "2026-11-11T13:00:00.000Z", endsAt: "2026-11-11T14:00:00.000Z", movements: [], ...over,
});
const closure = (over: Partial<ClosureEntry> = {}): ClosureEntry => ({ id: "c", roomId: null, startsAt: "2026-11-12T14:00:00.000Z", endsAt: "2026-11-12T15:00:00.000Z", reason: "", ...over });
const layout = (bookings: AgendaBooking[], closures: ClosureEntry[] = []) => weekBlocks({ from: FROM, rows: ROWS, stepMinutes: 30, bookings, closures, now: NOW });

test("una reserva es un solo bloque que abarca las filas de su duración", () => {
  const [block] = layout([booking()]);
  assert.deepEqual([block.dayIndex, block.firstRow, block.lastRow, block.lane, block.lanes, block.tone], [2, 0, 1, 0, 1, "confirmed"]);
});

test("un turno que no empieza en una fila cubre todas las que toca", () => {
  // 10:45 a 11:30 toca las filas de 10:30 y de 11:00.
  const [block] = layout([booking({ startsAt: "2026-11-11T13:45:00.000Z", endsAt: "2026-11-11T14:30:00.000Z" })]);
  assert.deepEqual([block.firstRow, block.lastRow], [1, 2]);
});

test("el color dice primero si hay dinero para devolver y después si falta la seña", () => {
  assert.equal(toneOf(booking({ needsRefund: true, status: "held", expiresAt: "2026-11-10T16:00:00.000Z" }), NOW), "refund");
  assert.equal(toneOf(booking({ status: "held", expiresAt: "2026-11-10T16:00:00.000Z" }), NOW), "unpaid");
  assert.equal(toneOf(booking({ status: "pending_transfer", expiresAt: "2026-11-10T16:00:00.000Z" }), NOW), "unpaid");
  assert.equal(toneOf(booking({ status: "completed" }), NOW), "done");
  assert.equal(toneOf(booking(), NOW), "confirmed");
});

test("un cierre de varios días es un bloque por día, recortado a las filas", () => {
  const blocks = layout([], [closure({ startsAt: "2026-11-12T03:00:00.000Z", endsAt: "2026-11-14T03:00:00.000Z" })]);
  assert.deepEqual(blocks.map(block => [block.dayIndex, block.firstRow, block.lastRow, block.tone]), [[3, 0, 5, "closure"], [4, 0, 5, "closure"]]);
});

test("lo que cae fuera de las filas no se dibuja", () => {
  assert.deepEqual(layout([booking({ startsAt: "2026-11-11T20:00:00.000Z", endsAt: "2026-11-11T21:00:00.000Z" })]), []);
});

test("dos bloques que comparten horario van lado a lado y el resto del día también se angosta", () => {
  const blocks = layout(
    [booking({ id: "b1" }), booking({ id: "b2", startsAt: "2026-11-11T15:00:00.000Z", endsAt: "2026-11-11T15:30:00.000Z" })],
    [closure({ startsAt: "2026-11-11T13:30:00.000Z", endsAt: "2026-11-11T14:30:00.000Z" })],
  );
  const lanes = Object.fromEntries(blocks.map(block => [block.key.split(":")[1], [block.lane, block.lanes]]));
  assert.deepEqual(lanes, { b1: [0, 2], c: [1, 2], b2: [0, 2] });
});

test("un bloque que ya terminó queda marcado como pasado", () => {
  const [block] = layout([booking({ startsAt: "2026-11-10T13:00:00.000Z", endsAt: "2026-11-10T14:00:00.000Z" })]);
  assert.equal(block.past, true);
  assert.equal(layout([booking()])[0].past, false);
});

test("la línea de ahora cae en hoy, en proporción a las filas", () => {
  // Tuesday 12:00: rows go from 10:00 to 13:00, so two thirds of the way.
  assert.deepEqual(nowPosition({ from: FROM, rows: ROWS, stepMinutes: 30, now: NOW }), { dayIndex: 1, fraction: 2 / 3 });
  assert.equal(nowPosition({ from: FROM, rows: ROWS, stepMinutes: 30, now: "2026-11-10T20:00:00.000Z" }), null, "después del cierre");
  assert.equal(nowPosition({ from: "2026-11-16", rows: ROWS, stepMinutes: 30, now: NOW }), null, "otra semana");
});
