import sharp from "sharp";
import { findSite } from "@/lib/sites";

// Tab, home-screen and installed-app icon: the Comidas del cielo bowl (public/comidasdelcielo-icon*.png), resized.
// ?size= 32, 64 (default), 180 (Apple), 192, 512. ?maskable=1 serves the full-bleed square for Android's adaptive shapes.
export async function GET(request: Request, context: { params: Promise<{ site: string }> }) {
  const site = findSite((await context.params).site);
  if (site?.kind !== "recetas") return new Response("No encontrado", { status: 404 });
  const url = new URL(request.url);
  const asked = Number(url.searchParams.get("size"));
  const size = [32, 64, 180, 192, 512].includes(asked) ? asked : 64;
  // The Apple icon has no transparency (iOS rounds it itself), so it uses the square version too.
  const square = url.searchParams.get("maskable") === "1" || size === 180;
  try {
    const source = await fetch(new URL(square ? "/comidasdelcielo-icon-maskable.png" : "/comidasdelcielo-icon.png", request.url), { signal: AbortSignal.timeout(5000) });
    if (!source.ok) throw new Error(`icon ${source.status}`);
    const png = await sharp(Buffer.from(await source.arrayBuffer())).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
    return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } });
  } catch (error) {
    console.error("[recetas/icon]", error);
    return new Response("Ícono no disponible", { status: 502 });
  }
}
