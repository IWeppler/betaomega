"use client";

import { useDeferredValue, useState } from "react";
import { EmptyState, PageHeader, useSite } from "@/platform/panel";
import { statusLabels, type AgendaBooking } from "../domain/agenda";
import { bookingStatuses } from "../domain/booking";
import { BookingCard } from "./booking-card";
import { Button, Field, inputClass, Notice } from "./controls";
import { useResource } from "./use-resource";

type Result = { now: string; bookings: AgendaBooking[]; rooms: Record<string, string> };

export function ReservasScreen() {
  const site = useSite();
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const query = useDeferredValue(text.trim());
  const { data, error, reload, loading } = useResource<Result>(`/api/sites/${site.id}/sauna/bookings?q=${encodeURIComponent(query)}&status=${status}`, { live: true });
  return <>
    <PageHeader title="Reservas" description="Buscá por nombre o por WhatsApp. Se muestran las 100 más recientes." />
    <div className="mb-4 grid gap-3 sm:grid-cols-2">
      <Field label="Buscar"><input className={inputClass} type="search" value={text} maxLength={80} onChange={event => setText(event.target.value)} /></Field>
      <Field label="Estado">
        <select className={inputClass} value={status} onChange={event => setStatus(event.target.value)}>
          <option value="">Todos</option>
          {bookingStatuses.map(item => <option key={item} value={item}>{statusLabels[item]}</option>)}
        </select>
      </Field>
    </div>
    {error && <div className="mb-3 grid justify-items-start gap-2"><Notice kind="error">{error}</Notice><Button onClick={() => void reload()}>Reintentar</Button></div>}
    {loading && !data && <p className="text-muted" aria-busy="true">Buscando…</p>}
    {data && (data.bookings.length === 0
      ? <EmptyState title="No hay reservas" text={query || status ? "Probá con otra búsqueda." : "Cuando alguien reserve desde el sitio, aparece acá."} />
      : <div className="grid gap-2" aria-busy={loading}>
        {data.bookings.map(booking => <BookingCard key={booking.id} booking={booking} now={data.now} roomName={data.rooms[booking.roomId]} showTurn onChanged={reload} />)}
      </div>)}
  </>;
}
