// Client-safe public entry: types and pure rules only. Server code goes through server.ts.
export { cleanThingName, ThingValidationError } from "./domain/thing";
export type { Thing } from "./domain/thing";
