import Link from "next/link";
import { CookingPot } from "@phosphor-icons/react/dist/ssr";

export default function RecipeNotFound() {
  return <main className="r-page">
    <div className="r-empty is-soon">
      <CookingPot size={56} weight="duotone" aria-hidden="true" />
      <h1>No encontramos esta receta</h1>
      <p>Puede que la dirección esté mal escrita o que la receta ya no esté publicada.</p>
      <Link className="r-button" href="/">Ver todas las recetas</Link>
    </div>
  </main>;
}
