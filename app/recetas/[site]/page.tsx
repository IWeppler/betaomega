import { notFound } from "next/navigation";
import { CookingPot } from "@phosphor-icons/react/dist/ssr";
import { recipeCategories, toRecipeCard } from "@/lib/recipes";
import { getRecipes, getSettings, recipeSite } from "./brand";
import { RecipeBrowser } from "./recipe-browser";
import { ShareButton, SiteFooter, SiteHeader } from "./site-chrome";

export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ site: string }>;
  searchParams: Promise<{ categoria?: string | string[] }>;
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
  const { tagline } = await getSettings(site.id);
  const cards = recipes.map(toRecipeCard);
  const categories = recipeCategories(recipes);
  const asked = (await searchParams).categoria;
  const initial =
    typeof asked === "string" && categories.some((c) => c.label === asked)
      ? asked
      : "";
  return (
    <>
      <SiteHeader
        name={site.name}
        action={<ShareButton path="/" text={site.name} />}
      />
      <main className="r-page">
        <header className="r-intro">
          <h1>
            {tagline}, <em>paso a paso</em>
          </h1>
        </header>
        {cards.length ? (
          <RecipeBrowser
            recipes={cards}
            categories={categories}
            initialCategory={initial}
          />
        ) : (
          <div className="r-empty is-soon">
            <CookingPot size={56} weight="duotone" aria-hidden="true" />
            <p>Estamos preparando las primeras recetas.</p>
          </div>
        )}
      </main>
      <SiteFooter name={site.name} siteId={site.id} />
    </>
  );
}
