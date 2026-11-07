import { isAdmin, sameOrigin } from "@/lib/auth";
import { ProductConflictError, readProducts, saveProducts } from "@/lib/product-store";
import { getSite } from "@/lib/site-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SiteParams = { params: Promise<{ site: string }> };
const productSite = async (params: SiteParams["params"]) => {
  const site = await getSite((await params).site);
  return site?.kind === "productos" ? site : undefined;
};
const notFound = () => Response.json({ error: "Sitio no encontrado." }, { status: 404 });

/** Validation and conflicts go back to the person as they are; Supabase failures are logged and summarized. */
function failure(error: unknown, action: string) {
  if (error instanceof ProductConflictError) return Response.json({ error: error.message }, { status: 409 });
  if (error instanceof SyntaxError) return Response.json({ error: "Lista inválida." }, { status: 400 });
  if (error instanceof Error && !("code" in error)) return Response.json({ error: error.message }, { status: 400 });
  console.error(`[products] ${action} failed:`, error);
  // Only administrators reach this point, so the cause is returned to make production failures diagnosable.
  const cause = error instanceof Error ? error.message.slice(0, 300) : String(error);
  return Response.json({ error: `No se pudo ${action}: ${cause}` }, { status: 500 });
}

export async function GET(_request: Request, { params }: SiteParams) {
  if (!await isAdmin()) return Response.json({ error: "Ingresá como administrador." }, { status: 401 });
  const site = await productSite(params);
  if (!site) return notFound();
  try {
    return Response.json(await readProducts(site), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error, "leer los datos"); }
}

export async function PUT(request: Request, { params }: SiteParams) {
  if (!sameOrigin(request) || !await isAdmin()) return Response.json({ error: "Ingresá como administrador para guardar." }, { status: 403 });
  const site = await productSite(params);
  if (!site) return notFound();
  try {
    const body = await request.text();
    if (body.length > 2_000_000) return Response.json({ error: "La lista es demasiado grande." }, { status: 413 });
    return Response.json(await saveProducts(site, JSON.parse(body)));
  } catch (error) { return failure(error, "guardar los datos"); }
}
