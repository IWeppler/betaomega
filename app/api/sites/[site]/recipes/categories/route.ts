import { isAdmin, sameOrigin } from "@/lib/auth";
import { RecipeConflictError, listRecipes, saveRecipe } from "@/lib/recipe-store";
import { canonicalCategory, renameCategory, toRecipeInput } from "@/lib/recipes";
import { failure, forbidden, notFound, recipeSite, type SiteParams } from "../helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Renames category `from` to `to` in every recipe of the site (drafts included). If `to` already exists (or differs from it only by case or accents) the recipes join it. */
export async function POST(request: Request, { params }: SiteParams) {
  if (!sameOrigin(request) || !await isAdmin()) return forbidden();
  const site = await recipeSite(params);
  if (!site) return notFound();
  try {
    const body = JSON.parse(await request.text()) as { from?: unknown; to?: unknown };
    if (typeof body.from !== "string" || typeof body.to !== "string") return Response.json({ error: "Categoría inválida." }, { status: 400 });
    const recipes = await listRecipes(site.id);
    const others = [...new Set(recipes.flatMap(r => r.categories))].filter(c => c !== body.from);
    const to = canonicalCategory(body.to, others);
    if (!to) return Response.json({ error: "Escribí el nuevo nombre de la categoría." }, { status: 400 });
    if (to.length > 40) return Response.json({ error: "El nombre es demasiado largo (máximo 40 caracteres)." }, { status: 400 });
    const affected = recipes.filter(r => r.categories.includes(body.from as string));
    if (!affected.length) return Response.json({ error: "Ninguna receta usa esa categoría. Recargá la página." }, { status: 404 });
    const failed: { title: string; error: string }[] = [];
    let changed = 0;
    for (const recipe of affected) {
      try {
        // saveRecipe starts from the revision just read, so a recipe someone else saved meanwhile is reported, not overwritten.
        await saveRecipe(site.id, renameCategory(toRecipeInput(recipe), body.from, to));
        changed++;
      } catch (error) {
        if (!(error instanceof RecipeConflictError)) throw error;
        failed.push({ title: recipe.title, error: error.message });
      }
    }
    return Response.json({ to, changed, failed });
  } catch (error) { return failure(error, "renombrar la categoría"); }
}
