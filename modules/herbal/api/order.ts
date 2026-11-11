import { sameOrigin } from "@/platform/auth/server";
import { getSite } from "@/platform/sites/server";
import { resolveCart, orderMessage, orderUrl } from "@/platform/catalog/store";
import { loadHerbalShop } from "../data/shop";
import { cleanOrderRequest, HerbalOrderError } from "../order-request";

export async function prepareHerbalOrder(request: Request, { params }: { params: Promise<{ site: string }> }) {
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (!sameOrigin(request)) return reply({ error: "Recargá la tienda antes de preparar el pedido." }, 403);
  try {
    const site = await getSite((await params).site);
    if (!site || site.kind !== "herboristeria") return reply({ error: "Tienda no encontrada." }, 404);
    const body = await request.text();
    if (body.length > 20000) return reply({ error: "El pedido es demasiado grande." }, 413);
    const { cart, details: order } = cleanOrderRequest(JSON.parse(body));
    // Bypass public ISR: prices and visibility must be current when the WhatsApp message is prepared.
    const shop = await loadHerbalShop();
    if (!shop.store.whatsapp) return reply({ error: "La tienda todavía no cargó su número de WhatsApp." }, 400);
    const resolved = resolveCart(cart, shop.offers);
    if (resolved.removed.length) return reply({ error: "Un producto ya no está disponible. Recargá la tienda y revisá el carrito." }, 409);
    const message = orderMessage(resolved, order);
    return reply({ ...orderUrl(shop.store.whatsapp, message), total: resolved.total, pending: resolved.pending });
  } catch (error) {
    if (error instanceof SyntaxError) return reply({ error: "El pedido no tiene un formato válido." }, 400);
    if (error instanceof HerbalOrderError) return reply({ error: error.message }, 400);
    console.error("[herbal/order] No se pudo preparar el pedido.");
    return reply({ error: "No pudimos verificar los precios. Intentá de nuevo." }, 500);
  }
}
