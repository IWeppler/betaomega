"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { BookOpenText, Plus } from "@phosphor-icons/react";
import { normalize } from "@/lib/catalog";
import { blankRecipe, duplicateRecipe, formatMinutes, isScheduled, totalMinutes, type RecipeInput } from "@/lib/recipes";
import { findSite } from "@/lib/sites";
import { EditorFrame } from "../editors";
import { EmptyState, SearchBox, useNewFromLink, useSelection } from "../list-tools";
import { usePanel } from "../panel-context";
import { RecipeEditor } from "../recipe-editor";
import { useRecipes } from "../recipes-context";
import { PageHeader } from "../shell";

export default function RecipesPage() {
  const { site: siteId } = useParams<{ site: string }>();
  const site = findSite(siteId);
  const { recipes } = useRecipes();
  const { busy } = usePanel();
  const { selection, setSelection, select } = useSelection<RecipeInput>();
  useNewFromLink(() => setSelection({ item: blankRecipe(), mode: "edit" }));
  const [filter, setFilter] = useState("");
  if (!recipes || !site) return null;
  const query = normalize(filter);
  const rows = recipes.filter(r => normalize([r.title, ...r.categories].join(" ")).includes(query));
  const saved = (id: string) => recipes.some(r => r.id === id);
  const side = selection?.mode === "delete" ? <DeleteRecipe recipe={selection.item} onCancel={() => setSelection({ item: selection.item, mode: "edit" })} onDeleted={() => setSelection(null)} />
    : selection ? <RecipeEditor key={selection.item.id} recipe={selection.item} siteId={site.id} siteName={site.name} siteUrl={site.url} onSaved={item => setSelection({ item, mode: "edit" })} onDuplicate={item => setSelection({ item: duplicateRecipe(item), mode: "edit" })} onClose={() => void select(null)} onDelete={saved(selection.item.id) ? () => void select({ item: selection.item, mode: "delete" }) : undefined} />
    : null;
  const scheduled = recipes.filter(r => isScheduled(r)).length;
  const published = recipes.filter(r => r.published).length - scheduled;
  return <>
    <PageHeader title="Recetas" description={`${published} publicadas de ${recipes.length}${scheduled ? `, ${scheduled} programadas` : ""}. Los borradores y las programadas no se ven en el sitio.`} actions={
      <button className="button primary" disabled={busy} onClick={() => void select({ item: blankRecipe(), mode: "edit" })}><Plus size={16} aria-hidden="true" />Nueva receta</button>
    } />
    <div className="panel-split" data-open={side ? "true" : undefined}>
      <section className="panel-card panel-list" aria-label="Lista de recetas">
        <div className="panel-list-tools"><SearchBox value={filter} onChange={setFilter} label="Buscar por nombre o categoría" /></div>
        {rows.length > 0 && <table className="panel-table">
          <thead><tr><th scope="col">Nombre</th><th scope="col">Categorías</th><th scope="col" className="is-num">Tiempo</th></tr></thead>
          <tbody>{rows.map(item => <tr key={item.id} aria-selected={selection?.item.id === item.id}>
            <th scope="row"><button className="panel-row-button" disabled={busy} onClick={() => void select({ item, mode: "edit" })}><BookOpenText size={16} aria-hidden="true" /><span>{item.title}</span>{!item.published && <span className="panel-badge is-draft">Borrador</span>}{isScheduled(item) && <span className="panel-badge">Programada</span>}</button></th>
            <td>{item.categories.join(", ") || <span className="panel-muted">Sin categoría</span>}</td>
            <td className="is-num">{formatMinutes(totalMinutes(item)) || <span className="panel-muted">—</span>}</td>
          </tr>)}</tbody>
        </table>}
        {!rows.length && <EmptyState title={filter ? "No encontramos esa receta" : "Todavía no hay recetas"} text={filter ? "Probá con otro nombre o categoría." : "Creá la primera receta con el botón Nueva receta."} />}
      </section>
      <div className="panel-side">{side ?? <EmptyState title="Elegí una receta" text="Seleccioná una receta de la lista para editarla, o creá una nueva." />}</div>
    </div>
  </>;
}

function DeleteRecipe({ recipe, onCancel, onDeleted }: { recipe: RecipeInput; onCancel: () => void; onDeleted: () => void }) {
  const { busy, error } = usePanel();
  const { remove } = useRecipes();
  return <EditorFrame title={`Eliminar ${recipe.title}`} onClose={onCancel}>
    <p className="panel-muted">La receta se elimina del panel y del sitio. No se puede deshacer. Si solo querés ocultarla, desmarcá &quot;Publicada en el sitio&quot;.</p>
    {error && <div className="alert error" role="alert">{error}</div>}
    <div className="form-actions">
      <button className="button" disabled={busy} onClick={onCancel}>Cancelar</button>
      <button className="button danger" disabled={busy} onClick={async () => { if (await remove(recipe.id)) onDeleted(); }}>{busy ? "Eliminando…" : "Eliminar receta"}</button>
    </div>
  </EditorFrame>;
}
