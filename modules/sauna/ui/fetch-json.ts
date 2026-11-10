/** Every route of this module answers `{ error }` with a message written for the person, so that message is what gets thrown. */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = response.status === 204 ? null : await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(data?.error ?? "No se pudo completar. Probá de nuevo.");
  return data as T;
}

/** `keepalive` lets a change held back by deferChange reach the server even if the page is closing. */
export const sendJson = <T>(url: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown, { keepalive = false } = {}) =>
  fetchJson<T>(url, { method, keepalive, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
