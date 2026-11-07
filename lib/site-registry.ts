import { findIn, seedSites, siteForHostIn, siteKinds, type ProductSiteOptions, type Site, type SiteKind } from "./sites.ts";
import { supabase } from "./supabase.ts";

// Server-only reads of the `sites` and `site_domains` tables (supabase/schema.sql). The sites never depend on the database being up:
// when the tables are missing, empty or unreachable, the seed in lib/sites.ts is served instead.

export type SiteRow = {
  id: string; kind: string; name: string; url: string; catalog_key: string | null; panel_icon: string | null;
  options: Record<string, unknown> | null; site_domains: { domain: string }[] | null; active?: boolean;
};

const isKind = (kind: string): kind is SiteKind => (siteKinds as readonly string[]).includes(kind);

/** A site from its row, or undefined when its kind is not one this code knows (a row added for a newer deploy). */
export function siteFromRow(row: SiteRow): Site | undefined {
  if (!isKind(row.kind)) return undefined;
  return {
    id: row.id, kind: row.kind, name: row.name, url: row.url,
    domains: (row.site_domains ?? []).map(d => d.domain),
    ...(row.catalog_key ? { catalogKey: row.catalog_key } : {}),
    ...(row.panel_icon ? { panelIcon: row.panel_icon } : {}),
    ...(row.kind === "productos" ? { products: row.options as ProductSiteOptions } : {}),
    ...(row.active === false ? { inactive: true as const } : {}),
  };
}

// A few seconds of cache keeps proxy.ts from querying on every visit. It is only a speed-up: Next may run the proxy anywhere,
// so a cold instance simply asks again. While the database fails, the last good copy (or the seed) is served and retried every `ttl`.
const ttl = 30_000;
let cache: { at: number; sites: Site[] } | undefined;
let pending: Promise<Site[]> | undefined;
let warnedAt = 0;
const warn = (error: unknown) => {
  if (Date.now() - warnedAt < 60_000) return;
  warnedAt = Date.now();
  console.warn("[sites] no se pudo leer la tabla sites (¿falta correr supabase/schema.sql?), se usa la lista del código:", error);
};

async function fetchSites(): Promise<Site[]> {
  try {
    const response = await supabase("/rest/v1/sites?select=*,site_domains(domain)&order=position.asc,id.asc", {
      headers: { Accept: "application/json" }, signal: AbortSignal.timeout(4000),
    });
    if (response.status === 404) { warn("falta la tabla sites"); return cache?.sites ?? seedSites; }
    const list = (await response.json() as SiteRow[]).map(siteFromRow).filter((site): site is Site => Boolean(site));
    // An empty table is a table nobody seeded yet, not a platform with no sites.
    return list.length ? list : seedSites;
  } catch (error) {
    warn(error);
    return cache?.sites ?? seedSites;
  }
}

/**
 * Every site, inactive ones included, in the order of the panel's switcher. Only for the panel, behind a session: an inactive site is one being
 * prepared, so whoever manages it has to reach it while the public cannot. Everything public goes through listSites and getSite.
 */
export async function listPanelSites(): Promise<Site[]> {
  if (cache && Date.now() - cache.at < ttl) return cache.sites;
  pending ??= fetchSites().then(list => { cache = { at: Date.now(), sites: list }; return list; }).finally(() => { pending = undefined; });
  return pending;
}

/** Every active site: the ones the public can reach. */
export const activeSites = (list: Site[]) => list.filter(site => !site.inactive);
export async function listSites(): Promise<Site[]> { return activeSites(await listPanelSites()); }

export async function getPanelSite(id: string) { return findIn(await listPanelSites(), id); }
export async function getSite(id: string) { return findIn(await listSites(), id); }
export async function getSiteForHost(host: string, fallback?: string) { return siteForHostIn(await listSites(), host, fallback); }

/** After a write to the registry, so this instance sees it at once (others catch up within the cache time). */
export function forgetSites() { cache = undefined; }
