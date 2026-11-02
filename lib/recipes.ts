// Recipes of the recipe sites (kind "recetas"). Pure code: the panel, the API and the tests share it.
export type Ingredient = { amount: string; name: string };
export type Recipe = {
  id: string;
  siteId: string;
  /** Public address of the recipe: comidasdelcielo.com/<slug>. Unique per site. */
  slug: string;
  title: string;
  summary: string;
  image?: string;
  /** More photos after the main one (at most maxExtraImages), shown as a gallery on the recipe page. */
  images: string[];
  categories: string[];
  /** Free text: "4 porciones", "12 empanadas". */
  servings: string;
  prepMinutes?: number;
  cookMinutes?: number;
  ingredients: Ingredient[];
  steps: string[];
  notes: string;
  published: boolean;
  /** Increases on every save. A save names the revision it started from, so two people cannot overwrite each other. 0: not saved yet. */
  revision: number;
  updatedAt?: string;
  /** First time it was published (set by the database). The public site lists recipes by it. */
  publishedAt?: string;
  /** Times the public recipe page was opened (bots and previews excluded). Only the panel reads it; the database counts. */
  views?: number;
  /** Panel only: the signature that opens this recipe's preview on the public site (?vista=). Never stored. */
  previewToken?: string;
};
/** What the panel sends: everything except what the server owns. */
export type RecipeInput = Omit<Recipe, "siteId" | "updatedAt" | "publishedAt" | "previewToken" | "views"> & {
  /** ISO date to publish on. With `published`, a future date keeps the recipe hidden (preview only) until then. Omitted: the stored date is left alone. */
  scheduledAt?: string;
};
export const maxExtraImages = 6;

export const slugify = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/, "");
export const isSlug = (slug: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length <= 80;
export const recipeImagePath = /^\/api\/images\/(?:[a-z0-9-]+\/)?[0-9a-f-]{36}\.(jpg|png|webp)$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isRecipeId = (id: string) => uuid.test(id);

/** Addresses taken by the recipe site's own routes (app/recetas/[site]). */
export const reservedRecipeSlugs = ["og", "icon"];

export const blankRecipe = (): RecipeInput => ({ id: crypto.randomUUID(), slug: "", title: "", summary: "", images: [], categories: [], servings: "", ingredients: [], steps: [], notes: "", published: false, revision: 0 });

function fail(message: string): never { throw new Error(message); }
const text = (value: unknown, label: string, max: number, required = false) => {
  if (value === undefined || value === null) value = "";
  if (typeof value !== "string") fail(`${label} inválido.`);
  const clean = value.trim();
  if (required && !clean) fail(`Completá ${label.toLowerCase()}.`);
  if (clean.length > max) fail(`${label} es demasiado largo (máximo ${max} caracteres).`);
  return clean;
};
const minutes = (value: unknown, label: string) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 10000) fail(`${label}: escribí una cantidad de minutos entera.`);
  return value;
};

/** An ISO date between 2000 and three years ahead, normalized; undefined when empty. */
function cleanScheduledAt(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const time = typeof value === "string" ? Date.parse(value) : NaN;
  if (!Number.isFinite(time) || time < Date.UTC(2000, 0, 1) || time > Date.now() + 3 * 365 * 86400_000) fail("La fecha de publicación no es válida.");
  return new Date(time).toISOString();
}

/** A published recipe whose date has not come yet: hidden from the public site (preview only) until then. */
export const isScheduled = (recipe: Pick<Recipe, "published" | "publishedAt">, now = Date.now()) => recipe.published && Boolean(recipe.publishedAt) && Date.parse(recipe.publishedAt as string) > now;

/** Recipes with views, the most opened first. */
export const mostViewed = <T extends Pick<Recipe, "views">>(recipes: T[], count = 5) => recipes.filter(r => (r.views ?? 0) > 0).sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, count);

