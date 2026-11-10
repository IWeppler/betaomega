"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { formatCents } from "@/platform/money";
import { PageHeader, useSite } from "@/platform/panel";
import { showToast } from "@/shared/ui/toast";
import { bookingActions, moneyState, type AgendaBooking, type AgendaTurn } from "../domain/agenda";
import { effectiveStatus } from "../domain/booking";
import { reminderMessage, whatsappLink } from "../domain/messages";
import { newBookings, summaryOf, type DayLoad, type PendingReason } from "../domain/summary";
import { addDays, businessDate, businessTime, dayLabel, shortDayLabel } from "../domain/time";
import { announceWhatsapp, BookingCard, BookingTags, messageOf, StatusTag } from "./booking-card";
import { CancelBookingDialog, SwipeRow } from "./cancel-booking";
import { Button, buttonClass, Card, Notice, Tag } from "./controls";
import { PreferredDays } from "./preferred-days";
import { useResource } from "./use-resource";

type Agenda = { now: string; bookings: AgendaBooking[]; rooms: Record<string, string> };

/** How many items of "Para resolver" fit before sending the person to Reservas. */
const PENDING_SHOWN = 5;
const reasonLabels: Record<PendingReason, string> = { refund: "Pago para devolver", attendance: "Marcar asistencia", confirm: "Sin confirmar" };

function Figure({ label, value, note, tone = "plain" }: { label: string; value: string | number; note: string; tone?: "plain" | "warn" }) {
  return <Card className={`grid content-start gap-1 ${tone === "warn" ? "border-warn-line" : ""}`}>
    <span className="text-sm text-muted">{label}</span>
    <strong className={`text-2xl tabular-nums ${tone === "warn" ? "text-warn-ink" : "text-ink"}`}>{value}</strong>
    <span className="text-sm text-muted">{note}</span>
  </Card>;
}

function SectionTitle({ id, children, action }: { id: string; children: ReactNode; action?: ReactNode }) {
  return <div className="mb-3 flex items-center justify-between gap-2">
    <h2 id={id} className="m-0 text-base font-semibold text-ink">{children}</h2>
    {action}
  </div>;
}

function TodayTurn({ turn, now, roomName, next, onCancel }: { turn: AgendaTurn; now: string; roomName?: string; next: boolean; onCancel: (booking: AgendaBooking) => void }) {
  const site = useSite();
  const past = Date.parse(turn.endsAt) <= Date.parse(now);
  const people = turn.bookings.reduce((sum, booking) => sum + booking.seats, 0);
  return <li className={`grid gap-2 rounded-field border p-3 sm:grid-cols-[5.5rem_minmax(0,1fr)] ${next ? "border-accent bg-accent-wash" : "border-line bg-bg"} ${past ? "opacity-60" : ""}`}>
    <div className="flex items-baseline gap-2 sm:grid sm:content-start sm:gap-0">
      <strong className="text-lg text-ink tabular-nums">{businessTime(turn.startsAt)}</strong>
      <span className="text-sm text-muted tabular-nums">a {businessTime(turn.endsAt)}</span>
    </div>
    <div className="grid min-w-0 gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-ink">{turn.typeName}</span>
        {roomName && <span className="text-muted">· {roomName}</span>}
        <span className="text-muted">· {people} {people === 1 ? "persona" : "personas"}</span>
        {next && <Tag tone="accent">{Date.parse(turn.startsAt) <= Date.parse(now) ? "En curso" : "Próximo"}</Tag>}
      </div>
      <ul className="grid gap-1">
        {turn.bookings.map(booking => {
          const status = effectiveStatus(booking, now);
          const owed = moneyState(booking).owedCents;
          const remind = !past && booking.customerWhatsapp && (status === "confirmed" || status === "held" || status === "pending_transfer");
          const name = booking.customerName || "Persona anonimizada";
          return <li key={booking.id} className="text-sm">
            <SwipeRow label={`Cancelar la reserva de ${name}`} onDelete={bookingActions(booking, now).cancel ? () => onCancel(booking) : undefined}>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-ink">{name}{booking.seats > 1 ? ` (${booking.seats})` : ""}</span>
              <StatusTag status={status} />
              <BookingTags booking={booking} />
              {owed > 0 && status !== "no_show" && <span className="text-muted">Cobrar {formatCents(owed)}</span>}
            </div>
            {remind && booking.customerWhatsapp && <a className={`${buttonClass()} shrink-0`} href={whatsappLink(booking.customerWhatsapp, reminderMessage(messageOf(booking, site)))} target="_blank" rel="noopener noreferrer"
              aria-label={`Enviar recordatorio por WhatsApp a ${booking.customerName || "la persona"}`} onClick={() => announceWhatsapp("recordatorio", booking)}>
              <FaWhatsapp size={16} aria-hidden="true" /><span className="hidden sm:inline">Recordatorio</span>
            </a>}
            </SwipeRow>
          </li>;
        })}
      </ul>
    </div>
  </li>;
}

function Week({ days, today }: { days: DayLoad[]; today: string }) {
  const most = Math.max(1, ...days.map(day => day.people));
  return <ul className="grid gap-2">
    {days.map(day => <li key={day.day} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 text-sm">
      <span className={`first-letter:uppercase ${day.day === today ? "font-semibold text-ink" : "text-muted"}`}>{day.day === today ? "Hoy" : shortDayLabel(day.day)}</span>
      <span className="h-2 overflow-hidden rounded-control bg-sunken" aria-hidden="true">
        {/* The width comes from the data (docs/DESIGN-SYSTEM.md §1). */}
        <span className="block h-full rounded-control bg-accent" style={{ width: `${(day.people / most) * 100}%` }} />
      </span>
      <span className="text-ink tabular-nums">{day.people} <span className="text-muted">{day.people === 1 ? "persona" : "personas"}</span></span>
    </li>)}
  </ul>;
}

