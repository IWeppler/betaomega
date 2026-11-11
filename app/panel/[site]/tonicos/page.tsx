"use client";
import { IngredientOrder, PreparationSteps, FormulaPricing } from "@/modules/herbal/ui";

import { useState, type ChangeEvent } from "react";
import { Flask, Plus, UploadSimple, X } from "@phosphor-icons/react";
import { blankTonic } from "@/app/admin-fields";
import { formatPrice, normalize, type Preparation } from "@/lib/catalog";
import { importTonics, type ImportReport } from "@/lib/csv";
import { useCatalog } from "../catalog-context";
import { SideSheet } from "../sheet";
import { PageHeader } from "../shell";
import { DeleteConfirm, TonicEditor } from "../editors";
import { EmptyState, Paged, SearchBox, StatusBadges, useNewFromLink, useSelection } from "../list-tools";

export default function TonicsPage() {
  const { catalog, catalogRef, busy, flushRef, save, error, setError } = useCatalog();
  const { selection, setSelection, select } = useSelection<Preparation>();
  useNewFromLink(() => setSelection({ item: blankTonic(), mode: "edit" }));
  const [filter, setFilter] = useState("");
  const [report, setReport] = useState<ImportReport | null>(null);
  if (!catalog) return null;
  const rows = catalog.preparations.filter(p => normalize(p.name).includes(normalize(filter))).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const chooseCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !(await flushRef.current())) return;
    if (file.size > 1_500_000) { setError("El archivo es demasiado grande."); return; }
    setSelection(null);
    setReport(importTonics(catalogRef.current ?? catalog, await file.text()));
  };
  const side = report ? <ImportPanel report={report} busy={busy} error={error} onCancel={() => setReport(null)} onConfirm={async () => { if (await save(report.catalog)) setReport(null); }} />
    : selection?.mode === "delete" ? <DeleteConfirm item={selection.item} onCancel={() => setSelection({ item: selection.item, mode: "edit" })} onDeleted={() => setSelection(null)} />
    : selection ? <TonicEditor FormulaPricing={FormulaPricing} IngredientOrder={IngredientOrder} PreparationSteps={PreparationSteps} key={selection.item.id} tonic={selection.item} onSaved={item => setSelection({ item, mode: "edit" })} onClose={() => void select(null)} onDelete={catalog.preparations.some(p => p.id === selection.item.id) ? () => void select({ item: selection.item, mode: "delete" }) : undefined} />
    : null;
  return <>
    <PageHeader title="Tónicos" description={`${catalog.preparations.length} tónicos. Los borradores no los ve el equipo.`} actions={<>
      <label className="button"><UploadSimple size={16} aria-hidden="true" />Importar CSV<input type="file" accept=".csv,text/csv" hidden disabled={busy} onChange={e => void chooseCsv(e)} /></label>
      <button className="button primary" disabled={busy} onClick={() => { setReport(null); void select({ item: blankTonic(), mode: "edit" }); }}><Plus size={16} aria-hidden="true" />Nuevo tónico</button>
    </>} />
    <div>
      <section className="panel-card panel-list" aria-label="Lista de tónicos">
        <div className="panel-list-tools"><SearchBox value={filter} onChange={setFilter} label="Buscar un tónico" /></div>
        {rows.length > 0 && <Paged rows={rows} resetKey={filter}>{shown => <table className="panel-table">
          <thead><tr><th scope="col">Nombre</th><th scope="col" className="is-num">Hierbas</th><th scope="col" className="is-num">Precio</th></tr></thead>
          <tbody>{shown.map(item => <tr key={item.id} aria-selected={selection?.item.id === item.id}>
            <th scope="row"><button className="panel-row-button" disabled={busy} onClick={() => { setReport(null); void select({ item, mode: "edit" }); }}><Flask size={16} aria-hidden="true" /><span>{item.name}</span><StatusBadges item={item} /></button></th>
            <td className="is-num">{item.ingredients.length}</td>
            <td className="is-num">{formatPrice(item) || <span className="panel-muted inline-block whitespace-normal text-xs leading-tight">{item.presentationWeightGrams === undefined ? "Sin precio" : "Pendiente de calcular"}</span>}</td>
          </tr>)}</tbody>
        </table>}</Paged>}
        {!rows.length && <EmptyState title={filter ? "No encontramos ese tónico" : "Todavía no hay tónicos"} text={filter ? "Probá con otro nombre." : "Creá un tónico o importá varios desde un archivo CSV."} />}
      </section>
      <SideSheet onClose={() => (report ? setReport(null) : void select(null))}>{side}</SideSheet>
    </div>
  </>;
}

function ImportPanel({ report, busy, error, onCancel, onConfirm }: { report: ImportReport; busy: boolean; error: string; onCancel: () => void; onConfirm: () => void }) {
  const total = report.created + report.updated;
  return <section className="panel-editor" aria-labelledby="import-title">
    <header className="panel-editor-head"><h2 id="import-title">Importar tónicos</h2><button className="panel-icon-button" aria-label="Cerrar" onClick={onCancel}><X size={18} aria-hidden="true" /></button></header>
    <div className="panel-editor-body">
      {total > 0 ? <p>Se van a crear <strong>{report.created}</strong> tónicos y actualizar <strong>{report.updated}</strong>. Los tónicos se identifican por su nombre.</p> : <p>No hay nada para importar.</p>}
      {report.drafts.length > 0 && <div className="alert warn">Quedan como borrador por estar incompletos (faltan usos, preparación o proporciones): {report.drafts.join(", ")}.</div>}
      {report.errors.length > 0 && <div className="alert error" role="alert"><ul>{report.errors.map(e => <li key={e}>{e}</li>)}</ul></div>}
      <p className="panel-muted">Columnas: Nombre, Usos, Sinónimos, Hierbas (como Manzanilla:2 partes|Menta:1 parte), Preparación, Advertencias, Notas, No recomendado en, Habilitado.</p>
      {error && <div className="alert error" role="alert">{error}</div>}
      <div className="form-actions">
        <button className="button" disabled={busy} onClick={onCancel}>Cancelar</button>
        {total > 0 && <button className="button primary" disabled={busy} onClick={onConfirm}>{busy ? "Importando…" : "Confirmar importación"}</button>}
      </div>
    </div>
  </section>;
}
