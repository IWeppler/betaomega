import { getSite } from "@/platform/sites/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ site: string }> }) {
  const site = await getSite((await context.params).site);
  if (site?.kind !== "sauna") return new Response("Not found", { status: 404 });
  const urls = ["/", "/terminos"].map(path => `  <url><loc>${site.url}${path}</loc></url>`).join("\n");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
