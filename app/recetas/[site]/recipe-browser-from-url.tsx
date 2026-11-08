"use client";

import { useSearchParams } from "next/navigation";
import { filterParams, isRecipeOrder, noFilters, recipeDifficulties, recipeMoments, recipeTimes, type RecipeCard, type RecipeFilters } from "@/lib/recipes";
import { RecipeBrowser } from "./recipe-browser";

/** URL filters belong to the browser so the public catalog can share one server render. */
export function RecipeBrowserFromUrl({ recipes, types, cuisines }: { recipes: RecipeCard[]; types: string[]; cuisines: string[] }) {
  const params = useSearchParams();
  const known: Record<keyof RecipeFilters, string[]> = {
    moment: recipeMoments.map(m => m.id), type: types, cuisine: cuisines,
    difficulty: recipeDifficulties.map(d => d.id), time: recipeTimes.map(t => t.id),
  };
  const filters = { ...noFilters };
  for (const axis of Object.keys(known) as (keyof RecipeFilters)[]) {
    const value = params.get(filterParams[axis]) || (axis === "type" ? params.get("categoria") : "") || "";
    if (known[axis].includes(value)) filters[axis] = value;
  }
  const order = params.get("orden") ?? "";
  return <RecipeBrowser recipes={recipes} types={types} cuisines={cuisines} initialFilters={filters} initialOrder={isRecipeOrder(order) ? order : "recientes"} />;
}
