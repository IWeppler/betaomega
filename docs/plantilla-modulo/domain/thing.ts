export type Thing = { id: string; name: string };

export class ThingValidationError extends Error {}

const MAX_NAME_LENGTH = 80;

/** Whatever comes from outside is validated here, so the rule has a test and no screen or route can skip it. */
export function cleanThingName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) throw new ThingValidationError("Escribí un nombre.");
  if (name.length > MAX_NAME_LENGTH) throw new ThingValidationError(`El nombre puede tener hasta ${MAX_NAME_LENGTH} caracteres.`);
  return name;
}
