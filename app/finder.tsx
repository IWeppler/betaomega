"use client";

import { useState, type ComponentType } from "react";
import { Calculator, Check, Copy, Printer, WarningCircle } from "@phosphor-icons/react";
import { Screen } from "./screen";
import { avoidOptions, type Catalog, type Plant, type Preparation } from "@/lib/catalog";
import { CatalogImage } from "./catalog-image";
import { WhatsAppShare } from "./whatsapp-share";
import { partsOf, grams, recipeText, herbText } from "@/lib/recipe";

const avoidLabel = (id: string) => avoidOptions.find(o => o.id === id)?.label ?? id;

export function TonicDetail({ prep, catalog, plantName, preview, profile, onClose, onEdit, inline = false, PriceDisplay }: { prep: Preparation; catalog: Catalog | null; plantName: (id: string) => string; preview: boolean; profile: string[]; inline?: boolean; onClose: () => void; onEdit?: () => void; PriceDisplay: ComponentType<{ item: Plant | Preparation; partial?: boolean }> }) {
  const [calculating, setCalculating] = useState(false);
  const [total, setTotal] = useState(prep.presentationWeightGrams ?? 1000);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [selected, setSelected] = useState(prep.ingredients.map(i => i.plantId));
  const [customInstructions, setCustomInstructions] = useState("");
  const included = prep.ingredients.filter(i => selected.includes(i.plantId));
  const partial = included.length !== prep.ingredients.length;
  const plantWarnings = included.flatMap(i => { const plant = catalog?.plants.find(p => p.id === i.plantId); return plant?.warnings ? [{ name: plant.name, text: plant.warnings }] : []; });
  const parts = included.map(i => partsOf(i.amount));
  const canCalculate = included.length > 0 && parts.every(p => p !== null);
  const sum = parts.reduce<number>((acc, p) => acc + (p ?? 0), 0);
  const amountFor = (plantId: string) => calculating && canCalculate && total > 0 && total <= 100000 && sum > 0 ? grams((total * (parts[included.findIndex(i => i.plantId === plantId)] ?? 0)) / sum) : null;
  const avoid = prep.avoid ?? [];

  let message = "", shareError = "";
  try { if (catalog) message = recipeText(prep, catalog, { selected, total: calculating && canCalculate ? total : undefined, instructions: customInstructions }); }
  catch (e) { shareError = (e as Error).message; }
  const copy = async () => {
    setCopyError("");
    try { await navigator.clipboard.writeText(message); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { setCopyError("No se pudo copiar. Podés seleccionar el mensaje en la sección de WhatsApp."); }
  };

  return <Screen title={prep.name} onClose={onClose} inline={inline}>
    <CatalogImage image={prep.image} name={prep.name} className="detail-image" />
    <PriceDisplay item={prep} partial={partial} />
    {preview && <p className="preview-note no-print">Vista previa del administrador. Revisá esta ficha antes de habilitarla.</p>}
    <section className="warning-panel" aria-labelledby="warn-title">
      <h3 id="warn-title"><WarningCircle size={30} weight="fill" aria-hidden="true" />Advertencias</h3>
      {avoid.length > 0 && <div className="avoid-list"><span>No recomendado en</span>{avoid.map(id => <strong key={id} className={profile.includes(id) ? "is-match" : undefined}>{avoidLabel(id)}</strong>)}</div>}
      {prep.warnings ? <p>{prep.warnings}</p> : <p>No hay advertencias cargadas. Confirmá con el dueño antes de orientar al cliente.</p>}
      {plantWarnings.map(w => <p key={w.name}><strong>{w.name}: </strong>{w.text}</p>)}
    </section>
    <section>
      <h3>Para qué se usa</h3>
      {prep.uses.length ? <ul className="use-list">{prep.uses.map(use => <li key={use}>{use}</li>)}</ul> : <p>Sin completar.</p>}
    </section>
    <section>
      <h3>Ingredientes</h3>
      <p className="section-note no-print">Elegí qué hierbas vas a incluir. La ficha original del dueño no cambia.</p>
      {partial && <p className="preview-note">Selección de {included.length} de {prep.ingredients.length} hierbas del tónico.</p>}
      <ul className="ingredient-list selectable">{prep.ingredients.map(i => <li key={i.plantId} className={selected.includes(i.plantId) ? "" : "is-excluded"}><label><input className="no-print" type="checkbox" checked={selected.includes(i.plantId)} onChange={e => { setSelected(e.target.checked ? [...selected, i.plantId] : selected.filter(id => id !== i.plantId)); setCopied(false); }} /><span>{plantName(i.plantId)}</span></label><span className="amounts">{selected.includes(i.plantId) && amountFor(i.plantId) && <b>{amountFor(i.plantId)}</b>}<strong>{i.amount || "Pendiente"}</strong></span></li>)}</ul>
      {canCalculate && <div className="calc no-print">
        {!calculating ? <button className="button" onClick={() => setCalculating(true)}><Calculator size={20} weight="bold" aria-hidden="true" />Calcular cantidades</button> : <>
          <label htmlFor="calc-total">Cantidad total de la mezcla (gramos)</label>
          <div className="calc-row">
            <input id="calc-total" type="number" inputMode="decimal" min={1} max={100000} value={total || ""} onChange={e => setTotal(Math.max(0, Number(e.target.value)))} />
            {[100, 250, 500, 1000].map(v => <button key={v} className="chip small" aria-pressed={total === v} onClick={() => setTotal(v)}>{v === 1000 ? "1 kg" : `${v} g`}</button>)}
            <button className="button" onClick={() => setCalculating(false)}>Ocultar</button>
          </div>
        </>}
      </div>}
    </section>
    <section>
      <h3>Preparación</h3>
      {partial && <p className="section-note">Esta es la preparación del tónico completo. Al compartir una selección, indicá su preparación abajo.</p>}
      {prep.steps?.length ? <ol className={`list-decimal space-y-2 pl-5 ${partial ? "no-print" : ""}`}>{prep.steps.map((step, index) => <li key={index} className="whitespace-pre-wrap">{step}</li>)}</ol> : <p className={partial ? "prose no-print" : "prose"}>{prep.instructions || "El dueño todavía debe completar las indicaciones."}</p>}
      {partial && <p className="prose print-only">{customInstructions || "Preparación de la selección pendiente de confirmar."}</p>}
      {partial && <label className="field custom-preparation"><span>Preparación para las hierbas seleccionadas</span><textarea rows={4} maxLength={10000} value={customInstructions} onChange={e => setCustomInstructions(e.target.value)} placeholder="Escribí las indicaciones confirmadas para esta selección." /></label>}
    </section>
    {prep.notes && <section className="no-print"><h3>Notas internas</h3><p className="prose">{prep.notes}</p></section>}
    <WhatsAppShare message={message} error={shareError} />
    {copyError && <p className="alert error" role="alert">{copyError}</p>}
    <div className="detail-actions no-print">
      <button className="button primary" disabled={!message || Boolean(shareError)} onClick={() => void copy()}>{copied ? <Check size={20} weight="bold" aria-hidden="true" /> : <Copy size={20} weight="bold" aria-hidden="true" />}{copied ? "Copiado" : "Copiar"}</button>
      <button className="button" onClick={() => window.print()}><Printer size={20} weight="bold" aria-hidden="true" />Imprimir</button>
      {onEdit && <button className="button" onClick={onEdit}>Editar ficha</button>}
    </div>
  </Screen>;
}

export function HerbDetail({ plant, onClose, onEdit, inline = false, PriceDisplay }: { plant: Plant; inline?: boolean; onClose: () => void; onEdit?: () => void; PriceDisplay: ComponentType<{ item: Plant | Preparation }> }) {
  return <Screen title={plant.name} onClose={onClose} inline={inline}><CatalogImage image={plant.image} name={plant.name} className="detail-image" /><PriceDisplay item={plant} />{plant.scientificName && <p className="section-note"><em>{plant.scientificName}</em></p>}<section className="warning-panel"><h3><WarningCircle size={30} weight="fill" aria-hidden="true" />Advertencias</h3><p>{plant.warnings || "No hay advertencias cargadas. Confirmá con el dueño antes de orientar al cliente."}</p></section><section><h3>Propiedades</h3><p className="prose">{plant.properties || "Sin propiedades cargadas."}</p></section><section><h3>Usos tradicionales y formas de uso</h3>{plant.uses.length ? <ul className="use-list">{plant.uses.map(use => <li key={use}>{use}</li>)}</ul> : <p>Sin usos cargados.</p>}</section>{plant.notes && <section className="no-print"><h3>Notas internas</h3><p className="prose">{plant.notes}</p></section>}<WhatsAppShare message={herbText(plant)} /><div className="detail-actions no-print"><button className="button" onClick={() => window.print()}><Printer size={20} aria-hidden="true" />Imprimir</button>{onEdit && <button className="button" onClick={onEdit}>Editar hierba</button>}</div></Screen>;
}

