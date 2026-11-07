import assert from "node:assert/strict";
import { test } from "node:test";
import { InvalidTransitionError } from "./booking.ts";
import { canTransitionPack, checkPackSession, packStatuses, packValidUntil, sessionsInWeek, sessionsLeft, transitionPack, type PackSession, type PackStatus } from "./pack.ts";

const pack = { status: "active" as PackStatus, sessions: 10, validUntil: "2027-01-01T00:00:00.000Z", maxPerWeek: 2 };
const request = { kind: "shared" as const, seats: 1, startsAt: "2026-11-11T20:00:00.000Z", hasCode: false };
const session = (over: Partial<PackSession> = {}): PackSession => ({ status: "confirmed", startsAt: "2026-11-02T20:00:00.000Z", sessionReturned: false, ...over });

test("una compra sigue los estados previstos y un pago tardío la activa", () => {
  const valid: [PackStatus, PackStatus][] = [
    ["held", "pending_transfer"], ["held", "active"], ["held", "expired"], ["held", "cancelled"],
    ["pending_transfer", "active"], ["pending_transfer", "expired"], ["pending_transfer", "cancelled"],
    ["active", "cancelled"], ["expired", "active"],
  ];
  for (const from of packStatuses) {
    for (const to of packStatuses) {
      const expected = valid.some(([a, b]) => a === from && b === to);
      assert.equal(canTransitionPack(from, to), expected, `${from} → ${to}`);
      if (expected) assert.equal(transitionPack({ status: from }, to).status, to);
      else assert.throws(() => transitionPack({ status: from }, to), InvalidTransitionError);
    }
  }
});

test("la validez corre desde la confirmación del pago", () => {
  assert.equal(packValidUntil("2026-11-10T15:00:00.000Z", 90), "2027-02-08T15:00:00.000Z");
});

test("el saldo son las sesiones menos las reservas que las consumen", () => {
  assert.equal(sessionsLeft(10, []), 10);
  assert.equal(sessionsLeft(10, [session(), session({ status: "completed" })]), 8);
});

test("un ausente consume la sesión", () => {
  assert.equal(sessionsLeft(10, [session({ status: "no_show" })]), 9);
});

test("una cancelación consume la sesión salvo que se haya devuelto", () => {
  assert.equal(sessionsLeft(10, [session({ status: "cancelled" })]), 9);
  assert.equal(sessionsLeft(10, [session({ status: "cancelled", sessionReturned: true })]), 10);
});

test("con saldo, vigente y dentro del máximo semanal se puede reservar", () => {
  assert.equal(checkPackSession(pack, request, []), null);
});

test("un pack sin activar no reserva", () => {
  for (const status of ["held", "pending_transfer", "expired", "cancelled"] as const) {
    assert.equal(checkPackSession({ ...pack, status }, request, []), "pack_not_active", status);
  }
  assert.equal(checkPackSession({ ...pack, validUntil: null }, request, []), "pack_not_active");
});

test("un pack sirve para un lugar en un turno compartido", () => {
  assert.equal(checkPackSession(pack, { ...request, kind: "private" }, []), "pack_shared_only");
  assert.equal(checkPackSession(pack, { ...request, seats: 2 }, []), "pack_shared_only");
});

test("un código no se combina con un pack", () => {
  assert.equal(checkPackSession(pack, { ...request, hasCode: true }, []), "pack_with_code");
});

test("el turno tiene que empezar antes del vencimiento del pack", () => {
  const validUntil = "2026-11-11T20:00:00.000Z";
  assert.equal(checkPackSession({ ...pack, validUntil }, { ...request, startsAt: "2026-11-11T19:59:59.000Z" }, []), null);
  assert.equal(checkPackSession({ ...pack, validUntil }, request, []), "pack_expired", "justo al vencer ya no vale");
});

test("sin sesiones restantes no se puede reservar la última dos veces", () => {
  const used = Array.from({ length: 2 }, () => session());
  assert.equal(checkPackSession({ ...pack, sessions: 3 }, request, used), null);
  const all = [...used, session()];
  assert.equal(checkPackSession({ ...pack, sessions: 3 }, request, all), "pack_no_sessions");
});

test("una sesión devuelta vuelve a estar disponible", () => {
  assert.equal(checkPackSession({ ...pack, sessions: 1 }, request, [session({ status: "cancelled", sessionReturned: true })]), null);
});

test("no se puede pasar del máximo semanal", () => {
  const sameWeek = [session({ startsAt: "2026-11-09T20:00:00.000Z" }), session({ startsAt: "2026-11-15T20:00:00.000Z" })];
  assert.equal(checkPackSession(pack, request, sameWeek), "pack_week_limit");
});

test("la semana cuenta por la fecha del turno, no por la de la reserva", () => {
  const nextWeek = [session({ startsAt: "2026-11-16T20:00:00.000Z" }), session({ startsAt: "2026-11-17T20:00:00.000Z" })];
  assert.equal(checkPackSession(pack, request, nextWeek), null);
  assert.equal(checkPackSession(pack, { ...request, startsAt: "2026-11-18T20:00:00.000Z" }, nextWeek), "pack_week_limit");
});

test("la semana va de lunes a domingo en hora de Buenos Aires", () => {
  // Sunday 23:30 in Buenos Aires is already Monday 02:30 in UTC: it belongs to the week that is ending.
  const sundayNight = session({ startsAt: "2026-11-16T02:30:00.000Z" });
  const mondayEarly = session({ startsAt: "2026-11-16T03:30:00.000Z" });
  assert.equal(sessionsInWeek([sundayNight], "2026-11-09T20:00:00.000Z"), 1);
  assert.equal(sessionsInWeek([mondayEarly], "2026-11-09T20:00:00.000Z"), 0);
  assert.equal(sessionsInWeek([mondayEarly], "2026-11-22T20:00:00.000Z"), 1);
});

test("un turno cancelado deja libre el lugar de la semana, aunque haya consumido la sesión", () => {
  const cancelled = session({ status: "cancelled", startsAt: "2026-11-09T20:00:00.000Z" });
  assert.equal(sessionsInWeek([cancelled], "2026-11-11T20:00:00.000Z"), 0);
  assert.equal(sessionsLeft(10, [cancelled]), 9);
});
