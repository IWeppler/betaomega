import test from "node:test";
import assert from "node:assert/strict";
import { ingredientPercentages } from "./formula.ts";

test("las partes de una fórmula se convierten a porcentajes", () => {
  assert.deepEqual(ingredientPercentages(["2 partes", "1 parte", "1 parte"]), [50, 25, 25]);
  assert.deepEqual(ingredientPercentages(["0,5 partes", "1.5 partes"]), [25, 75]);
});
test("las proporciones ambiguas no producen porcentajes engañosos", () => {
  for (const amount of ["", "a gusto", "0 partes", "-1 parte", "1 kg"]) {
    assert.deepEqual(ingredientPercentages(["1 parte", amount]), [null, null]);
  }
});
test("reordenar ingredientes conserva su porcentaje correspondiente", () => {
  assert.deepEqual(ingredientPercentages(["1 parte", "2 partes", "1 parte"]), [25, 50, 25]);
});
