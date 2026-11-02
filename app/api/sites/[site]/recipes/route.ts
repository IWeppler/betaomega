import { isAdmin } from "@/lib/auth";
import { previewToken } from "@/lib/preview";
import { listRecipes } from "@/lib/recipe-store";
import { failure, notFound, recipeSite, type SiteParams } from "./helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The panel's list, drafts included, each with its preview signature. The public site reads the table on the server.
export async function GET(_request: Request, { params }: SiteParams) {
  if (!await isAdmin()) return Response.json({ error: "Ingresá como administrador." }, { status: 401 });
  const site = await recipeSite(params);
  if (!site) return notFound();
  try {
    const recipes = (await listRecipes(site.id)).map(r => ({ ...r, previewToken: previewToken(site.id, r.id) }));
    return Response.json(recipes, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error, "leer las recetas"); }
}
