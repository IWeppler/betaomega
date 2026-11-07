import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanSettings, closureFromDays, SetupError } from "./setup.ts";

const settings = { depositPercent: 30, minLeadMinutes: 60, maxAdvanceDays: 60, mpHoldMinutes: 15, transferHoldHours: 12, startStepMinutes: 30, revision: 3 };

test("los ajustes válidos se guardan con el WhatsApp normalizado", () => {
  const clean = cleanSettings({ ...settings, contactWhatsapp: "11 2345 6789" });
  assert.equal(clean.contactWhatsapp, "5491123456789");
  assert.equal(clean.revision, 3);
  assert.equal(cleanSettings({ ...settings, contactWhatsapp: "" }).contactWhatsapp, null);
});

test("un ajuste fuera de rango o un WhatsApp inválido se rechaza", () => {
  for (const bad of [{ depositPercent: 101 }, { depositPercent: 1.5 }, { minLeadMinutes: -1 }, { maxAdvanceDays: 0 }, { mpHoldMinutes: 0 }, { transferHoldHours: 200 }, { contactWhatsapp: "abc" }]) {
    assert.throws(() => cleanSettings({ ...settings, ...bad }), SetupError, JSON.stringify(bad));
  }
});

test("un cierre abarca días completos de Buenos Aires, con los dos extremos, en todo el sauna", () => {
  assert.deepEqual(closureFromDays({ from: "2026-12-24", to: "2026-12-25", reason: " Navidad " }), {
    roomId: null, startsAt: "2026-12-24T03:00:00.000Z", endsAt: "2026-12-26T03:00:00.000Z", reason: "Navidad",
  });
});

test("un cierre con fechas inválidas o al revés se rechaza", () => {
  for (const bad of [{ from: "", to: "2026-12-24" }, { from: "2026-12-25", to: "2026-12-24" }, { from: "2026-02-30", to: "2026-03-01" }]) {
    assert.throws(() => closureFromDays(bad), SetupError, JSON.stringify(bad));
  }
});
