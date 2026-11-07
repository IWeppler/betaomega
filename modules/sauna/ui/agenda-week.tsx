"use client";

import { Fragment } from "react";
import { agendaRows, cellInstant, type AgendaBooking } from "../domain/agenda";
import { effectiveStatus } from "../domain/booking";
import { bandsOfDay, type TimeBand } from "../domain/hours";
import type { ClosureEntry } from "../domain/setup";
import { addDays, businessDate, businessTime, dayLabel, shortDayLabel, weekdayOf } from "../domain/time";
import { nowPosition, weekBlocks, type BlockTone, type WeekBlock } from "../domain/week";

const toneClass: Record<BlockTone, string> = {
  confirmed: "border-l-4 border-accent bg-accent-soft text-ink",
  unpaid: "border-l-4 border-warn-line bg-warn-bg text-warn-ink",
  refund: "border-l-4 border-danger bg-warn-bg text-danger",
  done: "border-l-4 border-line-strong bg-sunken text-muted",
  closure: "border border-dashed border-line-strong bg-sunken text-muted",
};

const legend: { tone: BlockTone; label: string }[] = [
  { tone: "confirmed", label: "Confirmada" },
  { tone: "unpaid", label: "Falta la seña" },
  { tone: "refund", label: "Pago para devolver" },
  { tone: "closure", label: "Ocupado" },
];

/** The words of a block: what it is and what is missing, for whoever attends. */
function blockStatus(block: WeekBlock, now: string): string {
  if (!block.booking) return block.closure?.reason || "Ocupado";
  if (block.tone === "refund") return "Pago para devolver";
  const status = effectiveStatus(block.booking, now);
  if (status === "pending_transfer") return "Espera transferencia";
  if (status === "held") return "Falta la seña";
  if (status === "completed") return "Asistió";
  if (status === "no_show") return "No vino";
  return block.booking.kind === "private" ? "Grupal" : "Confirmada";
}

export function WeekLegend() {
  return <ul className="m-0 mb-3 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-sm text-muted" aria-label="Colores de la grilla">
    {legend.map(item => <li key={item.tone} className="flex items-center gap-1.5"><span className={`size-3.5 rounded-sm ${toneClass[item.tone]}`} aria-hidden="true" />{item.label}</li>)}
  </ul>;
}

/**
 * The week as a calendar: free starts are empty cells to pick, hours outside opening are shaded, and every booking or closure is one block over the rows of
 * its time. Picking a cell or a block opens it in the side panel.
 */
