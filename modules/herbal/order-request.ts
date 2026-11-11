import { MAX_LINES, MAX_QTY, parseCart, validateOrder, type OrderDetails } from "../../platform/catalog/store.ts";

export class HerbalOrderError extends Error {}

/** Only identifiers, quantities and contact/delivery data are accepted. Browser prices are discarded. */
export function cleanOrderRequest(input: unknown) {
  const fail = (message: string): never => { throw new HerbalOrderError(message); };
  if (!input || typeof input !== "object" || !("cart" in input) || !("details" in input)) return fail("Revisá los datos del pedido.");
  const raw = input.cart;
  if (!Array.isArray(raw) || !raw.length || raw.length > MAX_LINES || raw.some(line => !line || typeof line !== "object" || !Number.isInteger(line.qty) || line.qty < 1 || line.qty > MAX_QTY)) return fail("Revisá las cantidades del carrito.");
  const cart = parseCart(JSON.stringify(raw));
  if (cart.length !== raw.length) return fail("Revisá los productos del carrito.");
  const details = input.details;
  if (!details || typeof details !== "object") return fail("Completá tus datos.");
  const fields = details as Record<string, unknown>;
  if (["name", "delivery", "address", "note"].some(key => typeof fields[key] !== "string")) return fail("Revisá tus datos de contacto y entrega.");
  const order = { name: fields.name, delivery: fields.delivery, address: fields.address, note: fields.note } as OrderDetails;
  const errors = validateOrder(order);
  if (Object.keys(errors).length) return fail(Object.values(errors)[0]!);
  return { cart, details: order };
}
