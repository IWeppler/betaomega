import type { Recipe, RecipeInput } from "./recipes";
import { rpc, supabase, SupabaseError } from "./supabase";

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
};
const fromRow = (row: Row): Recipe => ({
  id: row.id, siteId: row.site_id, slug: row.slug, title: row.title, summary: row.summary, image: row.image ?? undefined, categories: row.categories,
  servings: row.servings, prepMinutes: row.prep_minutes ?? undefined, cookMinutes: row.cook_minutes ?? undefined, ingredients: row.ingredients,
  steps: row.steps, notes: row.notes, published: row.published, revision: row.revision, updatedAt: row.updated_at,
  publishedAt: row.published_at ?? undefined, views: row.views, images: row.images ?? [],
});
// `images` only travels when it can matter (see saveRecipe) and `published_at` only when a date was chosen, so saving keeps working before schema.sql is run again.
const toRow = (siteId: string, recipe: RecipeInput, withImages: boolean) => ({
  ...(withImages ? { images: recipe.images } : {}),
  ...(recipe.scheduledAt ? { published_at: recipe.scheduledAt } : {}),
  site_id: siteId, slug: recipe.slug, title: recipe.title, summary: recipe.summary, image: recipe.image ?? null, categories: recipe.categories,
  servings: recipe.servings, prep_minutes: recipe.prepMinutes ?? null, cook_minutes: recipe.cookMinutes ?? null, ingredients: recipe.ingredients,
  steps: recipe.steps, notes: recipe.notes, published: recipe.published,
});

const missingTable = () => new SupabaseError("Falta la tabla recipes en Supabase. Corré supabase/schema.sql en el SQL Editor.");
async function rows(pathname: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) { headers.set("Content-Type", "application/json"); headers.set("Prefer", "return=representation"); }
  try {
    const response = await supabase(`/rest/v1/recipes${pathname}`, { ...init, headers });
    if (response.status === 404) throw missingTable();
    return response.status === 204 ? [] : await response.json() as Row[];
  } catch (error) {
    // 23505: unique violation. The only unique keys are the id and the slug of each site.
    if (error instanceof SupabaseError && error.message.includes("23505")) {
      throw new RecipeConflictError(error.message.includes("slug") ? "Ya hay otra receta con esa dirección. Cambiá la dirección o el nombre." : "Otra persona creó esta receta al mismo tiempo. Recargá la página.");
    }
    throw error;
  }
}
const eq = (value: string | number) => `eq.${encodeURIComponent(String(value))}`;

export async function listRecipes(siteId: string) {
  return (await rows(`?site_id=${eq(siteId)}&select=*&order=title.asc`)).map(fromRow);
}

/** Published recipes of a site, the most recently published first: what the public site shows. */
export async function listPublishedRecipes(siteId: string) {
  const query = (order: string, live = "") => rows(`?site_id=${eq(siteId)}&published=is.true${live}&select=*&order=${order}`);
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
  const [row] = await rows(`?site_id=${eq(siteId)}&slug=${eq(slug)}&select=*&limit=1`);
  return row ? fromRow(row) : undefined;
}

/** Creates the recipe (revision 0) or updates it if nobody saved since `recipe.revision`. */
export async function saveRecipe(siteId: string, recipe: RecipeInput) {
  const taken = await rows(`?site_id=${eq(siteId)}&slug=${eq(recipe.slug)}&id=neq.${recipe.id}&select=id`);
  if (taken.length) throw new RecipeConflictError("Ya hay otra receta con esa dirección. Cambiá la dirección o el nombre.");
  const missing = (error: unknown, column: string) => error instanceof SupabaseError && error.message.includes(column);
  try {
    return await write(siteId, recipe, true);
  } catch (error) {
    // Before schema.sql is run again there is no `images` column: that is fine while the recipe has no extra photos.
    if (!recipe.images.length && missing(error, "images")) return write(siteId, recipe, false);
    if (recipe.scheduledAt && missing(error, "published_at")) throw new SupabaseError("Para programar la publicación hay que correr supabase/schema.sql en el SQL Editor.");
    if (recipe.images.length && missing(error, "images")) throw new SupabaseError("Para guardar fotos adicionales hay que correr supabase/schema.sql en el SQL Editor.");
    throw error;
  }
}
async function write(siteId: string, recipe: RecipeInput, withImages: boolean) {
  if (recipe.revision === 0) {
    const [created] = await rows("", { method: "POST", body: JSON.stringify({ id: recipe.id, ...toRow(siteId, recipe, withImages), revision: 1 }) });
    return fromRow(created);
  }
  // The revision filter and the update run in one statement, so concurrent saves cannot overwrite each other.
  const [updated] = await rows(`?id=${eq(recipe.id)}&site_id=${eq(siteId)}&revision=${eq(recipe.revision)}`, {
    method: "PATCH", body: JSON.stringify({ ...toRow(siteId, recipe, withImages), revision: recipe.revision + 1, updated_at: new Date().toISOString() }),
  });
  if (!updated) throw new RecipeConflictError("Otra persona modificó o eliminó esta receta. Recargá la página antes de guardar.");
  return fromRow(updated);
}

let viewWarned = false;
/** Adds one view to a published recipe (the Postgres function bumps the counter in one statement). Never throws: a failed count must not break the page. */
export async function countRecipeView(recipeId: string) {
  try { await rpc("increment_recipe_view", { recipe_id: recipeId }); } catch (error) {
    if (!viewWarned) { viewWarned = true; console.warn("[recipes] no se pudo contar la vista (¿falta correr supabase/schema.sql?):", error); }
  }
}

export async function deleteRecipe(siteId: string, id: string) {
  await rows(`?id=${eq(id)}&site_id=${eq(siteId)}`, { method: "DELETE" });
}
