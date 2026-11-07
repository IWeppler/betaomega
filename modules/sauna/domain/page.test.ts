import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanPage, hoursSummary, pageDefaults } from "./page.ts";
import { SetupError } from "./setup.ts";

const band = (weekday: number, from = "10:00", to = "19:45") => ({ weekday, from, to, typeIds: ["t"] });

test("los textos iniciales no prometen beneficios de salud", () => {
  const defaults = pageDefaults();
  const health = [defaults.headline, defaults.intro, defaults.description, ...defaults.recommendations, ...defaults.indications, ...defaults.contraindications].join(" ");
  assert.doesNotMatch(health, /\b(cura|sana|sanar|desintoxic\w*|adelgaz\w*|terap\w*|beneficio\w*)\b/i);
  assert.ok(defaults.contraindications.includes("Embarazo"));
});

test("los textos iniciales cumplen las mismas reglas que lo que se carga en el panel", () => {
  const defaults = pageDefaults();
  assert.deepEqual(cleanPage(defaults), defaults);
});

test("el contenido válido se limpia y las listas se leen línea por línea", () => {
  const clean = cleanPage({ headline: " Calor ", bring: "Toalla\n\n  Ojotas  \n", includes: ["Ducha", " "], mapUrl: "https://maps.example/x", revision: 2 });
  assert.equal(clean.headline, "Calor");
  assert.deepEqual(clean.bring, ["Toalla", "Ojotas"]);
  assert.deepEqual(clean.includes, ["Ducha"]);
  assert.equal(clean.revision, 2);
});

test("los valores que faltan quedan vacíos, no rompen", () => {
  const clean = cleanPage({ headline: "Calor" });
  assert.deepEqual(clean.contraindications, []);
  assert.equal(clean.address, "");
  assert.equal(clean.revision, 0);
});

test("un contenido inválido se rechaza", () => {
  for (const bad of [{ headline: "" }, { headline: "x".repeat(71) }, { headline: "x", intro: 5 }, { headline: "x", mapUrl: "javascript:alert(1)" }, { headline: "x", mapUrl: "http://sin-cifrar.example" }, { headline: "x", bring: Array(13).fill("a") }, { headline: "x", bring: ["x".repeat(201)] }, null]) {
    assert.throws(() => cleanPage(bad), SetupError, JSON.stringify(bad));
  }
});

test("los horarios se resumen uniendo días seguidos, con el lunes primero", () => {
  assert.deepEqual(hoursSummary([band(0), band(1), band(2), band(3), band(4), band(5)]), ["Lunes a viernes: 10:00 a 19:45", "Domingo: 10:00 a 19:45"]);
});

test("dos días seguidos se nombran con y, y uno solo por su nombre", () => {
  assert.deepEqual(hoursSummary([band(6), band(0)]), ["Sábado y domingo: 10:00 a 19:45"]);
  assert.deepEqual(hoursSummary([band(3)]), ["Miércoles: 10:00 a 19:45"]);
});

test("un día con varias franjas las nombra en orden y no se une a otro distinto", () => {
  assert.deepEqual(hoursSummary([band(1, "16:00", "20:00"), band(1, "09:00", "13:00"), band(2)]), ["Lunes: 09:00 a 13:00 y 16:00 a 20:00", "Martes: 10:00 a 19:45"]);
});

test("días con el mismo horario pero no seguidos no se unen", () => {
  assert.deepEqual(hoursSummary([band(1), band(3)]), ["Lunes: 10:00 a 19:45", "Miércoles: 10:00 a 19:45"]);
});

test("sin franjas no hay nada que mostrar", () => {
  assert.deepEqual(hoursSummary([]), []);
});
