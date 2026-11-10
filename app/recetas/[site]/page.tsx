import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CookingPot } from "@phosphor-icons/react/dist/ssr";
import { noFilters, recipeCategories, recipeCuisines, toRecipeCard } from "@/lib/recipes";
import { getRecipes, recipeSite } from "./brand";
import { PageView } from "./page-view";
import { RecipeBrowserFromUrl } from "./recipe-browser-from-url";
import { RecipeBrowser } from "./recipe-browser";
import { SiteFooter, SiteHeader } from "./site-chrome";

export function generateStaticParams() { return []; }
// Same as publicRevalidate (platform/sites/public-cache.ts); segment config must be a literal.
export const revalidate = 3600;
type Props = {
  params: Promise<{ site: string }>;
};

export default async function RecipesHome({ params }: Props) {
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
  const types = recipeCategories(recipes).map((c) => c.label);
  const cuisines = recipeCuisines(recipes);
  return (
    <>
      <SiteHeader name={site.name} siteId={site.id} />
      <main className="r-page">
        {cards.length ? (
          <Suspense fallback={<RecipeBrowser recipes={cards} types={types} cuisines={cuisines} initialFilters={noFilters} initialOrder="recientes" />}>
            <RecipeBrowserFromUrl recipes={cards} types={types} cuisines={cuisines} />
          </Suspense>
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
