import { isAdmin } from "@/platform/auth/server";
import { getSite } from "@/platform/sites/server";
import { listThings } from "../data/things";

const KIND = "herboristeria"; // Replace with the module's own kind once it is in siteKinds.

// app/api/sites/[site]/<m>/route.ts only mounts this and declares `runtime` and `dynamic`. Pattern 8 of docs/PATTERNS.md has the full shape,
// including same-origin checks and body limits for writes.
export async function getThings(_request: Request, { params }: { params: Promise<{ site: string }> }) {
  if (!await isAdmin()) return Response.json({ error: "Iniciá sesión." }, { status: 401 });
  const site = await getSite((await params).site);
  if (!site || site.kind !== KIND) return Response.json({ error: "Sitio no encontrado." }, { status: 404 });
  try {
    return Response.json(await listThings(site.id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[things]", error);
    return Response.json({ error: "No pudimos cargar la lista. Probá de nuevo." }, { status: 500 });
  }
}
