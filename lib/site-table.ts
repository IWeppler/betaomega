import { readDocument, saveDocument, supabase, SupabaseError } from "./supabase.ts";

// Server-only. The one way to touch a table whose rows belong to a site (recipes, comments…): the scope is applied here, never by the caller,
// so forgetting a `site_id` filter in a new query cannot leak or overwrite another site's rows. The server uses the secret key,
// which bypasses RLS, so this layer is the isolation between sites.

export class MissingTableError extends SupabaseError {}

/** The kinds of JSON document a site keeps in app_data. Their stored keys are real data: renaming one loses its rows. */
export type SiteDocumentName = "products" | "site" | "saunaPage";

/** `<name>:<site>`. The id comes from the registry, so anything that could point at another document is a bug, and it throws. */
export function siteDocumentKey(name: SiteDocumentName, siteId: string) {
  if (!/^[a-z0-9-]+$/.test(siteId)) throw new Error(`site-table: id de sitio inválido: ${siteId}`);
  return `${name}:${siteId}`;
}

/** The one way to reach a document of a site in app_data: the key is built here, never by the caller. */
export function siteDocument(name: SiteDocumentName, siteId: string) {
  const key = siteDocumentKey(name, siteId);
  return { key, read: () => readDocument(key), save: (data: unknown, revision: number) => saveDocument(key, data, revision) };
}

/** `?site_id=eq.<id>` followed by the caller's filters. A caller that names `site_id` itself is a bug, so it throws. */
export function scopeQuery(siteId: string, query = "") {
  const rest = query.replace(/^\?/, "");
  if (/(^|&)site_id=/.test(rest)) throw new Error("site-table: la consulta no puede fijar site_id, lo fija la tabla del sitio.");
  return `?site_id=eq.${encodeURIComponent(siteId)}${rest ? `&${rest}` : ""}`;
}

/** The JSON body with `site_id` set to the site's. A body that names another site throws instead of being overwritten silently. */
export function scopeBody(siteId: string, body: string) {
  const stamp = (row: unknown) => {
    if (typeof row !== "object" || row === null || Array.isArray(row)) throw new Error("site-table: el cuerpo debe ser un objeto o una lista de objetos.");
    const named = (row as { site_id?: unknown }).site_id;
    if (named !== undefined && named !== siteId) throw new Error(`site-table: el cuerpo es del sitio ${String(named)} y la tabla es del sitio ${siteId}.`);
    return { ...row, site_id: siteId };
  };
  const parsed: unknown = JSON.parse(body);
  return JSON.stringify(Array.isArray(parsed) ? parsed.map(stamp) : stamp(parsed));
}

/**
 * A table of the panel itself, not of a site (the notices' destinations). Only for tables whose rows belong to no site: everything else goes
 * through siteTable. `query` holds the filters; a string body is sent as JSON and the written rows come back.
 */
export function panelTable<Row>(table: `panel_${string}`, missing: string) {
  return async (query = "", init: RequestInit = {}): Promise<Row[]> => {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (typeof init.body === "string") {
      headers.set("Content-Type", "application/json");
      if (!headers.has("Prefer")) headers.set("Prefer", "return=representation");
    }
    const rest = query.replace(/^\?/, "");
    const response = await supabase(`/rest/v1/${table}${rest ? `?${rest}` : ""}`, { ...init, headers });
    if (response.status === 404) throw new MissingTableError(missing);
    return response.status === 204 ? [] : await response.json() as Row[];
  };
}

/**
 * Reads and writes the rows of `table` that belong to `siteId`. `query` holds only the caller's own filters (`id=eq.…&select=*`).
 * `missing` words the error for a table that does not exist yet, which in this project means schema.sql was not run.
 */
export function siteTable<Row>(table: string, siteId: string, missing: string) {
  return async (query = "", init: RequestInit = {}): Promise<Row[]> => {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    let body = init.body;
    if (typeof body === "string") {
      body = scopeBody(siteId, body);
      headers.set("Content-Type", "application/json");
      headers.set("Prefer", "return=representation");
    }
    const response = await supabase(`/rest/v1/${table}${scopeQuery(siteId, query)}`, { ...init, headers, body });
    if (response.status === 404) throw new MissingTableError(missing);
    return response.status === 204 ? [] : await response.json() as Row[];
  };
}
