import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowLeft, Eye, Lightbulb } from "@phosphor-icons/react/dist/ssr";
import { validPreview } from "@/lib/preview";
import { findRecipeBySlug } from "@/lib/recipe-store";
import { descriptionLead, difficultyLabel, filterHref, formatMinutes, isScheduled, momentLabel, recipeJsonLd, recipeShareInfo, relatedRecipes, toRecipeCard, totalMinutes } from "@/lib/recipes";
import { getRecipes, getSettings, ogImage, recipeSite } from "../brand";
import { RecipeCardView } from "../recipe-card";
import { PrintButton, ShareButton, SiteFooter, SiteHeader } from "../site-chrome";
import { PageView } from "../page-view";
import { IngredientList } from "./ingredient-list";
import { RecipeComments } from "./recipe-comments";
import { RecipeGallery } from "./recipe-gallery";
import { RecipeSection } from "./recipe-section";
import { RecipeStory } from "./recipe-story";

type Props = { params: Promise<{ site: string; slug: string }>; searchParams: Promise<{ vista?: string | string[] }> };

/** The published recipe at this address or, with a valid ?vista= signature from the panel, its draft. */
async function find(params: Props["params"], searchParams: Props["searchParams"]) {
  const site = await recipeSite(params);
  if (!site) return {};
  const { slug } = await params;
  const recipes = await getRecipes(site.id);
  const published = recipes.find(r => r.slug === slug);
  if (published) return { site, recipes, recipe: published, preview: false };
  const { vista } = await searchParams;
  if (typeof vista !== "string") return { site, recipes };
  const draft = await findRecipeBySlug(site.id, slug);
  return draft && validPreview(site.id, draft.id, vista) ? { site, recipes, recipe: draft, preview: true } : { site, recipes };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { site, recipe, preview } = await find(params, searchParams).catch(() => ({ site: undefined, recipe: undefined, preview: false }));
  if (!site || !recipe) return { title: "Receta no encontrada" };
  if (preview) return { title: `Vista previa: ${recipe.title}`, robots: { index: false, follow: false }, alternates: { canonical: null } };
  const share = recipeShareInfo(recipe, site.name);
  const { description } = share;
  // Photo + title card (/og?receta=): same 1200 × 630 for every recipe, falls back to the site card without a photo.
  const images = [{ ...ogImage(site.name, (await getSettings(site.id)).tagline, recipe.slug), alt: recipe.title }];
  return {
    title: recipe.title,
    description,
    alternates: { canonical: `/${recipe.slug}` },
    openGraph: { title: recipe.title, description, url: `/${recipe.slug}`, type: "article", siteName: site.name, locale: "es_AR", images },
    twitter: { card: "summary_large_image", title: recipe.title, description, images },
  };
}

