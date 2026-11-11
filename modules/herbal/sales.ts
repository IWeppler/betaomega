// Relative .ts imports keep this pure projection runnable in the Node integration tests.
import { storeToday, type Catalog } from "../../platform/catalog/index.ts";
import { buildShop } from "../../platform/catalog/store.ts";
import { resolveCatalogPrices } from "./domain/pricing.ts";
import { saleItem } from "./sale-item.ts";

/** Retail presentations take precedence; herbs with only a kilogram price are offered per kilogram. */
export function salesCatalog(catalog: Catalog): Catalog {
  const resolved = resolveCatalogPrices(catalog);
  return { ...resolved, plants: resolved.plants.map(plant => plant.price === undefined && plant.pricePerKgCents !== undefined
    ? { ...plant, price: plant.pricePerKgCents / 100, priceUnit: "kg" }
    : plant) };
}

export function buildHerbalShop(catalog: Catalog, today = storeToday()) {
  return buildShop(salesCatalog(catalog), today);
}

/** A read-only sales projection. Never persist it: it contains current promotions and kilogram fallbacks. */
export function sellerCatalog(catalog: Catalog, today = storeToday()): Catalog {
  const resolved = salesCatalog(catalog);
  const current = <T extends { price?: number; priceUnit?: string; promoPrice?: number; promoUntil?: string }>(item: T): T => saleItem(item, today);
  return { ...resolved, plants: resolved.plants.map(current), preparations: resolved.preparations.map(current) };
}
