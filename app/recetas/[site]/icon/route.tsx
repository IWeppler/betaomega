import { ImageResponse } from "next/og";
import { findSite } from "@/lib/sites";
import { brand } from "../brand";

// Tab and home-screen icon: the site's initial on its accent. ?size= for the Apple icon (180).
export async function GET(request: Request, context: { params: Promise<{ site: string }> }) {
  const site = findSite((await context.params).site);
  if (site?.kind !== "recetas") return new Response("No encontrado", { status: 404 });
  const asked = Number(new URL(request.url).searchParams.get("size"));
  const size = [32, 64, 180, 192, 512].includes(asked) ? asked : 64;
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: brand.accent, color: brand.background, fontSize: size * 0.62, fontWeight: 700, borderRadius: size >= 180 ? 0 : size * 0.22 }}>
      {site.name.slice(0, 1).toUpperCase()}
    </div>,
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