/** True for crawlers, link-preview fetchers and tools: their visits are not counted as views. A missing user agent counts as a bot. */
export const looksLikeBot = (userAgent?: string | null) => !userAgent || /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|whatsapp|telegram|curl|wget|python-requests|monitor|uptime|pingdom/i.test(userAgent);

/** Checks what the panel sent and returns a clean copy with only the known fields. Throws a message for the person. */
export function cleanRecipe(value: unknown): RecipeInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("Receta inválida.");
  const data = value as Record<string, unknown>;
  const id = typeof data.id === "string" && isRecipeId(data.id) ? data.id : fail("Receta inválida.");
  const revision = typeof data.revision === "number" && Number.isInteger(data.revision) && data.revision >= 0 ? data.revision : fail("Receta inválida.");
  const title = text(data.title, "El nombre de la receta", 160, true);
  const slug = text(data.slug, "La dirección", 80) || slugify(title);
  if (!isSlug(slug)) fail("La dirección solo puede tener letras sin tilde, números y guiones.");
  if (reservedRecipeSlugs.includes(slug)) fail(`La dirección “${slug}” la usa el sitio. Elegí otra.`);
  const image = data.image === undefined || data.image === "" ? undefined : typeof data.image === "string" && recipeImagePath.test(data.image) ? data.image : fail("Imagen inválida. Subí una imagen desde el editor.");
  if (!Array.isArray(data.categories) || data.categories.length > 12) fail("Usá hasta 12 categorías.");
  const categories = normalizeCategories(data.categories.map(c => text(c, "La categoría", 40)).filter(Boolean));
  if (!Array.isArray(data.ingredients) || data.ingredients.length > 80) fail("Usá hasta 80 ingredientes.");
  const ingredients = data.ingredients.map((item, n) => {
    if (!item || typeof item !== "object") fail("Ingrediente inválido.");
    const { amount, name } = item as Record<string, unknown>;
    return { amount: text(amount, `La cantidad del ingrediente ${n + 1}`, 60), name: text(name, `El ingrediente ${n + 1}`, 160, true) };
  });
  if (!Array.isArray(data.steps) || data.steps.length > 60) fail("Usá hasta 60 pasos.");
  const steps = data.steps.map((step, n) => text(step, `El paso ${n + 1}`, 2000, true));
  if (data.images !== undefined && !Array.isArray(data.images)) fail("Fotos inválidas.");
  const given: unknown[] = (data.images as unknown[] | undefined) ?? [];
  if (given.length > maxExtraImages + 12) fail(`Usá hasta ${maxExtraImages} fotos adicionales.`);
  // Blank slots are dropped, and so are repeats and the main photo.
  const images = [...new Set(given.filter(v => v !== "").map(v => (typeof v === "string" && recipeImagePath.test(v) ? v : fail("Imagen inválida. Subí las imágenes desde el editor."))))].filter(v => v !== image);
  if (images.length > maxExtraImages) fail(`Usá hasta ${maxExtraImages} fotos adicionales.`);
  const published = data.published === true;
  const scheduledAt = published ? cleanScheduledAt(data.scheduledAt) : undefined;
  if (published && !ingredients.length) fail("Para publicar la receta, agregá al menos un ingrediente.");
  if (published && !steps.length) fail("Para publicar la receta, agregá al menos un paso.");
  return {
    id, revision, slug, title, image, images, categories, ingredients, steps, published, scheduledAt,
    summary: text(data.summary, "La descripción", 600),
    servings: text(data.servings, "Las porciones", 60),
    prepMinutes: minutes(data.prepMinutes, "Preparación"),
    cookMinutes: minutes(data.cookMinutes, "Cocción"),
    notes: text(data.notes, "Los consejos", 4000),
  };
}

/** "1 h 15 min" for the lists; "" when there is no time. */
export function formatMinutes(total?: number) {
  if (!total) return "";
  const hours = Math.floor(total / 60), rest = total % 60;
  return [hours && `${hours} h`, rest && `${rest} min`].filter(Boolean).join(" ");
}
export const totalMinutes = (recipe: Pick<Recipe, "prepMinutes" | "cookMinutes">) => (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0) || undefined;

