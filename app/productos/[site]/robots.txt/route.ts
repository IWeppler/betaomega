import { getSite } from "@/lib/site-registry";

// Next treats a route named like a metadata file as static; this one depends on the host.
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ site: string }> }) {
  const site = await getSite((await context.params).site);
  if (site?.kind !== "productos") return new Response("No encontrado", { status: 404 });
  return new Response(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${site.url}/sitemap.xml\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
