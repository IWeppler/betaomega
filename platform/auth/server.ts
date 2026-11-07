import "server-only";

// Facade over the session checks, which read cookies and the signing secret.
export { equal, isAdmin, sameOrigin } from "@/lib/auth";
