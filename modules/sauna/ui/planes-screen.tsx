"use client";

import { useState } from "react";
import { formatCents } from "@/platform/money";
import { EmptyState, PageHeader, useSite } from "@/platform/panel";
import { durationText, PLAN_TURNS, planQuote, planSummary, type Plan } from "../domain/plans";
import { Button, Card, Field, inputClass, Notice, Tag } from "./controls";
import { sendJson } from "./fetch-json";
import { offerRowUndo } from "./undo-row";
import { useResource } from "./use-resource";

/** `durations`: how long the active turn types last, shortest first. */
type Result = { plans: Plan[]; depositPercent: number; durations: number[] };

const bodyOf = (plan: Plan) => ({
  name: plan.name, description: plan.description, turns: plan.turns, priceCents: plan.priceCents, windowDays: plan.windowDays, durationMinutes: plan.durationMinutes,
  allowsCodes: plan.allowsCodes, active: plan.active,
});

function PlanForm({ plan, depositPercent, durations, onDone, reload }: {
  plan: Plan | null; depositPercent: number; durations: number[]; onDone: (saved: boolean) => Promise<void> | void; reload: () => Promise<void>;
}) {
  const site = useSite();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [turns, setTurns] = useState(plan?.turns ?? 4);
  const [pesos, setPesos] = useState(plan ? String(plan.priceCents / 100) : "");
  const priceCents = Math.round(Number(pesos) * 100);
  const quote = Number.isFinite(priceCents) && priceCents > 0 ? planQuote({ priceCents }, depositPercent) : null;
  const save = async (form: HTMLFormElement) => {
    const values = new FormData(form);
    const text = (name: string) => String(values.get(name) ?? "").trim();
    setBusy(true);
    setError("");
    try {
      const url = `/api/sites/${site.id}/sauna/plans`;
      const { id } = await sendJson<{ id: string }>(url, "POST", {
        id: plan?.id ?? null,
        updatedAt: plan?.updatedAt ?? null,
        name: text("name"),
        description: text("description"),
        turns,
        // The panel writes pesos; the server keeps cents.
        priceCents,
        windowDays: Number(text("windowDays")),
        durationMinutes: Number(text("durationMinutes")),
        allowsCodes: values.get("allowsCodes") === "on",
        active: values.get("active") === "on",
      });
      await onDone(true);
      offerRowUndo<Plan, Result>({ message: plan ? "Se guardó el plan." : "Se creó el plan.", url, previous: plan, savedId: id, rowsOf: data => data.plans, bodyOf, reload });
    } catch (failure) {
      setError((failure as Error).message);
      setBusy(false);
    }
  };
  return <Card className="mb-4">
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); void save(event.currentTarget); }}>
      <h2 className="m-0 text-lg font-semibold text-ink sm:col-span-2">{plan ? `Editar ${plan.name}` : "Nuevo plan"}</h2>
      <Field label="Nombre" hint="Lo que ve quien reserva.">
        <input className={inputClass} name="name" defaultValue={plan?.name ?? ""} maxLength={80} placeholder="Plan Vitalidad" required />
      </Field>
      <Field label="Cantidad de turnos" hint="Quien reserva los elige todos antes de pagar, cada uno en un día distinto.">
        <input className={inputClass} type="number" min={PLAN_TURNS.min} max={PLAN_TURNS.max} step={1} value={turns} onChange={event => setTurns(Number(event.target.value))} required />
      </Field>
      <Field label="Precio del plan, en pesos" hint={quote ? `Seña del ${depositPercent} %: ${formatCents(quote.depositCents)}. En el lugar: ${formatCents(quote.balanceCents)}.` : "El precio total de todos los turnos juntos."}>
        <input className={inputClass} type="number" min={turns} step={0.01} value={pesos} onChange={event => setPesos(event.target.value)} required />
      </Field>
      <Field label="Días para usarlo" hint="Del primer al último turno, contando el primero. Por ejemplo, 30.">
        <input className={inputClass} name="windowDays" type="number" min={1} max={365} step={1} defaultValue={plan?.windowDays ?? 30} required />
      </Field>
      <Field label="Duración de cada turno" hint="Solo se ofrecen los turnos que duran esto.">
        {/* A plan saved before this was asked has none: the list starts empty so it has to be chosen. Only lengths of real turn types are offered. */}
        <select className={inputClass} name="durationMinutes" defaultValue={plan?.durationMinutes != null && durations.includes(plan.durationMinutes) ? String(plan.durationMinutes) : durations.length === 1 ? String(durations[0]) : ""} required>
          <option value="" disabled>Elegí una duración</option>
          {durations.map(minutes => <option key={minutes} value={minutes}>{durationText(minutes)}</option>)}
        </select>
      </Field>
      <label className="flex items-center gap-2 self-end text-ink sm:min-h-control">
        <input type="checkbox" name="allowsCodes" defaultChecked={plan?.allowsCodes ?? false} className="size-4" />
        Acepta códigos de descuento
      </label>
      <Field label="Descripción (opcional)" hint="Una línea que explique el plan." className="sm:col-span-2">
        <input className={inputClass} name="description" defaultValue={plan?.description ?? ""} maxLength={300} placeholder="Cuatro sesiones para empezar el hábito." />
      </Field>
      <label className="flex items-center gap-2 text-ink sm:col-span-2">
        <input type="checkbox" name="active" defaultChecked={plan?.active ?? true} className="size-4" />
        Activo: se ofrece en el sitio
      </label>
      {error && <div className="sm:col-span-2"><Notice kind="error">{error}</Notice></div>}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button type="submit" variant="primary" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button>
        <Button disabled={busy} onClick={() => void onDone(false)}>Cancelar</Button>
      </div>
    </form>
  </Card>;
}

