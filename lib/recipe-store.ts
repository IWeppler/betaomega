import { normalizeCategories, type Recipe, type RecipeInput } from "./recipes";
import { recordedViews } from "./metric-store";
import { SupabaseError } from "./supabase";
import { MissingTableError, siteTable } from "./site-table";

// Server-only reads and writes of the recipes table (supabase/schema.sql).
export class RecipeConflictError extends Error {}

type Row = {
  id: string; site_id: string; slug: string; title: string; summary: string; image: string | null; categories: string[]; servings: string;
  prep_minutes: number | null; cook_minutes: number | null; ingredients: Recipe["ingredients"]; steps: string[]; notes: string;
  published: boolean; revision: number; updated_at: string;
  /** Missing until supabase/schema.sql is run again (it adds the column). */
  published_at?: string | null;
  /** Missing until schema.sql is run again: views counter and extra photos. */
  views?: number;
  images?: string[];
  /** Missing until schema.sql is run again: moment, nation and difficulty. */
  moments?: Recipe["moments"];
  cuisine?: string | null;
  difficulty?: Recipe["difficulty"] | null;
};
const taxonomyColumns = ["moments", "cuisine", "difficulty"];
/** Which optional columns a write sends. Each one is left out only while it is missing and the recipe has nothing to store in it. */
type Columns = { images: boolean; taxonomy: boolean };
const fromRow = (row: Row): Recipe => ({
  id: row.id, siteId: row.site_id, slug: row.slug, title: row.title, summary: row.summary, image: row.image ?? undefined, categories: normalizeCategories(row.categories),
  servings: row.servings, prepMinutes: row.prep_minutes ?? undefined, cookMinutes: row.cook_minutes ?? undefined, ingredients: row.ingredients,
  steps: row.steps, notes: row.notes, published: row.published, revision: row.revision, updatedAt: row.updated_at,
  publishedAt: row.published_at ?? undefined, views: row.views, images: row.images ?? [],
  moments: row.moments ?? [], cuisine: row.cuisine ?? "", difficulty: row.difficulty ?? undefined,
});
// Optional columns only travel when they can matter (see saveRecipe) and `published_at` only when a date was chosen, so saving keeps working before schema.sql is run again.
const toRow = (siteId: string, recipe: RecipeInput, columns: Columns) => ({
  ...(columns.images ? { images: recipe.images } : {}),
  ...(columns.taxonomy ? { moments: recipe.moments, cuisine: recipe.cuisine, difficulty: recipe.difficulty ?? null } : {}),
  ...(recipe.scheduledAt ? { published_at: recipe.scheduledAt } : {}),
  site_id: siteId, slug: recipe.slug, title: recipe.title, summary: recipe.summary, image: recipe.image ?? null, categories: recipe.categories,
  servings: recipe.servings, prep_minutes: recipe.prepMinutes ?? null, cook_minutes: recipe.cookMinutes ?? null, ingredients: recipe.ingredients,
  steps: recipe.steps, notes: recipe.notes, published: recipe.published,
});

const missingTable = "Falta la tabla recipes en Supabase. Corré supabase/schema.sql en el SQL Editor.";
/** The recipes of one site (siteTable scopes every query to it), with unique-key errors turned into RecipeConflictError. */
function rows(siteId: string) {
  const table = siteTable<Row>("recipes", siteId, missingTable);
  return async (query = "", init: RequestInit = {}) => {
    try { return await table(query, init); } catch (error) {
      // 23505: unique violation. The only unique keys are the id and the slug of each site.
      if (error instanceof SupabaseError && error.message.includes("23505")) {
        throw new RecipeConflictError(error.message.includes("slug") ? "Ya hay otra receta con esa dirección. Cambiá la dirección o el nombre." : "Otra persona creó esta receta al mismo tiempo. Recargá la página.");
      }
      throw error;
    }
  };
}
const eq = (value: string | number) => `eq.${encodeURIComponent(String(value))}`;

/** The panel's list. `views` is the old counter plus what the metrics have recorded since. */
export async function listRecipes(siteId: string) {
  const [list, recorded] = await Promise.all([rows(siteId)(`select=*&order=title.asc`), recordedViews(siteId)]);
  return list.map(fromRow).map(recipe => (recorded[recipe.id] ? { ...recipe, views: (recipe.views ?? 0) + recorded[recipe.id] } : recipe));
}

