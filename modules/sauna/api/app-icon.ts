import sharp from "sharp";
import { getSite } from "@/platform/sites/server";
import type { SiteContext } from "./route-tools";

// The installed app and the browser tab. Both icons come from public/sauna.png, cleaned up: the source has its checkerboard painted in, not transparency.
// "any" keeps the brand's rounded square with transparent corners; "maskable" fills the whole square, so Android can cut its own shape.
const ICON = { any: "/fropexio-icon.png", maskable: "/fropexio-icon-maskable.png" };
/** The sauna theme's background (docs/DESIGN-SYSTEM.md §3), also the layout's themeColor. */
const BACKGROUND = "#12110c";
const SIZES = [32, 64, 180, 192, 512];

const saunaOf = async (context: SiteContext) => {
  const site = await getSite((await context.params).site);
  return site?.kind === "sauna" ? site : undefined;
};

/** ?size= 32, 64 (default), 180 (Apple), 192 or 512. ?maskable=1 serves the full-bleed square. */
export async function getIcon(request: Request, context: SiteContext) {
  if (!await saunaOf(context)) return new Response("No encontrado", { status: 404 });
  const url = new URL(request.url);
  const asked = Number(url.searchParams.get("size"));
  const size = SIZES.includes(asked) ? asked : 64;
  // iOS rounds the corners itself and shows transparency as black, so the Apple icon is the full square too.
  const square = url.searchParams.get("maskable") === "1" || size === 180;
  try {
    // Read through HTTP, not the file system: a serverless function does not carry public/ with it.
    const source = await fetch(new URL(square ? ICON.maskable : ICON.any, request.url), { signal: AbortSignal.timeout(5000) });
    if (!source.ok) throw new Error(`icon ${source.status}`);
    const png = await sharp(Buffer.from(await source.arrayBuffer())).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
    return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } });
  } catch (error) {
    console.error("[sauna/icon]", error instanceof Error ? error.message : "error");
    return new Response("Ícono no disponible", { status: 502 });
  }
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
      { src: "/icon?size=192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon?size=512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon?size=192&maskable=1", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon?size=512&maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } });
}
