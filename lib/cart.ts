import { formatMoney } from "./catalog.ts";

/**
 * Shopping cart and WhatsApp order (docs/tienda-online.md, fase 6). Pure functions: the UI keeps the cart in
 * localStorage and calls these. The cart stores keys and quantities only; prices always come from `Offer`s,
 * which the server builds from the current catalogue (lib/shop.ts).
 */

/** Something that can be bought: a product ("p:<id>") or a combo ("c:<id>"). */
export type Offer = { key: string; name: string; unit: string; price?: number };
export type CartLine = { key: string; qty: number };
export type Cart = CartLine[];
export type ResolvedLine = CartLine & { name: string; unit: string; unitPrice?: number; subtotal?: number };
export type ResolvedCart = {
  lines: ResolvedLine[];
  /** Sum of the lines with a price. */
  total: number;
  /** Lines without a price ("precio a confirmar"). */
  pending: number;
  /** Keys that were dropped because the product or combo is no longer offered. */
  removed: string[];
  /** The cart without the dropped lines, to save back. */
  cart: Cart;
};
export type OrderDetails = { name: string; delivery: "pickup" | "delivery"; address: string; note: string };

export const CART_STORAGE_KEY = "nekurel-cart-v1";
export const MAX_QTY = 99;
export const MAX_LINES = 50;
/** WhatsApp links much longer than this fail on some phones and browsers; the UI warns before opening one. */
export const ORDER_URL_LIMIT = 4000;
export const ORDER_LIMITS = { name: 80, address: 200, note: 500 };

const keyPattern = /^[pc]:[^\s]{1,100}$/;
const clampQty = (qty: number) => Math.min(MAX_QTY, Math.max(0, Math.floor(qty)));

/** Reads what localStorage holds. Anything malformed is dropped rather than trusted. */
export function parseCart(raw: string | null | undefined): Cart {
  let data: unknown;
  try { data = JSON.parse(raw ?? "[]"); } catch { return []; }
  if (!Array.isArray(data)) return [];
  const cart: Cart = [];
  for (const line of data) {
    if (!line || typeof line !== "object") continue;
    const { key, qty } = line as Record<string, unknown>;
    if (typeof key !== "string" || !keyPattern.test(key) || typeof qty !== "number" || !Number.isFinite(qty)) continue;
    const amount = clampQty(qty);
    if (amount < 1 || cart.some(l => l.key === key)) continue;
    cart.push({ key, qty: amount });
    if (cart.length === MAX_LINES) break;
  }
  return cart;
}
export const serializeCart = (cart: Cart) => JSON.stringify(cart);

/** False when the cart is full and `key` would be a new line. */
export const canAdd = (cart: Cart, key: string) => cart.some(l => l.key === key) || cart.length < MAX_LINES;
/** Adds `qty` units, merging with an existing line. A full cart is returned unchanged (check canAdd first). */
export function addToCart(cart: Cart, key: string, qty = 1): Cart {
  if (!keyPattern.test(key) || !canAdd(cart, key)) return cart;
  const existing = cart.find(l => l.key === key);
  if (existing) return setQty(cart, key, existing.qty + qty);
  const amount = clampQty(qty);
  return amount < 1 ? cart : [...cart, { key, qty: amount }];
}
/** Sets a line's quantity. Zero or less removes it. */
export function setQty(cart: Cart, key: string, qty: number): Cart {
  const amount = Number.isFinite(qty) ? clampQty(qty) : 0;
  return amount < 1 ? removeFromCart(cart, key) : cart.map(l => l.key === key ? { ...l, qty: amount } : l);
}
export const removeFromCart = (cart: Cart, key: string): Cart => cart.filter(l => l.key !== key);
export const cartCount = (cart: Cart) => cart.reduce((sum, l) => sum + l.qty, 0);

/** Prices the cart against the current offers. Lines whose product left the store are dropped and reported. */
export function resolveCart(cart: Cart, offers: Offer[]): ResolvedCart {
  const byKey = new Map(offers.map(o => [o.key, o]));
  const lines: ResolvedLine[] = []; const removed: string[] = [];
  for (const line of cart) {
    const offer = byKey.get(line.key);
    if (!offer) { removed.push(line.key); continue; }
    lines.push({ ...line, name: offer.name, unit: offer.unit, ...(offer.price === undefined ? {} : { unitPrice: offer.price, subtotal: Math.round(offer.price * 100) * line.qty / 100 }) });
  }
  return {
    lines, removed, cart: lines.map(({ key, qty }) => ({ key, qty })),
    total: lines.reduce((sum, l) => sum + Math.round((l.subtotal ?? 0) * 100), 0) / 100,
    pending: lines.filter(l => l.subtotal === undefined).length,
  };
}

/** Spanish messages for the order form, keyed by field. Empty when the order can be sent. */
export function validateOrder(details: OrderDetails): Partial<Record<keyof OrderDetails, string>> {
  const errors: Partial<Record<keyof OrderDetails, string>> = {};
  if (!details.name.trim()) errors.name = "Escribí tu nombre.";
  else if (details.name.trim().length > ORDER_LIMITS.name) errors.name = `El nombre puede tener hasta ${ORDER_LIMITS.name} caracteres.`;
  if (details.delivery !== "pickup" && details.delivery !== "delivery") errors.delivery = "Elegí retiro o envío.";
  if (details.delivery === "delivery" && !details.address.trim()) errors.address = "Escribí la dirección de envío.";
  else if (details.address.trim().length > ORDER_LIMITS.address) errors.address = `La dirección puede tener hasta ${ORDER_LIMITS.address} caracteres.`;
  if (details.note.trim().length > ORDER_LIMITS.note) errors.note = `La nota puede tener hasta ${ORDER_LIMITS.note} caracteres.`;
  return errors;
}

/**
 * What the customer typed, on one line: line breaks and control characters are removed so the text
 * cannot add lines that look like part of the order (a fake "Total: $ 0", for example).
 */
const oneLine = (value: string, max: number) => value.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/** The WhatsApp text for an order. Throws when the cart is empty. */
export function orderMessage(resolved: ResolvedCart, details: OrderDetails): string {
  if (!resolved.lines.length) throw new Error("El carrito está vacío.");
  const name = oneLine(details.name, ORDER_LIMITS.name);
  const address = oneLine(details.address, ORDER_LIMITS.address);
  const note = oneLine(details.note, ORDER_LIMITS.note);
  const lines = resolved.lines.map(l => `${l.qty} x ${l.name}${l.unit ? ` (${l.unit})` : ""}: ${l.subtotal === undefined ? "precio a confirmar" : formatMoney(l.subtotal)}`);
  const priced = resolved.lines.length - resolved.pending;
  const total = !priced ? "Total: a confirmar" : `Total: ${formatMoney(resolved.total)}${resolved.pending ? " (más los productos a confirmar)" : ""}`;
  return [
    "Hola, quiero hacer un pedido en Ñekurel.", "",
    `Nombre: ${name}`,
    `Entrega: ${details.delivery === "delivery" ? `Envío a ${address}` : "Retiro en el local"}`, "",
    ...lines, "",
    total,
    ...(note ? [`Nota: ${note}`] : []),
  ].join("\n");
}

/** The wa.me link for an order, and whether it is long enough to risk failing. `whatsapp` is the store's number, digits only. */
export function orderUrl(whatsapp: string, message: string): { url: string; tooLong: boolean } {
  if (!/^[1-9]\d{7,14}$/.test(whatsapp)) throw new Error("La tienda todavía no cargó su número de WhatsApp.");
  const url = `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;
  return { url, tooLong: url.length > ORDER_URL_LIMIT };
}
