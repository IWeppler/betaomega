import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

/* Home-screen icon: the Ñekurel logo, whole, centred on the dark brand green. `maskable` leaves a safe zone for round masks. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const size = [180, 192, 512].includes(Number(params.get("size"))) ? Number(params.get("size")) : 192;
  const maskable = params.get("maskable") === "1";
  const logo = await readFile(join(process.cwd(), "public", "nekurel-logo.png"));
  // The artwork is 5:4, so it fits the square by width; maskable icons keep it inside the central 80%.
  const width = Math.round(size * (maskable ? 0.8 : 1));
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#102b20", borderRadius: maskable ? 0 : size * 0.22, overflow: "hidden" }}>
      {/* ImageResponse requires a native image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`data:image/png;base64,${logo.toString("base64")}`} width={width} height={Math.round(width * 0.8)} alt="" style={{ objectFit: "contain" }} />
    </div>,
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
