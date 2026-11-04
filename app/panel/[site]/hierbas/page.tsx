"use client";

import { useState } from "react";
import { Leaf, Plus } from "@phosphor-icons/react";
import { newHerb } from "@/app/admin-fields";
import { formatPrice, normalize, type Plant } from "@/lib/catalog";
import { useCatalog } from "../catalog-context";
import { SideSheet } from "../sheet";
import { PageHeader } from "../shell";
import { deleteBlocker, DeleteConfirm, HerbEditor } from "../editors";
import { EmptyState, Paged, SearchBox, StatusBadges, useNewFromLink, useSelection } from "../list-tools";

export default function HerbsPage() {
  const { catalog, busy } = useCatalog();
  const { selection, setSelection, select } = useSelection<Plant>();
  useNewFromLink(() => setSelection({ item: newHerb(""), mode: "edit" }));
  const [filter, setFilter] = useState("");
  if (!catalog) return null;
  const used = (plant: Plant) => catalog.preparations.filter(p => p.ingredients.some(i => i.plantId === plant.id)).length;
  const rows = catalog.plants.filter(p => normalize(p.name).includes(normalize(filter))).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const current = selection && catalog.plants.find(p => p.id === selection.item.id);
  const side = selection?.mode === "delete" ? <DeleteConfirm item={selection.item} onCancel={() => setSelection({ item: selection.item, mode: "edit" })} onDeleted={() => setSelection(null)} />
    : selection ? <HerbEditor key={selection.item.id} herb={selection.item} onSaved={item => setSelection({ item, mode: "edit" })} onClose={() => void select(null)} onDelete={current && !deleteBlocker(catalog, current) ? () => void select({ item: selection.item, mode: "delete" }) : undefined} />
    : null;
  return <>
    <PageHeader title="Hierbas" description={`${catalog.plants.length} hierbas. Las que se usan en un tónico no se pueden eliminar.`} actions={
      <button className="button primary" disabled={busy} onClick={() => void select({ item: newHerb(""), mode: "edit" })}><Plus size={16} aria-hidden="true" />Nueva hierba</button>
    } />
    <div>
      <section className="panel-card panel-list" aria-label="Lista de hierbas">
        <div className="panel-list-tools"><SearchBox value={filter} onChange={setFilter} label="Buscar una hierba" /></div>
        {rows.length > 0 && <Paged rows={rows} resetKey={filter}>{shown => <table className="panel-table">
          <thead><tr><th scope="col">Nombre</th><th scope="col" className="is-hide-sm">Nombre científico</th><th scope="col" className="is-num">Tónicos</th><th scope="col" className="is-num">Precio</th></tr></thead>
          <tbody>{shown.map(plant => <tr key={plant.id} aria-selected={selection?.item.id === plant.id}>
            <th scope="row"><button className="panel-row-button" disabled={busy} onClick={() => void select({ item: plant, mode: "edit" })}><Leaf size={16} aria-hidden="true" /><span>{plant.name}</span><StatusBadges item={plant} /></button></th>
            <td className="is-hide-sm panel-italic">{plant.scientificName || <span className="panel-muted">Sin cargar</span>}</td>
            <td className="is-num">{used(plant)}</td>
            <td className="is-num">{formatPrice(plant) || <span className="panel-muted">Sin precio</span>}</td>
          </tr>)}</tbody>
        </table>}</Paged>}
        {!rows.length && <EmptyState title={filter ? "No encontramos esa hierba" : "Todavía no hay hierbas"} text={filter ? "Probá con otro nombre." : "Creá una hierba o agregala al armar un tónico."} />}
      </section>
      <SideSheet onClose={() => void select(null)}>{side}</SideSheet>
    </div>
  </>;
}
