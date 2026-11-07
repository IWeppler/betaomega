import assert from "node:assert/strict";
import { test } from "node:test";
import { checkSeats, checkWindow, holdUntil, isClosed, seatsNeeded, seatsTaken, type Closure } from "./availability.ts";

const NOW = "2026-11-10T15:00:00.000Z";
const window = { minLeadMinutes: 60, maxAdvanceDays: 60 };

test("se puede reservar hasta la anticipación mínima, ese instante incluido", () => {
  assert.equal(checkWindow("2026-11-10T16:00:00.000Z", NOW, window), null);
  assert.equal(checkWindow("2026-11-10T15:59:59.000Z", NOW, window), "too_soon");
  assert.equal(checkWindow("2026-11-10T14:00:00.000Z", NOW, window), "too_soon", "un turno pasado tampoco");
});

test("no se puede reservar más allá del horizonte", () => {
  assert.equal(checkWindow("2027-01-09T15:00:00.000Z", NOW, window), null);
  assert.equal(checkWindow("2027-01-09T15:00:01.000Z", NOW, window), "too_far");
});

const turn = { roomId: "sala-1", startsAt: "2026-11-10T20:00:00.000Z", endsAt: "2026-11-10T21:00:00.000Z" };
const closure = (over: Partial<Closure>): Closure => ({ roomId: null, startsAt: "2026-11-10T00:00:00.000Z", endsAt: "2026-11-11T00:00:00.000Z", ...over });

test("un cierre general bloquea el turno de cualquier sala", () => {
  assert.equal(isClosed(turn, [closure({})]), true);
});

test("un cierre de otra sala no bloquea el turno", () => {
  assert.equal(isClosed(turn, [closure({ roomId: "sala-2" })]), false);
  assert.equal(isClosed(turn, [closure({ roomId: "sala-1" })]), true);
});

test("un cierre que toca parte del turno lo bloquea", () => {
  assert.equal(isClosed(turn, [closure({ startsAt: "2026-11-10T20:30:00.000Z", endsAt: "2026-11-10T20:40:00.000Z" })]), true);
  assert.equal(isClosed(turn, [closure({ startsAt: "2026-11-10T20:59:00.000Z" })]), true);
});

test("un cierre que termina justo cuando empieza el turno no lo bloquea", () => {
  assert.equal(isClosed(turn, [closure({ startsAt: "2026-11-10T19:00:00.000Z", endsAt: "2026-11-10T20:00:00.000Z" })]), false);
  assert.equal(isClosed(turn, [closure({ startsAt: "2026-11-10T21:00:00.000Z", endsAt: "2026-11-10T22:00:00.000Z" })]), false);
  assert.equal(isClosed(turn, []), false);
});

const held = (startsAt: string, endsAt: string, status = "confirmed" as "confirmed" | "held" | "cancelled" | "expired", expiresAt: string | null = null) => ({ status, expiresAt, startsAt, endsAt });
const at = (time: string) => `2026-11-10T${time}:00.000Z`;

test("una reserva individual deja la sala sin lugar para un desconocido", () => {
  const taken = seatsTaken([held(at("20:00"), at("21:00"))], at("20:00"), at("21:00"), NOW, 2);
  assert.equal(taken, 2);
  assert.equal(checkSeats({ mode: "either", capacity: 2 }, "shared", 1, taken), "full");
  assert.equal(checkSeats({ mode: "either", capacity: 2 }, "private", 2, taken), "not_empty");
});

test("solo cuentan las reservas vigentes, y las vencidas se liberan sin ninguna tarea", () => {
  const gone = [held(at("20:00"), at("21:00"), "held", at("14:50")), held(at("20:00"), at("21:00"), "expired", at("14:00")), held(at("20:00"), at("21:00"), "cancelled")];
  assert.equal(seatsTaken(gone, at("20:00"), at("21:00"), NOW, 2), 0);
  const holding = [held(at("20:00"), at("21:00"), "held", at("15:10"))];
  assert.equal(seatsTaken(holding, at("20:00"), at("21:00"), NOW, 2), 2);
  assert.equal(seatsTaken(holding, at("20:00"), at("21:00"), at("15:10"), 2), 0, "al vencer la retención se libera");
});

test("un turno de 60 minutos ocupa la sala en el de 45 que se le pisa", () => {
  const sixty = [held(at("10:00"), at("11:00"))];
  assert.equal(seatsTaken(sixty, at("10:30"), at("11:15"), NOW, 2), 2);
  assert.equal(seatsTaken(sixty, at("11:00"), at("11:45"), NOW, 2), 0, "el que empieza justo cuando termina no se pisa");
  assert.equal(seatsTaken(sixty, at("09:15"), at("10:00"), NOW, 2), 0, "el que termina justo cuando empieza tampoco");
});

const shared = { mode: "shared" as const, capacity: 6 };
const either = { mode: "either" as const, capacity: 6 };
const roomOnly = { mode: "private" as const, capacity: 6 };

test("un turno compartido admite hasta llenar su cupo", () => {
  assert.equal(checkSeats(shared, "shared", 6, 0), null);
  assert.equal(checkSeats(shared, "shared", 1, 5), null);
  assert.equal(checkSeats(shared, "shared", 1, 6), "full");
  assert.equal(checkSeats(shared, "shared", 2, 5), "full");
});

test("una cantidad de lugares inválida se rechaza", () => {
  for (const seats of [0, -1, 1.5]) assert.equal(checkSeats(shared, "shared", seats, 0), "invalid_seats");
});

test("la sala completa solo se toma con el turno vacío", () => {
  assert.equal(checkSeats(either, "private", 6, 0), null);
  assert.equal(checkSeats(either, "private", 6, 1), "not_empty");
  assert.equal(seatsNeeded("private", 1, 6), 6, "ocupa todos los lugares sin importar cuántos pida");
  assert.equal(seatsNeeded("shared", 2, 6), 2);
});

test("una sala completa ya reservada deja el turno sin lugar para compartir", () => {
  assert.equal(checkSeats(either, "shared", 1, seatsNeeded("private", 1, 6)), "full");
});

test("cada turno admite solo las modalidades que ofrece", () => {
  assert.equal(checkSeats(shared, "private", 6, 0), "kind_not_offered");
  assert.equal(checkSeats(roomOnly, "shared", 1, 0), "kind_not_offered");
  assert.equal(checkSeats(roomOnly, "private", 6, 0), null);
  assert.equal(checkSeats(either, "shared", 1, 0), null);
});

test("una retención dura lo configurado y nunca pasa del inicio del turno", () => {
  assert.equal(holdUntil(NOW, "2026-11-11T15:00:00.000Z", 15), "2026-11-10T15:15:00.000Z");
  assert.equal(holdUntil(NOW, "2026-11-10T22:00:00.000Z", 12 * 60), "2026-11-10T22:00:00.000Z");
});
