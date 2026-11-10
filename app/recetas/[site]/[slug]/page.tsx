import { generateMetadata as recipeMetadata, default as RecipePage } from "./recipe-page";

export const dynamic = "force-static";
// Same as publicRevalidate (platform/sites/public-cache.ts); segment config must be a literal.
export const revalidate = 3600;
type Props = { params: Promise<{ site: string; slug: string }> };

export function generateMetadata({ params }: Props) {
  return recipeMetadata({ params, searchParams: Promise.resolve({}) });
}

export default function PublishedRecipe({ params }: Props) {
  return <RecipePage params={params} searchParams={Promise.resolve({})} />;
}
