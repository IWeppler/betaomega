import { getSite } from "@/lib/site-registry";
import { askedIconSize, redirectToStatic } from "@/shared/lib/static-icons";
import { recipeIcon } from "../brand";

// Old address of the tab, home-screen and installed-app icon (?size=, ?maskable=1). The icons are pre-rendered into public/icons/
// (scripts/generate-icons.mjs) and the pages point there; this only redirects installed apps and cached pages that still ask here.
export async function GET(request: Request, context: { params: Promise<{ site: string }> }) {
  const site = await getSite((await context.params).site);
  if (site?.kind !== "recetas") return new Response("No encontrado", { status: 404 });
  const url = new URL(request.url);
  return redirectToStatic(recipeIcon(askedIconSize(url.searchParams.get("size")), url.searchParams.get("maskable") === "1"));
}
