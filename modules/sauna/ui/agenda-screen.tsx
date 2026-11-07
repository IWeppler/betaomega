"use client";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader, useSite } from "@/platform/panel";
import { agendaByDay, agendaRange, cellInstant, dayClosureState, moveAgenda, type AgendaBooking, type AgendaView } from "../domain/agenda";
import { isCurrent } from "../domain/booking";
import { bandsOfDay, type TimeBand } from "../domain/hours";
import type { ClosureEntry } from "../domain/setup";
import { addDays, businessDate, dayLabel, monthLabel, startOfWeek, shortDayLabel, weekdayOf } from "../domain/time";
import { AgendaAside, daySelection, type AgendaSelection } from "./agenda-aside";
import { DayAgenda, MonthAgenda } from "./agenda-views";
import { WeekAgenda } from "./agenda-week";
import { Button, Notice } from "./controls";
import { useResource } from "./use-resource";
import { useManualBookingDraft } from "./use-manual-booking-draft";
type Agenda = { now: string; closures: ClosureEntry[]; bookings: AgendaBooking[]; rooms: Record<string, string>; bands: TimeBand[]; stepMinutes: number };
const views: { id: AgendaView; label: string }[] = [{ id: "day", label: "Día" }, { id: "week", label: "Semana" }, { id: "month", label: "Mes" }];
const heading = (view: AgendaView, date: string) => {
  if (view === "day") return dayLabel(date);
  if (view === "month") return monthLabel(date);
  const monday = startOfWeek(date);
  return `${shortDayLabel(monday)} al ${shortDayLabel(addDays(monday, 6))}`;
};
export function AgendaScreen() {
  const site = useSite();
  const manual = useManualBookingDraft();
  const [created, setCreated] = useState(false);
  const [today] = useState(() => businessDate(new Date().toISOString()));
  const [view, setView] = useState<AgendaView>("day");
  const [date, setDate] = useState(today);
  const [selected, setSelected] = useState<string | null>(today);
  const aside = useRef<HTMLElement>(null);
  const { from, to } = agendaRange(view, date);
  const { data, error, reload, loading } = useResource<Agenda>(`/api/sites/${site.id}/sauna/agenda?from=${from}&to=${to}`, { live: true });
  const days = data ? agendaByDay(data.bookings, data.now) : null;
  const bookings = data?.bookings.filter(booking => isCurrent(booking, data.now)) ?? [];
  const select = (key: string) => {
    if (manual.busy) return;
    setSelected(key);
    if (window.matchMedia("(max-width: 1023px)").matches) requestAnimationFrame(() => aside.current?.scrollIntoView({ behavior: "instant", block: "start" }));
  };
  const navigate = (nextView: AgendaView, nextDate: string) => {
    if (manual.busy) return;
    const range = agendaRange(nextView, nextDate);
    setView(nextView); setDate(nextDate);
    setSelected(current => {
      if (nextView === "day") return nextDate;
      if (!current || current.slice(0, 10) < range.from || current.slice(0, 10) > range.to) return null;
      return nextView === "month" ? current.slice(0, 10) : current;
    });
  };
  let selection: AgendaSelection | null = null;
  if (selected && data) {
    const [day, clock] = selected.split("|");
    if (!clock) selection = daySelection(day);
    else {
      const startsAt = cellInstant(day, clock);
      selection = { day, clock, startsAt, endsAt: new Date(Date.parse(startsAt) + data.stepMinutes * 60_000).toISOString(), open: bandsOfDay(data.bands, weekdayOf(day)).some(band => clock >= band.from && clock < band.to) };
    }
  }
  return <>
    <PageHeader title="Agenda" />
    {created && <p role="status" className="rounded-field border border-line bg-surface px-3 py-2 text-ink">La reserva se creó confirmada, con el total pendiente de cobro y la aceptación de condiciones del cliente pendiente.</p>}
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <Button aria-label="Anterior" onClick={() => navigate(view, moveAgenda(view, date, -1))}><ChevronLeft size={18} aria-hidden="true" /></Button>
        <h2 className="m-0 text-base font-semibold text-ink first-letter:uppercase sm:text-lg" aria-live="polite">{heading(view, date)}</h2>
        <Button aria-label="Siguiente" onClick={() => navigate(view, moveAgenda(view, date, 1))}><ChevronRight size={18} aria-hidden="true" /></Button>
      </div>
      <div className="inline-flex overflow-hidden rounded-control border border-line-strong" role="group" aria-label="Vista">
        {views.map(item => <button key={item.id} type="button" className={`min-h-control px-4 font-semibold ${view === item.id ? "bg-accent text-accent-ink" : "bg-surface text-ink hover:bg-sunken"}`} aria-pressed={view === item.id} onClick={() => navigate(item.id, date)}>{item.label}</button>)}
      </div>
    </div>
    {error && <div className="mb-3 grid justify-items-start gap-2"><Notice kind="error">{error}</Notice><Button onClick={() => void reload()}>Reintentar</Button></div>}
    {loading && !data && <p className="text-muted" aria-busy="true">Cargando la agenda…</p>}
    {data && days && <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]" aria-busy={loading}>
      <div className="min-w-0">
        {view === "day" && <DayAgenda turns={days.get(date) ?? []} closed={dayClosureState(date, data.closures) !== null} rooms={data.rooms} now={data.now} onChanged={reload} />}
        {view === "week" && <WeekAgenda from={from} bands={data.bands} stepMinutes={data.stepMinutes} bookings={bookings} closures={data.closures} selected={selected} onSelect={select} />}
        {view === "month" && <MonthAgenda date={date} days={days} closureState={day => dayClosureState(day, data.closures)} today={today} selected={selected} onOpen={select} />}
      </div>
      <aside ref={aside} className="min-w-0 scroll-mt-4 lg:sticky lg:top-4 lg:self-start" aria-label="Detalle de la selección">
        <AgendaAside key={selected} selection={selection} siteId={site.id} closures={data.closures} bookings={bookings} now={data.now} onChanged={reload} onOpenDay={day => navigate("day", day)} editor={{ draft: manual.draft, onDraftChange: next => { setCreated(false); manual.update(next); }, onDiscard: manual.discard, saving: manual.busy, onSavingChange: manual.setSaving, onCreated: async () => { manual.clear(); setCreated(true); await reload(); } }} />
      </aside>
    </div>}
    {manual.dialog}
  </>;
}
