import { isAdmin, isSeller, sameOrigin } from "@/lib/auth";
import { readCatalog, saveCatalog, ConflictError } from "@/lib/store";
import { searchCatalog, validateCatalog } from "@/lib/catalog";
import { publicTags, refreshPublic } from "@/platform/sites/server";
import { resolveCatalogPrices, sellerCatalog } from "@/modules/herbal/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    // The seller view includes internal notes and recipes, so it needs a seller (or administrator) session.
    // The public store does not use this endpoint: it reads the catalogue on the server (lib/shop.ts).
    if (!await isSeller()) return Response.json({ error: "Ingresá el código de vendedor para ver el catálogo.", seller: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
    const catalog = resolveCatalogPrices(await readCatalog());
    if (new URL(request.url).searchParams.get("scope") !== "public" && await isAdmin()) return Response.json(catalog, { headers: { "Cache-Control": "no-store" } });
    const visible = searchCatalog(sellerCatalog(catalog), "");
    return Response.json({ ...visible, revision: catalog.revision, categoryImages: catalog.categoryImages, categories: catalog.categories, store: catalog.store }, { headers: { "Cache-Control": "no-store", "X-Catalog-Scope": "public" } });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "No se pudo leer el catálogo desde Supabase." }, { status: 500 });
  }
}
export async function PUT(request: Request) {
  const origin = sameOrigin(request), admin = origin && await isAdmin();
  if (!admin) console.warn(`[catalog PUT] forbidden: sameOrigin=${origin} origin=${request.headers.get("origin")} host=${request.headers.get("host")}`);
  if (!admin) return Response.json({ error: "Ingresá como administrador para guardar." }, { status: 403 });
  try {
    const text = await request.text();
    if (text.length > 2_000_000) return Response.json({ error: "El catálogo es demasiado grande." }, { status: 413 });
    const data: unknown = JSON.parse(text);
    validateCatalog(data);
    const saved = await saveCatalog(resolveCatalogPrices(data));
    refreshPublic(publicTags.herbShop);
    refreshPublic(publicTags.sauna);
    return Response.json(saved);
  } catch (error) {
    if (error instanceof ConflictError) { console.warn("[catalog PUT] conflict:", error.message); return Response.json({ error: error.message }, { status: 409 }); }
    if (error instanceof SyntaxError || (error instanceof Error && !("code" in error))) { console.warn("[catalog PUT] rejected:", error.message); return Response.json({ error: error.message }, { status: 400 }); }
    console.error("[catalog PUT] failed:", error);
    // Only administrators reach this point, so the cause is returned to make production failures diagnosable.
    const cause = error instanceof Error ? error.message.slice(0, 300) : String(error);
    return Response.json({ error: `No se pudo guardar: ${cause}` }, { status: 500 });
  }
}

