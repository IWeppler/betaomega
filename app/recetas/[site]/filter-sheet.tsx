"use client";

import { useEffect, useRef, useState } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { matchesFilters, matchesRecipe, noFilters, type RecipeCard, type RecipeFilters, type RecipeOrder } from "@/lib/recipes";
import { activeFilters, FilterGroups } from "./filter-groups";

/**
 * Phones and tablets: every filter on one full-screen page, like a real-estate search. Choices are a draft until
 * "Buscar"; the X (or Esc, or the back gesture) leaves the catalog as it was. The moment stays in the chips on the page.
 */
export function FilterSheet({ recipes, query, types, cuisines, filters, order, onApply, onClose }: {
  recipes: RecipeCard[]; query: string; types: string[]; cuisines: string[];
  filters: RecipeFilters; order: RecipeOrder;
  onApply: (filters: RecipeFilters, order: RecipeOrder) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(filters);
  const [draftOrder, setDraftOrder] = useState(order);
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => element?.close();
  }, []);

  const clear = () => { setDraft({ ...noFilters, moment: draft.moment }); setDraftOrder("recientes"); };
  const total = recipes.filter(r => matchesFilters(r, draft) && matchesRecipe(r, query)).length;

  return <dialog ref={dialog} className="r-sheet" aria-labelledby="sheet-title"
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="r-sheet-head">
      <button type="button" className="r-sheet-close" aria-label="Cerrar filtros" onClick={onClose}><X size={22} weight="bold" aria-hidden="true" /></button>
      <h2 id="sheet-title">Filtros</h2>
      <button type="button" className="r-sheet-clear" onClick={clear} disabled={!activeFilters(draft, draftOrder)}>Limpiar</button>
    </header>
    <div className="r-sheet-body">
      <FilterGroups variant="sheet" recipes={recipes} types={types} cuisines={cuisines} filters={draft} order={draftOrder}
        onFilter={(axis, value) => setDraft(current => ({ ...current, [axis]: value }))} onOrder={setDraftOrder} />
    </div>
    <footer className="r-sheet-foot">
      <p aria-live="polite">{total === 1 ? "1 receta" : `${total} recetas`}</p>
      <button type="button" className="r-button r-primary r-sheet-submit" onClick={() => onApply(draft, draftOrder)}>
        <MagnifyingGlass size={18} weight="bold" aria-hidden="true" />Buscar
      </button>
    </footer>
  </dialog>;
}
