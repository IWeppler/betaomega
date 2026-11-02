"use client";

import { useState } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { matchesRecipe, type RecipeCard } from "@/lib/recipes";
import { RecipeCardView } from "./recipe-card";

/** Search box, category chips and the grid. The chosen category goes to the address (?categoria=), so it can be shared. */
export function RecipeBrowser({ recipes, categories, initialCategory }: { recipes: RecipeCard[]; categories: { label: string; count: number }[]; initialCategory: string }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(initialCategory);
  const choose = (next: string) => {
    setCategory(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("categoria", next); else url.searchParams.delete("categoria");
    window.history.replaceState(null, "", url);
  };
  const shown = recipes.filter(r => (!category || r.categories.includes(category)) && matchesRecipe(r, query));
  const filtered = Boolean(category || query.trim());
  return <>
    <div className="r-bar">
      <label className="r-search">
        <MagnifyingGlass size={20} aria-hidden="true" />
        <span className="sr-only">Buscar recetas</span>
        <input type="search" placeholder="Buscar por plato o ingrediente" value={query} onChange={e => setQuery(e.target.value)} autoComplete="off" spellCheck={false} />
        {query && <button type="button" aria-label="Borrar búsqueda" onClick={() => setQuery("")}><X size={18} aria-hidden="true" /></button>}
      </label>
      {categories.length > 0 && <div className="r-chips" role="group" aria-label="Categorías">
        <button type="button" aria-pressed={!category} onClick={() => choose("")}>Todas <span>{recipes.length}</span></button>
        {categories.map(c => <button type="button" key={c.label} aria-pressed={category === c.label} onClick={() => choose(category === c.label ? "" : c.label)}>{c.label} <span>{c.count}</span></button>)}
      </div>}
    </div>
    <h2 className="sr-only">{category || "Todas las recetas"}</h2>
    <p className="r-count" aria-live="polite">{filtered ? (shown.length === 1 ? "1 receta" : `${shown.length} recetas`) : ""}</p>
    {shown.length > 0
      ? <ul className="r-grid">{shown.map((r, n) => <RecipeCardView key={r.slug} recipe={r} priority={n < 3} />)}</ul>
      : <div className="r-empty" role="status">
        <p>{query.trim() ? `No encontramos recetas para “${query.trim()}”${category ? ` en ${category}` : ""}.` : "No hay recetas en esta categoría."}</p>
        <button type="button" className="r-button" onClick={() => { setQuery(""); choose(""); }}>Ver todas las recetas</button>
      </div>}
  </>;
}
