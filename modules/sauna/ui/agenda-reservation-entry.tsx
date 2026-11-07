"use client";

import { useState } from "react";
import type { Turn } from "../domain/agenda";
import { manualBookingOptions, turnKey, type ManualBookingDraft } from "../domain/manual-booking";
import { businessTime } from "../domain/time";
import { Button, Notice } from "./controls";
import { useResource } from "./use-resource";
import { ManualBookingForm } from "./manual-booking-form";

export type ManualBookingEditor = { draft: ManualBookingDraft; onDraftChange: (draft: ManualBookingDraft) => void; onDiscard: () => Promise<boolean>; saving: boolean; onSavingChange: (value: boolean) => void; onCreated: () => Promise<void> };

function TurnPicker({ siteId, day, clock, now, onBack, draft, onDraftChange, onDiscard, saving, onSavingChange, onCreated }: { siteId: string; day: string; clock?: string; now: string; onBack: () => void } & ManualBookingEditor) {
  const { data, error, loading, reload } = useResource<Turn[]>(`/api/sites/${siteId}/sauna/manual-bookings?from=${day}&to=${day}`, { live: true });
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const options = manualBookingOptions(data ?? [], day, clock, now);
  const chosen = options.find(turn => turnKey(turn) === selected);
  return <section className="grid gap-3" aria-label="Nueva reserva">
    <h3 className="m-0 text-lg font-semibold text-ink">Nueva reserva</h3>
    {loading && <p className="m-0 text-muted" aria-busy="true">Consultando los horarios disponibles…</p>}
    {error && <div className="grid justify-items-start gap-2"><Notice kind="error">{error}</Notice><Button onClick={() => void reload()}>Reintentar</Button></div>}
    {!loading && !error && <>
      {!options.length ? <p className="m-0 text-muted">{clock ? "No hay turnos disponibles que empiecen a esta hora." : "No hay turnos disponibles para este día."}</p> : !(editing && chosen) && <fieldset className="m-0 grid min-w-0 gap-2 border-0 p-0">
        <legend className="mb-2 font-semibold text-ink">Elegí un turno</legend>
        {options.map(turn => {
          const key = turnKey(turn);
          const checked = key === selected;
          return <label key={key} className={`flex min-h-control cursor-pointer items-center gap-2 rounded-field border p-3 ${checked ? "border-accent bg-accent-soft text-accent-text" : "border-line-strong bg-surface text-ink"}`}>
            <input type="radio" name="manual-turn" value={key} checked={checked} disabled={saving} onChange={() => setSelected(key)} />
            <span className="min-w-0 break-words"><strong className="block tabular-nums">{businessTime(turn.startsAt)} a {businessTime(turn.endsAt)}</strong>{turn.typeName}</span>
          </label>;
        })}
      </fieldset>}
      {selected && !chosen && <Notice>Ese turno ya no está disponible. Elegí otro.</Notice>}
      {chosen && (editing ? <ManualBookingForm key={turnKey(chosen)} siteId={siteId} turn={chosen} draft={draft} onChange={onDraftChange} onBack={() => setEditing(false)} onSavingChange={onSavingChange} onCreated={async () => { await onCreated(); onBack(); }} /> : <Button variant="primary" onClick={() => setEditing(true)}>Cargar datos</Button>)}
    </>}
    <Button disabled={saving} onClick={() => { void onDiscard().then(leave => { if (leave) onBack(); }); }}>Volver a la agenda</Button>
  </section>;
}

export function AgendaReservationEntry({ siteId, day, clock, now, ...editor }: { siteId: string; day: string; clock?: string; now: string } & ManualBookingEditor) {
  const [open, setOpen] = useState(false);
  return open ? <TurnPicker siteId={siteId} day={day} clock={clock} now={now} {...editor} onBack={() => setOpen(false)} />
    : <Button variant="primary" onClick={() => setOpen(true)}>Crear reserva</Button>;
}
