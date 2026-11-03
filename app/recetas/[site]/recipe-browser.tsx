"use client";

import { useState } from "react";
import { MagnifyingGlass, SlidersHorizontal, X } from "@phosphor-icons/react";
import {
  facetCounts, filterParams, matchesFilters, matchesRecipe, momentLabel, noFilters, recipeMoments, sortRecipes,
  type RecipeCard, type RecipeFilters, type RecipeOrder,
} from "@/lib/recipes";
import { activeFilters, FilterGroups } from "./filter-groups";
import { FilterSheet } from "./filter-sheet";
import { RecipeCardView } from "./recipe-card";

/**
 * The catalog. The search and the moment chips span the full width on top. Desktop: below them, filters in a sidebar
 * that folds by group and applies at once, beside the recipes. Phones and tablets: the sidebar becomes a button beside
 * the search that opens every filter on its own page (filter-sheet.tsx).
 */
export function RecipeBrowser({ recipes, types, cuisines, initialFilters, initialOrder }: {
  recipes: RecipeCard[]; types: string[]; cuisines: string[]; initialFilters: RecipeFilters; initialOrder: RecipeOrder;
}) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(initialFilters);
  const [order, setOrder] = useState(initialOrder);
  const [sheetOpen, setSheetOpen] = useState(false);
  const remember = (nextFilters: RecipeFilters, nextOrder: RecipeOrder) => {
    const url = new URL(window.location.href);
    url.searchParams.delete("categoria");
    for (const axis of Object.keys(filterParams) as (keyof RecipeFilters)[]) {
      if (nextFilters[axis]) url.searchParams.set(filterParams[axis], nextFilters[axis]); else url.searchParams.delete(filterParams[axis]);
    }
    if (nextOrder !== "recientes") url.searchParams.set("orden", nextOrder); else url.searchParams.delete("orden");
    window.history.replaceState(null, "", url);
  };
  const apply = (nextFilters: RecipeFilters, nextOrder: RecipeOrder) => {
    setFilters(nextFilters);
    setOrder(nextOrder);
    remember(nextFilters, nextOrder);
  };
  const choose = (axis: keyof RecipeFilters, value: string) => apply({ ...filters, [axis]: value }, order);
  const reset = () => { setQuery(""); apply(noFilters, order); };
  const clearSidebar = () => apply({ ...noFilters, moment: filters.moment }, "recientes");

  const shown = sortRecipes(recipes.filter(r => matchesFilters(r, filters) && matchesRecipe(r, query)), order);
  const filtered = Boolean(query.trim() || Object.values(filters).some(Boolean));
  const momentCounts = facetCounts(recipes, filters, "moment", recipeMoments.map(m => m.id));
  const allMoments = recipes.filter(r => matchesFilters(r, filters, "moment")).length;
  const usedMoments = recipeMoments.filter(m => recipes.some(r => r.moments.includes(m.id)));
  const active = activeFilters(filters, order);
  const heading = [filters.moment && momentLabel(filters.moment), filters.type, filters.cuisine].filter(Boolean).join(" · ");
  const groups = { recipes, types, cuisines, filters, order, onFilter: choose, onOrder: (next: RecipeOrder) => apply(filters, next) };

  return <div className="r-catalog">
      <div className="r-bar">
        <div className="r-search-row">
          <label className="r-search">
            <MagnifyingGlass size={20} aria-hidden="true" />
            <span className="sr-only">Buscar recetas</span>
            <input type="search" placeholder="Buscar por plato o ingrediente" value={query} onChange={e => setQuery(e.target.value)} autoComplete="off" spellCheck={false} />
            {query && <button type="button" aria-label="Borrar búsqueda" onClick={() => setQuery("")}><X size={18} aria-hidden="true" /></button>}
          </label>
          {/* Below desktop only (CSS): opens every filter on its own page. */}
          <button type="button" className="r-filter-button" aria-haspopup="dialog" onClick={() => setSheetOpen(true)}
            aria-label={active ? `Filtros, ${active} ${active === 1 ? "activo" : "activos"}` : "Filtros"}>
            <SlidersHorizontal size={22} weight="bold" aria-hidden="true" />
            {active > 0 && <span className="r-filter-badge" aria-hidden="true">{active}</span>}
          </button>
        </div>
        {usedMoments.length > 0 && <div className="r-chips" role="group" aria-label="Momento del día">
          <button type="button" aria-pressed={!filters.moment} onClick={() => choose("moment", "")}>Todas <span>{allMoments}</span></button>
          {usedMoments.map(m => <button type="button" key={m.id} aria-pressed={filters.moment === m.id} onClick={() => choose("moment", filters.moment === m.id ? "" : m.id)}>
            {m.label} <span>{momentCounts.get(m.id) ?? 0}</span>
          </button>)}
        </div>}
      </div>

    <aside className="r-aside" aria-labelledby="aside-title">
      <div className="r-aside-head">
        <h2 id="aside-title">Filtros</h2>
        {active > 0 && <button type="button" className="r-aside-clear" onClick={clearSidebar}>Limpiar</button>}
      </div>
      <FilterGroups variant="aside" {...groups} />
    </aside>

    <div className="r-results">
      <h2 className="sr-only">{heading || "Todas las recetas"}</h2>
      <p className="r-count" aria-live="polite">
        {filtered ? (shown.length === 1 ? "1 receta" : `${shown.length} recetas`) : ""}
        {filtered && <button type="button" className="r-link" onClick={reset}>Quitar filtros</button>}
      </p>
      {shown.length > 0
        ? <ul className="r-grid">{shown.map((r, n) => <RecipeCardView key={r.slug} recipe={r} priority={n < 3} />)}</ul>
        : <div className="r-empty" role="status">
          <p>{query.trim() ? `No encontramos recetas para “${query.trim()}” con estos filtros.` : "No hay recetas con estos filtros."}</p>
          <button type="button" className="r-button" onClick={reset}>Ver todas las recetas</button>
        </div>}
    </div>

    {sheetOpen && <FilterSheet recipes={recipes} query={query} types={types} cuisines={cuisines} filters={filters} order={order}
      onApply={(f, o) => { apply(f, o); setSheetOpen(false); }} onClose={() => setSheetOpen(false)} />}
  </div>;
}
