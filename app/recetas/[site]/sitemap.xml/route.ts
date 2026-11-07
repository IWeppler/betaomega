import { listPublishedRecipes } from "@/lib/recipe-store";
import { getSite } from "@/lib/site-registry";

// Next treats a route named like a metadata file as static; this one depends on the host and the data.
export const dynamic = "force-dynamic";

// Served at /sitemap.xml of each recipe site's own host: the home page and every published recipe.
export async function GET(_request: Request, context: { params: Promise<{ site: string }> }) {
  const site = await getSite((await context.params).site);
  if (site?.kind !== "recetas") return new Response("No encontrado", { status: 404 });
  let recipes;
  try { recipes = await listPublishedRecipes(site.id); } catch (error) {
    console.error("[recetas/sitemap] read failed:", error);
    return new Response("No se pudo armar el mapa del sitio", { status: 503 });
  }
  const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const entry = (path: string, modified?: string) => `  <url><loc>${escape(`${site.url}${path}`)}</loc>${modified ? `<lastmod>${modified.slice(0, 10)}</lastmod>` : ""}</url>`;
  const body = [entry("/", recipes[0]?.updatedAt), ...recipes.map(r => entry(`/${r.slug}`, r.updatedAt))].join("\n");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
