import { notFound } from "next/navigation";
import { getSite } from "@/lib/site-registry";

// The installed app opens on the team's finder (/equipo), as it did before the store took the home page.
// id stays "/" (the old start_url) so tablets that already installed it keep the same app.
export async function GET(_request: Request, { params }: { params: Promise<{ site: string }> }) {
  const site = await getSite((await params).site);
  if (!site) notFound();
  return Response.json({
    name: site.name,
    short_name: site.name,
    description: "Consulta rápida de tónicos para el equipo.",
    lang: "es",
    id: "/",
    start_url: "/equipo",
    scope: "/",
    display: "standalone",
    background_color: "#f3f5f1",
    theme_color: "#1c7a4d",
    icons: [
      { src: "/pwa-icon?size=192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon?size=512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon?size=512&maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }, { headers: { "Content-Type": "application/manifest+json" } });
}
