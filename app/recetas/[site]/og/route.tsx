import { ImageResponse } from "next/og";
import sharp from "sharp";
import { findSite } from "@/lib/sites";
import { brand, getRecipes, getSettings } from "../brand";

// Social preview, 1200 × 630. Without ?receta= it is the site's card (logo + name); with the slug of a
// published recipe it is the recipe's photo with its title. next/og cannot read webp, so the logo ships as a PNG
// and recipe photos are re-encoded as JPEG here.
const logoPath = brand.logo.replace(/\.webp$/, ".png");

async function dataUri(url: URL, width: number): Promise<string | undefined> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return undefined;
    const jpeg = await sharp(Buffer.from(await response.arrayBuffer())).resize({ width, height: 630, fit: "cover" }).jpeg({ quality: 82 }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch { return undefined; }
}

async function logoUri(request: Request): Promise<string | undefined> {
  try {
    const response = await fetch(new URL(logoPath, request.url), { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return undefined;
    return `data:image/png;base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
  } catch { return undefined; }
}

export async function GET(request: Request, context: { params: Promise<{ site: string }> }) {
  const site = findSite((await context.params).site);
  if (site?.kind !== "recetas") return new Response("No encontrado", { status: 404 });
  const options = { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=86400" } };
  const logo = await logoUri(request);
  const slug = new URL(request.url).searchParams.get("receta");

  if (slug) {
    const recipe = (await getRecipes(site.id).catch(() => [])).find(r => r.slug === slug);
    const photo = recipe?.image ? await dataUri(new URL(recipe.image, request.url), 1200) : undefined;
    if (recipe && photo) {
      return new ImageResponse(
        <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: brand.ink }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} width={1200} height={630} alt="" style={{ position: "absolute", inset: 0 }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", background: "linear-gradient(to top, rgba(35,26,20,0.92) 0%, rgba(35,26,20,0.55) 45%, rgba(35,26,20,0) 75%)" }} />
          <div style={{ position: "absolute", left: 64, right: 64, bottom: 52, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", maxWidth: logo ? 860 : 1070 }}>
              <div style={{ fontSize: 30, color: "#fbca6d", letterSpacing: 2, textTransform: "uppercase" }}>{site.name}</div>
              <div style={{ fontSize: recipe.title.length > 48 ? 56 : 72, fontWeight: 700, lineHeight: 1.08, marginTop: 12, color: "#fff" }}>{recipe.title}</div>
            </div>
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} width={120} height={160} alt="" style={{ borderRadius: 14, border: "3px solid #fff" }} />
            )}
          </div>
        </div>,
        options,
      );
    }
  }

  // The site's card is the Yodhkum cover itself: whole, centered, over a blurred copy of itself to fill 1200 × 630.
  try {
    const response = await fetch(new URL(brand.logo, request.url), { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      const source = Buffer.from(await response.arrayBuffer());
      const background = await sharp(source).resize(1200, 630, { fit: "cover", position: "top" }).blur(40).modulate({ brightness: 0.75 }).toBuffer();
      const poster = await sharp(source).resize({ height: 630 }).toBuffer();
      const jpeg = await sharp(background).composite([{ input: poster, gravity: "center" }]).jpeg({ quality: 85 }).toBuffer();
      return new Response(new Uint8Array(jpeg), { headers: { "Content-Type": "image/jpeg", "Cache-Control": options.headers["Cache-Control"] } });
    }
  } catch { /* falls back to the text card */ }

  const { tagline } = await getSettings(site.id);
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", background: brand.background, color: brand.ink, borderBottom: `28px solid ${brand.accent}` }}>
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} width={367} height={490} alt="" style={{ marginLeft: 80, borderRadius: 18, boxShadow: "0 12px 40px rgba(35,26,20,0.25)" }} />
      )}
      <div style={{ display: "flex", flexDirection: "column", marginLeft: logo ? 64 : 96, marginRight: 56, flex: 1 }}>
        <div style={{ fontSize: 32, color: brand.accent, letterSpacing: 2, textTransform: "uppercase" }}>{tagline}</div>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, marginTop: 16 }}>{site.name}</div>
        <div style={{ fontSize: 32, marginTop: 28, color: "#6a5b50" }}>Ingredientes, tiempos y preparación paso a paso.</div>
      </div>
    </div>,
    options,
  );
}
