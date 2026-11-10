import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanPlan, durationText, fitsPlan, planProblem, planQuote, planSummary, splitPlan } from "./plans.ts";
import { SetupError } from "./setup.ts";

const draft = { name: " Plan Vitalidad ", description: "", turns: 4, priceCents: 8_000_000, windowDays: 30, durationMinutes: 60, allowsCodes: true, active: true };
const durations = [60, 90];

test("un plan válido se guarda limpio", () => {
  const plan = cleanPlan(draft, durations);
  assert.equal(plan.name, "Plan Vitalidad");
  assert.equal(plan.id, null);
  assert.equal(plan.turns, 4);
  assert.equal(plan.durationMinutes, 60);
  assert.equal(plan.allowsCodes, true);
  assert.equal(cleanPlan({ ...draft, allowsCodes: "sí" }, durations).allowsCodes, false, "solo true acepta códigos");
});

test("un plan fuera de rango se rechaza", () => {
  for (const bad of [{ name: " " }, { turns: 1 }, { turns: 13 }, { turns: 2.5 }, { priceCents: 399 }, { windowDays: 0 }, { name: "x".repeat(81) }, { durationMinutes: undefined }, { durationMinutes: 45 }, { durationMinutes: 60.5 }]) {
    assert.throws(() => cleanPlan({ ...draft, ...bad }, durations), SetupError, JSON.stringify(bad));
  }
});

const sum = (shares: ReturnType<typeof splitPlan>, key: "priceCents" | "discountCents" | "depositCents") => shares.reduce((total, share) => total + share[key], 0);

test("el precio y la seña se reparten en centavos enteros, el resto al primero", () => {
  assert.deepEqual(splitPlan(1_000, 0, 300, 3).map(share => share.priceCents), [334, 333, 333]);
  assert.deepEqual(splitPlan(800, 0, 200, 4), Array(4).fill({ priceCents: 200, discountCents: 0, depositCents: 50 }));
  const shares = splitPlan(999_997, 0, 300_000, 4);
  assert.equal(sum(shares, "priceCents"), 999_997);
  assert.equal(sum(shares, "depositCents"), 300_000);
});

test("con descuento, ningún turno queda con descuento mayor a su precio ni seña mayor a lo que cuesta", () => {
  // The cases where an even split, the rest to the first, would break the bookings' checks: a discount or a deposit close to the price.
  for (const [price, discount, deposit, turns] of [[900, 800, 100, 3], [900, 0, 899, 3], [1_000, 999, 1, 4], [100_003, 100_000, 3, 12], [8_000_000, 8_000_000, 0, 4], [700, 350, 350, 7]]) {
    const shares = splitPlan(price, discount, deposit, turns);
    assert.equal(shares.length, turns);
    assert.deepEqual([sum(shares, "priceCents"), sum(shares, "discountCents"), sum(shares, "depositCents")], [price, discount, deposit], `${price}/${discount}/${deposit}`);
    for (const share of shares) {
      assert.ok(share.discountCents >= 0 && share.discountCents <= share.priceCents, JSON.stringify(share));
      assert.ok(share.depositCents >= 0 && share.depositCents <= share.priceCents - share.discountCents, JSON.stringify(share));
    }
  }
});

test("la seña del plan es el porcentaje del sitio sobre el precio", () => {
  assert.deepEqual(planQuote({ priceCents: 8_000_000 }, 30), { priceCents: 8_000_000, discountCents: 0, totalCents: 8_000_000, depositCents: 2_400_000, balanceCents: 5_600_000 });
});

test("un código se aplica al precio del plan entero y la seña sale del precio con descuento", () => {
  assert.deepEqual(planQuote({ priceCents: 8_000_000 }, 30, { type: "percent", value: 10 }), { priceCents: 8_000_000, discountCents: 800_000, totalCents: 7_200_000, depositCents: 2_160_000, balanceCents: 5_040_000 });
  assert.equal(planQuote({ priceCents: 8_000_000 }, 30, { type: "fixed", value: 9_000_000 }).totalCents, 0, "nunca por debajo de cero");
  assert.equal(planQuote({ priceCents: 8_000_000 }, 30, { type: "free", value: 0 }).depositCents, 0);
  assert.deepEqual(planQuote({ priceCents: 8_000_000 }, 30, { type: "no_deposit", value: 0 }), { priceCents: 8_000_000, discountCents: 0, totalCents: 8_000_000, depositCents: 0, balanceCents: 8_000_000 });
});

test("un plan ofrece solo turnos de su duración; uno sin duración, todos", () => {
  const turn = { startsAt: "2026-11-14T22:00:00Z", endsAt: "2026-11-14T23:30:00Z" };
  assert.equal(fitsPlan(turn, { durationMinutes: 90 }), true);
  assert.equal(fitsPlan(turn, { durationMinutes: 60 }), false);
  assert.equal(fitsPlan(turn, { durationMinutes: null }), true);
});

test("la duración se escribe como se dice", () => {
  assert.deepEqual([45, 60, 90, 120, 150].map(durationText), ["45 minutos", "1 hora", "1 h 30 min", "2 horas", "2 h 30 min"]);
  assert.equal(planSummary({ turns: 4, windowDays: 30, durationMinutes: 60 }), "4 turnos de 1 hora, uno por día, dentro de 30 días");
  assert.equal(planSummary({ turns: 4, windowDays: 30, durationMinutes: null }), "4 turnos, uno por día, dentro de 30 días");
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