/** True when the recipe is published and its date has come: the only ones that take comments, views and shares. */
/** The title of a live recipe, or null when it is not live (or the table is missing). For the panel notices. */
export async function liveRecipeTitle(siteId: string, recipeId: string): Promise<string | null> {
  const live = `&or=(published_at.is.null,published_at.lte.${new Date().toISOString()})`;
  try { return (await rows(siteId)(`id=${eq(recipeId)}&published=is.true${live}&select=title`))[0]?.title ?? null; } catch (error) {
    if (error instanceof MissingTableError) return null;
    throw error;
  }
}

export async function isLiveRecipe(siteId: string, recipeId: string) {
  const live = `&or=(published_at.is.null,published_at.lte.${new Date().toISOString()})`;
  try { return (await rows(siteId)(`id=${eq(recipeId)}&published=is.true${live}&select=id`)).length > 0; } catch (error) {
    // No table yet: nothing is live.
    if (error instanceof MissingTableError) return false;
    throw error;
  }
}

/** Published recipes of a site, the most recently published first: what the public site shows. */
export async function listPublishedRecipes(siteId: string) {
  const query = (order: string, live = "") => rows(siteId)(`published=is.true${live}&select=*&order=${order}`);
  try {
    // A recipe scheduled for a later date stays out until then.
    const live = `&or=(published_at.is.null,published_at.lte.${new Date().toISOString()})`;
    return (await query("published_at.desc.nullslast,created_at.desc", live)).map(fromRow);
  } catch (error) {
    // Until schema.sql is run again the column does not exist: keep the site up with the old order.
    if (!(error instanceof SupabaseError && error.message.includes("published_at"))) throw error;
    console.warn("[recipes] Falta la columna published_at: corré supabase/schema.sql. Ordenando por última edición.");
    return (await query("updated_at.desc")).map(fromRow);
  }
}

/** One recipe by its address, published or not. Only for previews: the caller checks the signature. */
export async function findRecipeBySlug(siteId: string, slug: string) {
  const [row] = await rows(siteId)(`slug=${eq(slug)}&select=*&limit=1`);
  return row ? fromRow(row) : undefined;
}

/** Creates the recipe (revision 0) or updates it if nobody saved since `recipe.revision`. */
export async function saveRecipe(siteId: string, recipe: RecipeInput) {
  const taken = await rows(siteId)(`slug=${eq(recipe.slug)}&id=neq.${recipe.id}&select=id`);
  if (taken.length) throw new RecipeConflictError("Ya hay otra receta con esa dirección. Cambiá la dirección o el nombre.");
  const missing = (error: unknown, ...columns: string[]) => error instanceof SupabaseError && columns.some(column => error.message.includes(column));
  const hasTaxonomy = Boolean(recipe.moments.length || recipe.cuisine || recipe.difficulty);
  // Before schema.sql is run again some columns do not exist: that is fine while the recipe has nothing to store in them.
  const columns: Columns = { images: true, taxonomy: true };
  for (;;) {
    try {
      return await write(siteId, recipe, columns);
    } catch (error) {
      if (columns.images && !recipe.images.length && missing(error, "images")) { columns.images = false; continue; }
      if (columns.taxonomy && !hasTaxonomy && missing(error, ...taxonomyColumns)) { columns.taxonomy = false; continue; }
      if (recipe.scheduledAt && missing(error, "published_at")) throw new SupabaseError("Para programar la publicación hay que correr supabase/schema.sql en el SQL Editor.");
      if (recipe.images.length && missing(error, "images")) throw new SupabaseError("Para guardar fotos adicionales hay que correr supabase/schema.sql en el SQL Editor.");
      if (hasTaxonomy && missing(error, ...taxonomyColumns)) throw new SupabaseError("Para guardar el momento, la nación o la complejidad hay que correr supabase/schema.sql en el SQL Editor.");
      throw error;
    }
  }
}
async function write(siteId: string, recipe: RecipeInput, columns: Columns) {
  if (recipe.revision === 0) {
    const [created] = await rows(siteId)("", { method: "POST", body: JSON.stringify({ id: recipe.id, ...toRow(siteId, recipe, columns), revision: 1 }) });
    return fromRow(created);
  }
  // The revision filter and the update run in one statement, so concurrent saves cannot overwrite each other.
  const [updated] = await rows(siteId)(`id=${eq(recipe.id)}&revision=${eq(recipe.revision)}`, {
    method: "PATCH", body: JSON.stringify({ ...toRow(siteId, recipe, columns), revision: recipe.revision + 1, updated_at: new Date().toISOString() }),
  });
  if (!updated) throw new RecipeConflictError("Otra persona modificó o eliminó esta receta. Recargá la página antes de guardar.");
  return fromRow(updated);
}

export async function deleteRecipe(siteId: string, id: string) {
  await rows(siteId)(`id=${eq(id)}`, { method: "DELETE" });
}
