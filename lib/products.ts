// Products of the product sites (lib/sites.ts, kind "productos"). Pure code: the panel, the API, the public site and the tests share it.
// Each site keeps its whole list as one app_data document, `products:<id>`, so no SQL is needed.
import { normalize, relevance, slugify } from "./catalog.ts";
import { validImagePath } from "./images.ts";

export type ProductApplication = "beber" | "piel";
export type Product = {
  id: string;
  /** Public address: <site>/<slug>. Set on the first save and kept when the name changes, so shared links keep working. */
  slug: string;
  name: string;
  image?: string;
  description: string;
  /** The "Para qué sirve" list: words or phrases. The public search looks here and in the name. */
  keywords: string[];
  /** Only on sites whose options ask for it. */
  application?: ProductApplication;
  published: boolean;
};
export type ProductList = { revision: number; products: Product[] };

/** The sign shown with a product. "piel" is a warning: the product must not be drunk. */
export const productApplications: Record<ProductApplication, { option: string; sign: string; note: string }> = {
  beber: { option: "Para beber", sign: "Bebible", note: "Se puede tomar." },
  piel: { option: "Para aplicar en la piel", sign: "Uso externo", note: "Aplicar en la piel. No beber." },
};

/** The phrases the panel and the public pages need, for what each site calls its items ("producto", "voz sagrada"). */
export function productWords({ one, many, feminine }: { one: string; many: string; feminine: boolean }) {
  const end = feminine ? "a" : "o";
  /** "el agua", "un agua": a feminine noun starting with a stressed "a" takes the masculine article. */
  const elided = feminine && /^h?a/i.test(one);
  const capital = (text: string) => text.charAt(0).toLocaleUpperCase("es") + text.slice(1);
  return {
    one,
    many,
    Many: capital(many),
    new: `Nuev${end} ${one}`,
    an: `${feminine && !elided ? "una" : "un"} ${one}`,
    An: `${feminine && !elided ? "Una" : "Un"} ${one}`,
    the: `${feminine && !elided ? "la" : "el"} ${one}`,
    The: `${feminine && !elided ? "La" : "El"} ${one}`,
    ofThe: `${feminine && !elided ? "de la" : "del"} ${one}`,
    that: `${feminine ? "esa" : "ese"} ${one}`,
    theMany: `${feminine ? "las" : "los"} ${many}`,
    TheMany: `${feminine ? "Las" : "Los"} ${many}`,
    firstMany: `${feminine ? "las primeras" : "los primeros"} ${many}`,
    createFirst: `Creá ${feminine ? "la primera" : "el primero"}`,
    /** "editarlo", "ocultarla". */
    it: feminine ? "la" : "lo",
    aNewOne: feminine ? "una nueva" : "uno nuevo",
    published: `publicad${end}`,
    publishedMany: `publicad${end}s`,
    PublishedMany: `Publicad${end}s`,
    Published: `Publicad${end}`,
  };
}

export const productsKey = (siteId: string) => `products:${siteId}`;
export const blankProduct = (): Product => ({ id: crypto.randomUUID(), slug: "", name: "", description: "", keywords: [], published: true });

// Routes of the site itself, so a product cannot take them.
const reservedSlugs = new Set(["og", "icon"]);
const maxProducts = 500;
const maxKeywords = 40;
const imagePrefix = "/api/images/";

function fail(message: string): never {
  throw new Error(message);
}
const text = (value: unknown, label: string, max: number) => {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") fail(`${label} inválido.`);
  const clean = value.trim();
  if (clean.length > max) fail(`${label} es demasiado largo (máximo ${max} caracteres).`);
  return clean;
};

/** Trims the list and drops repeats, ignoring capitals and accents. */
export function cleanKeywords(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail("La lista de para qué sirve es inválida.");
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const item of value) {
    const keyword = text(item, "Cada frase de para qué sirve", 120).replace(/\s+/g, " ");
    const key = normalize(keyword);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keywords.push(keyword);
  }
  if (keywords.length > maxKeywords) fail(`Para qué sirve admite hasta ${maxKeywords} frases.`);
  return keywords;
}

function cleanProduct(value: unknown, askApplication: boolean, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("Ficha inválida.");
  const data = value as Record<string, unknown>;
  if (typeof data.id !== "string" || !data.id || data.id.length > 100) fail("Ficha inválida.");
  const name = text(data.name, "El nombre", 120).replace(/\s+/g, " ");
  if (!name) fail("Escribí el nombre.");
  const image = text(data.image, "La imagen", 300);
  if (image && !(image.startsWith(imagePrefix) && validImagePath(image.slice(imagePrefix.length).split("/")))) fail("Imagen inválida. Subí una imagen desde el editor.");
  const application = askApplication && (data.application === "beber" || data.application === "piel") ? data.application : undefined;
  if (askApplication && data.application !== undefined && !application) fail("Elegí si es para beber o para aplicar en la piel.");
  const product: Product = {
    id: data.id,
    slug: typeof data.slug === "string" ? data.slug : "",
    name,
    ...(image ? { image } : {}),
    description: text(data.description, label, 5000),
    keywords: cleanKeywords(data.keywords),
    ...(application ? { application } : {}),
    published: data.published === true,
  };
  if (product.published) {
    if (!product.description) fail(`Para publicar ${name}, completá ${label.toLowerCase()}.`);
    if (!product.keywords.length) fail(`Para publicar ${name}, agregá al menos una frase en para qué sirve.`);
    // A skin product shown without its warning could end up being drunk.
    if (askApplication && !application) fail(`Para publicar ${name}, elegí si es para beber o para aplicar en la piel.`);
  }
  return product;
}

/** One address per product. An existing slug is kept; a new one comes from the name and gets a number if it is taken. */
function assignSlugs(products: Product[]) {
  const own = products.map(p => p.slug).filter(Boolean);
  if (new Set(own).size !== own.length) fail("Hay dos con la misma dirección.");
  const taken = new Set([...reservedSlugs, ...own]);
  return products.map(product => {
    if (product.slug) return product;
    const base = slugify(product.name).slice(0, 80).replace(/-+$/, "");
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    taken.add(slug);
    return { ...product, slug };
  });
}

/** Checks what the panel sent and returns a clean copy with only the known fields. Throws a message for the person. */
export function cleanProductList(value: unknown, options: { application: boolean; descriptionLabel: string }): ProductList {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("Lista inválida.");
  const data = value as Record<string, unknown>;
  if (typeof data.revision !== "number" || !Number.isInteger(data.revision) || data.revision < 0 || !Array.isArray(data.products)) fail("Lista inválida.");
  if (data.products.length > maxProducts) fail(`El sitio admite hasta ${maxProducts} fichas.`);
  const products = data.products.map(item => cleanProduct(item, options.application, options.descriptionLabel));
  if (new Set(products.map(p => p.id)).size !== products.length) fail("Hay dos con el mismo identificador.");
  for (const { slug } of products) if (slug && (!/^[a-z0-9-]{1,90}$/.test(slug) || reservedSlugs.has(slug))) fail("Dirección inválida.");
  return { revision: data.revision, products: assignSlugs(products) };
}

/** Published products that match the search, best match first; all of them, alphabetically, without a search. Looks in the name and in "para qué sirve". */
export function searchProducts<T extends Pick<Product, "name" | "keywords">>(products: T[], query: string): T[] {
  return products
    .map(product => ({ product, score: relevance({ name: product.name, uses: product.keywords, aliases: [] }, query) }))
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name, "es"))
    .map(result => result.product);
}
