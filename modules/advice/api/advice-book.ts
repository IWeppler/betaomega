import { isAdmin, sameOrigin } from "@/platform/auth/server";
import { getPanelSite, refreshPublic, publicTags } from "@/platform/sites/server";
import { cleanAdviceBook } from "../domain/advice";
import { AdviceConflictError, readAdviceBook, saveAdviceBook } from "../data/advice-book";

// The panel's reads and saves of the advice book (docs/PATTERNS.md, pattern 8). Only product sites whose options turn the advice on have one.

type SiteContext = { params: Promise<{ site: string }> };
const noStore = { "Cache-Control": "no-store" };
const fail = (status: number, error: string) => Response.json({ error }, { status, headers: noStore });

async function adviceSite(context: SiteContext) {
  const site = await getPanelSite((await context.params).site);
  const chapterName = site?.kind === "productos" ? site.products?.advice?.chapterName : undefined;
  return site && chapterName ? { site, chapterName } : null;
}

/** Validation and conflicts go to the person as they are; Supabase failures are logged and summed up. */
function failure(error: unknown, action: string) {
  if (error instanceof AdviceConflictError) return fail(409, error.message);
  if (error instanceof SyntaxError) return fail(400, "Datos inválidos.");
  if (error instanceof Error && !("code" in error)) return fail(400, error.message);
  console.error(`[advice] ${action} failed:`, error);
  return fail(500, `No se pudo ${action}. Probá de nuevo en un rato.`);
}

export async function getAdviceBook(_request: Request, context: SiteContext) {
  if (!await isAdmin()) return fail(401, "Ingresá como administrador.");
  const found = await adviceSite(context);
  if (!found) return fail(404, "Este sitio no tiene consejos del día.");
  try {
    return Response.json(await readAdviceBook(found.site.id, found.chapterName), { headers: noStore });
  } catch (error) { return failure(error, "leer los consejos"); }
}

/** PUT the whole book, with the revision that was read. The public modal sees the change on the next visit. */
export async function putAdviceBook(request: Request, context: SiteContext) {
  if (!sameOrigin(request) || !await isAdmin()) return fail(403, "Ingresá como administrador para guardar.");
  const found = await adviceSite(context);
  if (!found) return fail(404, "Este sitio no tiene consejos del día.");
  try {
    const body = await request.text();
    if (body.length > 2_000_000) return fail(413, "Los consejos son demasiado largos.");
    const stored = await saveAdviceBook(found.site.id, cleanAdviceBook(JSON.parse(body)));
    refreshPublic(publicTags.advice);
    return Response.json(stored, { headers: noStore });
  } catch (error) { return failure(error, "guardar los consejos"); }
}
