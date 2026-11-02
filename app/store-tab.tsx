"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { ArrowsClockwise, Eye, MagnifyingGlass, PencilSimple, Plus, Tag, Trash, X } from "@phosphor-icons/react";
import { ProductCombobox, type ProductOption } from "./product-combobox";
import { SaveForm } from "./save-form";
import { ImageField } from "./catalog-image";
import { brokenCombos, combosUsing, comboSavings, effectivePrice, findProduct, formatMoney, formatPrice, getCategories, isInStore, normalize, storeToday, type Catalog, type Combo, type Plant, type Preparation } from "@/lib/catalog";
import { applyPriceEdits, bulkError, bulkPrice, parsePriceText, priceRows, priceText, resolveEdit, summarizeEdits, whatsappDigits, type BulkAction, type PriceEdits } from "@/lib/store-tools";

type Section = "data" | "prices" | "visibility" | "promos";
const sections: { id: Section; label: string }[] = [
  { id: "data", label: "Datos" },
  { id: "prices", label: "Precios" },
  { id: "visibility", label: "Visibilidad" },
  { id: "promos", label: "Promociones y combos" },
];
type Product = Plant | Preparation;
const isTonic = (item: Product): item is Preparation => "ingredients" in item;
const allProducts = (catalog: Catalog): Product[] => [...catalog.preparations, ...catalog.plants].sort((a, b) => a.name.localeCompare(b.name, "es"));
const isConflict = (message: string) => message.startsWith("Otra persona modificó");

type Props = {
  catalog: Catalog; busy: boolean; error: string;
  /** Only the active tab mounts its edit form, so it can share the administrator's leave handle. */
  active: boolean;
  flushRef: MutableRefObject<() => Promise<boolean>>;
  onSave: (next: Catalog) => Promise<boolean>;
  onReload: () => void;
  onClearError: () => void;
  /** True while there is unsaved work that a background refresh must not replace. */
  onDirty: (dirty: boolean) => void;
};

