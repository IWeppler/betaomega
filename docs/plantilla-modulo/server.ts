import "server-only";

// Server public entry: the build fails if a client component imports this file.
export { getThings } from "./api/things";
export { listThings } from "./data/things";
