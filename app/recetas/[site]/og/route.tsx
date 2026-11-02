import { ImageResponse } from "next/og";
import { findSite } from "@/lib/sites";
import { brand, getSettings } from "../brand";

// Social preview, 1200 × 630, for the home page and recipes without a photo.
export async function GET(_request: Request, context: { params: Promise<{ site: string }> }) {
  const site = findSite((await context.params).site);
  if (site?.kind !== "recetas") return new Response("No encontrado", { status: 404 });
  const { tagline } = await getSettings(site.id);
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 96px", background: brand.background, color: brand.ink, borderBottom: `28px solid ${brand.accent}` }}>
      <div style={{ fontSize: 34, color: brand.accent, letterSpacing: 2, textTransform: "uppercase" }}>{tagline}</div>
      <div style={{ fontSize: 112, fontWeight: 700, lineHeight: 1.05, marginTop: 16 }}>{site.name}</div>
      <div style={{ fontSize: 40, marginTop: 28, color: "#4a5d6c" }}>Ingredientes, tiempos y preparación paso a paso.</div>
    </div>,
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
