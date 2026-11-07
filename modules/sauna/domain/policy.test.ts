import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanRules, describeRules, PolicyError, proposeRefund, proposesSessionReturn, refundError, refundPercentFor } from "./policy.ts";

test("la política se explica en palabras, de mayor a menor anticipación", () => {
  assert.deepEqual(describeRules([{ hoursBefore: 0, refundPercent: 0 }, { hoursBefore: 1, refundPercent: 25 }, { hoursBefore: 48, refundPercent: 100 }]), [
    "Con 48 horas o más de anticipación: se reintegra toda la seña.",
    "Con 1 hora o más de anticipación: se reintegra el 25 % de la seña.",
    "Hasta el inicio del turno: no se reintegra la seña.",
  ]);
});

const rules = [
  { hoursBefore: 48, refundPercent: 100 },
  { hoursBefore: 24, refundPercent: 50 },
  { hoursBefore: 0, refundPercent: 0 },
];
const START = "2026-11-20T20:00:00.000Z";
const hoursBefore = (hours: number) => new Date(Date.parse(START) - hours * 3_600_000).toISOString();

test("cada tramo aplica desde sus horas exactas de anticipación", () => {
  assert.equal(refundPercentFor(rules, START, hoursBefore(72)), 100);
  assert.equal(refundPercentFor(rules, START, hoursBefore(48)), 100);
  assert.equal(refundPercentFor(rules, START, hoursBefore(47.99)), 50);
  assert.equal(refundPercentFor(rules, START, hoursBefore(24)), 50);
  assert.equal(refundPercentFor(rules, START, hoursBefore(23)), 0);
  assert.equal(refundPercentFor(rules, START, hoursBefore(0)), 0);
});

test("el resultado no depende del orden en que estén los tramos", () => {
  assert.equal(refundPercentFor([...rules].reverse(), START, hoursBefore(30)), 50);
});

test("después de empezar el turno no se reintegra nada, aunque un tramo de 0 horas prometa algo", () => {
  assert.equal(refundPercentFor([{ hoursBefore: 0, refundPercent: 100 }], START, hoursBefore(-1)), 0);
});

test("si la cancelación no alcanza ningún tramo no se reintegra nada", () => {
  assert.equal(refundPercentFor([{ hoursBefore: 48, refundPercent: 100 }], START, hoursBefore(10)), 0);
});

test("la propuesta es el porcentaje de la seña pagada, con el redondeo único", () => {
  assert.equal(proposeRefund(rules, START, hoursBefore(72), 300000), 300000);
  assert.equal(proposeRefund(rules, START, hoursBefore(30), 300000), 150000);
  assert.equal(proposeRefund(rules, START, hoursBefore(30), 333), 167); // 166,50
  assert.equal(proposeRefund(rules, START, hoursBefore(1), 300000), 0);
  assert.equal(proposeRefund(rules, START, hoursBefore(72), 0), 0, "sin seña pagada no hay nada que proponer");
});

test("se propone devolver la sesión de un pack solo si el tramo reintegra el 100 %", () => {
  assert.equal(proposesSessionReturn(rules, START, hoursBefore(48)), true);
  assert.equal(proposesSessionReturn(rules, START, hoursBefore(30)), false);
  assert.equal(proposesSessionReturn(rules, START, hoursBefore(1)), false);
});

test("un reintegro parcial cabe hasta lo que queda por devolver", () => {
  assert.equal(refundError(100000, 300000), null);
  assert.equal(refundError(300000, 300000), null);
});

test("un reintegro que supera lo cobrado se rechaza, también sumando los anteriores", () => {
  assert.notEqual(refundError(300001, 300000), null);
  const charged = 300000;
  const alreadyRefunded = 200000;
  assert.equal(refundError(100000, charged - alreadyRefunded), null);
  assert.notEqual(refundError(100001, charged - alreadyRefunded), null);
});

test("un reintegro de cero o con un monto inválido se rechaza", () => {
  assert.notEqual(refundError(0, 300000), null);
  assert.notEqual(refundError(-1, 300000), null);
  assert.notEqual(refundError(1.5, 300000), null);
});

test("los tramos válidos se ordenan de mayor a menor anticipación", () => {
  assert.deepEqual(cleanRules([{ hoursBefore: 0, refundPercent: 0 }, { hoursBefore: 48, refundPercent: 100 }]), [
    { hoursBefore: 48, refundPercent: 100 }, { hoursBefore: 0, refundPercent: 0 },
  ]);
});

test("una política inválida se rechaza", () => {
  for (const value of [
    null, "x", [], [null], [{}],
    [{ hoursBefore: -1, refundPercent: 10 }],
    [{ hoursBefore: 1.5, refundPercent: 10 }],
    [{ hoursBefore: 1, refundPercent: 101 }],
    [{ hoursBefore: 1, refundPercent: "50" }],
    [{ hoursBefore: 1, refundPercent: 10 }, { hoursBefore: 1, refundPercent: 20 }],
  ]) assert.throws(() => cleanRules(value), PolicyError, JSON.stringify(value));
});
