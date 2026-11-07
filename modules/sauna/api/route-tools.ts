import { isAdmin, sameOrigin } from "@/platform/auth/server";
import { getPanelSite } from "@/platform/sites/server";
import type { Site } from "@/platform/sites";
import { SetupConflictError } from "../data/setup";
import { CustomerError } from "../domain/customer";
import { SetupError } from "../domain/setup";

// The defence every route of this module repeats (docs/PATTERNS.md, pattern 8).

export type SiteContext = { params: Promise<{ site: string }> };

export const noStore = { "Cache-Control": "no-store" };
export const fail = (status: number, error: string) => Response.json({ error }, { status });

/** Over the size limit, or unreadable: an answer for the person instead of the data. */
export class BodyError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function readJson(request: Request, limit: number): Promise<unknown> {
  const body = await request.text();
  if (body.length > limit) throw new BodyError(413, "Los datos son demasiado grandes.");
  try { return JSON.parse(body); } catch { throw new BodyError(400, "Datos inválidos."); }
}

// Numbers are masked because a database error can quote the row, and logs carry no personal data.
const forLog = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 300).replace(/\d{8,}/g, "…");

/** Validation and conflicts go back to the person as they are; anything else is logged and summarized. */
export function failure(error: unknown, action: string) {
  if (error instanceof BodyError) return fail(error.status, error.message);
  if (error instanceof SetupError || error instanceof CustomerError) return fail(400, error.message);
  if (error instanceof SetupConflictError) return fail(409, error.message);
  console.error(`[sauna] ${action} failed:`, forLog(error));
  return fail(500, `No se pudo ${action}. Probá de nuevo.`);
}

type Handler<C> = (request: Request, site: Site, context: C) => Promise<Response>;

/** A route of the panel: an inactive site counts, because it is being prepared from there. */
function panelRoute<C extends SiteContext>(write: boolean, handler: Handler<C>) {
  return async (request: Request, context: C): Promise<Response> => {
    if (write ? !sameOrigin(request) || !await isAdmin() : !await isAdmin()) return fail(write ? 403 : 401, "Ingresá como administrador.");
    const site = await getPanelSite((await context.params).site);
    if (site?.kind !== "sauna") return fail(404, "Sitio no encontrado.");
    return handler(request, site, context);
  };
}

export const panelRead = <C extends SiteContext>(handler: Handler<C>) => panelRoute(false, handler);
export const panelWrite = <C extends SiteContext>(handler: Handler<C>) => panelRoute(true, handler);
