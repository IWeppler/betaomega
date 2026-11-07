"use client";

import { useState } from "react";
import { showToast } from "@/shared/ui/toast";
import { closuresOfRange, type AgendaBooking } from "../domain/agenda";
import type { ClosureEntry } from "../domain/setup";
import { addDays, businessDate, businessDayStart, businessTime, dayLabel } from "../domain/time";
import { BookingCard } from "./booking-card";
import { AgendaReservationEntry, type ManualBookingEditor } from "./agenda-reservation-entry";
import { Button, Card, Field, inputClass, Notice } from "./controls";
import { sendJson } from "./fetch-json";

export type AgendaSelection = { day: string; startsAt: string; endsAt: string; clock?: string; open: boolean };
const stamp = (instant: string) => `${dayLabel(businessDate(instant))}, ${businessTime(instant)}`;

export function AgendaAside({ selection, siteId, closures, bookings, now, onChanged, onOpenDay, editor }: {
  selection: AgendaSelection | null; siteId: string; closures: ClosureEntry[]; bookings: AgendaBooking[]; now: string;
  onChanged: () => Promise<void>; onOpenDay: (day: string) => void;
  editor: ManualBookingEditor;
}) {
  const [reason, setReason] = useState("");
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (method: "POST" | "DELETE", body?: object, id?: string) => {
    setBusy(true); setError("");
    try {
      await sendJson(`/api/sites/${siteId}/sauna/closures${id ? `?id=${id}` : ""}`, method, body);
      await onChanged();
      setAsking(false); setReason("");
      showToast(method === "DELETE" ? "Se liberó el horario." : "Se marcó como ocupado.");
    } catch (failure) { setError((failure as Error).message); } finally { setBusy(false); }
  };
  if (!selection) return <Card>Elegí un horario o un día</Card>;
  const { day, startsAt, endsAt, clock, open } = selection;
  const occupied = closuresOfRange(startsAt, endsAt, closures);
  const selectedBookings = bookings.filter(booking => Date.parse(booking.startsAt) < Date.parse(endsAt) && Date.parse(booking.endsAt) > Date.parse(startsAt));
  // A day remains actionable until its end; an individual start is read-only once it passes.
  const past = Date.parse(clock ? startsAt : endsAt) <= Date.parse(now);
  const today = day === businessDate(now);
  return <Card className="grid gap-3">
    <h2 className="m-0 text-lg font-semibold text-ink first-letter:uppercase">{dayLabel(day)}{clock ? `, ${clock}` : ""}</h2>
    {!clock && <><p className="m-0 text-muted">{selectedBookings.length} reservas</p><Button onClick={() => onOpenDay(day)}>Ver día</Button></>}
    {!past && open && (!clock || (!occupied.length && !selectedBookings.length)) && <AgendaReservationEntry siteId={siteId} day={day} clock={clock} now={now} {...editor} />}
    {selectedBookings.map(booking => <BookingCard key={booking.id} booking={booking} now={now} onChanged={onChanged} />)}
    {occupied.map(closure => {
      const wider = Date.parse(closure.startsAt) < Date.parse(startsAt) || Date.parse(closure.endsAt) > Date.parse(endsAt);
      return <div key={closure.id} className="grid gap-2 border-t border-line pt-3">
        <strong>Ocupado</strong><p className="m-0 text-muted">{closure.reason || "Sin motivo"}</p>
        <p className="m-0 text-sm text-muted">{stamp(closure.startsAt)} al {stamp(closure.endsAt)}</p>
        {wider && <Notice>Este cierre va del {stamp(closure.startsAt)} al {stamp(closure.endsAt)} y se libera completo</Notice>}
        {!past && <Button disabled={busy || editor.saving} onClick={() => void run("DELETE", undefined, closure.id)}>Liberar</Button>}
      </div>;
    })}
    {past ? <p className="m-0 text-muted">Horario pasado. Solo lectura.</p> : <>
      {!open && clock && <p className="m-0 text-muted">Fuera del horario de atención.</p>}
      {open && !occupied.length && <>
        <Field label="Motivo (opcional)"><input className={inputClass} value={reason} maxLength={200} onChange={event => setReason(event.target.value)} /></Field>
        {selectedBookings.length > 0 && <Notice>Las reservas ya hechas no se cancelan</Notice>}
        <Button disabled={busy || editor.saving} onClick={() => void run("POST", clock ? { startsAt, endsAt, reason } : { from: day, to: day, reason })}>{clock ? "Marcar como ocupado" : "Marcar el día como ocupado"}</Button>
      </>}
      {!clock && today && <div className="grid gap-2 border-t border-line pt-3">
        {!asking ? <Button disabled={busy || editor.saving} onClick={() => setAsking(true)}>No habilitar más turnos por hoy</Button> : <>
          <Notice>Las reservas ya hechas no se cancelan.</Notice>
          <Button variant="danger" disabled={busy || editor.saving} onClick={() => void run("POST", { today: true })}>Sí, cerrar por hoy</Button>
          <Button disabled={busy} onClick={() => setAsking(false)}>No</Button>
        </>}
      </div>}
    </>}
    {error && <Notice kind="error">{error}</Notice>}
  </Card>;
}

export const daySelection = (day: string): AgendaSelection => ({ day, startsAt: businessDayStart(day), endsAt: businessDayStart(addDays(day, 1)), open: true });
