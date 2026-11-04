import { ImageResponse } from "next/og";
import { findSite } from "@/lib/sites";

// Social preview of the site, 1200 × 630. A product with a photo shares the photo instead (see [slug]/page.tsx).
export async function GET(_request: Request, context: { params: Promise<{ site: string }> }) {
  const site = findSite((await context.params).site);
  if (!site?.products) return new Response("No encontrado", { status: 404 });
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 96, background: "#f6f8f8", color: "#14211f", borderBottom: `28px solid ${site.products.accent}` }}>
      <div style={{ fontSize: 132, fontWeight: 700, lineHeight: 1, textTransform: "uppercase" }}>{site.name}</div>
      <div style={{ fontSize: 40, marginTop: 28, color: "#4d5c5a" }}>Buscá productos por nombre o para qué sirve.</div>
    </div>,
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