/** What a published recipe is missing to look good on the site. Drafts are reported apart. */
export function recipeGaps(recipe: Recipe) {
  return [!recipe.image && "foto", !recipe.summary && "descripción", !recipe.categories.length && "categoría", !totalMinutes(recipe) && "tiempo"].filter(Boolean) as string[];
}

/** What a recipe card on the public site needs. `search` is the normalized text the search box matches. */
export type RecipeCard = { slug: string; title: string; summary: string; image?: string; /** The second photo, shown while the card is hovered. */ hoverImage?: string; categories: string[]; servings: string; minutes?: number; search: string };
const plain = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
/** The recipe's photos in order: the main one, then the extra ones. */
const photos = (recipe: Pick<Recipe, "image" | "images">) => [recipe.image, ...(recipe.images ?? [])].filter((src): src is string => Boolean(src));
export const toRecipeCard = (recipe: Recipe): RecipeCard => ({
  slug: recipe.slug, title: recipe.title, summary: recipe.summary, image: photos(recipe)[0], hoverImage: photos(recipe)[1], categories: recipe.categories, servings: recipe.servings, minutes: totalMinutes(recipe),
  search: plain([recipe.title, recipe.summary, ...recipe.categories, ...recipe.ingredients.map(i => i.name)].join(" ")),
});
/** True when every word of the query appears in the card's text, ignoring accents and case. */
export const matchesRecipe = (card: Pick<RecipeCard, "search">, query: string) => plain(query).split(/\s+/).filter(Boolean).every(word => card.search.includes(word));

// Bullets, numbering and emoji that start a pasted line: "- ", "• ", "✅ ", "1.", "2)", "3 -", "Paso 4:", "5️⃣".
const listMarker = /^\s*(?:[-*•·▪◦►➤–—]+|\p{Extended_Pictographic}️?|\d️?⃣|(?:paso\s*)?\d{1,2}\s*[.):\-–—](?!\d)|paso\s*\d{1,2})\s*/iu;
const stripMarker = (line: string) => {
  let rest = line.trim(), before = "";
  // Emoji bullets can be followed by a dash or number ("✅ 1. Mezclar"), so strip until nothing changes.
  while (rest !== before) { before = rest; rest = rest.replace(listMarker, "").trim(); }
  return rest;
};

const fractions: Record<string, string> = { "½": "1/2", "¼": "1/4", "¾": "3/4", "⅓": "1/3", "⅔": "2/3" };
const unitWords = "kg|kgs|kilos?|kilogramos?|g|gr|grs|gramos?|mg|l|lt|lts|litros?|ml|cc|cl|dl|tazas?|tazones?|vasos?|cucharadas?|cucharaditas?|cdas?|cdtas?|cdita|ditas?|pizcas?|dientes?|unidad(?:es)?|u|latas?|paquetes?|sobres?|potes?|rodajas?|hojas?|ramas?|ramitas?|atados?|puñados?|trozos?|pedazos?|fetas?|lonjas?|barras?|tabletas?|gotas?|chorritos?|chorros?";
const quantity = new RegExp(`^((?:\\d+\\s+\\d+/\\d+|\\d+/\\d+|\\d+[.,]?\\d*)(?:\\s*(?:-|–|a)\\s*\\d+[.,]?\\d*(?:/\\d+)?)?)\\s*(?:(${unitWords})\\b\\.?)?(?:\\s+de\\b)?\\s*(.*)$`, "iu");

/**
 * Turns a pasted list into ingredient rows, one per line: "200 g de harina" → { amount: "200 g", name: "harina" }.
 * Lines without a quantity ("sal a gusto", "c/n de pimienta") keep the whole line as the name. Headers ending in ":" are skipped.
 */
