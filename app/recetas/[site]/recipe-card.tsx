import Image from "next/image";
import Link from "next/link";
import { ChefHat, Clock, CookingPot, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { difficultyLabel, formatMinutes, type RecipeCard } from "@/lib/recipes";

/** The photo, or a pot on a warm background when there is none (the image covers it when it loads). */
export function RecipePhoto({ title, image, hoverImage, priority, sizes }: { title: string; image?: string; hoverImage?: string; priority?: boolean; sizes: string }) {
  return <div className="r-photo">
    <CookingPot size={48} weight="duotone" aria-hidden="true" />
    {image && <Image src={image} alt={title} fill sizes={sizes} unoptimized priority={priority} />}
    {image && hoverImage && <Image className="r-photo-hover" src={hoverImage} alt="" fill sizes={sizes} unoptimized />}
  </div>;
}

/** Time · servings · difficulty, in that order. Missing ones are skipped without leaving a gap. */
export function RecipeMeta({ minutes, servings, difficulty }: { minutes?: number; servings: string; difficulty?: string }) {
  if (!minutes && !servings && !difficulty) return null;
  return <p className="r-meta">
    {minutes ? <span><Clock size={16} aria-hidden="true" /><span className="sr-only">Tiempo total: </span>{formatMinutes(minutes)}</span> : null}
    {servings && <span><UsersThree size={16} aria-hidden="true" /><span className="sr-only">Rinde: </span>{servings}</span>}
    {difficulty && <span><ChefHat size={16} aria-hidden="true" /><span className="sr-only">Complejidad: </span>{difficultyLabel(difficulty)}</span>}
  </p>;
}

/** One recipe in a grid. The whole card is a single link, named by the title. */
export function RecipeCardView({ recipe, priority }: { recipe: RecipeCard; priority?: boolean }) {
  return <li className="r-card">
    <Link href={`/${recipe.slug}`}>
      <RecipePhoto title="" image={recipe.image} hoverImage={recipe.hoverImage} priority={priority} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px" />
      <div className="r-card-body">
        {recipe.categories.length > 0 && <p className="r-eyebrow">{recipe.categories.slice(0, 2).join(" · ")}</p>}
        <h3>{recipe.title}</h3>
        {recipe.summary && <p className="r-card-summary">{recipe.summary}</p>}
        <RecipeMeta minutes={recipe.minutes} servings={recipe.servings} difficulty={recipe.difficulty} />
      </div>
    </Link>
  </li>;
}
