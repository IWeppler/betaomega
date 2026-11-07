import { cleanProductList, type Product, type ProductList } from "./products";
import { siteDocument } from "./site-table";
import type { Site } from "./sites";

// Server-only reads and writes of the `products:<id>` documents in app_data.
export class ProductConflictError extends Error {}
const rules = (site: Site) => site.products ?? { application: false, descriptionLabel: "Descripción" };

export async function readProducts(site: Site): Promise<ProductList> {
  const data = await siteDocument("products", site.id).read();
  return data === null ? { revision: 0, products: [] } : cleanProductList(data, rules(site));
}

/** What the public site shows: only published products, alphabetically. */
export async function listPublishedProducts(site: Site): Promise<Product[]> {
  return (await readProducts(site)).products.filter(p => p.published).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Saves the whole list if nobody saved since its revision. */
export async function saveProducts(site: Site, value: unknown): Promise<ProductList> {
  const list = cleanProductList(value, rules(site));
  const next = { ...list, revision: list.revision + 1 };
  if (!await siteDocument("products", site.id).save(next, list.revision)) throw new ProductConflictError("Otra persona hizo cambios en este sitio. Recargá la página antes de guardar.");
  return next;
}
