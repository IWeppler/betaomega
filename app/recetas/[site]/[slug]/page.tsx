import { generateMetadata as recipeMetadata, default as RecipePage } from "./recipe-page";

export const dynamic = "force-static";
export const revalidate = 60;
type Props = { params: Promise<{ site: string; slug: string }> };

export function generateMetadata({ params }: Props) {
  return recipeMetadata({ params, searchParams: Promise.resolve({}) });
}

export default function PublishedRecipe({ params }: Props) {
  return <RecipePage params={params} searchParams={Promise.resolve({})} />;
}
