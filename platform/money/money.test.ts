import assert from "node:assert/strict";
import { test } from "node:test";
import { centsFromPesos, formatCents, isCents, isPercent, MAX_CENTS, MoneyError, percentOf, pesosFromCents } from "./index.ts";

test("un precio escrito por una persona se lee en centavos", () => {
  for (const [text, cents] of [["1500", 150000], ["1.500", 150000], ["1.500,50", 150050], ["1500,5", 150050], ["1500.50", 150050], ["$ 1.500", 150000], ["0", 0], ["1.234.567,89", 123456789], ["19,99", 1999]] as const) {
    assert.equal(centsFromPesos(text), cents, text);
  }
});

test("un precio ilegible es null, no un cálculo", () => {
  for (const text of ["", "abc", "-5", "1,5,5", "1.50.000", "1500,505", "1 500"]) assert.equal(centsFromPesos(text), null, text);
});

test("el valor de un campo de precio vuelve a leerse igual", () => {
  for (const cents of [0, 5, 150000, 150050, 1999]) assert.equal(centsFromPesos(pesosFromCents(cents)), cents);
});

test("un porcentaje se calcula sobre centavos", () => {
  assert.equal(percentOf(1000000, 30), 300000);
  assert.equal(percentOf(1000000, 0), 0);
  assert.equal(percentOf(1000000, 100), 1000000);
  assert.equal(percentOf(0, 50), 0);
});

test("la mitad exacta de un centavo redondea hacia arriba", () => {
  assert.equal(percentOf(50, 1), 1); // 0,50
  assert.equal(percentOf(49, 1), 0); // 0,49
  assert.equal(percentOf(150, 1), 2); // 1,50
  assert.equal(percentOf(333, 50), 167); // 166,50
});

test("un monto muy grande no pierde precisión", () => {
  assert.equal(percentOf(MAX_CENTS, 100), MAX_CENTS);
  assert.equal(percentOf(MAX_CENTS, 1), MAX_CENTS / 100);
});

test("un monto o un porcentaje inválido es un error, no un cálculo", () => {
  for (const cents of [-1, 1.5, Number.NaN, MAX_CENTS + 1]) assert.throws(() => percentOf(cents, 10), MoneyError);
  for (const percent of [-1, 101, 12.5, Number.NaN]) assert.throws(() => percentOf(100, percent), MoneyError);
});

test("reconoce centavos y porcentajes válidos", () => {
  assert.equal(isCents(0), true);
  assert.equal(isCents(100), true);
  assert.equal(isCents(-1), false);
  assert.equal(isCents(0.5), false);
  assert.equal(isCents("100"), false);
  assert.equal(isPercent(100), true);
  assert.equal(isPercent(101), false);
  assert.equal(isPercent(33.3), false);
});

test("se muestra en pesos, con centavos solo si los hay", () => {
  assert.equal(formatCents(0), "$ 0");
  assert.equal(formatCents(150000), "$ 1.500");
  assert.equal(formatCents(150050), "$ 1.500,50");
  assert.equal(formatCents(5), "$ 0,05");
  assert.equal(formatCents(123456789), "$ 1.234.567,89");
  assert.equal(formatCents(-150000), "-$ 1.500");
});