export function PlanesScreen() {
  const site = useSite();
  const { data, error, reload, loading } = useResource<Result>(`/api/sites/${site.id}/sauna/plans`);
  const [editing, setEditing] = useState<Plan | "new" | null>(null);
  const done = async (saved: boolean) => {
    if (saved) await reload();
    setEditing(null);
  };
  return <>
    <PageHeader
      title="Planes"
      description="Quien reserva elige todos los turnos y paga una sola seña."
      actions={!editing && <Button variant="primary" onClick={() => setEditing("new")}>Nuevo plan</Button>}
    />
    {error && <div className="mb-3 grid justify-items-start gap-2"><Notice kind="error">{error}</Notice><Button onClick={() => void reload()}>Reintentar</Button></div>}
    {editing && data && data.durations.length === 0 && <div className="mb-4"><Notice kind="error">Primero creá un tipo de turno en Horarios y precios: el plan necesita saber cuánto dura cada turno.</Notice></div>}
    {editing && data && data.durations.length > 0 && <PlanForm key={editing === "new" ? "new" : editing.id} plan={editing === "new" ? null : editing} depositPercent={data.depositPercent} durations={data.durations} onDone={done} reload={reload} />}
    {loading && !data && <p className="text-muted" aria-busy="true">Cargando…</p>}
    {data && (data.plans.length === 0
      ? !editing && <EmptyState title="Todavía no hay planes" text="Creá uno, por ejemplo un Plan Vitalidad de 4 turnos, para ofrecer varias sesiones juntas." />
      : <div className="grid gap-2">
        {data.plans.map(plan => <article key={plan.id} className={`grid gap-1 rounded-field border border-line bg-bg p-3 ${plan.active ? "" : "opacity-75"}`}>
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-ink">{plan.name}</strong>
            <span className="text-ink tabular-nums">{formatCents(plan.priceCents)}</span>
            {plan.active ? <Tag tone="accent">Activo</Tag> : <Tag>Inactivo</Tag>}
            {plan.allowsCodes && <Tag>Acepta códigos</Tag>}
            {plan.durationMinutes === null && <Tag>Falta la duración</Tag>}
          </div>
          <p className="m-0 text-muted">{planSummary(plan)} · seña {formatCents(planQuote(plan, data.depositPercent).depositCents)}</p>
          {plan.description && <p className="m-0 text-muted">{plan.description}</p>}
          <div><Button disabled={editing !== null} onClick={() => setEditing(plan)}>Editar</Button></div>
        </article>)}
      </div>)}
  </>;
}
