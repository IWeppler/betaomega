"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { BookOpenText, Plus, X } from "@phosphor-icons/react";
import { normalize } from "@/lib/catalog";
import {
  blankRecipe,
  formatMinutes,
  isScheduled,
  totalMinutes,
  type Recipe,
  type RecipeInput,
} from "@/lib/recipes";
import { findSite } from "@/lib/sites";
import { EditorFrame } from "../editors";
import {
  EmptyState,
  SearchBox,
  useNewFromLink,
  useSelection,
} from "../list-tools";
import { usePanel } from "../panel-context";
import { RecipeEditor } from "../recipe-editor";
import { useRecipes } from "../recipes-context";
import { isRecipeView, recipeViews, type RecipeView } from "../recipe-views";
import { PageHeader } from "../shell";

/** A new recipe starts ticked as published in the site (the panel's default); the person can untick it to keep a draft. */
const newRecipe = () => ({ ...blankRecipe(), published: true });

export default function RecipesPage() {
  const { site: siteId } = useParams<{ site: string }>();
  const site = findSite(siteId);
  const { recipes } = useRecipes();
  const { busy } = usePanel();
  const { selection, setSelection, select } = useSelection<RecipeInput>();
  useNewFromLink(() => setSelection({ item: newRecipe(), mode: "edit" }));
  const [filter, setFilter] = useState("");
  const [view, setView] = useState<RecipeView | null>(null);
  useLinkedRecipe(recipes, (item) => setSelection({ item, mode: "edit" }), setView);
  if (!recipes || !site) return null;
  const query = normalize(filter);
  const rows = recipes.filter(
    (r) =>
      (!view || recipeViews[view].test(r)) &&
      normalize([r.title, ...r.categories].join(" ")).includes(query),
  );
  const saved = (id: string) => recipes.some((r) => r.id === id);
  const side =
    selection?.mode === "delete" ? (
      <DeleteRecipe
        recipe={selection.item}
        onCancel={() => setSelection({ item: selection.item, mode: "edit" })}
        onDeleted={() => setSelection(null)}
      />
    ) : selection ? (
      <RecipeEditor
        key={selection.item.id}
        recipe={selection.item}
        siteId={site.id}
        siteName={site.name}
        siteUrl={site.url}
        onSaved={(item) => setSelection({ item, mode: "edit" })}
        onClose={() => void select(null)}
        onDelete={
          saved(selection.item.id)
            ? () => void select({ item: selection.item, mode: "delete" })
            : undefined
        }
      />
    ) : null;
  const scheduled = recipes.filter((r) => isScheduled(r)).length;
  const published = recipes.filter((r) => r.published).length - scheduled;
  return (
    <>
      <PageHeader
        title="Recetas"
        description={`${published} publicadas de ${recipes.length}${scheduled ? `, ${scheduled} programadas` : ""}.`}
        actions={
          <button
            className="button primary"
            disabled={busy}
            onClick={() => void select({ item: newRecipe(), mode: "edit" })}
          >
            <Plus size={16} aria-hidden="true" />
            Nueva receta
          </button>
        }
      />
      <div className="panel-split" data-open={side ? "true" : undefined}>
        <section
          className="panel-card panel-list"
          aria-label="Lista de recetas"
        >
          <div className="panel-list-tools">
            <SearchBox
              value={filter}
              onChange={setFilter}
              label="Buscar por nombre o tipo"
            />
            {view && (
              <p className="panel-list-view">
                <span>
                  Mostrando: <strong>{recipeViews[view].label}</strong> ({rows.length})
                </span>
                <button className="button" onClick={() => setView(null)}>
                  <X size={14} aria-hidden="true" />
                  Ver todas
                </button>
              </p>
            )}
          </div>
          {rows.length > 0 && (
            <table className="panel-table">
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Tipos</th>
                  <th scope="col" className="is-num">
                    Tiempo
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr
                    key={item.id}
                    aria-selected={selection?.item.id === item.id}
                  >
                    <th scope="row">
                      <button
                        className="panel-row-button"
                        disabled={busy}
                        onClick={() => void select({ item, mode: "edit" })}
                      >
                        <BookOpenText size={16} aria-hidden="true" />
                        <span>{item.title}</span>
                        {!item.published && (
                          <span className="panel-badge is-draft">Borrador</span>
                        )}
                        {isScheduled(item) && (
                          <span className="panel-badge">Programada</span>
                        )}
                      </button>
                    </th>
                    <td>
                      {item.categories.join(", ") || (
                        <span className="panel-muted">Sin tipo</span>
                      )}
                    </td>
                    <td className="is-num">
                      {formatMinutes(totalMinutes(item)) || (
                        <span className="panel-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!rows.length && (
            <EmptyState
              title={
                filter
                  ? "No encontramos esa receta"
                  : view
                    ? "No queda ninguna"
                    : "Todavía no hay recetas"
              }
              text={
                filter
                  ? "Probá con otro nombre o tipo."
                  : view
                    ? "Ya no hay recetas en este grupo. Tocá Ver todas para ver la lista completa."
                  : "Creá la primera receta con el botón Nueva receta."
              }
            />
          )}
        </section>
        <div className="panel-side">
          {side ?? (
            <EmptyState
              title="Elegí una receta"
              text="Seleccioná una receta de la lista para editarla, o creá una nueva."
            />
          )}
        </div>
      </div>
    </>
  );
}

/** Arriving from the summary: ?receta=<id> opens that recipe, ?ver=<view> filters the list. The parameters are dropped so a reload starts clean. */
function useLinkedRecipe(
  recipes: Recipe[] | null,
  open: (item: Recipe) => void,
  filterTo: (view: RecipeView) => void,
) {
  const router = useRouter();
  const pathname = usePathname();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !recipes) return;
    done.current = true;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("receta");
    const view = params.get("ver");
    if (!id && !view) return;
    router.replace(pathname, { scroll: false });
    if (isRecipeView(view)) filterTo(view);
    const item = id && recipes.find((r) => r.id === id);
    if (item) open(item);
    // Runs once, when the recipes arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipes]);
}

function DeleteRecipe({
  recipe,
  onCancel,
  onDeleted,
}: {
  recipe: RecipeInput;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const { busy, error } = usePanel();
  const { remove } = useRecipes();
  return (
    <EditorFrame title={`Eliminar ${recipe.title}`} onClose={onCancel}>
      <p className="panel-muted">
        La receta se elimina del panel y del sitio. No se puede deshacer. Si
        solo querés ocultarla, desmarcá &quot;Publicada en el sitio&quot;.
      </p>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      <div className="form-actions">
        <button className="button" disabled={busy} onClick={onCancel}>
          Cancelar
        </button>
        <button
          className="button danger"
          disabled={busy}
          onClick={async () => {
            if (await remove(recipe.id)) onDeleted();
          }}
        >
          {busy ? "Eliminando…" : "Eliminar receta"}
        </button>
      </div>
    </EditorFrame>
  );
}
