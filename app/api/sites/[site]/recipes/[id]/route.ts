import { isAdmin, sameOrigin } from "@/lib/auth";
import { previewToken } from "@/lib/preview";
import { deleteRecipe, saveRecipe } from "@/lib/recipe-store";
import { cleanRecipe, isRecipeId } from "@/lib/recipes";
import { failure, forbidden, notFound, recipeSite } from "../helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Params = { params: Promise<{ site: string; id: string }> };

/** Creates or updates one recipe. The body carries the revision it was edited from (0 for a new one). */
export async function PUT(request: Request, { params }: Params) {
  if (!sameOrigin(request) || !await isAdmin()) return forbidden();
  const site = await recipeSite(params);
  const { id } = await params;
  if (!site || !isRecipeId(id)) return notFound();
  try {
    const text = await request.text();
    if (text.length > 200_000) return Response.json({ error: "La receta es demasiado larga." }, { status: 413 });
    const recipe = cleanRecipe(JSON.parse(text));
    if (recipe.id !== id) return Response.json({ error: "Receta inválida." }, { status: 400 });
    return Response.json({ ...await saveRecipe(site.id, recipe), previewToken: previewToken(site.id, id) });
  } catch (error) { return failure(error, "guardar la receta"); }
}

export async function DELETE(request: Request, { params }: Params) {
  if (!sameOrigin(request) || !await isAdmin()) return forbidden();
  const site = await recipeSite(params);
  const { id } = await params;
  if (!site || !isRecipeId(id)) return notFound();
  try {
    await deleteRecipe(site.id, id);
    return new Response(null, { status: 204 });
  } catch (error) { return failure(error, "eliminar la receta"); }
}
