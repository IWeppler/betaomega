import { cleanSettings, settingsKey, type SiteSettings } from "./site-settings";
import { SupabaseError, readDocument, supabase } from "./supabase";

// Server-only reads and writes of the `site:<id>` documents in app_data. No SQL function needed: the revision filter and the update are one REST statement.
export class SiteConflictError extends Error {}
const conflict = () => new SiteConflictError("Otra persona modificó los datos del sitio. Recargá la página antes de guardar.");

/** The stored settings, or null when nobody saved any yet. A document that fails validation counts as missing, so a bad row never takes the site down. */
export async function readSiteSettings(siteId: string): Promise<SiteSettings | null> {
  const data = await readDocument(settingsKey(siteId));
  if (data === null) return null;
  try { return cleanSettings(data); } catch (error) {
    console.warn(`[sites] ${settingsKey(siteId)} inválido, se usan los valores por defecto:`, error);
    return null;
  }
}

/** Creates the document (revision 0) or updates it if nobody saved since `settings.revision`. */
export async function saveSiteSettings(siteId: string, settings: SiteSettings): Promise<SiteSettings> {
  const next = { ...settings, revision: settings.revision + 1 };
  const key = settingsKey(siteId);
  const headers = { "Content-Type": "application/json", Accept: "application/json", Prefer: "return=representation" };
  let rows: unknown[];
  try {
    const body = JSON.stringify(settings.revision === 0 ? { key, data: next, revision: next.revision } : { data: next, revision: next.revision, updated_at: new Date().toISOString() });
    const response = settings.revision === 0
      ? await supabase("/rest/v1/app_data", { method: "POST", headers, body })
      : await supabase(`/rest/v1/app_data?key=eq.${encodeURIComponent(key)}&revision=eq.${settings.revision}`, { method: "PATCH", headers, body });
    if (response.status === 404) throw new SupabaseError("Falta la tabla app_data en Supabase.");
    rows = await response.json() as unknown[];
  } catch (error) {
    // 23505: the first save raced with another first save.
    if (error instanceof SupabaseError && error.message.includes("23505")) throw conflict();
    throw error;
  }
  if (!rows.length) throw conflict();
  return next;
}
