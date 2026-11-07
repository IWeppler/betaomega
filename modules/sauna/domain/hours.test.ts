import assert from "node:assert/strict";
import { test } from "node:test";
import { bandsOfDay, cleanTurnType, cleanWeek, clockOptions, offersPrivate, offersShared, turnStarts, type TurnType } from "./hours.ts";
import { SetupError } from "./setup.ts";

const T45 = "11111111-1111-4111-8111-111111111145";
const T60 = "11111111-1111-4111-8111-111111111160";
const type = (over: Partial<TurnType> = {}): TurnType => ({ id: T45, name: "Turno 45", durationMinutes: 45, priceCents: 800000, privatePriceCents: null, depositPercent: null, active: true, revision: 1, ...over });
const types = [type(), type({ id: T60, name: "Turno 60", durationMinutes: 60 })];
const band = (over: Record<string, unknown> = {}) => ({ weekday: 1, from: "09:00", to: "13:00", typeIds: [T45, T60], ...over });
const week = (over: Record<string, unknown> = {}) => ({ capacity: 2, stepMinutes: 30, revision: 3, bands: [band()], ...over });

test("los turnos empiezan cada tanto desde la apertura, mientras entren enteros", () => {
  assert.deepEqual(turnStarts({ from: "10:00", to: "12:00" }, 60, 30), ["10:00", "10:30", "11:00"]);
  assert.deepEqual(turnStarts({ from: "10:00", to: "12:00" }, 45, 30), ["10:00", "10:30", "11:00"]);
  assert.deepEqual(turnStarts({ from: "10:00", to: "12:00" }, 45, 45), ["10:00", "10:45"]);
  assert.deepEqual(turnStarts({ from: "10:00", to: "10:30" }, 45, 30), []);
});

test("las horas para elegir van cada media hora", () => {
  assert.equal(clockOptions[19], "09:30");
  assert.equal(clockOptions.at(-1), "23:30");
});

test("las franjas de un día salen en orden", () => {
  const tarde = band({ from: "16:00", to: "20:00" });
  assert.deepEqual(bandsOfDay([tarde, band(), band({ weekday: 2 })] as never, 1).map(item => item.from), ["09:00", "16:00"]);
});

test("un tipo ofrece lo que tiene precio", () => {
  assert.deepEqual([offersShared(type()), offersPrivate(type())], [true, false]);
  assert.deepEqual([offersShared(type({ priceCents: null, privatePriceCents: 1 })), offersPrivate(type({ priceCents: null, privatePriceCents: 1 }))], [false, true]);
  assert.equal(offersShared(type({ priceCents: 0 })), true, "cero es un precio");
});

test("un tipo de turno válido se limpia", () => {
  assert.deepEqual(cleanTurnType({ name: " Turno 60 ", durationMinutes: 60, priceCents: 1000000, privatePriceCents: 5000000, depositPercent: 30 }), {
    id: null, name: "Turno 60", durationMinutes: 60, priceCents: 1000000, privatePriceCents: 5000000, depositPercent: 30, active: true, revision: 1,
  });
  assert.equal(cleanTurnType({ name: "x", durationMinutes: 45, priceCents: 1, depositPercent: 0 }).depositPercent, 0, "cero es un valor, no su ausencia");
  assert.equal(cleanTurnType({ name: "x", durationMinutes: 45, priceCents: 1, active: false }).active, false);
});

test("un tipo sin ningún precio se rechaza y dice cuál es", () => {
  assert.throws(() => cleanTurnType({ name: "Noche", durationMinutes: 45 }), /"Noche" necesita un precio/);
});

test("un tipo inválido se rechaza", () => {
  for (const bad of [{ name: "" }, { name: "x".repeat(41) }, { durationMinutes: 0 }, { durationMinutes: 1.5 }, { priceCents: -1 }, { priceCents: 1.5 }, { depositPercent: 101 }, { depositPercent: "30" }]) {
    assert.throws(() => cleanTurnType({ name: "x", durationMinutes: 45, priceCents: 100, ...bad }), SetupError, JSON.stringify(bad));
  }
});

test("una semana válida admite varias franjas por día y varios tipos por franja", () => {
  const clean = cleanWeek(week({ bands: [band(), band({ from: "16:00", to: "20:00", typeIds: [T60] }), band({ weekday: 2 })] }), types);
  assert.equal(clean.bands.length, 3);
  assert.deepEqual(clean.bands[0].typeIds, [T45, T60]);
  assert.deepEqual([clean.capacity, clean.stepMinutes, clean.revision], [2, 30, 3]);
});

test("una franja termina donde empieza la otra sin pisarse", () => {
  assert.equal(cleanWeek(week({ bands: [band({ to: "13:00" }), band({ from: "13:00", to: "15:00" })] }), types).bands.length, 2);
});

test("dos franjas que se pisan se rechazan y dicen qué día", () => {
  assert.throws(() => cleanWeek(week({ bands: [band({ to: "13:00" }), band({ from: "12:30", to: "15:00" })] }), types), /lunes hay dos franjas que se pisan/);
  assert.equal(cleanWeek(week({ bands: [band(), band({ weekday: 2 })] }), types).bands.length, 2, "en días distintos no se pisan");
});

test("una franja al revés o sin tipos se rechaza y dice qué día", () => {
  assert.throws(() => cleanWeek(week({ bands: [band({ from: "13:00", to: "09:00" })] }), types), /lunes hay una franja que termina antes de empezar/);
  assert.throws(() => cleanWeek(week({ bands: [band({ typeIds: [] })] }), types), /no tiene ningún tipo de turno/);
});

test("un tipo que no entra en su franja se rechaza y dice cuál", () => {
  assert.throws(() => cleanWeek(week({ bands: [band({ from: "09:00", to: "09:50" })] }), types), /no entra "Turno 60"/);
});

test("un tipo borrado no se puede ofrecer", () => {
  assert.throws(() => cleanWeek(week(), [type(), type({ id: T60, active: false })]), /ya no existe/);
  assert.throws(() => cleanWeek(week({ bands: [band({ typeIds: ["otro"] })] }), types), /ya no existe/);
});

test("una semana sin franjas es válida: todo cerrado", () => {
  assert.deepEqual(cleanWeek(week({ bands: [] }), types).bands, []);
});

test("una semana inválida se rechaza", () => {
  for (const bad of [{ capacity: 0 }, { stepMinutes: 1 }, { revision: 0 }, { bands: "x" }, { bands: [band({ weekday: 7 })] }, { bands: [band({ from: "25:00" })] }]) {
    assert.throws(() => cleanWeek(week(bad), types), SetupError, JSON.stringify(bad));
  }
});