export function WeekAgenda({ from, bands, stepMinutes, bookings, closures, now, selected, onSelect }: {
  from: string; bands: TimeBand[]; stepMinutes: number; bookings: AgendaBooking[]; closures: ClosureEntry[]; now: string;
  selected: string | null; onSelect: (key: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(from, index));
  const rows = agendaRows(bands, stepMinutes);
  if (!rows.length) return <p className="text-muted">Todavía no hay horarios de atención. Cargalos en Horarios y precios.</p>;
  const today = businessDate(now);
  const blocks = weekBlocks({ from, rows, stepMinutes, bookings, closures, now });
  const line = nowPosition({ from, rows, stepMinutes, now });
  // A cell under a block is not a separate stop for the keyboard or a screen reader: the block is.
  const covered = new Set(blocks.flatMap(block => Array.from({ length: block.lastRow - block.firstRow + 1 }, (_, offset) => `${days[block.dayIndex]}|${rows[block.firstRow + offset]}`)));
  return <>
    <WeekLegend />
    <div className="min-w-0 overflow-x-auto rounded-card border border-line" tabIndex={0} role="region" aria-label="Grilla semanal de horarios">
      {/* Rows are the configured start interval; each keeps the height of a control so a block of one row still reads. */}
      <div className="grid min-w-160 grid-cols-[4rem_repeat(7,minmax(0,1fr))] gap-px bg-line lg:min-w-0" style={{ gridTemplateRows: `auto repeat(${rows.length}, var(--spacing-control))` }}>
        <span className="sticky left-0 z-20 bg-surface p-2 text-sm text-muted" style={{ gridColumn: 1, gridRow: 1 }}>Hora</span>
        {days.map((day, index) => <span key={day} aria-current={day === today ? "date" : undefined} className={`grid gap-0.5 p-2 first-letter:uppercase ${day === today ? "bg-accent-soft text-accent-text" : "bg-surface text-ink"}`} style={{ gridColumn: index + 2, gridRow: 1 }}>
          <span className="font-semibold first-letter:uppercase">{shortDayLabel(day)}</span>
          {day === today && <span className="text-xs font-semibold">Hoy</span>}
        </span>)}
        {rows.map((clock, rowIndex) => <Fragment key={clock}>
          <span className="sticky left-0 z-20 bg-surface px-2 pt-1 text-sm text-muted tabular-nums" style={{ gridColumn: 1, gridRow: rowIndex + 2 }}>{clock}</span>
          {days.map((day, dayIndex) => {
            const key = `${day}|${clock}`;
            const startsAt = cellInstant(day, clock);
            const past = Date.parse(startsAt) + stepMinutes * 60_000 <= Date.parse(now);
            const open = bandsOfDay(bands, weekdayOf(day)).some(band => clock >= band.from && clock < band.to);
            const hidden = covered.has(key);
            const label = open ? (past ? "Horario pasado" : "Libre") : "Fuera del horario de atención";
            const surface = !open ? "bg-sunken" : past ? "bg-sunken/50" : day === today ? "bg-accent-soft/40 hover:bg-sunken" : "bg-surface hover:bg-sunken";
            return <button key={day} type="button" tabIndex={hidden ? -1 : undefined} aria-hidden={hidden || undefined} aria-pressed={selected === key} aria-label={`${dayLabel(day)}, ${clock}: ${label}`} onClick={() => onSelect(key)}
              className={`min-w-0 ${surface} ${selected === key ? "outline-2 -outline-offset-2 outline-accent" : ""}`}
              style={{ gridColumn: dayIndex + 2, gridRow: rowIndex + 2 }} />;
          })}
        </Fragment>)}
        {blocks.map(block => {
          const day = days[block.dayIndex];
          const key = `${day}|${rows[block.firstRow]}`;
          const time = `${businessTime(block.startsAt)} a ${businessTime(block.endsAt)}`;
          const status = blockStatus(block, now);
          const who = block.booking ? block.booking.customerName || "Sin nombre" : "Ocupado";
          const tall = block.lastRow > block.firstRow;
          return <button key={block.key} type="button" aria-pressed={selected === key}
            aria-label={`${dayLabel(day)}, ${time}: ${who}${block.booking?.typeName ? `, ${block.booking.typeName}` : ""}, ${status}`}
            onClick={() => onSelect(key)}
            className={`z-10 m-0.5 grid min-w-0 content-start overflow-hidden rounded-field px-1.5 py-1 text-left text-xs/tight ${toneClass[block.tone]} ${block.past ? "opacity-60" : ""} ${selected === key ? "outline-2 outline-offset-1 outline-focus" : ""}`}
            style={{ gridColumn: block.dayIndex + 2, gridRow: `${block.firstRow + 2} / ${block.lastRow + 3}`, justifySelf: "start", width: `calc(${100 / block.lanes}% - 0.25rem)`, marginLeft: `calc(${(block.lane * 100) / block.lanes}% + 0.125rem)` }}>
            <span className="truncate font-semibold">{who}</span>
            {tall && <span className="truncate tabular-nums">{time}</span>}
            {tall && <span className="truncate">{status}</span>}
          </button>;
        })}
        {line && <span aria-hidden="true" className="pointer-events-none relative z-20" style={{ gridColumn: line.dayIndex + 2, gridRow: `2 / ${rows.length + 2}` }}>
          <span className="absolute inset-x-0 h-0.5 bg-accent" style={{ top: `${line.fraction * 100}%` }}>
            <span className="absolute -top-1 -left-1 size-2.5 rounded-full bg-accent" />
          </span>
        </span>}
      </div>
    </div>
  </>;
}