export function StoreTab({ catalog, busy, error, active, flushRef, onSave, onReload, onClearError, onDirty }: Props) {
  const [section, setSection] = useState<Section>("data");
  // Pending price edits live here, not in the Precios section, so they survive switching sections or tabs.
  const [edits, setEdits] = useState<PriceEdits>({});
  const [editingCombo, setEditingCombo] = useState(false);
  const rows = useMemo(() => priceRows(catalog), [catalog]);
  const summary = useMemo(() => summarizeEdits(rows, edits, catalog), [rows, edits, catalog]);
  const dirty = summary.changed > 0 || summary.errors > 0 || editingCombo;
  useEffect(() => { onDirty(dirty); return () => onDirty(false); }, [dirty, onDirty]);
  useEffect(() => {
    if (!summary.changed && !summary.errors) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [summary.changed, summary.errors]);
  const broken = brokenCombos(catalog);
  const go = async (next: Section) => {
    if (busy || !(await flushRef.current())) return;
    onClearError();
    setSection(next);
  };
  return <section className="store-tab" aria-label="Tienda online" hidden={!active}>
    <nav className="segmented store-nav" aria-label="Secciones de la tienda">
      {sections.map(({ id, label }) => <button key={id} aria-current={section === id ? "page" : undefined} onClick={() => void go(id)}>
        {label}
        {id === "prices" && summary.changed > 0 && <span className="nav-count" aria-label={`${summary.changed} cambios sin guardar`}>{summary.changed}</span>}
        {id === "promos" && broken.length > 0 && <span className="nav-count is-warn" aria-label={`${broken.length} combos con problemas`}>{broken.length}</span>}
      </button>)}
    </nav>
    {active && section === "data" && <DataSection catalog={catalog} busy={busy} error={error} flushRef={flushRef} onSave={onSave} />}
    {section === "prices" && <PricesSection catalog={catalog} busy={busy} error={error} edits={edits} setEdits={setEdits} onSave={onSave} onReload={onReload} />}
    {section === "visibility" && <VisibilitySection catalog={catalog} busy={busy} error={error} onSave={onSave} />}
    {section === "promos" && <PromosSection catalog={catalog} busy={busy} error={error} onSave={onSave} onEditing={setEditingCombo} />}
  </section>;
}

/* ---- Datos ---- */

function DataSection({ catalog, busy, error, flushRef, onSave }: Pick<Props, "catalog" | "busy" | "error" | "flushRef" | "onSave">) {
  const store = catalog.store ?? {};
  const [local, setLocal] = useState("");
  const [digits, setDigits] = useState(store.whatsapp ?? "");
  const submit = async (element: HTMLFormElement) => {
    const form = new FormData(element);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    const raw = text("whatsapp");
    if (raw && !/^[\d\s+\-().]+$/.test(raw)) { setLocal("El WhatsApp solo puede llevar números, con código de país. Ejemplo: 5493491123456."); return false; }
    setLocal("");
    return onSave({ ...catalog, store: { whatsapp: whatsappDigits(raw) || undefined, instagram: text("instagram") || undefined, facebook: text("facebook") || undefined, address: text("address") || undefined, mapsUrl: text("mapsUrl") || undefined, hours: text("hours") || undefined } });
  };
  return <div className="store-section">
    <p className="section-note">Estos datos se muestran al pie de la tienda y en cada ficha. El WhatsApp recibe los pedidos y las consultas.</p>
    <SaveForm error={local || error} registerRef={flushRef} paused={busy} onSave={submit} changes="">
      <label className="field">
        <span>WhatsApp de la tienda<span className="required-tag">Importante</span></span>
        <input name="whatsapp" type="tel" inputMode="tel" defaultValue={store.whatsapp ?? ""} maxLength={25} placeholder="Ej: 5493491123456" onChange={e => setDigits(whatsappDigits(e.target.value))} aria-describedby="store-whatsapp-hint" />
        <small id="store-whatsapp-hint">Con código de país y sin el 0 ni el 15. Sin este número, la tienda no ofrece Consultar ni Pedir por WhatsApp.{digits ? ` Se abrirá wa.me/${digits}.` : ""}</small>
      </label>
      <div className="form-grid">
        <label className="field"><span>Instagram</span><input name="instagram" defaultValue={store.instagram ?? ""} maxLength={200} placeholder="@nekurel" /><small>Usuario o link. Opcional.</small></label>
        <label className="field"><span>Facebook</span><input name="facebook" defaultValue={store.facebook ?? ""} maxLength={200} placeholder="nekurel o https://facebook.com/nekurel" /><small>Usuario o link. Opcional.</small></label>
      </div>
      <div className="form-grid">
        <label className="field"><span>Dirección</span><input name="address" defaultValue={store.address ?? ""} maxLength={300} placeholder="Calle 123, Tostado, Santa Fe" /><small>Opcional.</small></label>
        <label className="field"><span>Link del mapa</span><input name="mapsUrl" type="url" inputMode="url" defaultValue={store.mapsUrl ?? ""} maxLength={2000} placeholder="https://maps.app.goo.gl/..." /><small>Opcional. Tiene que empezar con https://</small></label>
      </div>
      <label className="field"><span>Horarios</span><textarea name="hours" rows={4} defaultValue={store.hours ?? ""} maxLength={1000} placeholder={"Lunes a viernes de 9 a 13 y de 17 a 21\nSábados de 9 a 13"} /><small>Opcional. Cada renglón se muestra por separado.</small></label>
    </SaveForm>
  </div>;
}

/* ---- Precios ---- */

/** Modal with the bulk price actions. Applying one closes it; `run` returns an error message to keep it open. */
function BulkDialog({ count, busy, onClose, run }: { count: number; busy: boolean; onClose: () => void; run: (action: BulkAction) => string | undefined }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [percent, setPercent] = useState("10");
  const [step, setStep] = useState("100");
  const [fixed, setFixed] = useState("");
  const [problem, setProblem] = useState("");
  useEffect(() => { const element = dialog.current; if (element && !element.open) element.showModal(); }, []);
  const number = (value: string) => Number(value.replace(",", "."));
  const apply = (action: BulkAction) => { const message = run(action); if (message) setProblem(message); else onClose(); };
  return <dialog ref={dialog} className="bulk-dialog" aria-labelledby="bulk-title" onClose={onClose} onClick={e => { if (e.target === dialog.current) onClose(); }}>
    <div className="bulk-dialog-body">
      <header><h3 id="bulk-title">Precios masivos</h3><button type="button" className="icon-button" aria-label="Cerrar" onClick={onClose}><X size={22} weight="bold" aria-hidden="true" /></button></header>
      <p className="section-note">Se aplican a los {count === 1 ? "1 producto seleccionado" : `${count} productos seleccionados`}. Los cambios quedan pendientes hasta que apretés <strong>Guardar cambios</strong>.</p>
      <fieldset className="bulk-group"><legend>Subir o bajar un porcentaje</legend>
        <div className="bulk-row">
          <label className="field"><span>Porcentaje (%)</span><input inputMode="decimal" value={percent} onChange={e => setPercent(e.target.value)} /></label>
          <button type="button" className="button" disabled={busy} onClick={() => apply({ kind: "percent", percent: Math.abs(number(percent)) })}>Subir</button>
          <button type="button" className="button" disabled={busy} onClick={() => apply({ kind: "percent", percent: -Math.abs(number(percent)) })}>Bajar</button>
        </div>
      </fieldset>
      <fieldset className="bulk-group"><legend>Redondear</legend>
        <div className="bulk-row">
          <label className="field"><span>Múltiplo de ($)</span><input inputMode="decimal" value={step} onChange={e => setStep(e.target.value)} /></label>
          <button type="button" className="button" disabled={busy} onClick={() => apply({ kind: "round", step: number(step) })}>Redondear</button>
        </div>
      </fieldset>
      <fieldset className="bulk-group"><legend>Fijar un precio</legend>
        <div className="bulk-row">
          <label className="field"><span>Precio ($)</span><input inputMode="decimal" value={fixed} onChange={e => setFixed(e.target.value)} placeholder="Ej: 2500" /></label>
          <button type="button" className="button" disabled={busy} onClick={() => { const parsed = parsePriceText(fixed); if (parsed.error || parsed.value === undefined) setProblem(parsed.error ?? "Escribí el precio que querés fijar."); else apply({ kind: "fixed", price: parsed.value }); }}>Fijar</button>
        </div>
      </fieldset>
      {problem && <p className="bulk-note is-problem" role="alert">{problem}</p>}
    </div>
  </dialog>;
}

function PricesSection({ catalog, busy, error, edits, setEdits, onSave, onReload }: Pick<Props, "catalog" | "busy" | "error" | "onSave" | "onReload"> & { edits: PriceEdits; setEdits: (update: (current: PriceEdits) => PriceEdits) => void }) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [note, setNote] = useState("");
  const rows = useMemo(() => priceRows(catalog), [catalog]);
  const categories = getCategories(catalog);
  const summary = useMemo(() => summarizeEdits(rows, edits, catalog), [rows, edits, catalog]);
  const q = normalize(text);
  const visible = rows.filter(r => (!category || r.categoryIds.includes(category)) && (!q || normalize(r.name).includes(q)));
  const selectedRows = rows.filter(r => selected.includes(r.id));
  const setCell = (id: string, change: { price?: string; unit?: string }) => setEdits(current => ({ ...current, [id]: { ...current[id], ...change } }));
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
  const allSelected = visible.length > 0 && visible.every(r => selected.includes(r.id));

  const run = (action: BulkAction): string | undefined => {
    const problem = bulkError(action);
    if (problem) return problem;
    let changed = 0, skipped = 0;
    const next: PriceEdits = {};
    for (const row of selectedRows) {
      const pending = resolveEdit(row, edits[row.id]);
      if (pending.error) { skipped++; continue; }
      const price = bulkPrice(pending.price, action);
      if (price === undefined) { skipped++; continue; }
      next[row.id] = { price: priceText(price) };
      changed++;
    }
    setEdits(current => { const merged = { ...current }; for (const [id, edit] of Object.entries(next)) merged[id] = { ...merged[id], ...edit }; return merged; });
    setNote(`${changed === 1 ? "Se ajustó 1 producto" : `Se ajustaron ${changed} productos`}${skipped ? `; ${skipped === 1 ? "1 se omitió" : `${skipped} se omitieron`} por no tener un precio para ajustar` : ""}. Revisá los cambios y guardalos.`);
    return undefined;
  };
  const save = async () => {
    if (await onSave(applyPriceEdits(catalog, edits))) { setEdits(() => ({})); setSelected([]); setNote("Se guardaron los precios."); }
  };
  const discard = () => { setEdits(() => ({})); setNote(""); };

  return <div className="store-section prices">
    <p className="section-note">Cambiá precios en la tabla, o marcá varios productos y usá <strong>Precios masivos</strong>. Nada se guarda hasta que apretés <strong>Guardar cambios</strong>.</p>
    <div className="price-filters">
      <label className="price-search"><MagnifyingGlass size={22} aria-hidden="true" /><span className="sr-only">Buscar por nombre</span><input type="search" value={text} onChange={e => setText(e.target.value)} placeholder="Buscar por nombre" autoComplete="off" /></label>
      <label className="price-category"><span className="sr-only">Categoría</span>
        <select value={category} onChange={e => setCategory(e.target.value)}><option value="">Todas las categorías</option>{categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
      </label>
    </div>
    {note && <p className="bulk-note" role="status">{note}</p>}

    <div className="admin-table-wrap">
      <table className="admin-table price-table">
        <caption>Precios de tónicos y hierbas</caption>
        <thead><tr>
          <th scope="col" className="price-check"><label className="check-cell"><input type="checkbox" checked={allSelected} disabled={!visible.length} onChange={() => setSelected(current => allSelected ? current.filter(id => !visible.some(r => r.id === id)) : [...new Set([...current, ...visible.map(r => r.id)])])} /><span className="sr-only">Seleccionar los {visible.length} productos de la lista</span></label></th>
          <th scope="col">Nombre</th><th scope="col">Categoría</th><th scope="col">Precio ($)</th><th scope="col">El precio es por</th>
        </tr></thead>
        <tbody>
          {visible.map(row => {
            const result = resolveEdit(row, edits[row.id]);
            const price = edits[row.id]?.price ?? priceText(row.price);
            const unit = edits[row.id]?.unit ?? row.unit;
            return <tr key={row.id} className={result.error ? "is-invalid" : result.changed ? "is-changed" : undefined}>
              <td className="price-check"><label className="check-cell"><input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggle(row.id)} /><span className="sr-only">Seleccionar {row.name}</span></label></td>
              <th scope="row">{row.name}{row.hidden && <span className="hidden-tag">Oculto</span>}{result.changed && <span className="changed-tag">Cambió</span>}</th>
              <td className="table-scientific">{row.categoryLabel || "—"}</td>
              <td><input className="cell-input" inputMode="decimal" aria-label={`Precio de ${row.name}`} value={price} placeholder="Sin precio" aria-invalid={Boolean(result.error)} aria-describedby={result.error ? `price-error-${row.id}` : undefined} onChange={e => setCell(row.id, { price: e.target.value })} />{result.error && <small className="field-error" id={`price-error-${row.id}`}>{result.error}</small>}</td>
              <td><input className="cell-input" aria-label={`Unidad del precio de ${row.name}`} value={unit} maxLength={50} placeholder="Ej: 100 g" onChange={e => setCell(row.id, { unit: e.target.value })} /></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
    {!visible.length && <div className="empty"><h3>{rows.length ? "No hay productos con ese filtro" : "Todavía no hay productos"}</h3><p>{rows.length ? "Probá con otro nombre o categoría." : "Creá tónicos o hierbas para cargar sus precios."}</p></div>}

    <div className={`save-bar${selected.length ? " is-lifted" : ""}`} role="region" aria-label="Cambios de precios">
      <div className="save-bar-info" role="status">
        <strong>{summary.changed === 0 ? "Sin cambios pendientes" : summary.changed === 1 ? "1 producto cambia" : `${summary.changed} productos cambian`}</strong>
        {summary.errors > 0 && <span className="is-problem">{summary.errors === 1 ? "Hay 1 precio inválido." : `Hay ${summary.errors} precios inválidos.`} Corregilos para guardar.</span>}
        {summary.lowersPromo > 0 && <span>{summary.lowersPromo === 1 ? "1 tiene una oferta que dejará de aplicarse" : `${summary.lowersPromo} tienen una oferta que dejará de aplicarse`}: el nuevo precio es menor o igual al de oferta.</span>}
      </div>
      <div className="save-bar-actions">
        <button type="button" className="button" disabled={busy || (!summary.changed && !summary.errors && !Object.keys(edits).length)} onClick={discard}><X size={20} aria-hidden="true" />Descartar</button>
        <button type="button" className="button primary" disabled={busy || summary.changed === 0 || summary.errors > 0} onClick={() => void save()}>{busy ? "Guardando…" : `Guardar cambios${summary.changed ? ` (${summary.changed})` : ""}`}</button>
      </div>
    </div>
    {error && <div className="alert error" role="alert"><span>{error}{isConflict(error) && " Tus cambios siguen acá: actualizá el catálogo y volvé a guardar."}</span>{isConflict(error) && <button type="button" onClick={onReload}><ArrowsClockwise size={18} aria-hidden="true" /> Actualizar catálogo</button>}</div>}

    {selected.length > 0 && <div className="selection-bar" role="region" aria-label="Productos seleccionados">
      <strong aria-live="polite">{selected.length === 1 ? "1 producto seleccionado" : `${selected.length} productos seleccionados`}</strong>
      <div className="save-bar-actions">
        <button type="button" className="button" onClick={() => setSelected([])}>Quitar selección</button>
        <button type="button" className="button primary" disabled={busy} onClick={() => setBulkOpen(true)}><Tag size={20} aria-hidden="true" />Precios masivos</button>
      </div>
    </div>}
    {bulkOpen && <BulkDialog count={selected.length} busy={busy} run={run} onClose={() => setBulkOpen(false)} />}
  </div>;
}

/* ---- Visibilidad ---- */

function BrokenCombos({ catalog }: { catalog: Catalog }) {
  const broken = brokenCombos(catalog);
  if (!broken.length) return null;
  return <div className="alert warn" role="status"><div>
    <strong>{broken.length === 1 ? "Un combo no se muestra en la tienda" : `${broken.length} combos no se muestran en la tienda`}</strong>
    <ul>{broken.map(combo => {
      const missing = combo.items.map(i => findProduct(catalog, i.productId)).filter((p): p is Product => !p || !isInStore(catalog, p)).map(p => p?.name ?? "un producto borrado");
      return <li key={combo.id}>{combo.name}: tiene {missing.join(", ")} oculto o en borrador.</li>;
    })}</ul>
    <small>Mostrá el producto de nuevo o sacalo del combo.</small>
  </div></div>;
}

function VisibilitySection({ catalog, busy, error, onSave }: Pick<Props, "catalog" | "busy" | "error" | "onSave">) {
  const categories = getCategories(catalog);
  const hiddenCategories = categories.filter(c => c.hidden);
  const hiddenProducts = allProducts(catalog).filter(p => p.hidden);
  // Published, not hidden themselves, but still not in the store: every category they belong to is hidden (or they have none).
  const unlisted = allProducts(catalog).filter(p => p.published && !p.hidden && !isInStore(catalog, p));
  const showCategory = (id: string) => onSave({ ...catalog, categories: categories.map(c => c.id === id ? { ...c, hidden: undefined } : c) });
  const showProduct = (item: Product) => onSave(isTonic(item) ? { ...catalog, preparations: catalog.preparations.map(p => p.id === item.id ? { ...p, hidden: undefined } : p) } : { ...catalog, plants: catalog.plants.map(p => p.id === item.id ? { ...p, hidden: undefined } : p) });
  return <div className="store-section">
    <p className="section-note">Lo oculto no se ve en la tienda, ni por link, ni se puede pedir. El equipo lo sigue viendo en su buscador. Para ocultar algo, usá el interruptor <strong>Visible en la tienda</strong> en la ficha o en la categoría.</p>
    <BrokenCombos catalog={catalog} />
    <section className="visibility-group" aria-labelledby="vis-categories">
      <h3 id="vis-categories">Categorías ocultas ({hiddenCategories.length})</h3>
      {hiddenCategories.length ? <ul className="visibility-list">{hiddenCategories.map(c => <li key={c.id}><span>{c.label}<small>Sus productos tampoco se ven en la tienda.</small></span><button className="button" disabled={busy} aria-label={`Mostrar de nuevo la categoría ${c.label}`} onClick={() => void showCategory(c.id)}><Eye size={20} aria-hidden="true" />Mostrar de nuevo</button></li>)}</ul> : <p className="section-note">No hay categorías ocultas.</p>}
    </section>
    <section className="visibility-group" aria-labelledby="vis-products">
      <h3 id="vis-products">Productos ocultos ({hiddenProducts.length})</h3>
      {hiddenProducts.length ? <ul className="visibility-list">{hiddenProducts.map(p => <li key={p.id}><span>{p.name}<small>{isTonic(p) ? "Tónico" : "Hierba"}{formatPrice(p) ? ` · ${formatPrice(p)}` : ""}{combosUsing(catalog, p.id).length ? ` · Está en un combo` : ""}</small></span><button className="button" disabled={busy} aria-label={`Mostrar de nuevo ${p.name}`} onClick={() => void showProduct(p)}><Eye size={20} aria-hidden="true" />Mostrar de nuevo</button></li>)}</ul> : <p className="section-note">No hay productos ocultos.</p>}
    </section>
    {unlisted.length > 0 && <section className="visibility-group" aria-labelledby="vis-unlisted">
      <h3 id="vis-unlisted">Sin lugar en la tienda ({unlisted.length})</h3>
      <p className="section-note">Estos productos no están ocultos, pero no aparecen porque todas sus categorías están ocultas o no tienen categoría. Mostrá una categoría o asignales otra desde su ficha.</p>
      <ul className="visibility-list">{unlisted.map(p => <li key={p.id}><span>{p.name}<small>{isTonic(p) ? "Tónico" : "Hierba"}</small></span></li>)}</ul>
    </section>}
    {error && <div className="alert error" role="alert">{error}</div>}
  </div>;
}

/* ---- Promociones y combos ---- */

function promoStatus(item: Product, today: string): string {
  const { onPromo } = effectivePrice(item, today);
  if (item.promoPrice === undefined) return "";
  if (typeof item.price !== "number") return "No se aplica: el producto no tiene precio.";
  if (item.promoPrice >= item.price) return "No se aplica: la oferta no es menor al precio.";
  if (!onPromo) return `Vencida el ${item.promoUntil!.split("-").reverse().join("/")}.`;
  return item.promoUntil ? `Vigente hasta el ${item.promoUntil.split("-").reverse().join("/")}.` : "Vigente, sin fecha de fin.";
}

function PromosSection({ catalog, busy, error, onSave, onEditing }: Pick<Props, "catalog" | "busy" | "error" | "onSave"> & { onEditing: (editing: boolean) => void }) {
  const [editing, setEditing] = useState<Combo | null>(null);
  const [removing, setRemoving] = useState("");
  const combos = [...(catalog.combos ?? [])].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const today = storeToday();
  const withPromo = allProducts(catalog).filter(p => p.promoPrice !== undefined);
  useEffect(() => { onEditing(editing !== null); return () => onEditing(false); }, [editing, onEditing]);
  const saveCombos = (next: Combo[]) => onSave({ ...catalog, combos: next });
  const outOfStore = (combo: Combo) => combo.items.map(i => findProduct(catalog, i.productId)).filter((p): p is Product => !!p && !isInStore(catalog, p)).map(p => p.name);
  return <div className="store-section">
    <p className="section-note">Las ofertas por producto se cargan en la ficha de cada tónico u hierba (<strong>Precio de oferta</strong> y <strong>Válida hasta</strong>). Los combos se arman acá. Un producto dentro de un combo se vende al precio del combo: la oferta aplica solo a compras sueltas.</p>
    <BrokenCombos catalog={catalog} />
    <section className="visibility-group" aria-labelledby="promo-list">
      <h3 id="promo-list">Ofertas cargadas ({withPromo.length})</h3>
      {withPromo.length ? <ul className="visibility-list">{withPromo.map(p => <li key={p.id}><span>{p.name}<small>{formatMoney(p.promoPrice!)}{typeof p.price === "number" ? ` en lugar de ${formatMoney(p.price)}` : ""} · {promoStatus(p, today)}</small></span></li>)}</ul> : <p className="section-note">Ninguna oferta cargada todavía.</p>}
    </section>
    <section className="visibility-group" aria-labelledby="combo-list">
      <div className="group-head"><h3 id="combo-list">Combos ({combos.length})</h3>
        {!editing && <button className="button primary" disabled={busy} onClick={() => setEditing({ id: crypto.randomUUID(), name: "", description: "", items: [], price: 0, active: true })}><Plus size={20} aria-hidden="true" />Nuevo combo</button>}
      </div>
      {combos.length === 0 && !editing && <p className="section-note">Todavía no armaste combos. Un combo junta varios productos a un precio fijo.</p>}
      {combos.length > 0 && <ul className="visibility-list combo-admin-list">{combos.map(combo => {
        const hiddenNames = combo.active ? outOfStore(combo) : [];
        return <li key={combo.id} className={editing?.id === combo.id ? "is-selected" : undefined}>
          <span>{combo.name}<small>{combo.items.map(i => `${i.qty} x ${findProduct(catalog, i.productId)?.name ?? "?"}`).join(", ")} · {formatMoney(combo.price)} · {combo.active ? (hiddenNames.length ? "Activo, pero no se ve en la tienda" : "Activo") : "Desactivado"}</small></span>
          <div className="row-actions">
            <button className="button" disabled={busy} aria-label={`${combo.active ? "Desactivar" : "Activar"} el combo ${combo.name}`} onClick={() => void saveCombos(combos.map(c => c.id === combo.id ? { ...c, active: !c.active } : c))}>{combo.active ? "Desactivar" : "Activar"}</button>
            <button className="button" disabled={busy} aria-label={`Editar el combo ${combo.name}`} onClick={() => { setRemoving(""); setEditing(combo); }}><PencilSimple size={20} aria-hidden="true" />Editar</button>
            {removing === combo.id
              ? <><button className="button danger" disabled={busy} onClick={async () => { if (await saveCombos(combos.filter(c => c.id !== combo.id))) setRemoving(""); }}>Sí, eliminar</button><button className="button" onClick={() => setRemoving("")}>Cancelar</button></>
              : <button className="button" disabled={busy} aria-label={`Eliminar el combo ${combo.name}`} onClick={() => setRemoving(combo.id)}><Trash size={20} aria-hidden="true" />Eliminar</button>}
          </div>
        </li>;
      })}</ul>}
    </section>
    {editing && <ComboEditor key={editing.id} catalog={catalog} initial={editing} busy={busy} onCancel={() => setEditing(null)} onSave={async combo => { const others = (catalog.combos ?? []).filter(c => c.id !== combo.id); if (await saveCombos([...others, combo])) setEditing(null); }} />}
    {error && <div className="alert error" role="alert">{error}</div>}
  </div>;
}

type ComboDraft = { productId: string; qty: string };
function ComboEditor({ catalog, initial, busy, onCancel, onSave }: { catalog: Catalog; initial: Combo; busy: boolean; onCancel: () => void; onSave: (combo: Combo) => Promise<void> }) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [image, setImage] = useState(initial.image ?? "");
  const [price, setPrice] = useState(initial.items.length ? String(initial.price) : "");
  const [active, setActive] = useState(initial.active);
  const [items, setItems] = useState<ComboDraft[]>(initial.items.map(i => ({ productId: i.productId, qty: String(i.qty) })));
  const [uploading, setUploading] = useState(false);
  const [problem, setProblem] = useState("");
  const options: ProductOption[] = allProducts(catalog).map(p => ({ id: p.id, name: p.name, detail: `${isTonic(p) ? "Tónico" : "Hierba"}${isInStore(catalog, p) ? "" : p.published ? " · fuera de la tienda" : " · borrador"}` }));
  const patch = (index: number, change: Partial<ComboDraft>) => setItems(current => current.map((d, n) => n === index ? { ...d, ...change } : d));

  const build = (): { combo?: Combo; problem?: string } => {
    const trimmed = name.trim();
    if (!trimmed) return { problem: "Escribí el nombre del combo." };
    if ((catalog.combos ?? []).some(c => c.id !== initial.id && normalize(c.name) === normalize(trimmed))) return { problem: "Ya hay un combo con ese nombre." };
    if (!items.length) return { problem: "Agregá al menos un producto." };
    if (items.some(i => !i.productId)) return { problem: "Elegí un producto en cada renglón." };
    if (new Set(items.map(i => i.productId)).size !== items.length) return { problem: "Hay un producto repetido: subí su cantidad en lugar de repetirlo." };
    const lines = items.map(i => ({ productId: i.productId, qty: Number(i.qty) }));
    if (lines.some(l => !Number.isInteger(l.qty) || l.qty < 1 || l.qty > 99)) return { problem: "Las cantidades tienen que ser números enteros entre 1 y 99." };
    const parsed = parsePriceText(price);
    if (parsed.error || parsed.value === undefined) return { problem: parsed.error ?? "Escribí el precio del combo." };
    return { combo: { id: initial.id, name: trimmed, description: description.trim(), image: image || undefined, items: lines, price: parsed.value, active } };
  };
  const built = build();
  const savings = built.combo ? comboSavings(catalog, built.combo) : undefined;
  const hint = !built.combo ? "" : !savings ? "Algún producto no tiene precio: el combo no muestra cuánto se ahorra." : savings.savings > 0 ? `Comprados por separado suman ${formatMoney(savings.regular)} (a precio regular). El combo ahorra ${formatMoney(savings.savings)}.` : `Comprados por separado suman ${formatMoney(savings.regular)}. El combo cuesta lo mismo o más: no se muestra ahorro.`;

  return <form className="combo-editor" aria-label={initial.name ? `Editar el combo ${initial.name}` : "Nuevo combo"} onSubmit={event => { event.preventDefault(); if (!built.combo) { setProblem(built.problem ?? ""); return; } setProblem(""); void onSave(built.combo); }} noValidate>
    <h3>{initial.name ? `Editar combo: ${initial.name}` : "Nuevo combo"}</h3>
    <label className="field"><span>Nombre del combo<span className="required-tag">Obligatorio</span></span><input value={name} maxLength={200} onChange={e => setName(e.target.value)} /></label>
    <ImageField label="Foto del combo" value={image} onChange={setImage} onBusy={setUploading} />
    <label className="field"><span>Descripción</span><textarea rows={3} value={description} maxLength={2000} onChange={e => setDescription(e.target.value)} /><small>Opcional. Se muestra en la ficha del combo.</small></label>
    <fieldset className="ingredients-editor">
      <legend>Productos <span className="required-tag">Obligatorio: al menos uno</span></legend>
      {items.map((draft, index) => <div className="combo-row" key={index}>
        <div className="combo-product"><ProductCombobox label={`Producto ${index + 1}`} value={draft.productId} onChange={id => patch(index, { productId: id })} options={options} taken={new Set(items.filter((_, n) => n !== index).map(i => i.productId))} /></div>
        <label className="field qty-field"><span className="sr-only">Cantidad {index + 1}</span><input type="number" min={1} max={99} step={1} inputMode="numeric" value={draft.qty} onChange={e => patch(index, { qty: e.target.value })} /></label>
        <button type="button" className="icon-button" aria-label={`Quitar el producto ${index + 1}`} onClick={() => setItems(current => current.filter((_, n) => n !== index))}><X size={22} weight="bold" aria-hidden="true" /></button>
      </div>)}
      <button type="button" className="button" disabled={items.length >= 20} onClick={() => setItems(current => [...current, { productId: "", qty: "1" }])}><Plus size={20} weight="bold" aria-hidden="true" />Agregar producto</button>
    </fieldset>
    <label className="field"><span>Precio del combo ($)<span className="required-tag">Obligatorio</span></span><input inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder="Ej: 6500" />{hint && <small>{hint}</small>}</label>
    <label className="check"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />Activo (se muestra en la tienda)</label>
    {problem && <div className="alert error" role="alert">{problem}</div>}
    <div className="form-actions">
      <button type="button" className="button" disabled={busy} onClick={onCancel}>Cancelar</button>
      <button type="submit" className="button primary" disabled={busy || uploading}>{busy ? "Guardando…" : "Guardar combo"}</button>
    </div>
  </form>;
}