export default async function RecipePage({ params, searchParams }: Props) {
  let found;
  try { found = await find(params, searchParams); } catch (error) {
    console.error("[recetas/slug] read failed:", error);
    const site = await recipeSite(params);
    return <main className="r-page"><SiteHeader name={site?.name ?? ""} /><p className="r-empty" role="alert">No se pudo cargar la receta. Intentá de nuevo en unos minutos.</p></main>;
  }
  const { site, recipes, recipe, preview } = found;
  if (!site || !recipe) notFound();
  const total = totalMinutes(recipe);
  const facts = [
    recipe.prepMinutes && { label: "Preparación", value: formatMinutes(recipe.prepMinutes) },
    recipe.cookMinutes && { label: "Cocción", value: formatMinutes(recipe.cookMinutes) },
    recipe.prepMinutes && recipe.cookMinutes && total && { label: "Total", value: formatMinutes(total) },
    recipe.servings && { label: "Rinde", value: recipe.servings },
    recipe.difficulty && { label: "Complejidad", value: difficultyLabel(recipe.difficulty) },
    recipe.cuisine && { label: "Nación", value: recipe.cuisine },
  ].filter(Boolean) as { label: string; value: string }[];
  const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);
  const ingredientsLabel = plural(recipe.ingredients.length, "ingrediente", "ingredientes");
  const stepsLabel = plural(recipe.steps.length, "paso", "pasos");
  // Long descriptions (titles, lists, several paragraphs) show their first paragraph under the title and the whole text after the method.
  const { lead, more } = descriptionLead(recipe.summary);
  const related = relatedRecipes(recipe, recipes).map(toRecipeCard);
  // "<" escaped so a recipe's text can never close the script tag.
  const jsonLd = JSON.stringify(recipeJsonLd(recipe, site.url, site.name)).replace(/</g, "\\u003c");
  return <>
    <SiteHeader name={site.name} siteId={site.id} />
    <main className="r-page r-recipe">
      {preview
        ? <p className="r-preview no-print" role="status"><Eye size={20} weight="fill" aria-hidden="true" /><span>{isScheduled(recipe)
          ? <><strong>Vista previa de una receta programada.</strong> Se publica el {new Date(recipe.publishedAt as string).toLocaleString("es-AR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" })}; hasta entonces solo la ve quien tiene este link. Muestra lo último que se guardó en el panel.</>
          : <><strong>Vista previa del borrador.</strong> Esta receta no está publicada: solo la ve quien tiene este link. Muestra lo último que se guardó en el panel.</>}</span></p>
        : <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />}
      <nav className="r-back no-print" aria-label="Volver"><Link href="/"><ArrowLeft size={18} aria-hidden="true" />Todas las recetas</Link></nav>
      <article>
        <header className="r-hero">
          <RecipeGallery title={recipe.title} images={[recipe.image, ...recipe.images].filter((src): src is string => Boolean(src))} sizes="(max-width: 860px) 100vw, 560px" />
          <div className="r-hero-text">
            {(recipe.moments.length > 0 || recipe.categories.length > 0) && <ul className="r-tags" aria-label="Tipos">
              {recipe.moments.map(m => <li key={m}><Link href={filterHref("moment", m)}>{momentLabel(m)}</Link></li>)}
              {recipe.categories.map(c => <li key={c}><Link href={filterHref("type", c)}>{c}</Link></li>)}
            </ul>}
            <div className="r-title-row">
              <h1>{recipe.title}</h1>
              <div className="r-title-actions no-print">
                {!preview && <ShareButton iconOnly label="Compartir receta" path={`/${recipe.slug}`} text={recipe.title} siteId={site.id} recipeId={recipe.id} />}
                <PrintButton iconOnly />
              </div>
            </div>
            {lead && <p className={`r-lead${more ? " is-clipped" : ""}`}>{lead}</p>}
            {more && <a className="r-more no-print" href="#sobre-la-receta">Seguir leyendo<ArrowDown size={16} weight="bold" aria-hidden="true" /></a>}
            {facts.length > 0 && <dl className="r-facts">
              {facts.map(f => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}
            </dl>}
          </div>
        </header>
        <div className="r-method">
          <RecipeSection id="ingredients" title="Ingredientes" summary={ingredientsLabel} className="r-ingredients">
            {recipe.servings && <p className="r-yield">Para {recipe.servings}</p>}
            <IngredientList ingredients={recipe.ingredients} />
          </RecipeSection>
          <RecipeSection id="steps" title="Preparación" summary={stepsLabel} foldOnPhone className="r-steps">
            <ol>{recipe.steps.map((step, n) => <li key={n}><p>{step}</p></li>)}</ol>
          </RecipeSection>
          {recipe.notes && <aside className="r-notes" aria-labelledby="notes-title">
            <h3 id="notes-title"><Lightbulb size={20} weight="fill" aria-hidden="true" />Consejos</h3>
            {recipe.notes.split(/\n+/).map((line, n) => <p key={n}>{line}</p>)}
          </aside>}
        </div>
        {more && <RecipeStory text={recipe.summary} />}
      </article>
      {/* Counted by the browser, so link-preview fetchers and router prefetches never add a view; the API also drops crawlers and previews. */}
      {!preview && <PageView siteId={site.id} recipeId={recipe.id} />}
      {!preview && <RecipeComments siteId={site.id} recipeId={recipe.id} />}
      {related.length > 0 && <section className="r-related no-print" aria-labelledby="related-title">
        <h2 id="related-title">Más recetas</h2>
        <ul className="r-grid">{related.map(r => <RecipeCardView key={r.slug} recipe={r} />)}</ul>
      </section>}
    </main>
    <SiteFooter name={site.name} siteId={site.id} />
  </>;
}
