import { getSite } from "@/lib/site-registry";
import { RecipeConflictError } from "@/lib/recipe-store";
import { SiteConflictError } from "@/lib/site-store";

export type SiteParams = { params: Promise<{ site: string }> };
/** The recipe site named in the URL, or undefined when it does not exist or is another kind of site. */
export async function recipeSite(params: Promise<{ site: string }>) {
  const site = await getSite((await params).site);
  return site?.kind === "recetas" ? site : undefined;
}
export const notFound = () => Response.json({ error: "Sitio no encontrado." }, { status: 404 });
export const forbidden = () => Response.json({ error: "Ingresá como administrador para guardar." }, { status: 403 });

/** Validation and conflicts go back to the person as they are; Supabase failures are logged and summarized. */
export function failure(error: unknown, action: string) {
  if (error instanceof RecipeConflictError || error instanceof SiteConflictError) return Response.json({ error: error.message }, { status: 409 });
  if (error instanceof SyntaxError) return Response.json({ error: "Receta inválida." }, { status: 400 });
  if (error instanceof Error && !("code" in error)) return Response.json({ error: error.message }, { status: 400 });
  console.error(`[recipes] ${action} failed:`, error);
  // Only administrators reach this point, so the cause is returned to make production failures diagnosable.
  const cause = error instanceof Error ? error.message.slice(0, 300) : String(error);
  return Response.json({ error: `No se pudo ${action}: ${cause}` }, { status: 500 });
}