export function SaunaSummary() {
  const site = useSite();
  const [today] = useState(() => businessDate(new Date().toISOString()));
  // A week back for attendance not marked yet, a month ahead for bookings waiting for confirmation.
  const { data, error, reload } = useResource<Agenda>(`/api/sites/${site.id}/sauna/agenda?from=${addDays(today, -7)}&to=${addDays(today, 30)}`, { live: true });
  const summary = data ? summaryOf(data.bookings, data.now) : null;
  // The screen already refreshes every few minutes and on focus: what is new since the last answer is a booking that just came in.
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!data) return;
    const fresh = newBookings(seen.current, data.bookings, data.now);
    seen.current = new Set(data.bookings.map(booking => booking.id));
    if (!fresh.length) return;
    const [first] = fresh;
    showToast(fresh.length === 1
      ? `Nueva reserva: ${first.customerName || "una persona"}, ${dayLabel(businessDate(first.startsAt))} a las ${businessTime(first.startsAt)}.`
      : `Llegaron ${fresh.length} reservas nuevas.`, 8000);
  }, [data]);
  const [cancelling, setCancelling] = useState<AgendaBooking | null>(null);
  const weekPeople = summary?.week.reduce((sum, day) => sum + day.people, 0) ?? 0;
  const agenda = `/${site.id}/agenda`;
  return <>
    <PageHeader title="Resumen" description={`Hoy es ${dayLabel(today)}.`} actions={<Link className={buttonClass("primary")} href={agenda}><CalendarDays size={16} aria-hidden="true" />Ver la agenda</Link>} />
    {error && <div className="mb-3 grid justify-items-start gap-2"><Notice kind="error">{error}</Notice><Button onClick={() => void reload()}>Reintentar</Button></div>}
    {!data && !error && <p className="text-muted" aria-busy="true">Cargando…</p>}
    {data && summary && <div className="grid min-w-0 gap-4">
      {Object.keys(data.rooms).length === 0 && <Notice>Para empezar, creá los tipos de turno y cargá los días y las horas en <Link className="font-semibold text-warn-ink" href={`/${site.id}/horarios-precios`}>Horarios y precios</Link>.</Notice>}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Números">
        <Figure label="Personas hoy" value={summary.peopleToday} note={`${summary.bookingsToday} ${summary.bookingsToday === 1 ? "reserva" : "reservas"}`} />
        <Figure label="Por cobrar hoy" value={formatCents(summary.owedTodayCents)} note="En el lugar o pendiente" />
        <Figure label="Para resolver" value={summary.pending.length} note={summary.pending.length ? "Esperan una acción" : "Nada pendiente"} tone={summary.pending.length ? "warn" : "plain"} />
        <Figure label="Próximos 7 días" value={weekPeople} note={weekPeople === 1 ? "persona" : "personas"} />
      </section>
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <Card className="min-w-0">
          <section aria-labelledby="today-title">
            <SectionTitle id="today-title" action={<Link className="text-sm font-semibold text-accent-text" href={agenda}>Abrir el día</Link>}>Turnos de hoy</SectionTitle>
            {summary.today.length
              ? <ol className="grid gap-2">{summary.today.map(turn => <TodayTurn key={turn.key} turn={turn} now={data.now} roomName={data.rooms[turn.roomId]} next={turn.key === summary.nextTurnKey} onCancel={setCancelling} />)}</ol>
              : <div className="grid gap-3">
                <p className="m-0 text-muted">Hoy no hay turnos reservados.</p>
                {summary.nextDay && <>
                  <h3 className="m-0 text-sm font-semibold text-ink first-letter:uppercase">El próximo: {dayLabel(summary.nextDay.day)}</h3>
                  <ol className="grid gap-2">{summary.nextDay.turns.map(turn => <TodayTurn key={turn.key} turn={turn} now={data.now} roomName={data.rooms[turn.roomId]} next={false} onCancel={setCancelling} />)}</ol>
                </>}
              </div>}
          </section>
        </Card>
        <div className="grid min-w-0 gap-4">
          <Card>
            <section aria-labelledby="pending-title">
              <SectionTitle id="pending-title" action={summary.pending.length > PENDING_SHOWN && <Link className="text-sm font-semibold text-accent-text" href={`/${site.id}/reservas`}>Ver todas</Link>}>Para resolver</SectionTitle>
              {summary.pending.length
                ? <ul className="grid gap-3">
                  {summary.pending.slice(0, PENDING_SHOWN).map(({ reason, booking }) => <li key={booking.id} className="grid gap-1">
                    <span className="text-sm font-semibold text-warn-ink">{reasonLabels[reason]}</span>
                    <BookingCard booking={booking} now={data.now} roomName={data.rooms[booking.roomId]} showTurn onChanged={reload} />
                  </li>)}
                </ul>
                : <p className="m-0 flex items-center gap-2 text-muted"><CheckCircle2 size={18} className="text-accent-text" aria-hidden="true" />Todo en orden.</p>}
            </section>
          </Card>
          <Card>
            <section aria-labelledby="week-title">
              <SectionTitle id="week-title">Próximos 7 días</SectionTitle>
              <Week days={summary.week} today={today} />
            </section>
          </Card>
          <PreferredDays />
        </div>
      </div>
      <CancelBookingDialog booking={cancelling} onClose={() => setCancelling(null)} onChanged={reload} />
    </div>}
  </>;
}
