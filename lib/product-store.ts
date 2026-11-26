import { cleanProductList, newestFirst, stampPublished, type Product, type ProductList } from "./products";
import { siteDocument } from "./site-table";
import type { Site } from "./sites";

// Server-only reads and writes of the `products:<id>` documents in app_data.
export class ProductConflictError extends Error {}
const rules = (site: Site) => site.products ?? { application: false, descriptionLabel: "Descripción" };

export async function readProducts(site: Site): Promise<ProductList> {
  const data = await siteDocument("products", site.id).read();
  return data === null ? { revision: 0, products: [] } : cleanProductList(data, rules(site));
}

/** What the public site shows: only published products, the last one published first. */
export async function listPublishedProducts(site: Site): Promise<Product[]> {
  return newestFirst((await readProducts(site)).products.filter(p => p.published));
}

/** Saves the whole list if nobody saved since its revision. */
export async function saveProducts(site: Site, value: unknown): Promise<ProductList> {
  const sent = cleanProductList(value, rules(site));
  // The publication dates come from what is stored, never from the panel. A stale read only loses the race below, so it changes nothing.
  const list = { ...sent, products: stampPublished((await readProducts(site)).products, sent.products, new Date()) };
  const next = { ...list, revision: list.revision + 1 };
  if (!await siteDocument("products", site.id).save(next, list.revision)) throw new ProductConflictError("Otra persona hizo cambios en este sitio. Recargá la página antes de guardar.");
  return next;
}
