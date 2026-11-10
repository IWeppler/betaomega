"use client";

import { useId, useRef, useState } from "react";
import { formatCents } from "@/platform/money";
import { statusLabels, type Turn } from "../domain/agenda";
import { manualBookingKinds, manualBookingPreview, prepareManualBooking, turnKey, type ManualBookingDraft, type ManualBookingPreparation } from "../domain/manual-booking";
import { businessDate, businessTime, dayLabel } from "../domain/time";
import { Button, Field, inputClass, Notice } from "./controls";
import { offerUndo } from "@/shared/ui/undo";
import { sendJson } from "./fetch-json";

export function ManualBookingForm({ siteId, turn, draft, onChange, onBack, onSavingChange, onCreated, onUndone }: { /** After "Deshacer": the agenda reloads. */ onUndone: () => Promise<void>; siteId: string; turn: Turn; draft: ManualBookingDraft; onChange: (draft: ManualBookingDraft) => void; onBack: () => void; onSavingChange: (value: boolean) => void; onCreated: () => Promise<void> }) {
  const noticeId = useId();
  const [error, setError] = useState("");
  const [reviewed, setReviewed] = useState<string | null>(null);
  const [preparation, setPreparation] = useState<ManualBookingPreparation | null>(null);
  const [saving, setSaving] = useState(false);
  const flight = useRef(false);
  const request = useRef<{ signature: string; id: string } | null>(null);
  const kinds = manualBookingKinds(turn);
  const kind = kinds.includes(draft.kind) ? draft.kind : kinds[0];
  const preview = manualBookingPreview(turn, kind);
  const signature = JSON.stringify({ ...draft, kind, turn: turnKey(turn), endsAt: turn.endsAt, capacity: turn.capacity, price: preview.totalCents });
  const reviewing = reviewed === signature && preparation !== null;
  const patch = (change: Partial<ManualBookingDraft>) => { setError(""); onChange({ ...draft, ...change }); };
  const review = () => {
    setError("");
    try {
      setPreparation(prepareManualBooking(turn, { ...draft, kind }, new Date().toISOString()));
      setReviewed(signature);
    } catch (failure) { setError((failure as Error).message); }
  };
  const customer = reviewing ? preparation?.customer : null;
  const confirm = async () => {
    if (!customer || !preparation || flight.current) return;
    flight.current = true;
    setSaving(true); onSavingChange(true); setError("");
    try {
      if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
      const made = await sendJson<{ id: string }>(`/api/sites/${siteId}/sauna/manual-bookings`, "POST", {
        roomId: turn.roomId, turnTypeId: turn.turnTypeId, startsAt: turn.startsAt, kind, name: customer.name, whatsapp: customer.whatsapp,
        requestId: request.current.id, expectedPriceCents: preparation.booking.priceCents,
      });
      await onCreated();
      // Nothing was charged on a booking loaded by hand, so undoing it is cancelling it: the turn is free again and the record says why.
      offerUndo(`Se cargó la reserva de ${customer.name}.`, async () => {
        await sendJson(`/api/sites/${siteId}/sauna/bookings/${made.id}`, "PATCH", { action: "cancel", note: "Deshecha desde el panel al cargarla" });
        await onUndone();
        return `Se canceló la reserva de ${customer.name}: el turno quedó libre.`;
      });
    } catch (failure) { setError((failure as Error).message); }
    finally { flight.current = false; setSaving(false); onSavingChange(false); }
  };
  return <form className="grid min-w-0 gap-3" onSubmit={event => { event.preventDefault(); review(); }}>
    <h3 className="m-0 text-lg font-semibold text-ink">{reviewing ? "Revisá la reserva" : "Datos de la reserva"}</h3>
    <dl className="m-0 grid gap-2 rounded-field bg-sunken p-3 text-ink">
      <div><dt className="text-sm text-muted">Día y horario</dt><dd className="m-0 first-letter:uppercase">{dayLabel(businessDate(turn.startsAt))}, {businessTime(turn.startsAt)} a {businessTime(turn.endsAt)}</dd></div>
      <div><dt className="text-sm text-muted">Tipo de turno</dt><dd className="m-0">{turn.typeName} · {preview.durationMinutes} minutos</dd></div>
      <div className="flex justify-between gap-2"><dt>Precio</dt><dd className="m-0 font-semibold tabular-nums">{formatCents(preview.totalCents)}</dd></div>
      <div className="flex justify-between gap-2"><dt>Saldo sin pagos</dt><dd className="m-0 font-semibold tabular-nums">{formatCents(preview.balanceCents)}</dd></div>
    </dl>
    {reviewing && customer && preparation ? <>
      <dl className="m-0 grid gap-2 break-words text-ink">
        <div><dt className="text-sm text-muted">Modalidad</dt><dd className="m-0">{kind === "shared" ? "Individual" : "Grupal"}</dd></div>
        <div><dt className="text-sm text-muted">Nombre</dt><dd className="m-0">{customer.name}</dd></div>
        <div><dt className="text-sm text-muted">WhatsApp</dt><dd className="m-0">+{customer.whatsapp}</dd></div>
        <div><dt className="text-sm text-muted">Estado al confirmar</dt><dd className="m-0">{statusLabels[preparation.booking.status]}</dd></div>
      </dl>
      {error && <Notice kind="error">{error}</Notice>}
      <Button variant="primary" disabled={saving} aria-describedby={noticeId} onClick={() => void confirm()}>{saving ? "Creando reserva…" : "Confirmar reserva"}</Button>
      <Button disabled={saving} onClick={() => setReviewed(null)}>Seguir editando</Button>
    </> : <>
      <fieldset className="m-0 grid min-w-0 gap-2 border-0 p-0">
        <legend className="mb-2 font-semibold text-ink">Modalidad</legend>
        {kinds.map(value => <label key={value} className={`flex min-h-control items-center gap-2 rounded-field border p-3 ${kind === value ? "border-accent bg-accent-soft text-accent-text" : "border-line-strong bg-surface text-ink"}`}>
          <input type="radio" name="manual-kind" value={value} checked={kind === value} onChange={() => patch({ kind: value })} />{value === "shared" ? "Individual" : "Grupal"}
        </label>)}
      </fieldset>
      <Field label="Nombre"><input className={inputClass} name="manual-name" autoComplete="off" maxLength={80} value={draft.name} onChange={event => patch({ name: event.target.value })} required /></Field>
      <Field label="WhatsApp" hint="Número argentino con característica, sin el 0 ni el 15.">
        <span className="flex min-w-0 items-center gap-2"><span className="text-muted">+54</span><input className={`${inputClass} min-w-0`} name="manual-whatsapp" type="tel" autoComplete="off" maxLength={24} value={draft.whatsapp} onChange={event => patch({ whatsapp: event.target.value })} required /></span>
      </Field>
      {error && <Notice kind="error">{error}</Notice>}
      <Button type="submit" variant="primary">Revisar reserva</Button>
    </>}
    <Button disabled={saving} onClick={onBack}>Cambiar turno</Button>
  </form>;
}
