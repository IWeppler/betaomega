"use client";

import { useState, type ReactNode } from "react";
import { Plus, Trash, X } from "@phosphor-icons/react";
import { SaveForm } from "@/app/save-form";
import { ImageField } from "@/app/catalog-image";
import { HerbCombobox } from "@/app/herb-combobox";
import { CategoryPicker } from "@/app/category-picker";
import { AvoidSelector } from "@/app/avoid-selector";
import { Field, newHerb, parsePrice, PriceFields, proportions, splitTags } from "@/app/admin-fields";
import { combosUsing, getAvoidOptions, normalize, type Catalog, type Plant, type Preparation } from "@/lib/catalog";
import { useCatalog } from "./catalog-context";

type Draft = { name: string; amount: string };

export function EditorFrame({ title, onClose, onDelete, children }: { title: string; onClose: () => void; onDelete?: () => void; children: ReactNode }) {
  return <section className="panel-editor" aria-labelledby="panel-editor-title">
    <header className="panel-editor-head">
      <h2 id="panel-editor-title">{title}</h2>
      <div className="panel-editor-actions">
        {onDelete && <button className="panel-icon-button is-danger" aria-label={`Eliminar ${title}`} onClick={onDelete}><Trash size={18} aria-hidden="true" /></button>}
        <button className="panel-icon-button" aria-label="Cerrar editor" onClick={onClose}><X size={18} aria-hidden="true" /></button>
      </div>
    </header>
    <div className="panel-editor-body">{children}</div>
  </section>;
}

// Fields shared by tonics and herbs that the store needs (see the store rules in docs/tienda-online.md).
const storeFields = (form: FormData, text: (key: string) => string) => ({
  categoryIds: form.getAll("categoryIds").map(String),
  price: parsePrice(text("price")),
  priceUnit: text("priceUnit") || undefined,
  promoPrice: parsePrice(text("promoPrice")),
  promoUntil: text("promoUntil") || undefined,
  hidden: form.get("visible") ? undefined : true,
});

export function TonicEditor({ tonic, onSaved, onClose, onDelete }: { tonic: Preparation; onSaved: (item: Preparation) => void; onClose: () => void; onDelete?: () => void }) {
  const { catalog, catalogRef, save, busy, setBusy, error, setError, flushRef } = useCatalog();
  const [image, setImage] = useState(tonic.image || "");
  const [avoid, setAvoid] = useState<string[]>(tonic.avoid ?? []);
  const plantName = (id: string) => catalog?.plants.find(p => p.id === id)?.name || "Hierba no disponible";
  const [drafts, setDrafts] = useState<Draft[]>(tonic.ingredients.map(i => ({ name: plantName(i.plantId), amount: i.amount })));
  const setDraft = (index: number, patch: Partial<Draft>) => setDrafts(drafts.map((d, n) => (n === index ? { ...d, ...patch } : d)));
  const herbOptions = (catalog?.plants ?? []).map(p => ({ id: p.id, name: p.name, tonics: catalog?.preparations.filter(t => t.ingredients.some(i => i.plantId === p.id)).length ?? 0 })).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const submit = async (element: HTMLFormElement) => {
    const current = catalogRef.current;
    if (!current) return false;
    if (!element.checkValidity()) { setError("Completá el nombre y los campos requeridos."); return false; }
    const form = new FormData(element);
    const text = (key: string) => String(form.get(key) || "").trim();
    if (!drafts.length || drafts.some(d => !d.name.trim())) { setError("Agregá al menos una hierba y completá todos los nombres."); return false; }
    const plants = [...current.plants];
    const ingredients = drafts.map(d => {
      let herb = plants.find(p => normalize(p.name) === normalize(d.name));
      if (!herb) { herb = newHerb(d.name.trim()); plants.push(herb); }
      return { plantId: herb.id, amount: d.amount.trim() };
    });
    if (new Set(ingredients.map(i => i.plantId)).size !== ingredients.length) { setError("Hay una hierba repetida en este tónico."); return false; }
    const item: Preparation = { ...tonic, image, name: text("name"), uses: splitTags(text("uses")), aliases: splitTags(text("aliases")), warnings: text("warnings"), published: true, ingredients, instructions: text("instructions"), avoid, ...storeFields(form, text) };
    if (!(await save({ ...current, plants, preparations: [...current.preparations.filter(p => p.id !== item.id), item] }))) return false;
    onSaved(item);
    return true;
  };
  return <EditorFrame title={tonic.name || "Nuevo tónico"} onClose={onClose} onDelete={onDelete}>
    <SaveForm error={error} registerRef={flushRef} paused={busy} onSave={submit} changes={JSON.stringify([drafts, image, avoid])}>
      <Field label="Nombre del tónico" name="name" value={tonic.name} required />
      <ImageField value={image} onChange={setImage} onBusy={setBusy} />
      {catalog && <CategoryPicker catalog={catalog} item={tonic} />}
      <PriceFields item={tonic} />
      <div className="form-grid">
        <Field label="Se utiliza para" name="uses" value={tonic.uses.join(", ")} multiline hint="Separá cada uso con una coma: gases, pesadez, descanso." />
        <Field label="También buscar por" name="aliases" value={tonic.aliases.join(", ")} multiline hint="Sinónimos y expresiones del cliente: hinchazón, dolor de panza." />
      </div>
      <fieldset className="ingredients-editor">
        <legend>Hierbas y proporciones <span className="required-tag">Obligatorio: al menos una hierba</span></legend>
        <p>Escribí el nombre y elegí una hierba existente. Si no está, se agrega sola. Con proporciones como &quot;2 partes&quot; el equipo puede calcular gramos.</p>
        {drafts.map((draft, index) => <div className="ingredient-row" key={index}>
          <HerbCombobox label={`Hierba ${index + 1}`} value={draft.name} onChange={name => setDraft(index, { name })} options={herbOptions} taken={new Set(drafts.filter((_, n) => n !== index).map(d => normalize(d.name)))} />
          <select aria-label={`Proporción ${index + 1}`} value={draft.amount} onChange={e => setDraft(index, { amount: e.target.value })}>
            <option value="">Elegir partes</option>
            {draft.amount && !proportions.includes(draft.amount) && <option value={draft.amount}>{draft.amount}</option>}
            {proportions.map(amount => <option key={amount} value={amount}>{amount}</option>)}
          </select>
          <button type="button" className="icon-button" aria-label={`Quitar hierba ${index + 1}`} onClick={() => setDrafts(drafts.filter((_, n) => n !== index))}><X size={18} weight="bold" aria-hidden="true" /></button>
        </div>)}
        <button className="button" type="button" onClick={() => setDrafts([...drafts, { name: "", amount: "" }])}><Plus size={18} weight="bold" aria-hidden="true" />Agregar hierba</button>
      </fieldset>
      <Field label="Preparación e indicaciones internas" name="instructions" value={tonic.instructions} multiline hint="Escribí el método y los tiempos definidos por el dueño." />
      <Field label="Advertencias / contraindicaciones" name="warnings" value={tonic.warnings} multiline />
      <AvoidSelector value={avoid} options={getAvoidOptions(catalog)} onChange={setAvoid} />
    </SaveForm>
  </EditorFrame>;
}

