import { getSite } from "@/lib/site-registry";
import { getSettings } from "../brand";

// Minimal web app manifest so the catalog can be installed from the phone (the footer's install button).
// Separate icons, caching and the panel's own app are the PWA group of PLAN.md.
export async function GET(_request: Request, context: { params: Promise<{ site: string }> }) {
  const site = await getSite((await context.params).site);
  if (site?.kind !== "recetas") return new Response("No encontrado", { status: 404 });
  const { tagline, description } = await getSettings(site.id);
  const manifest = {
    name: site.name,
    short_name: site.name,
    description: description || tagline,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "es-AR",
    background_color: "#e55002",
    theme_color: "#e55002",
    icons: [
      { src: "/icon?size=192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon?size=512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon?size=512&maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } });
}
