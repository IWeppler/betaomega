"use client";

import { useState } from "react";
import { EmptyState, PageHeader, useSite } from "@/platform/panel";
import { describeCode } from "../domain/codes";
import { codeTypes, type CodeType } from "../domain/pricing";
import { businessDate, dayLabel } from "../domain/time";
import { Button, Card, Field, inputClass, Notice, Tag } from "./controls";
import { sendJson } from "./fetch-json";
import { useResource } from "./use-resource";

type PanelCode = {
  id: string; code: string; type: CodeType; value: number; active: boolean; validFrom: string | null; validUntil: string | null;
  maxUses: number | null; maxUsesPerCustomer: number | null; turnTypeId: string | null; note: string; updatedAt: string; uses: number;
};
type Result = { now: string; codes: PanelCode[]; types: { id: string; name: string }[] };

const typeLabels: Record<CodeType, string> = {
  percent: "Porcentaje de descuento",
  fixed: "Monto fijo de descuento",
  no_deposit: "Reserva sin seña",
  free: "Sesión sin cargo",
};

const typeHints: Record<CodeType, string> = {
  percent: "Resta un porcentaje del precio. La seña se calcula sobre el precio con descuento.",
  fixed: "Resta un monto, sin dejar el precio por debajo de cero.",
  no_deposit: "La reserva se confirma sin pagar seña y el total se paga en el lugar.",
  free: "Precio cero: la reserva se confirma al instante. Necesita un máximo de usos.",
};

/** A code that cannot be used today, whatever its uses: the panel says so next to it. */
function stateOf(code: PanelCode, now: number) {
  if (!code.active) return "Inactivo";
  if (code.validFrom && Date.parse(code.validFrom) > now) return "Todavía no vigente";
  if (code.validUntil && Date.parse(code.validUntil) < now) return "Vencido";
  if (code.maxUses !== null && code.uses >= code.maxUses) return "Sin usos disponibles";
  return null;
}

function CodeForm({ code, types, onDone }: { code: PanelCode | null; types: Result["types"]; onDone: (saved: boolean) => Promise<void> | void }) {
  const site = useSite();
  const [type, setType] = useState<CodeType>(code?.type ?? "percent");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async (form: HTMLFormElement) => {
    const values = new FormData(form);
    const text = (name: string) => String(values.get(name) ?? "").trim();
    const number = (name: string) => (text(name) === "" ? null : Number(text(name)));
    setBusy(true);
    setError("");
    try {
      await sendJson(`/api/sites/${site.id}/sauna/codes`, "POST", {
        id: code?.id ?? null,
        updatedAt: code?.updatedAt ?? null,
        code: text("code"),
        type,
        // The panel writes pesos; the server keeps cents.
        value: type === "percent" ? number("percent") : type === "fixed" ? Math.round((number("amount") ?? 0) * 100) : 0,
        maxUses: number("maxUses"),
        maxUsesPerCustomer: number("maxUsesPerCustomer"),
        validFrom: text("validFrom"),
        validUntil: text("validUntil"),
        turnTypeId: text("turnTypeId"),
        note: text("note"),
        active: values.get("active") === "on",
      });
      await onDone(true);
    } catch (failure) {
      setError((failure as Error).message);
      setBusy(false);
    }
  };
  return <Card className="mb-4">
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); void save(event.currentTarget); }}>
      <h2 className="m-0 text-lg font-semibold text-ink sm:col-span-2">{code ? `Editar ${code.code}` : "Nuevo código"}</h2>
      <Field label="Código" hint="Lo que escribe quien reserva. Sin importar mayúsculas.">
        <input className={`${inputClass} uppercase`} name="code" defaultValue={code?.code ?? ""} minLength={3} maxLength={40} pattern="[A-Za-z0-9\-]{3,40}" autoComplete="off" spellCheck={false} required />
      </Field>
      <Field label="Tipo" hint={typeHints[type]}>
        <select className={inputClass} value={type} onChange={event => setType(event.target.value as CodeType)}>
          {codeTypes.map(item => <option key={item} value={item}>{typeLabels[item]}</option>)}
        </select>
      </Field>
      {type === "percent" && <Field label="Porcentaje">
        <input className={inputClass} name="percent" type="number" min={1} max={100} step={1} defaultValue={code?.type === "percent" ? code.value : ""} required />
      </Field>}
      {type === "fixed" && <Field label="Monto, en pesos">
        <input className={inputClass} name="amount" type="number" min={0.01} step={0.01} defaultValue={code?.type === "fixed" ? code.value / 100 : ""} required />
      </Field>}
      <Field label="Máximo de usos" hint={type === "free" ? "Obligatorio en un código gratis." : "Vacío: sin límite."}>
        <input className={inputClass} name="maxUses" type="number" min={1} step={1} defaultValue={code?.maxUses ?? ""} required={type === "free"} />
      </Field>
      <Field label="Máximo por persona" hint="Se cuenta por WhatsApp. Vacío: sin límite.">
        <input className={inputClass} name="maxUsesPerCustomer" type="number" min={1} step={1} defaultValue={code?.maxUsesPerCustomer ?? ""} />
      </Field>
      <Field label="Vale desde" hint="Vacío: desde ya.">
        <input className={inputClass} name="validFrom" type="date" defaultValue={code?.validFrom ? businessDate(code.validFrom) : ""} />
      </Field>
      <Field label="Vale hasta, inclusive" hint="Vacío: no vence.">
        <input className={inputClass} name="validUntil" type="date" defaultValue={code?.validUntil ? businessDate(code.validUntil) : ""} />
      </Field>
      <Field label="Solo para" hint="Restringe el código a un tipo de turno.">
        <select className={inputClass} name="turnTypeId" defaultValue={code?.turnTypeId ?? ""}>
          <option value="">Cualquier turno</option>
          {types.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          {code?.turnTypeId && !types.some(item => item.id === code.turnTypeId) && <option value={code.turnTypeId}>Tipo ya quitado</option>}
        </select>
      </Field>
      <Field label="Nota interna" hint="Solo se ve en el panel.">
        <input className={inputClass} name="note" maxLength={200} defaultValue={code?.note ?? ""} placeholder="Regalo de cumpleaños de Ana" />
      </Field>
      <label className="flex items-center gap-2 text-ink sm:col-span-2">
        <input type="checkbox" name="active" defaultChecked={code?.active ?? true} className="size-4" />
        Activo: se puede usar al reservar
      </label>
      {error && <div className="sm:col-span-2"><Notice kind="error">{error}</Notice></div>}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button type="submit" variant="primary" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button>
        <Button disabled={busy} onClick={() => void onDone(false)}>Cancelar</Button>
      </div>
    </form>
  </Card>;
}

