// Web app manifest of the admin panel, served on the panel host (proxy.ts rewrites /manifest.webmanifest here).
// Its own app, separate from each site's: the panel always needs the network, so nothing is cached.
export function GET() {
  const manifest = {
    name: "BetaOmega",
    short_name: "BetaOmega",
    description: "Panel de administración de los sitios.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "es-AR",
    background_color: "#fffefe",
    theme_color: "#f2f2f1",
    icons: [
      { src: "/betayomega-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/betayomega-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/betayomega-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } });
}
