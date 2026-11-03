"use client";

import { CaretDown } from "@phosphor-icons/react";
import {
  facetCounts, recipeDifficulties, recipeOrders, recipeTimes,
  type RecipeCard, type RecipeFilters, type RecipeOrder,
} from "@/lib/recipes";

type Axis = Exclude<keyof RecipeFilters, "moment">;
type Group = { id: Axis | "order"; legend: string; options: { id: string; label: string; count?: number }[]; value: string };

/** The axes the filters offer, in order. The moment is not here: it has its own chips above the recipes. */
export const filterAxes: Axis[] = ["type", "cuisine", "difficulty", "time"];
/** How many filters are set besides the moment (the order counts when it is not the default). */
export const activeFilters = (filters: RecipeFilters, order: RecipeOrder) =>
  filterAxes.filter(axis => filters[axis]).length + (order !== "recientes" ? 1 : 0);

/**
 * Every filter group, with how many recipes each option would show given the rest. Options that would show
 * nothing are left out unless chosen. `variant`: "sheet" draws pills (phones, full-screen page);
 * "aside" draws folding groups with radio rows (desktop sidebar, like a real-estate search).
 */
export function FilterGroups({ recipes, types, cuisines, filters, order, onFilter, onOrder, variant }: {
  recipes: RecipeCard[]; types: string[]; cuisines: string[];
  filters: RecipeFilters; order: RecipeOrder;
  onFilter: (axis: Axis, value: string) => void; onOrder: (order: RecipeOrder) => void;
  variant: "sheet" | "aside";
}) {
  const axis = (id: Axis, legend: string, all: string, values: { id: string; label: string }[]): Group | null => {
    const counts = facetCounts(recipes, filters, id, values.map(v => v.id));
    const options = values.filter(v => (counts.get(v.id) ?? 0) > 0 || filters[id] === v.id).map(v => ({ ...v, count: counts.get(v.id) ?? 0 }));
    if (!options.length && !filters[id]) return null;
    return { id, legend, value: filters[id], options: [{ id: "", label: all }, ...options] };
  };
  const groups = [
    { id: "order", legend: "Ordenar por", value: order, options: recipeOrders.map(o => ({ id: o.id, label: o.id === "alfabetico" ? "Alfabético (A a Z)" : o.label })) } as Group,
    axis("type", "Tipo de plato", "Todos", types.map(t => ({ id: t, label: t }))),
    axis("cuisine", "Nación", "Todas", cuisines.map(c => ({ id: c, label: c }))),
    axis("difficulty", "Complejidad", "Cualquiera", recipeDifficulties.map(d => ({ id: d.id, label: d.label }))),
    axis("time", "Tiempo total", "Cualquiera", recipeTimes.map(t => ({ id: t.id, label: t.label }))),
  ].filter((g): g is Group => g !== null);
  const pick = (group: Group, value: string) => group.id === "order" ? onOrder(value as RecipeOrder) : onFilter(group.id, value);
  const name = (group: Group) => `${variant}-${group.id}`;

  if (variant === "sheet") return <>{groups.map(group => <fieldset key={group.id} className="r-sheet-group">
    <legend>{group.legend}</legend>
    <div className="r-options">
      {group.options.map(o => <label key={o.id || "all"} className="r-option">
        <input type="radio" name={name(group)} checked={group.value === o.id} onChange={() => pick(group, o.id)} />
        <span>{o.label}{o.count !== undefined && <> <small>{o.count}</small></>}</span>
      </label>)}
    </div>
  </fieldset>)}</>;

  // Aside: the order, the dish type and anything already chosen start open; the rest fold until needed.
  return <>{groups.map(group => {
    const chosen = group.value ? group.options.find(o => o.id === group.value)?.label : "";
    const open = group.id === "order" || group.id === "type" || Boolean(group.value);
    return <details key={group.id} className="r-facet" open={open}>
      <summary>
        <span className="r-facet-title">{group.legend}</span>
        {chosen && group.id !== "order" && <span className="r-facet-chosen">{chosen}</span>}
        <CaretDown className="r-facet-caret" size={16} weight="bold" aria-hidden="true" />
      </summary>
      <fieldset className="r-facet-body">
        <legend className="sr-only">{group.legend}</legend>
        {group.options.map(o => <label key={o.id || "all"} className="r-radio">
          <input type="radio" name={name(group)} checked={group.value === o.id} onChange={() => pick(group, o.id)} />
          <span>{o.label}</span>
          {o.count !== undefined && <small>{o.count}</small>}
        </label>)}
      </fieldset>
    </details>;
  })}</>;
}
