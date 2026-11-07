import { listPublishedProducts } from "@/lib/product-store";
import { getSite } from "@/lib/site-registry";

// Next treats a route named like a metadata file as static; this one depends on the host and the data.
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ site: string }> }) {
  const site = await getSite((await context.params).site);
  if (site?.kind !== "productos") return new Response("No encontrado", { status: 404 });
  let products;
  try { products = await listPublishedProducts(site); } catch (error) {
    console.error("[productos/sitemap] read failed:", error);
    return new Response("No se pudo armar el mapa del sitio", { status: 503 });
  }
  const paths = ["/", ...products.map(p => `/${p.slug}`)];
  const body = paths.map(path => `  <url><loc>${site.url}${path}</loc></url>`).join("\n");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
