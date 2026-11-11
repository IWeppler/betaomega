import { effectivePrice, storeToday } from "../../platform/catalog/index.ts";

/** Read-only formatting projection. Prices of automatic tonics have already been resolved on the server. */
export function saleItem<T extends { price?: number; priceUnit?: string; pricePerKgCents?: number; promoPrice?: number; promoUntil?: string }>(item: T, today = storeToday()): T {
  const base = !("ingredients" in item) && item.price === undefined && item.pricePerKgCents !== undefined ? { ...item, price: item.pricePerKgCents / 100, priceUnit: "kg" } : item;
  const price = effectivePrice(base, today);
  return { ...item, price: price.price, priceUnit: price.unit };
}
