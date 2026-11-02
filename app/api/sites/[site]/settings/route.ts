import { isAdmin, sameOrigin } from "@/lib/auth";
import { cleanSettings } from "@/lib/site-settings";
import { readSiteSettings, saveSiteSettings } from "@/lib/site-store";
import { failure, forbidden, notFound, recipeSite, type SiteParams } from "../recipes/helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stored values only (empty = the template's text). The panel shows the defaults as placeholders.
export async function GET(_request: Request, { params }: SiteParams) {
  if (!await isAdmin()) return Response.json({ error: "Ingresá como administrador." }, { status: 401 });
  const site = await recipeSite(params);
  if (!site) return notFound();
  try {
    const stored = await readSiteSettings(site.id);
    return Response.json(stored ?? cleanSettings({ revision: 0 }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error, "leer los datos del sitio"); }
}

export async function PUT(request: Request, { params }: SiteParams) {
  if (!sameOrigin(request) || !await isAdmin()) return forbidden();
  const site = await recipeSite(params);
  if (!site) return notFound();
  try {
    const text = await request.text();
    if (text.length > 20_000) return Response.json({ error: "Los datos son demasiado largos." }, { status: 413 });
    return Response.json(await saveSiteSettings(site.id, cleanSettings(JSON.parse(text))));
  } catch (error) { return failure(error, "guardar los datos del sitio"); }
}