export function parseIngredientLines(input: string): Ingredient[] {
  const rows: Ingredient[] = [];
  for (const raw of input.split(/\r?\n/)) {
    let line = stripMarker(raw).replace(/[½¼¾⅓⅔]/g, f => ` ${fractions[f]} `).replace(/\s+/g, " ").trim();
    if (!line || line.endsWith(":")) continue;
    // "1 kilo", "200g", "1/2 taza", "1 1/2 l", "3 huevos".
    const found = quantity.exec(line);
    if (found && found[3]) {
      const [, number, unit, name] = found;
      rows.push({ amount: [number.trim(), unit].filter(Boolean).join(" ").slice(0, 60), name: name.slice(0, 160) });
    } else {
      if (line.length > 160) line = line.slice(0, 160);
      rows.push({ amount: "", name: line });
    }
  }
  return rows;
}

/**
 * Turns pasted text into steps. With blank lines between blocks, each block is a step (wrapped lines are joined,
 * unless a line carries its own number or bullet); otherwise every line is a step. Numbering and bullets are removed.
 */
export function parseStepLines(input: string): string[] {
  const text = input.replace(/\r/g, "").trim();
  const blocks = /\n\s*\n/.test(text) ? text.split(/\n\s*\n/) : text.split("\n");
  const steps: string[] = [];
  for (const block of blocks) {
    let current = "";
    for (const line of block.split("\n")) {
      if (!line.trim()) continue;
      const clean = stripMarker(line);
      const marked = clean !== line.trim();
      // Wrapped text continues the previous line of the same block; a numbered or bulleted line starts a new step.
      if (current && !marked) current += ` ${clean}`;
      else { if (current) steps.push(current); current = clean; }
    }
    if (current) steps.push(current);
  }
  return steps.map(s => s.slice(0, 2000)).filter(Boolean);
}

/** A new, unsaved draft with the same content: new id, revision 0, address empty so it follows the new name. */
export function duplicateRecipe(recipe: RecipeInput): RecipeInput {
  return {
    ...recipe,
    ingredients: recipe.ingredients.map(i => ({ ...i })), steps: [...recipe.steps], categories: [...recipe.categories], images: [...(recipe.images ?? [])], scheduledAt: undefined,
    id: crypto.randomUUID(), revision: 0, published: false, slug: "", title: `${recipe.title.slice(0, 153)} (copia)`,
  };
}

/** Case, accents and extra spaces do not make a different category: "Postres", "postres " and "Póstres" share this key. */
export const categoryKey = (label: string) => plain(label).replace(/\s+/g, " ").trim();
/** The label to use for what was typed: an existing one that differs only by case or accents, else the typed text tidied up. */
export function canonicalCategory(typed: string, existing: string[]) {
  const clean = typed.replace(/\s+/g, " ").trim();
  return existing.find(label => categoryKey(label) === categoryKey(clean)) ?? clean;
}
/** Maps each label to its canonical one and drops repeats (same key), keeping the order. */
export function normalizeCategories(labels: string[], existing: string[] = []) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const label of labels) {
    const canonical = canonicalCategory(label, existing);
    const key = categoryKey(canonical);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(canonical);
  }
  return result;
}
/** The recipe with category `from` replaced by `to`: no repeats, same position. Other recipes' categories are untouched. */
export function renameCategory<T extends Pick<Recipe, "categories">>(recipe: T, from: string, to: string): T {
  if (!recipe.categories.includes(from)) return recipe;
  const renamed = recipe.categories.map(c => (c === from ? to : c));
  return { ...recipe, categories: renamed.filter((c, n) => renamed.indexOf(c) === n) };
}
/** Every category with how many published recipes and drafts use it, the most used first. */
export function categoryUsage(recipes: Pick<Recipe, "categories" | "published">[]) {
  const usage = new Map<string, { published: number; drafts: number }>();
  for (const recipe of recipes) for (const label of new Set(recipe.categories)) {
    const entry = usage.get(label) ?? { published: 0, drafts: 0 };
    if (recipe.published) entry.published++; else entry.drafts++;
    usage.set(label, entry);
  }
  return [...usage].map(([label, counts]) => ({ label, ...counts })).sort((a, b) => b.published + b.drafts - (a.published + a.drafts) || a.label.localeCompare(b.label, "es"));
}
/** What a save takes: the recipe without what the server owns. */
export const toRecipeInput = (recipe: Recipe): RecipeInput => ({
  id: recipe.id, slug: recipe.slug, title: recipe.title, summary: recipe.summary, image: recipe.image, images: recipe.images, categories: recipe.categories, servings: recipe.servings,
  prepMinutes: recipe.prepMinutes, cookMinutes: recipe.cookMinutes, ingredients: recipe.ingredients, steps: recipe.steps, notes: recipe.notes, published: recipe.published, revision: recipe.revision,
});

