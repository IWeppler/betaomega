import assert from "node:assert/strict";
import test from "node:test";
import { cleanComment, hasLink, isCommentStatus, sentTooFast } from "./comments.ts";
import { cleanMetric, fillDays, looksLikeBot, searchTerm, shiftDay } from "./metrics.ts";

test("un comentario se limpia y el nombre es obligatorio", () => {
  assert.deepEqual(cleanComment({ voiceId: "abc", name: "  Ana   María ", body: "  Gracias \r\n\n\n\npor esto. " }), { voiceId: "abc", name: "Ana María", body: "Gracias\n\npor esto." });
  assert.throws(() => cleanComment({ voiceId: "abc", name: "  ", body: "Hola" }), /tu nombre/);
  assert.throws(() => cleanComment({ voiceId: "abc", name: "Ana", body: "a" }), /tu comentario/);
  assert.throws(() => cleanComment({ voiceId: "", name: "Ana", body: "Hola" }), /Voz inválida/);
  assert.throws(() => cleanComment({ voiceId: "abc", name: "Ana", body: "x".repeat(1001) }), /demasiado largo/);
  assert.throws(() => cleanComment({ voiceId: "abc", name: "Ana", body: "mirá www.spam.com" }), /enlaces/);
  assert.equal(hasLink("https://x"), true);
  assert.equal(isCommentStatus("approved"), true);
  assert.equal(isCommentStatus("deleted"), false);
});

test("un formulario enviado al instante no lo mandó una persona", () => {
  const now = 1_000_000;
  assert.equal(sentTooFast(now - 1000, now), true);
  assert.equal(sentTooFast(now - 5000, now), false);
  assert.equal(sentTooFast(undefined, now), true);
  assert.equal(sentTooFast(now + 120_000, now), true);
});

test("una búsqueda se cuenta igual sin importar mayúsculas, tildes ni signos", () => {
  assert.equal(searchTerm("  Protección,  FAMILIA "), "proteccion familia");
  assert.equal(searchTerm("¿Enemigos?"), "enemigos");
  assert.equal(searchTerm("ab"), "");
  assert.equal(searchTerm("x".repeat(80)).length, 60);
});

test("los eventos del sitio se validan antes de llegar a la base", () => {
  assert.deepEqual(cleanMetric({ kind: "view" }), { kind: "view" });
  assert.deepEqual(cleanMetric({ kind: "view", voiceId: "1f6c-voz" }), { kind: "view", voiceId: "1f6c-voz" });
  assert.deepEqual(cleanMetric({ kind: "search", term: "Paz Interior" }), { kind: "search", term: "paz interior" });
  assert.throws(() => cleanMetric({ kind: "view", voiceId: "<script>" }), /Voz inválida/);
  assert.throws(() => cleanMetric({ kind: "search", term: "a" }), /Búsqueda inválida/);
  assert.throws(() => cleanMetric({ kind: "share" }), /Evento inválido/);
});

test("los robots no cuentan como lectores", () => {
  assert.equal(looksLikeBot("Mozilla/5.0 (compatible; Googlebot/2.1)"), true);
  assert.equal(looksLikeBot("WhatsApp/2.23"), true);
  assert.equal(looksLikeBot(null), true);
  assert.equal(looksLikeBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1"), false);
});

test("los días sin actividad aparecen en cero", () => {
  assert.equal(shiftDay("2026-03-01", -1), "2026-02-28");
  const rows = fillDays({ today: "2026-11-26", days: 3, daily: [{ day: "2026-11-25", pageViews: 4, voiceViews: 2, searches: 1 }] });
  assert.deepEqual(rows.map(row => [row.day, row.pageViews]), [["2026-11-24", 0], ["2026-11-25", 4], ["2026-11-26", 0]]);
});
