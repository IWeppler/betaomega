import assert from "node:assert/strict";
import test from "node:test";
import { parseVideoStats, shortCount, statsBatches } from "./video-stats.ts";

test("las estadísticas se leen de la respuesta de YouTube y lo raro se ignora", () => {
  const body = { items: [
    { id: "aaaaaaaaaaa", statistics: { viewCount: "1234", likeCount: "56" } },
    { id: "bbbbbbbbbbb", statistics: { viewCount: "99" } },
    { id: "ccccccccccc", statistics: { viewCount: "no" } },
    { id: 5, statistics: { viewCount: "1" } },
    null,
  ] };
  assert.deepEqual(parseVideoStats(body), { aaaaaaaaaaa: { views: 1234, likes: 56 }, bbbbbbbbbbb: { views: 99 } });
  assert.deepEqual(parseVideoStats(null), {});
  assert.deepEqual(parseVideoStats({ error: { code: 403 } }), {});
});

test("los videos se piden de a 50, sin repetir y siempre en el mismo orden", () => {
  const ids = Array.from({ length: 120 }, (_, n) => `id${String(n).padStart(3, "0")}`);
  const batches = statsBatches([...ids, ids[0]].reverse());
  assert.deepEqual(batches.map(batch => batch.length), [50, 50, 20]);
  assert.equal(batches[0][0], "id000");
  assert.deepEqual(statsBatches([]), []);
});

test("los números se acortan como se escriben en Argentina", () => {
  assert.equal(shortCount(950), "950");
  assert.equal(shortCount(1234), "1,2 mil");
  assert.equal(shortCount(1999), "1,9 mil");
  assert.equal(shortCount(25_000), "25 mil");
  assert.equal(shortCount(3_400_000), "3,4 M");
});
