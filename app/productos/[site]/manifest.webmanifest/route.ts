import { findSite } from "@/lib/sites";
import { siteDescription } from "../brand";

// Web app manifest, so each product site can be installed as its own app with its own icon.
export async function GET(_request: Request, context: { params: Promise<{ site: string }> }) {
  const site = findSite((await context.params).site);
  if (!site?.products) return new Response("No encontrado", { status: 404 });
  const manifest = {
    name: site.name,
    short_name: site.name,
    description: siteDescription(site),
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "es-AR",
    background_color: "#f6f8f8",
    theme_color: site.products.accent,
    icons: [
      { src: "/icon?size=192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon?size=512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon?size=512&maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } });
}
