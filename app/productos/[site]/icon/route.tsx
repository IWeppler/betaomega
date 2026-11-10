import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getSite } from "@/lib/site-registry";
import { appIcon, askedIconSize, redirectToStatic } from "@/shared/lib/static-icons";

// Tab, home-screen and installed-app icon. Icons pre-rendered into public/icons/ redirect there (pages point there directly, see productIcon);
// a site added later from the database gets its icon files resized here, or its initial on the accent colour when it has none.
// ?size= 32, 64 (default), 180 (Apple), 192, 512. ?maskable=1 serves the full-bleed square for Android's adaptive shapes.
export async function GET(request: Request, context: { params: Promise<{ site: string }> }) {
  const site = await getSite((await context.params).site);
  if (!site?.products) return new Response("No encontrado", { status: 404 });
  const url = new URL(request.url);
  const size = askedIconSize(url.searchParams.get("size"));
  const headers = { "Cache-Control": "public, max-age=86400, s-maxage=86400" };
  const { accent, icon } = site.products;
  if (!icon) {
    return new ImageResponse(
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: accent, color: "#fff", fontSize: size * 0.62, fontWeight: 700 }}>{site.name.slice(0, 1)}</div>,
      { width: size, height: size, headers },
    );
  }
  // The Apple icon has no transparency (iOS rounds it itself), so it uses the square version too.
  const square = url.searchParams.get("maskable") === "1" || size === 180;
  const prerendered = appIcon(icon, size, square);
  if (prerendered) return redirectToStatic(prerendered);
  try {
    const source = await fetch(new URL(square ? icon.maskable : icon.any, request.url), { signal: AbortSignal.timeout(5000) });
    if (!source.ok) throw new Error(`icon ${source.status}`);
    const png = await sharp(Buffer.from(await source.arrayBuffer())).resize(size, size).png({ compressionLevel: 6 }).toBuffer();
    return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", ...headers } });
  } catch (error) {
    console.error("[productos/icon]", error);
    return new Response("Ícono no disponible", { status: 502 });
  }
}
