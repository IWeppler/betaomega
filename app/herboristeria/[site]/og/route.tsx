import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

// Social preview, 1200 × 630. A route handler instead of opengraph-image.tsx: see og-image.ts.
export async function GET() {
  const logo = await readFile(join(process.cwd(), "public", "nekurel-logo.png"));
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#102b20" }}>
      {/* ImageResponse requires a native image; preserve the entire supplied artwork. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`data:image/png;base64,${logo.toString("base64")}`} width={788} height={630} alt="" style={{ objectFit: "contain" }} />
    </div>,
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
