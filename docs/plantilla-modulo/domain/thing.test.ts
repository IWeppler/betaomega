import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanThingName, ThingValidationError } from "./thing.ts";

test("un nombre se guarda sin espacios sobrantes", () => {
  assert.equal(cleanThingName("  Sala  "), "Sala");
});

test("un nombre vacío es un error", () => {
  assert.throws(() => cleanThingName("   "), ThingValidationError);
});
