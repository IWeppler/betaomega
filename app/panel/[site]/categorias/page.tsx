import { notFound } from "next/navigation";
import { getSite } from "@/lib/site-registry";
import { HerbCategories } from "./herb-categories";
import { RecipeCategories } from "./recipe-categories";

// The page depends on the kind of site; the layout already checked the session.
export default async function CategoriesPage({ params }: { params: Promise<{ site: string }> }) {
  const site = await getSite((await params).site);
  if (!site) notFound();
  return site.kind === "recetas" ? <RecipeCategories /> : <HerbCategories />;
}