export function CodigosScreen() {
  const site = useSite();
  const { data, error, reload, loading } = useResource<Result>(`/api/sites/${site.id}/sauna/codes`);
  const [editing, setEditing] = useState<PanelCode | "new" | null>(null);
  const typeName = (id: string | null) => data?.types.find(item => item.id === id)?.name ?? "un tipo ya quitado";
  const done = async (saved: boolean) => {
    if (saved) await reload();
    setEditing(null);
  };
  return <>
    <PageHeader
      title="Códigos"
      description="Un uso se devuelve solo si la reserva vence o se cancela. Para dejar de usar un código, desactivalo."
      actions={!editing && <Button variant="primary" onClick={() => setEditing("new")}>Nuevo código</Button>}
    />
    {error && <div className="mb-3 grid justify-items-start gap-2"><Notice kind="error">{error}</Notice><Button onClick={() => void reload()}>Reintentar</Button></div>}
    {editing && data && <CodeForm key={editing === "new" ? "new" : editing.id} code={editing === "new" ? null : editing} types={data.types} onDone={done} />}
    {loading && !data && <p className="text-muted" aria-busy="true">Cargando…</p>}
    {data && (data.codes.length === 0
      ? !editing && <EmptyState title="Todavía no hay códigos" text="Creá uno para ofrecer un descuento, una reserva sin seña o una sesión de regalo." />
      : <div className="grid gap-2">
        {data.codes.map(code => {
          const state = stateOf(code, Date.parse(data.now));
          return <article key={code.id} className={`grid gap-1 rounded-field border border-line bg-bg p-3 ${state ? "opacity-75" : ""}`}>
            <div className="flex flex-wrap items-center gap-2">
              <strong className="font-mono text-ink">{code.code}</strong>
              <span className="text-muted">{describeCode(code)}</span>
              {state ? <Tag>{state}</Tag> : <Tag tone="accent">Vigente</Tag>}
            </div>
            <p className="m-0 text-muted">
              {code.maxUses !== null ? `${code.uses} de ${code.maxUses} usos` : `${code.uses} ${code.uses === 1 ? "uso" : "usos"}`}
              {code.maxUsesPerCustomer !== null && ` · hasta ${code.maxUsesPerCustomer} por persona`}
              {code.validFrom && ` · desde el ${dayLabel(businessDate(code.validFrom))}`}
              {code.validUntil && ` · hasta el ${dayLabel(businessDate(code.validUntil))}`}
              {code.turnTypeId && ` · solo ${typeName(code.turnTypeId)}`}
            </p>
            {code.note && <p className="m-0 text-muted italic">{code.note}</p>}
            <div><Button disabled={editing !== null} onClick={() => setEditing(code)}>Editar</Button></div>
          </article>;
        })}
      </div>)}
  </>;
}
