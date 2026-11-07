"use client";

import { Fragment } from "react";
import { agendaRows, cellInstant, closuresOfRange, type AgendaBooking } from "../domain/agenda";
import { bandsOfDay, type TimeBand } from "../domain/hours";
import type { ClosureEntry } from "../domain/setup";
import { addDays, dayLabel, shortDayLabel, weekdayOf } from "../domain/time";

export function WeekAgenda({ from, bands, stepMinutes, bookings, closures, selected, onSelect }: {
  from: string; bands: TimeBand[]; stepMinutes: number; bookings: AgendaBooking[]; closures: ClosureEntry[];
  selected: string | null; onSelect: (key: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(from, index));
  const rows = agendaRows(bands, stepMinutes);
  if (!rows.length) return <p className="text-muted">Todavía no hay horarios de atención.</p>;
  return <div className="min-w-0 overflow-x-auto rounded-card border border-line" tabIndex={0} role="region" aria-label="Grilla semanal de horarios">
    {/* Fixed hour column and seven readable day columns scroll inside the available space. */}
    <div className="grid min-w-160 grid-cols-[4rem_repeat(7,minmax(0,1fr))] gap-px bg-line lg:min-w-0">
      <span className="sticky left-0 z-10 bg-surface p-2 text-sm text-muted">Hora</span>
      {days.map(day => <span key={day} className="bg-surface p-2 font-semibold first-letter:uppercase">{shortDayLabel(day)}</span>)}
      {rows.map(clock => <Fragment key={clock}>
        <span className="sticky left-0 z-10 bg-surface p-2 text-sm text-muted tabular-nums">{clock}</span>
        {days.map(day => {
          const startsAt = cellInstant(day, clock);
          const endsAt = new Date(Date.parse(startsAt) + stepMinutes * 60_000).toISOString();
          const open = bandsOfDay(bands, weekdayOf(day)).some(band => clock >= band.from && clock < band.to);
          const occupied = closuresOfRange(startsAt, endsAt, closures).length > 0;
          const reserved = bookings.filter(booking => Date.parse(booking.startsAt) < Date.parse(endsAt) && Date.parse(booking.endsAt) > Date.parse(startsAt));
          const label = reserved.length ? `Reservada: ${reserved.map(booking => booking.customerName || "Sin nombre").join(", ")}${occupied ? ", Ocupado" : ""}` : occupied ? "Ocupado" : open ? "Libre" : "Fuera del horario de atención";
          const key = `${day}|${clock}`;
          return <button key={day} type="button" aria-pressed={selected === key} aria-label={`${dayLabel(day)}, ${clock}: ${label}`} onClick={() => onSelect(key)} className={`min-h-control p-2 text-left text-sm break-words ${selected === key ? "bg-accent-soft text-accent-text outline-2 -outline-offset-2 outline-accent" : reserved.length || occupied ? "bg-accent-wash text-ink" : open ? "bg-surface text-ink hover:bg-sunken" : "bg-sunken text-muted"}`}>{label}</button>;
        })}
      </Fragment>)}
    </div>
  </div>;
}
