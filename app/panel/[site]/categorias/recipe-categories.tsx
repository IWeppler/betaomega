"use client";

import { useState } from "react";
import { GitMerge, PencilSimple, Tag } from "@phosphor-icons/react";
import { categoryKey, categoryUsage } from "@/lib/recipes";
import { EditorFrame } from "../editors";
import { EmptyState, Paged } from "../list-tools";
import { SideSheet } from "../sheet";
import { usePanel } from "../panel-context";
import { useRecipes } from "../recipes-context";
import { PageHeader } from "../shell";

type Action = { from: string; mode: "rename" | "merge" };
type Outcome = { text: string; failed: { title: string; error: string }[] };

export function RecipeCategories() {
  const { recipes, renameCategory } = useRecipes();
  const { busy, error, setError } = usePanel();
  const [action, setAction] = useState<Action | null>(null);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  if (!recipes) return null;
  const usage = categoryUsage(recipes);
  const open = (next: Action) => { setError(""); setOutcome(null); setAction(next); setName(next.from); setTarget(""); };
  const close = () => { setError(""); setAction(null); };

  const submit = async () => {
    if (!action) return;
    const to = action.mode === "rename" ? name.trim() : target;
    if (!to) { setError(action.mode === "rename" ? "Escribí el nuevo nombre." : "Elegí con qué tipo juntarlo."); return; }
    if (to === action.from) { close(); return; }
    const result = await renameCategory(action.from, to);
    if (!result) return;
    const verb = action.mode === "rename" ? "Renombrada" : "Juntada";
    setOutcome({ text: `${verb} “${action.from}” → “${result.to}”: ${result.changed} ${result.changed === 1 ? "receta actualizada" : "recetas actualizadas"}.`, failed: result.failed });
    setAction(null);
  };

  const selected = action ? usage.find(u => u.label === action.from) : undefined;
  const others = action ? usage.filter(u => u.label !== action.from) : [];
  const existing = action?.mode === "rename" && name.trim() ? others.find(u => categoryKey(u.label) === categoryKey(name)) : undefined;
  const count = selected ? selected.published + selected.drafts : 0;
  const side = action && selected ? <EditorFrame title={action.mode === "rename" ? `Renombrar “${action.from}”` : `Juntar “${action.from}”`} onClose={close}>
    <form onSubmit={e => { e.preventDefault(); void submit(); }}>
      {action.mode === "rename" ? <label className="field">
        <span>Nuevo nombre</span>
        <input value={name} onChange={e => setName(e.target.value)} maxLength={40} autoFocus />
        <small>{existing ? `Ya existe “${existing.label}”: las recetas pasan a ese tipo.` : "Se cambia en todas las recetas, publicadas y borradores."}</small>
      </label> : <label className="field">
        <span>Pasar sus recetas a</span>
        <select value={target} onChange={e => setTarget(e.target.value)}>
          <option value="">Elegí un tipo</option>
          {others.map(u => <option key={u.label} value={u.label}>{u.label}</option>)}
        </select>
        <small>“{action.from}” desaparece y sus recetas quedan en el tipo elegido.</small>
      </label>}
      <p className="panel-muted">Afecta a {count} {count === 1 ? "receta" : "recetas"}. Los links del sitio que filtran por “{action.from}” dejan de filtrar.</p>
      {error && <div className="alert error" role="alert">{error}</div>}
      <div className="form-actions">
        <button type="button" className="button" disabled={busy} onClick={close}>Cancelar</button>
        <button type="submit" className="button primary" disabled={busy}>{busy ? "Guardando…" : action.mode === "rename" ? "Renombrar" : "Juntar"}</button>
      </div>
    </form>
  </EditorFrame> : null;

  return <>
    <PageHeader title="Tipos" description="Salen de las recetas. Acá podés unificar nombres repetidos o cambiarlos en todas las recetas a la vez." />
    {outcome && <div className={`alert ${outcome.failed.length ? "error" : ""}`} role="status">
      {outcome.text}
      {outcome.failed.length > 0 && <> No se pudieron actualizar:<ul>{outcome.failed.map(f => <li key={f.title}>{f.title}: {f.error}</li>)}</ul>Repetí la acción para reintentar.</>}
    </div>}
    <div>
      <section className="panel-card panel-list" aria-label="Lista de tipos">
        {usage.length > 0 ? <Paged rows={usage} resetKey={""}>{shown => <table className="panel-table">
          <thead><tr><th scope="col">Tipo</th><th scope="col" className="is-num">Publicadas</th><th scope="col" className="is-num">Borradores</th><th scope="col"><span className="sr-only">Acciones</span></th></tr></thead>
          <tbody>{shown.map(u => <tr key={u.label} aria-selected={action?.from === u.label}>
            <th scope="row"><span className="panel-row-label"><Tag size={16} aria-hidden="true" />{u.label}</span></th>
            <td className="is-num">{u.published}</td>
            <td className="is-num">{u.drafts}</td>
            <td><div className="panel-row-actions">
              <button className="button" disabled={busy} onClick={() => open({ from: u.label, mode: "rename" })}><PencilSimple size={16} aria-hidden="true" />Renombrar</button>
              <button className="button" disabled={busy || usage.length < 2} onClick={() => open({ from: u.label, mode: "merge" })}><GitMerge size={16} aria-hidden="true" />Juntar</button>
            </div></td>
          </tr>)}</tbody>
        </table>}</Paged> : <EmptyState title="Todavía no hay tipos" text="Aparecen cuando agregás tipos a una receta." />}
      </section>
      <SideSheet onClose={close}>{side}</SideSheet>
    </div>
  </>;
}
