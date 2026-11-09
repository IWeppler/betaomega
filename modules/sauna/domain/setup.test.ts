import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanSettings, closureFromDays, firstBookableDay, isValidCbu, SetupError, transferAccount } from "./setup.ts";

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

test("la fecha de apertura es opcional, y si no llegó corre el primer día que se muestra", () => {
  assert.equal(cleanSettings(settings).opensOn, null);
  assert.equal(cleanSettings({ ...settings, opensOn: "" }).opensOn, null);
  assert.equal(cleanSettings({ ...settings, opensOn: "2026-11-14" }).opensOn, "2026-11-14");
  assert.throws(() => cleanSettings({ ...settings, opensOn: "2026-02-30" }), SetupError);
  assert.equal(firstBookableDay("2026-11-09", "2026-11-14"), "2026-11-14");
  assert.equal(firstBookableDay("2026-11-20", "2026-11-14"), "2026-11-20");
  assert.equal(firstBookableDay("2026-11-09", null), "2026-11-09");
});

// Built with the BCRA check digits: block 1 = 2850590 + 9, block 2 = 4009041813520 + 1.
const CBU = "2850590940090418135201";

test("un CBU o CVU vale solo con sus dos dígitos verificadores", () => {
  assert.equal(isValidCbu(CBU), true);
  assert.equal(isValidCbu("2850590840090418135201"), false, "primer bloque");
  assert.equal(isValidCbu("2850590940090418135202"), false, "segundo bloque");
  assert.equal(isValidCbu("285059094009041813520"), false, "21 números");
});

test("los datos de transferencia se guardan limpios, o vacíos para no ofrecerla", () => {
  const clean = cleanSettings({ ...settings, transferAlias: " sauna.fropexio ", transferCbu: "2850590940 090418135201", transferHolder: " Ana Pérez " });
  assert.deepEqual([clean.transferAlias, clean.transferCbu, clean.transferHolder], ["sauna.fropexio", CBU, "Ana Pérez"]);
  assert.deepEqual(transferAccount(clean), { alias: "sauna.fropexio", cbu: CBU, holder: "Ana Pérez" });
  const off = cleanSettings({ ...settings, transferAlias: "", transferCbu: null });
  assert.equal(transferAccount(off), null);
  assert.deepEqual(transferAccount(cleanSettings({ ...settings, transferAlias: "sauna.fropexio", transferHolder: "Ana" })), { alias: "sauna.fropexio", cbu: null, holder: "Ana" });
});

test("una cuenta sin titular, un titular sin cuenta o un alias o CBU mal escritos se rechazan", () => {
  for (const bad of [
    { transferAlias: "sauna.fropexio" }, { transferCbu: CBU }, { transferHolder: "Ana" }, { transferAlias: "corto", transferHolder: "Ana" },
    { transferAlias: "con espacio", transferHolder: "Ana" }, { transferCbu: "2850590840090418135201", transferHolder: "Ana" }, { transferAlias: 7, transferHolder: "Ana" },
  ]) {
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