export function HerbEditor({ herb, onSaved, onClose, onDelete }: { herb: Plant; onSaved: (item: Plant) => void; onClose: () => void; onDelete?: () => void }) {
  const { catalog, catalogRef, save, busy, setBusy, error, setError, flushRef } = useCatalog();
  const [image, setImage] = useState(herb.image || "");
  const submit = async (element: HTMLFormElement) => {
    const current = catalogRef.current;
    if (!current) return false;
    if (!element.checkValidity()) { setError("Completá el nombre de la hierba."); return false; }
    const form = new FormData(element);
    const text = (key: string) => String(form.get(key) || "").trim();
    if (current.plants.some(p => p.id !== herb.id && normalize(p.name) === normalize(text("name")))) { setError("Ya existe una hierba con ese nombre. Editá su ficha."); return false; }
    const item: Plant = { ...herb, image, name: text("name"), scientificName: text("scientificName"), properties: text("properties"), uses: splitTags(text("uses")), aliases: splitTags(text("aliases")), warnings: text("warnings"), published: true, ...storeFields(form, text) };
    if (!(await save({ ...current, plants: [...current.plants.filter(p => p.id !== item.id), item] }))) return false;
    onSaved(item);
    return true;
  };
  return <EditorFrame title={herb.name || "Nueva hierba"} onClose={onClose} onDelete={onDelete}>
    <SaveForm error={error} registerRef={flushRef} paused={busy} onSave={submit} changes={image}>
      <Field label="Nombre de la hierba" name="name" value={herb.name} required />
      <ImageField value={image} onChange={setImage} onBusy={setBusy} />
      {catalog && <CategoryPicker catalog={catalog} item={herb} />}
      <PriceFields item={herb} />
      <Field label="Nombre científico" name="scientificName" value={herb.scientificName} />
      <Field label="Propiedades" name="properties" value={herb.properties} multiline />
      <Field label="Usos tradicionales y formas de uso" name="uses" value={herb.uses.join(", ")} multiline hint="Separá por comas. Ejemplos: mate, infusión, sobremesa." />
      <Field label="También buscar por" name="aliases" value={herb.aliases.join(", ")} multiline hint="Sinónimos o búsquedas del cliente. Ejemplo: hierbas para mate." />
      <Field label="Advertencias / contraindicaciones" name="warnings" value={herb.warnings} multiline />
    </SaveForm>
  </EditorFrame>;
}

/** Why an item cannot be deleted, or "" when it can. */
export function deleteBlocker(catalog: Catalog, item: Plant | Preparation) {
  if (!("ingredients" in item) && catalog.preparations.some(p => p.ingredients.some(i => i.plantId === item.id))) return "Esta hierba se usa en un tónico. Quitala de sus ingredientes antes de eliminarla.";
  const combos = combosUsing(catalog, item.id);
  if (combos.length) return `Esta ficha forma parte de ${combos.length === 1 ? "el combo" : "los combos"} ${combos.map(c => c.name).join(", ")}. Quitala del combo antes de eliminarla.`;
  return "";
}

export function DeleteConfirm({ item, onCancel, onDeleted }: { item: Plant | Preparation; onCancel: () => void; onDeleted: () => void }) {
  const { catalogRef, save, busy, error, setError } = useCatalog();
  const remove = async () => {
    const current = catalogRef.current;
    if (!current) return;
    const blocker = deleteBlocker(current, item);
    if (blocker) { setError(blocker); return; }
    const next = "ingredients" in item ? { ...current, preparations: current.preparations.filter(p => p.id !== item.id) } : { ...current, plants: current.plants.filter(p => p.id !== item.id) };
    if (await save(next)) onDeleted();
  };
  return <EditorFrame title={`Eliminar ${item.name}`} onClose={onCancel}>
    <p className="panel-muted">La ficha se elimina del catálogo y de la tienda. No se puede deshacer.</p>
    {error && <div className="alert error" role="alert">{error}</div>}
    <div className="form-actions">
      <button className="button" disabled={busy} onClick={onCancel}>Cancelar</button>
      <button className="button danger" disabled={busy} onClick={() => void remove()}>{busy ? "Eliminando…" : "Eliminar ficha"}</button>
    </div>
  </EditorFrame>;
}
