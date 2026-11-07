import { cleanSettings, type SiteSettings } from "./site-settings";
import { siteDocument } from "./site-table";

// Server-only reads and writes of the `site:<id>` documents in app_data.
export class SiteConflictError extends Error {}

/** The stored settings, or null when nobody saved any yet. A document that fails validation counts as missing, so a bad row never takes the site down. */
export async function readSiteSettings(siteId: string): Promise<SiteSettings | null> {
  const document = siteDocument("site", siteId);
  const data = await document.read();
  if (data === null) return null;
  try { return cleanSettings(data); } catch (error) {
    console.warn(`[sites] ${document.key} inválido, se usan los valores por defecto:`, error);
    return null;
  }
}

/** Creates the document (revision 0) or updates it if nobody saved since `settings.revision`. */
export async function saveSiteSettings(siteId: string, settings: SiteSettings): Promise<SiteSettings> {
  const next = { ...settings, revision: settings.revision + 1 };
  if (!await siteDocument("site", siteId).save(next, settings.revision)) throw new SiteConflictError("Otra persona modificó los datos del sitio. Recargá la página antes de guardar.");
  return next;
}