/** Categories in use, the most used first. */
export function recipeCategories(recipes: Pick<Recipe, "categories">[]) {
  const counts = new Map<string, number>();
  for (const recipe of recipes) for (const category of new Set(recipe.categories)) counts.set(category, (counts.get(category) ?? 0) + 1);
  return [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
}

/** Other recipes to suggest under one: those sharing more categories first, then in the list's order. */
export function relatedRecipes<T extends Pick<Recipe, "slug" | "categories">>(recipe: T, all: T[], count = 3) {
  const shared = (other: T) => other.categories.filter(c => recipe.categories.includes(c)).length;
  return all.filter(other => other.slug !== recipe.slug).sort((a, b) => shared(b) - shared(a)).slice(0, count);
}

/** "PT1H15M": ISO 8601 duration for schema.org. */
export const isoDuration = (total?: number) => total ? `PT${Math.floor(total / 60) ? `${Math.floor(total / 60)}H` : ""}${total % 60 ? `${total % 60}M` : ""}` : undefined;

/** schema.org/Recipe, so search engines can show the recipe with its photo and times. */
export function recipeJsonLd(recipe: Recipe, siteUrl: string, siteName: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipe.title,
    description: recipe.summary || undefined,
    image: recipe.image ? [recipe.image, ...recipe.images].map(src => new URL(src, siteUrl).href) : undefined,
    url: new URL(`/${recipe.slug}`, siteUrl).href,
    author: { "@type": "Organization", name: siteName },
    datePublished: recipe.publishedAt,
    dateModified: recipe.updatedAt,
    recipeCategory: recipe.categories[0],
    keywords: recipe.categories.join(", ") || undefined,
    recipeYield: recipe.servings || undefined,
    prepTime: isoDuration(recipe.prepMinutes),
    cookTime: isoDuration(recipe.cookMinutes),
    totalTime: isoDuration(totalMinutes(recipe)),
    recipeIngredient: recipe.ingredients.map(i => [i.amount, i.name].filter(Boolean).join(" ")),
    recipeInstructions: recipe.steps.map((text, n) => ({ "@type": "HowToStep", position: n + 1, text })),
  };
}

/** What search engines and chat apps show for a recipe. The public page and the panel's "Cómo se ve al compartir" both build it here, so they never differ. */
export function recipeShareInfo(recipe: Pick<RecipeInput, "title" | "slug" | "summary" | "image">, siteName: string) {
  const title = recipe.title.trim() || "Sin nombre";
  const summary = recipe.summary.trim();
  return {
    title,
    /** The page title as the browser tab and Google show it (the site layout's template). */
    pageTitle: `${title} | ${siteName}`,
    path: `/${recipe.slug}`,
    description: (summary || `Receta de ${title}: ingredientes y preparación paso a paso.`).slice(0, 200),
    /** The recipe's photo; undefined means the site's general image (/og). */
    image: recipe.image || undefined,
    warnings: [
      !recipe.image && "No tiene foto: WhatsApp va a mostrar la imagen general del sitio.",
      !summary && "No tiene descripción: se usa un texto genérico.",
      summary.length > 160 && `La descripción tiene ${summary.length} caracteres: Google la corta alrededor de los 160.`,
    ].filter(Boolean) as string[],
  };
}
