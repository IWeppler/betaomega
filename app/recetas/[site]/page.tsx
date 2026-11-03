import { notFound } from "next/navigation";
import { CookingPot } from "@phosphor-icons/react/dist/ssr";
import { filterParams, isRecipeOrder, noFilters, recipeCategories, recipeCuisines, recipeDifficulties, recipeMoments, recipeTimes, toRecipeCard, type RecipeFilters } from "@/lib/recipes";
import { getRecipes, getSettings, recipeSite } from "./brand";
import { PageView } from "./page-view";
import { RecipeBrowser } from "./recipe-browser";
import { SiteFooter, SiteHeader } from "./site-chrome";

export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ site: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RecipesHome({ params, searchParams }: Props) {
  const site = await recipeSite(params);
  if (!site) notFound();
  let recipes;
  try {
    recipes = await getRecipes(site.id);
  } catch (error) {
    console.error("[recetas] read failed:", error);
    return (
      <main className="r-page">
        <SiteHeader name={site.name} />
        <p className="r-empty" role="alert">
          No se pudieron cargar las recetas. Intentá de nuevo en unos minutos.
        </p>
      </main>
    );
  }
  const cards = recipes.map(toRecipeCard);
  const { tagline, description } = await getSettings(site.id);
  const types = recipeCategories(recipes).map((c) => c.label);
  const cuisines = recipeCuisines(recipes);
  // Filters from the address; unknown values are ignored. ?categoria= is the old name of ?tipo= (links already shared).
  const asked = await searchParams;
  const param = (name: string) => (typeof asked[name] === "string" ? (asked[name] as string) : "");
  const known: Record<keyof RecipeFilters, string[]> = {
    moment: recipeMoments.map((m) => m.id),
    type: types,
    cuisine: cuisines,
    difficulty: recipeDifficulties.map((d) => d.id),
    time: recipeTimes.map((t) => t.id),
  };
  const initialFilters = { ...noFilters };
  for (const axis of Object.keys(known) as (keyof RecipeFilters)[]) {
    const value = param(filterParams[axis]) || (axis === "type" ? param("categoria") : "");
    if (known[axis].includes(value)) initialFilters[axis] = value;
  }
  const order = param("orden");
  return (
    <>
      <SiteHeader name={site.name} siteId={site.id} />
      <main className="r-page">
        {cards.length ? (
          <RecipeBrowser
            recipes={cards}
            types={types}
            cuisines={cuisines}
            initialFilters={initialFilters}
            initialOrder={isRecipeOrder(order) ? order : "recientes"}
          />
        ) : (
          <div className="r-empty is-soon">
            <CookingPot size={56} weight="duotone" aria-hidden="true" />
            <p>Estamos preparando las primeras recetas.</p>
          </div>
        )}
      </main>
      <PageView siteId={site.id} />
      <SiteFooter name={site.name} siteId={site.id} />
    </>
  );
}
