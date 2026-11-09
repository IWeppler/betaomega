import { isAdmin, sameOrigin } from "@/platform/auth/server";
import { listPanelSites } from "@/lib/site-registry";
import { cleanLabel, cleanSiteIds } from "@/platform/notifications";

// Shared by the routes of the Avisos screen: the session (and, to write, the same origin), and reading what the screen sends.

export const noStore = { "Cache-Control": "no-store" };
export const fail = (status: number, error: string) => Response.json({ error }, { status, headers: noStore });

/** Null when the request may go on; otherwise the answer to give. */
export async function guard(request: Request, write: boolean): Promise<Response | null> {
  if (write && !sameOrigin(request)) return fail(403, "Origen no permitido.");
  return await isAdmin() ? null : fail(401, "Ingresá como administrador.");
}

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > 4_000) return {};
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch { return {}; }
}

/** The label and the sites a destination chose, kept to the panel's sites. */
export async function choice(body: Record<string, unknown>) {
  const sites = await listPanelSites();
  return { label: cleanLabel(body.label), siteIds: cleanSiteIds(body.siteIds, sites.map(site => site.id)) };
}

/** Logged without details: a failing database or channel must not leak into the answer. */
export function failure(error: unknown, action: string) {
  console.error(`[notifications] ${action} failed:`, error instanceof Error ? error.message.slice(0, 200) : "error");
  return fail(500, `No se pudo ${action}. Revisá que se haya corrido supabase/schema.sql y probá de nuevo.`);
}
