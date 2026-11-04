// Server-only access to Supabase through its REST APIs. The secret key bypasses RLS, so it must never reach the browser.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SECRET_KEY;

export class SupabaseError extends Error {
  code = "SUPABASE";
}

export async function supabase(pathname: string, init: RequestInit = {}) {
  if (!url || !key) throw new SupabaseError("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY.");
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Authorization", `Bearer ${key}`);
  const response = await fetch(`${url}${pathname}`, { ...init, headers, cache: "no-store" }).catch((error: unknown) => {
    throw new SupabaseError(`No se pudo conectar con Supabase: ${error instanceof Error ? error.message : error}`);
  });
  if (!response.ok && response.status !== 404) throw new SupabaseError(`Supabase ${response.status}: ${await response.text()}`);
  return response;
}

/** Calls a Postgres function exposed through PostgREST. */
export async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const response = await supabase(`/rest/v1/rpc/${name}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(args) });
  if (response.status === 404) throw new SupabaseError(`Falta la función ${name} en Supabase.`);
  return response.json() as Promise<T>;
}

/** Reads the JSON document stored under a key in app_data, or null when the row does not exist. */
export async function readDocument(documentKey: string): Promise<unknown> {
  const response = await supabase(`/rest/v1/app_data?key=eq.${encodeURIComponent(documentKey)}&select=data`, { headers: { Accept: "application/json" } });
  if (response.status === 404) throw new SupabaseError("Falta la tabla app_data en Supabase.");
  const rows = await response.json() as { data: unknown }[];
  return rows[0]?.data ?? null;
}

/**
 * Creates the document (revision 0) or updates it if nobody saved since `revision`; false means somebody did.
 * No SQL function needed: the revision filter and the update are one REST statement.
 */
export async function saveDocument(documentKey: string, data: unknown, revision: number): Promise<boolean> {
  const headers = { "Content-Type": "application/json", Accept: "application/json", Prefer: "return=representation" };
  const next = revision + 1;
  try {
    const response = revision === 0
      ? await supabase("/rest/v1/app_data", { method: "POST", headers, body: JSON.stringify({ key: documentKey, data, revision: next }) })
      : await supabase(`/rest/v1/app_data?key=eq.${encodeURIComponent(documentKey)}&revision=eq.${revision}`, { method: "PATCH", headers, body: JSON.stringify({ data, revision: next, updated_at: new Date().toISOString() }) });
    if (response.status === 404) throw new SupabaseError("Falta la tabla app_data en Supabase.");
    return (await response.json() as unknown[]).length > 0;
  } catch (error) {
    // 23505: the first save raced with another first save.
    if (error instanceof SupabaseError && error.message.includes("23505")) return false;
    throw error;
  }
}
