"use client";

import { useState } from "react";
import { useSite } from "@/platform/panel";
import type { AgendaBooking } from "../domain/agenda";
import type { TimeBand } from "../domain/hours";
import { LEVELS, levelOf, preferencesOf, topHours, weekOrder, type PreferenceCell } from "../domain/preferences";
import { addDays, businessDate, weekdayName } from "../domain/time";
import { Card } from "./controls";
import { useResource } from "./use-resource";

type Agenda = { now: string; bookings: AgendaBooking[]; bands: TimeBand[] };

/** Twelve weeks back and the coming week: the agenda API reads at most 93 days. */
const WEEKS_BACK = 12;
/** Columns of the map: the most booked hours only, so it stays small. */
const HOURS_SHOWN = 5;

// One accent hue, light to dark (sequential scale). Index is the level from levelOf; 0 is an empty cell.
const levelClass = ["bg-sunken", "bg-accent/20", "bg-accent/45", "bg-accent/70", "bg-accent"];

const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")} h`;
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const cellText = (cell: PreferenceCell) => `${weekdayName(cell.weekday)} a las ${hourLabel(cell.hour)}: ${plural(cell.bookings, "reserva", "reservas")}, ${plural(cell.people, "persona", "personas")}`;

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="grid min-w-0 gap-0.5">
    <span className="text-xs text-muted">{label}</span>
    <strong className="truncate text-lg font-semibold text-ink tabular-nums first-letter:uppercase">{value}</strong>
  </div>;
}

/** When people prefer to come: a small heat map of bookings by weekday and the five most booked starting hours. */
export function PreferredDays() {
  const site = useSite();
  const [today] = useState(() => businessDate(new Date().toISOString()));
  const { data, error } = useResource<Agenda>(`/api/sites/${site.id}/sauna/agenda?from=${addDays(today, -7 * WEEKS_BACK)}&to=${addDays(today, 6)}`);
  const [shown, setShown] = useState<PreferenceCell | null>(null);
  const result = data ? preferencesOf(data.bookings, data.now, data.bands) : null;
  const hours = result ? topHours(result, HOURS_SHOWN) : [];
  const cell = (weekday: number, hour: number) => result?.rows[result.hours.indexOf(hour)][weekOrder.indexOf(weekday as (typeof weekOrder)[number])];
  // The colors scale to the fullest cell that is on screen.
  const most = Math.max(0, ...hours.flatMap(hour => weekOrder.map(weekday => cell(weekday, hour)?.bookings ?? 0)));
  return <Card>
    <section aria-labelledby="preferred-title" className="grid gap-4">
      <div className="grid gap-0.5">
        <h2 id="preferred-title" className="m-0 text-base font-semibold text-ink">Cuándo prefieren venir</h2>
        <p className="m-0 text-xs text-muted">Últimas {WEEKS_BACK} semanas y la próxima. Sin canceladas ni vencidas.</p>
      </div>
      {error && <p className="m-0 text-sm text-danger" role="alert">{error}</p>}
      {!data && !error && <p className="m-0 text-muted" aria-busy="true">Cargando…</p>}
      {result && (hours.length === 0
        ? <p className="m-0 text-muted">Todavía no hay horarios ni reservas para mostrar.</p>
        : <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Reservas" value={String(result.total)} />
            <Stat label="Día favorito" value={result.topDay === null ? "—" : weekdayName(result.topDay)} />
            <Stat label="Horario favorito" value={result.topHour === null ? "—" : hourLabel(result.topHour)} />
          </div>
          <div onMouseLeave={() => setShown(null)}>
            <table className="mx-auto border-separate border-spacing-1 text-xs">
              <caption className="sr-only">Reservas por día de la semana en los {hours.length} horarios más reservados</caption>
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">Día</span></th>
                  {hours.map(hour => <th key={hour} scope="col" className={`pb-0.5 font-normal tabular-nums ${hour === result.topHour ? "font-semibold text-ink" : "text-muted"}`}>{hourLabel(hour)}</th>)}
                </tr>
              </thead>
              <tbody>
                {weekOrder.map(weekday => <tr key={weekday}>
                  <th scope="row" className={`pr-1.5 text-right font-normal first-letter:uppercase ${weekday === result.topDay ? "font-semibold text-ink" : "text-muted"}`}>
                    <abbr title={weekdayName(weekday)} className="no-underline">{weekdayName(weekday).slice(0, 3)}</abbr>
                  </th>
                  {hours.map(hour => {
                    const item = cell(weekday, hour);
                    if (!item) return <td key={hour} />;
                    return <td key={hour} tabIndex={0} aria-label={cellText(item)} onMouseEnter={() => setShown(item)} onFocus={() => setShown(item)} onBlur={() => setShown(null)}
                      className={`size-8 rounded-field ${levelClass[levelOf(item.bookings, most)]} ${shown === item ? "outline-2 outline-offset-1 outline-ink" : ""}`}>
                      <span className="sr-only">{item.bookings}</span>
                    </td>;
                  })}
                </tr>)}
              </tbody>
            </table>
          </div>
          <p className="m-0 min-h-4 text-center text-xs text-ink" role="status">{shown ? <span className="first-letter:uppercase">{cellText(shown)}</span> : ""}</p>
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted" aria-hidden="true">
            <span>Menos</span>
            {Array.from({ length: LEVELS + 1 }, (_, level) => <span key={level} className={`size-4 rounded-control ${levelClass[level]}`} />)}
            <span>Más</span>
          </div>
        </>)}
    </section>
  </Card>;
}
