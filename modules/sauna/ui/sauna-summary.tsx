"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader, useSite } from "@/platform/panel";
import { agendaByDay, peopleOf, type AgendaBooking } from "../domain/agenda";
import { effectiveStatus } from "../domain/booking";
import { addDays, businessDate } from "../domain/time";
import { Button, buttonClass, Card, Notice } from "./controls";
import { useResource } from "./use-resource";

type Agenda = { now: string; bookings: AgendaBooking[]; rooms: Record<string, string> };

function Figure({ label, value }: { label: string; value: number }) {
  return <Card className="grid gap-1"><span className="text-muted">{label}</span><strong className="text-2xl text-ink tabular-nums">{value}</strong></Card>;
}

export function SaunaSummary() {
  const site = useSite();
  const [today] = useState(() => businessDate(new Date().toISOString()));
  const tomorrow = addDays(today, 1);
  const { data, error, reload } = useResource<Agenda>(`/api/sites/${site.id}/sauna/agenda?from=${today}&to=${tomorrow}`, { live: true });
  const days = data ? agendaByDay(data.bookings, data.now) : null;
  const waiting = data?.bookings.filter(booking => ["held", "pending_transfer"].includes(effectiveStatus(booking, data.now))).length ?? 0;
  return <>
    <PageHeader title="Resumen" actions={<Link className={buttonClass("primary")} href={`/${site.id}/agenda`}>Ver la agenda</Link>} />
    {error && <div className="mb-3 grid justify-items-start gap-2"><Notice kind="error">{error}</Notice><Button onClick={() => void reload()}>Reintentar</Button></div>}
    {!data && !error && <p className="text-muted" aria-busy="true">Cargando…</p>}
    {data && days && <div className="grid gap-4">
      {Object.keys(data.rooms).length === 0 && <Notice>Para empezar, creá los tipos de turno y cargá los días y las horas en <Link className="font-semibold text-warn-ink" href={`/${site.id}/horarios-precios`}>Horarios y precios</Link>.</Notice>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Figure label="Personas hoy" value={peopleOf(days.get(today) ?? [])} />
        <Figure label="Personas mañana" value={peopleOf(days.get(tomorrow) ?? [])} />
        <Figure label="Reservas sin confirmar" value={waiting} />
      </div>
    </div>}
  </>;
}
