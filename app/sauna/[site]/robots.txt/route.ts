import { getSite } from "@/platform/sites/server";

export const dynamic = "force-dynamic";

// A booking's page is reached only through its secret link, and it stays out of search engines.
export async function GET(_request: Request, context: { params: Promise<{ site: string }> }) {
  const site = await getSite((await context.params).site);
  if (site?.kind !== "sauna") return new Response("Not found", { status: 404 });
  return new Response(`User-agent: *\nAllow: /\nDisallow: /reserva/\n\nSitemap: ${site.url}/sitemap.xml\n`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
