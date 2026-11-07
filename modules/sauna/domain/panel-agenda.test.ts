import assert from "node:assert/strict";
import { test } from "node:test";
import { agendaRows, cellInstant, closuresOfRange, dayClosureState } from "./agenda.ts";
import { startsExample, turnsOverlap, type TurnType } from "./hours.ts";
import { closureFromRange, SetupError } from "./setup.ts";

const now = "2026-11-06T12:00:00Z";
const closure = { id: "one", roomId: null, startsAt: "2026-11-07T03:00:00Z", endsAt: "2026-11-08T03:00:00Z", reason: "" };
test("un cierre valida fechas, orden, vencimiento y motivo", () => {
  const range = { startsAt: "2026-11-07T10:00:00-03:00", endsAt: "2026-11-07T11:00:00-03:00", reason: " Limpieza " };
  assert.equal(closureFromRange(range, now).startsAt, "2026-11-07T13:00:00.000Z");
  assert.equal(closureFromRange(range, now).reason, "Limpieza");
  for (const patch of [{ startsAt: "2026-02-30T10:00:00Z" }, { startsAt: "2026-11-07T10:00" }, { startsAt: "no" }, { endsAt: range.startsAt }, { endsAt: "2026-11-05T11:00:00Z" }, { reason: "x".repeat(201) }]) assert.throws(() => closureFromRange({ ...range, ...patch }, now), SetupError);
  assert.throws(() => closureFromRange({ startsAt: now, endsAt: now }, now), SetupError);
});
test("la grilla cubre las franjas con el intervalo configurado", () => {
  assert.deepEqual(agendaRows([], 30), []);
  assert.deepEqual(agendaRows([{ weekday: 1, from: "10:00", to: "11:00", typeIds: [] }, { weekday: 2, from: "10:15", to: "11:00", typeIds: [] }], 30), ["10:00", "10:30"]);
  assert.equal(cellInstant("2026-11-07", "10:15"), "2026-11-07T13:15:00.000Z");
});
test("los cierres se solapan sin incluir el extremo final y distinguen días enteros", () => {
  assert.equal(closuresOfRange("2026-11-08T03:00:00Z", "2026-11-08T04:00:00Z", [closure]).length, 0);
  assert.equal(closuresOfRange("2026-11-07T02:00:00Z", "2026-11-07T04:00:00Z", [closure]).length, 1);
  assert.equal(dayClosureState("2026-11-07", [closure]), "full");
  assert.equal(dayClosureState("2026-11-06", [closure]), null);
  assert.equal(dayClosureState("2026-11-07", [{ ...closure, startsAt: "2026-11-07T10:00:00Z" }]), "partial");
  assert.equal(dayClosureState("2026-11-07", [{ ...closure, endsAt: "2026-11-07T10:00:00Z" }, { ...closure, startsAt: "2026-11-07T10:00:00Z" }]), "full");
  assert.equal(dayClosureState("2026-11-07", [{ ...closure, endsAt: "2026-11-07T10:00:00Z" }, { ...closure, startsAt: "2026-11-07T11:00:00Z" }]), "partial");
});
test("el ejemplo usa el tipo más corto y el intervalo editable", () => {
  const type: TurnType = { id: "a", name: "Turno 45 min", durationMinutes: 45, priceCents: 100, privatePriceCents: null, depositPercent: null, active: true, revision: 1 };
  const bands = [{ weekday: 1, from: "10:00", to: "15:00", typeIds: ["a"] }];
  assert.equal(startsExample([type], bands, 45), "Con Turno 45 min desde las 10:00: 10:00, 10:45, 11:30…");
  assert.match(startsExample([type], bands, 30), /10:00, 10:30, 11:00/);
  assert.equal(startsExample([], bands, 45), "");
  assert.equal(startsExample([type], [], 45), "");
  assert.equal(turnsOverlap([type], 45), false);
  assert.equal(turnsOverlap([type, { ...type, durationMinutes: 60 }], 45), true);
});
