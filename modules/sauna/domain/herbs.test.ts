import { test } from "node:test";
import assert from "node:assert/strict";
import { saunaHerbs, selectedHerb } from "./herbs.ts";

test("sauna offers only explicitly enabled published herbs, alphabetically, without internal fields", () => {
  const herbs = saunaHerbs([
    { id: "z", name: "Zeta", published: true, saunaEnabled: true, saunaDescription: "Texto" },
    { id: "a", name: "Árnica", published: true, saunaEnabled: true },
    { id: "b", name: "B", published: true },
    { id: "c", name: "C", published: false, saunaEnabled: true },
  ]);
  assert.deepEqual(herbs.map(herb => herb.id), ["a", "z"]);
  assert.deepEqual(herbs[0], { id: "a", name: "Árnica", description: "" });
  assert.equal(selectedHerb(herbs, ""), null);
  assert.equal(selectedHerb(herbs, null), null);
  assert.equal(selectedHerb(herbs, "z")?.name, "Zeta");
  for (const invalid of ["b", "removed", ["a", "z"], 12]) assert.throws(() => selectedHerb(herbs, invalid));
});
