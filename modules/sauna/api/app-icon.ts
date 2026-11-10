import { appIcon, askedIconSize, redirectToStatic, type IconSize } from "@/shared/lib/static-icons";
import { getSite } from "@/platform/sites/server";
import type { SiteContext } from "./route-tools";

// The installed app and the browser tab. Both icons come from public/fropexio-icon*.png, pre-rendered at every size into public/icons/
// (scripts/generate-icons.mjs), so no function resizes them. "any" keeps the brand's rounded square with transparent corners; "maskable"
// fills the whole square, so Android can cut its own shape.
const ICON = { any: "/fropexio-icon.png", maskable: "/fropexio-icon-maskable.png" };
/** The sauna theme's background (docs/DESIGN-SYSTEM.md §3), also the layout's themeColor. */
const BACKGROUND = "#12110c";

/** The pre-rendered icon file. iOS rounds the corners itself and shows transparency as black, so the Apple icon (180) is the full square too. */
export const saunaIcon = (size: IconSize, maskable = false) => appIcon(ICON, size, maskable || size === 180) as string;

const saunaOf = async (context: SiteContext) => {
  const site = await getSite((await context.params).site);
  return site?.kind === "sauna" ? site : undefined;
};

/** Old address (?size=, ?maskable=1), kept for installed apps and cached pages: redirects to the static file. */
export async function getIcon(request: Request, context: SiteContext) {
  if (!await saunaOf(context)) return new Response("No encontrado", { status: 404 });
  const url = new URL(request.url);
  return redirectToStatic(saunaIcon(askedIconSize(url.searchParams.get("size")), url.searchParams.get("maskable") === "1"));
}

/** So the public site can be installed as its own app. */
export async function getManifest(_request: Request, context: SiteContext) {
  const site = await saunaOf(context);
  if (!site) return new Response("No encontrado", { status: 404 });
  const manifest = {
    name: site.name,
    short_name: site.name,
    description: `Reservá tu turno en ${site.name}.`,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "es-AR",
    background_color: BACKGROUND,
    theme_color: BACKGROUND,
    icons: [
      { src: saunaIcon(192), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: saunaIcon(512), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: saunaIcon(192, true), sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: saunaIcon(512, true), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } });
}
