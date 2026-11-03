import { isScheduled, lacksContent, recipeGaps, type Recipe } from "@/lib/recipes";

/** Subsets of the recipe list the summary links to with ?ver=<id>. */
export const recipeViews = {
  borradores: { label: "Borradores", test: (r: Recipe) => !r.published },
  "sin-contenido": { label: "Publicadas sin ingredientes o pasos", test: (r: Recipe) => r.published && !isScheduled(r) && lacksContent(r) },
  incompletas: { label: "Publicadas incompletas", test: (r: Recipe) => r.published && !isScheduled(r) && recipeGaps(r).length > 0 },
  programadas: { label: "Programadas", test: (r: Recipe) => isScheduled(r) },
} as const;
export type RecipeView = keyof typeof recipeViews;
export const isRecipeView = (value: unknown): value is RecipeView => typeof value === "string" && Object.hasOwn(recipeViews, value);

/** Panel addresses: the list filtered to a view, or one recipe open in the editor. */
export const recipesHref = (site: string, to?: { view: RecipeView } | { recipe: string }) =>
  `/${site}/recetas${!to ? "" : "view" in to ? `?ver=${to.view}` : `?receta=${to.recipe}`}`;
