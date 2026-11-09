import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanPlan, planProblem, planQuote, splitCents } from "./plans.ts";
import { SetupError } from "./setup.ts";

const draft = { name: " Plan Vitalidad ", description: "", turns: 4, priceCents: 8_000_000, windowDays: 30, active: true };

test("un plan válido se guarda limpio", () => {
  const plan = cleanPlan(draft);
  assert.equal(plan.name, "Plan Vitalidad");
  assert.equal(plan.id, null);
  assert.equal(plan.turns, 4);
});

test("un plan fuera de rango se rechaza", () => {
  for (const bad of [{ name: " " }, { turns: 1 }, { turns: 13 }, { turns: 2.5 }, { priceCents: 399 }, { windowDays: 0 }, { name: "x".repeat(81) }]) {
    assert.throws(() => cleanPlan({ ...draft, ...bad }), SetupError, JSON.stringify(bad));
  }
});

test("el precio y la seña se reparten en centavos enteros, el resto al primero", () => {
  assert.deepEqual(splitCents(1_000, 3), [334, 333, 333]);
  assert.deepEqual(splitCents(800, 4), [200, 200, 200, 200]);
  assert.equal(splitCents(999_997, 4).reduce((a, b) => a + b, 0), 999_997);
});

test("la seña del plan es el porcentaje del sitio sobre el precio", () => {
  assert.deepEqual(planQuote({ priceCents: 8_000_000 }, 30), { totalCents: 8_000_000, depositCents: 2_400_000, balanceCents: 5_600_000 });
});

test("los turnos van en días distintos, dentro de la ventana y en la cantidad del plan", () => {
  const plan = { turns: 3, windowDays: 7 };
  // 19:00 and 22:00 in Buenos Aires, Saturday 14 November 2026: the same day, although 22:00 is already Sunday in UTC.
  assert.equal(planProblem(["2026-11-14T22:00:00Z", "2026-11-15T01:00:00Z"], plan, false), "plan_same_day");
  assert.equal(planProblem(["2026-11-14T22:00:00Z", "2026-11-20T22:00:00Z"], plan, false), null, "seis días después entra en una ventana de 7");
  assert.equal(planProblem(["2026-11-14T22:00:00Z", "2026-11-21T22:00:00Z"], plan, false), "plan_window");
  assert.equal(planProblem(["2026-11-14T22:00:00Z", "2026-11-15T22:00:00Z"], plan, true), "plan_turn_count");
  assert.equal(planProblem(["2026-11-14T22:00:00Z", "2026-11-15T22:00:00Z", "2026-11-16T22:00:00Z"], plan, true), null);
});
