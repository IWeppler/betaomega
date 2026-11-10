"use client";

import { useDeferredValue, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Layers, Search, X } from "lucide-react";
import { formatCents } from "@/platform/money";
import { EmptyState, PageHeader, useSite } from "@/platform/panel";
import type { AgendaBooking } from "../domain/agenda";
import { effectiveStatus, type BookingStatus } from "../domain/booking";
import { BOOKINGS_PAGE_SIZE, chargeOf, leadOf, statusCounts, type BookingGroup, type BookingView, type Charge } from "../domain/booking-groups";
import { ledgerOf } from "../domain/payments";
import { businessDate, businessTime, shortDayLabel } from "../domain/time";
import { BookingActions, BookingTags, primaryAction, StatusTag, useBookingAction } from "./booking-card";
import { Button, inputClass, Notice, Tag } from "./controls";
import { useResource } from "./use-resource";

type Kind = "" | "single" | "plan";
type Result = {
  now: string; view: BookingView; groups: BookingGroup[]; page: number; pages: number; total: number; counts: Record<BookingView, number>; capped: boolean;
  rooms: Record<string, string>;
};
type Person = { name: string; whatsapp: string };

/** The state filter: everything first, then in the order the day is worked: what needs someone, what is coming, the record. */
const views: { id: BookingView; label: string; empty: string }[] = [
  { id: "all", label: "Todas", empty: "Cuando alguien reserve desde el sitio, aparece acá." },
  { id: "attention", label: "Para resolver", empty: "No hay nada pendiente: ninguna seña, transferencia, asistencia ni devolución esperando." },
  { id: "upcoming", label: "Próximas", empty: "No hay reservas confirmadas para los próximos días." },
  { id: "past", label: "Pasadas", empty: "Todavía no hay turnos con la asistencia marcada." },
  { id: "closed", label: "Canceladas y vencidas", empty: "No hay reservas canceladas ni vencidas." },
];

const kinds: { id: Kind; label: string }[] = [{ id: "", label: "Turnos sueltos y planes" }, { id: "single", label: "Solo turnos sueltos" }, { id: "plan", label: "Solo planes" }];

/** "12/11" */
const numericDate = (instant: string) => { const date = businessDate(instant); return `${Number(date.slice(8))}/${Number(date.slice(5, 7))}`; };
/** "jue 12/11" */
const dayAndDate = (instant: string) => `${shortDayLabel(businessDate(instant)).split(" ")[0]} ${numericDate(instant)}`;
const modality = (booking: AgendaBooking) => (booking.kind === "private" ? "Grupal" : "Individual");
/** Money in the colors of the states: red to return, amber missing, plain ink what is normally collected at the sauna, blue paid, gray nothing. */
const chargeTones: Record<Charge["tone"], string> = { danger: "font-semibold text-danger", warn: "font-semibold text-warn-ink", plain: "text-ink", accent: "font-semibold text-accent-text", none: "text-muted" };

function ChargeText({ charge }: { charge: Charge }) {
  return <span className={`inline-flex items-center gap-1 text-sm tabular-nums ${chargeTones[charge.tone]}`}>
    {charge.tone === "accent" && <Check size={14} strokeWidth={3} aria-hidden="true" />}{charge.text}
  </span>;
}

/** How many turns of a plan are in a state: "1 confirmada", "3 confirmadas". */
const counted: Record<BookingStatus, [string, string]> = {
  held: ["retenida", "retenidas"], pending_transfer: ["espera transferencia", "esperan transferencia"], confirmed: ["confirmada", "confirmadas"],
  cancelled: ["cancelada", "canceladas"], expired: ["vencida", "vencidas"], completed: ["con asistencia", "con asistencia"], no_show: ["sin asistencia", "sin asistencia"],
};

/** Every filter has the same height, so the search and the selects line up. */
const control = "h-control";
const labelClass = "text-sm font-semibold text-ink";

/** The turn that matters in this tab, first and largest: what the list is read by. A plan says how many more it holds. */
function When({ group, lead }: { group: BookingGroup; lead: AgendaBooking }) {
  const others = group.bookings.length - 1;
  return <span className="grid gap-0.5">
    <span className="font-semibold text-ink first-letter:uppercase tabular-nums">{dayAndDate(lead.startsAt)}</span>
    <span className="text-sm text-muted tabular-nums">{businessTime(lead.startsAt)} a {businessTime(lead.endsAt)}{group.plan && others > 0 ? ` · y ${others} ${others === 1 ? "turno más" : "turnos más"}` : ""}</span>
  </span>;
}

/** A single booking reads "Turno suelto"; a plan carries its name and an icon, so the two never look alike. */
function What({ group, lead }: { group: BookingGroup; lead: AgendaBooking }) {
  if (group.plan) return <span className="grid justify-items-start gap-1">
    <Tag tone="outline"><Layers size={13} strokeWidth={2.5} aria-hidden="true" />{group.plan.name}</Tag>
    <span className="text-sm text-muted">{group.bookings.length < group.plan.turns ? `${group.bookings.length} de ${group.plan.turns} turnos` : `${group.plan.turns} turnos`}</span>
  </span>;
  return <span className="grid gap-0.5">
    <span className="text-ink">Turno suelto</span>
    <span className="text-sm text-muted">{lead.typeName} · {modality(lead)}</span>
  </span>;
}

/** The state, and until when a hold lasts: the one time that tells how urgent it is. A plan counts its turns by state. */
function State({ group, lead, now }: { group: BookingGroup; lead: AgendaBooking; now: string }) {
  if (group.plan) return <span className="flex flex-wrap items-center gap-1">
    {statusCounts(group.bookings, now).map(({ status, count }) => <StatusTag key={status} status={status} label={`${count} ${counted[status][count === 1 ? 0 : 1]}`} count={count} />)}
  </span>;
  const status = effectiveStatus(lead, now);
  const started = Date.parse(lead.startsAt) <= Date.parse(now);
  return <span className="grid justify-items-start gap-0.5">
    <StatusTag status={status} />
    {(status === "held" || status === "pending_transfer") && lead.expiresAt && <span className="text-sm text-muted tabular-nums">Vence a las {businessTime(lead.expiresAt)}</span>}
    {status === "confirmed" && started && <span className="text-sm text-warn-ink">Falta marcar asistencia</span>}
  </span>;
}

/** The name filters the list to that person's bookings: their history, without a page of its own. */
function PersonCell({ booking, onPick }: { booking: AgendaBooking; onPick: (person: Person) => void }) {
  if (!booking.customerName || !booking.customerWhatsapp) return <span className="text-muted">Persona anonimizada</span>;
  const person = { name: booking.customerName, whatsapp: booking.customerWhatsapp };
  return <span className="grid min-w-0 gap-0.5">
    <button type="button" onClick={() => onPick(person)} title={`Ver todas las reservas de ${person.name}`}
      className="justify-self-start truncate text-left font-semibold text-ink underline-offset-4 hover:text-accent-text hover:underline">{person.name}</button>
    <span className="text-sm text-muted tabular-nums">+{person.whatsapp}</span>
  </span>;
}

/** The action the row asks for next, so the usual case needs no opening. A plan's turns are handled one by one, inside it. */
function Primary({ group, lead, now, onChanged }: { group: BookingGroup; lead: AgendaBooking; now: string; onChanged: () => Promise<void> }) {
  const { run, busy } = useBookingAction(lead, onChanged);
  const next = group.plan ? null : primaryAction(lead, now);
  if (!next) return null;
  return <Button variant="primary" disabled={busy} onClick={() => run(next.action)} className="whitespace-nowrap">{next.label}</Button>;
}

/** What opens under a row: every turn with its details and the rest of its actions. */
function Detail({ group, now, rooms, onChanged }: { group: BookingGroup; now: string; rooms: Record<string, string>; onChanged: () => Promise<void> }) {
  const showRoom = Object.keys(rooms).length > 1;
  return <div className="grid gap-4">
    {group.plan && <p className="m-0 text-sm text-muted">Cada turno se maneja por separado. Registrar la transferencia de un turno registra la del plan entero.</p>}
    <ol className="m-0 grid list-none gap-0 p-0">
      {group.bookings.map(booking => {
        const status = effectiveStatus(booking, now);
        return <li key={booking.id} className="grid gap-3 border-t border-line py-3 first:border-0 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink first-letter:uppercase tabular-nums">{dayAndDate(booking.startsAt)}, {businessTime(booking.startsAt)} a {businessTime(booking.endsAt)}</span>
            {group.plan && <StatusTag status={status} />}
            <BookingTags booking={{ ...booking, planName: null }} />
            {booking.status === "pending_transfer" && status === "expired" && <span className="text-sm text-muted">Esperaba transferencia</span>}
          </div>
          <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div><dt className="text-muted">Turno</dt><dd className="m-0 text-ink">{booking.typeName} · {modality(booking)}{showRoom && rooms[booking.roomId] ? ` · ${rooms[booking.roomId]}` : ""}</dd></div>
            <div><dt className="text-muted">Precio</dt><dd className="m-0 text-ink tabular-nums">{formatCents(booking.priceCents - booking.discountCents)}{booking.discountCents > 0 ? `, con ${formatCents(booking.discountCents)} de descuento` : ""}</dd></div>
            <div><dt className="text-muted">Pagado</dt><dd className="m-0 text-ink tabular-nums">{formatCents(ledgerOf(booking.movements).netCents)}, seña de {formatCents(booking.depositCents)}</dd></div>
            <div><dt className="text-muted">Reservada</dt><dd className="m-0 text-ink tabular-nums">{numericDate(booking.createdAt)}, {businessTime(booking.createdAt)}</dd></div>
          </dl>
          <BookingActions booking={booking} now={now} onChanged={onChanged} hidePrimary={!group.plan} />
        </li>;
      })}
    </ol>
  </div>;
}

function Pager({ page, pages, total, shown, onGo }: { page: number; pages: number; total: number; shown: number; onGo: (page: number) => void }) {
  if (pages <= 1) return null;
  const first = (page - 1) * BOOKINGS_PAGE_SIZE + 1;
  return <nav aria-label="Paginación" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
    <span aria-live="polite" className="tabular-nums">{first}–{first + shown - 1} de {total}</span>
    <div className="flex items-center gap-2">
      <Button disabled={page <= 1} onClick={() => onGo(page - 1)} aria-label="Página anterior"><ChevronLeft size={16} aria-hidden="true" /><span className="hidden sm:inline">Anterior</span></Button>
      <span className="tabular-nums">{page} de {pages}</span>
      <Button disabled={page >= pages} onClick={() => onGo(page + 1)} aria-label="Página siguiente"><span className="hidden sm:inline">Siguiente</span><ChevronRight size={16} aria-hidden="true" /></Button>
    </div>
  </nav>;
}

const head = "px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-muted uppercase";
const cell = "px-3 py-3 align-middle";

export function ReservasScreen() {
  const site = useSite();
  const [text, setText] = useState("");
  const [view, setView] = useState<BookingView>("all");
  const [kind, setKind] = useState<Kind>("");
  const [person, setPerson] = useState<Person | null>(null);
  const [paging, setPaging] = useState({ page: 1, filters: "" });
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const top = useRef<HTMLDivElement>(null);
  const query = useDeferredValue(person ? person.whatsapp : text.trim());
  const filters = `${query}|${view}|${kind}`;
  // Changing a filter starts again at page 1.
  const page = paging.filters === filters ? paging.page : 1;
  const { data, error, reload, loading } = useResource<Result>(
    `/api/sites/${site.id}/sauna/bookings?q=${encodeURIComponent(query)}&view=${view}&kind=${kind}&page=${page}`, { live: true });
  const toggle = (key: string) => setOpen(current => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const go = (next: number) => { setPaging({ page: next, filters }); top.current?.scrollIntoView({ block: "start" }); };
  // Someone's history covers every state: the filter goes to "Todas".
  const pick = (next: Person) => { setPerson(next); setText(""); setView("all"); top.current?.scrollIntoView({ block: "start" }); };
  const now = data?.now ?? "";
  const empty = views.find(item => item.id === view)?.empty ?? "";

  const opener = (group: BookingGroup, label: string): ReactNode => {
    const expanded = open.has(group.key);
    return <button type="button" aria-expanded={expanded} aria-controls={`reserva-${group.key}`} onClick={() => toggle(group.key)}
      className="inline-flex min-h-control items-center gap-1 rounded-control px-2.5 text-sm font-semibold whitespace-nowrap text-muted transition-[background-color,color,transform] duration-150 ease-out hover:bg-sunken hover:text-ink active:scale-[0.97] motion-reduce:active:scale-100">
      {expanded ? "Cerrar" : group.plan ? "Ver turnos" : "Detalle"}
      <ChevronDown size={16} aria-hidden="true" className={`transition-transform duration-200 ease-out ${expanded ? "rotate-180" : ""}`} />
      <span className="sr-only"> de {label}</span>
    </button>;
  };
  const labelOf = (group: BookingGroup) => `${group.plan ? `el plan ${group.plan.name}` : "la reserva"} de ${group.bookings[0].customerName || "la persona"}`;

  return <>
    <PageHeader title="Reservas" description="Lo que hay que resolver, lo que viene y el historial. Cada plan es una sola fila con sus turnos adentro." />

    {/* Three filters of one height in one row: the search, the state with how many rows each one holds, and the kind. */}
    <div ref={top} className="mb-4 grid scroll-mt-4 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
      {person
        ? <div className="grid content-start gap-1">
          <span className={labelClass}>Persona</span>
          <span className={`flex ${control} items-center justify-between gap-2 rounded-field border border-accent bg-accent-soft pr-1 pl-3 text-accent-text`}>
            <strong className="truncate">{person.name}</strong>
            <button type="button" onClick={() => setPerson(null)} aria-label={`Dejar de filtrar por ${person.name}`} className="grid size-7 shrink-0 place-items-center rounded-control hover:bg-accent-wash"><X size={16} aria-hidden="true" /></button>
          </span>
        </div>
        : <label className="grid content-start gap-1">
          <span className={labelClass}>Buscar</span>
          <span className="relative">
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input className={`${inputClass} ${control} pl-9`} type="search" value={text} maxLength={80} placeholder="Nombre o WhatsApp" onChange={event => setText(event.target.value)} />
          </span>
        </label>}
      <label className="grid content-start gap-1">
        <span className={labelClass}>Estado</span>
        <select className={`${inputClass} ${control}`} value={view} onChange={event => setView(event.target.value as BookingView)}>
          {views.map(item => <option key={item.id} value={item.id}>{item.label}{data ? ` (${data.counts[item.id]})` : ""}</option>)}
        </select>
      </label>
      <label className="grid content-start gap-1">
        <span className={labelClass}>Tipo</span>
        <select className={`${inputClass} ${control}`} value={kind} onChange={event => setKind(event.target.value as Kind)}>
          {kinds.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
    </div>

    {error && <div className="mb-3 grid justify-items-start gap-2"><Notice kind="error">{error}</Notice><Button onClick={() => void reload()}>Reintentar</Button></div>}
    {loading && !data && <div className="grid gap-2" aria-busy="true" aria-label="Cargando reservas">{Array.from({ length: 4 }, (_, index) => <span key={index} className="h-16 animate-pulse rounded-field bg-surface motion-reduce:animate-none" />)}</div>}
    {data && (data.groups.length === 0
      ? <EmptyState title={query || kind ? "No hay reservas con esa búsqueda" : view === "attention" ? "Todo al día" : "No hay reservas acá"} text={query || kind ? "Probá con otra búsqueda o con otra vista." : empty} />
      : <div aria-busy={loading} className={`transition-opacity duration-150 ${loading ? "opacity-60" : ""}`}>
        {/* Desktop: a table, read by the date of the turn. Each row opens under itself. */}
        <div className="hidden overflow-hidden rounded-card border border-line bg-surface lg:block">
          <table className="w-full border-collapse">
            <thead className="border-b border-line">
              <tr>
                <th className={head}>Turno</th>
                <th className={head}>Persona</th>
                <th className={head}>Reserva</th>
                <th className={head}>Estado</th>
                <th className={head}>Cobro</th>
                <th className={head}><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            {data.groups.map(group => {
              const lead = leadOf(group, view, now);
              const charge = chargeOf(group, now, formatCents);
              const expanded = open.has(group.key);
              return <tbody key={group.key} className="border-b border-line last:border-0">
                <tr className={`transition-colors duration-150 hover:bg-bg ${group.plan ? "shadow-[inset_3px_0_0_var(--color-line-strong)]" : ""} ${expanded ? "bg-bg" : ""}`}>
                  <td className={cell}><When group={group} lead={lead} /></td>
                  <td className={`${cell} max-w-56`}><PersonCell booking={lead} onPick={pick} /></td>
                  <td className={cell}><What group={group} lead={lead} /></td>
                  <td className={cell}><State group={group} lead={lead} now={now} /></td>
                  <td className={cell}><ChargeText charge={charge} /></td>
                  <td className={`${cell} text-right`}>
                    <span className="inline-flex items-center justify-end gap-1">
                      <Primary group={group} lead={lead} now={now} onChanged={reload} />
                      {opener(group, labelOf(group))}
                    </span>
                  </td>
                </tr>
                {expanded && <tr id={`reserva-${group.key}`} className="bg-bg">
                  <td colSpan={6} className="px-3 pt-1 pb-4"><Detail group={group} now={now} rooms={data.rooms} onChanged={reload} /></td>
                </tr>}
              </tbody>;
            })}
          </table>
        </div>

        {/* Phone and tablet: the same rows as cards, the turn first. */}
        <ul className="m-0 grid list-none gap-2 p-0 lg:hidden">
          {data.groups.map(group => {
            const lead = leadOf(group, view, now);
            const charge = chargeOf(group, now, formatCents);
            return <li key={group.key} className={`grid gap-3 rounded-field border bg-surface p-3 ${group.plan ? "border-line border-l-4 border-l-line-strong" : "border-line"}`}>
              <div className="flex items-start justify-between gap-3">
                <When group={group} lead={lead} />
                <State group={group} lead={lead} now={now} />
              </div>
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <PersonCell booking={lead} onPick={pick} />
                <What group={group} lead={lead} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                <ChargeText charge={charge} />
                <span className="flex items-center gap-1">
                  <Primary group={group} lead={lead} now={now} onChanged={reload} />
                  {opener(group, labelOf(group))}
                </span>
              </div>
              {open.has(group.key) && <div id={`reserva-${group.key}`} className="border-t border-line pt-3"><Detail group={group} now={now} rooms={data.rooms} onChanged={reload} /></div>}
            </li>;
          })}
        </ul>

        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted" aria-label="Qué significa cada color">
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-success" aria-hidden="true" />Confirmada</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-accent" aria-hidden="true" />Pagado</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-warn-line" aria-hidden="true" />Falta algo</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-danger" aria-hidden="true" />Cancelada o para devolver</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-line-strong" aria-hidden="true" />Terminada</span>
        </p>
        <Pager page={data.page} pages={data.pages} total={data.total} shown={data.groups.length} onGo={go} />
        {data.capped && <p className="mt-3 text-sm text-muted">La lista lee las 1000 reservas más recientes. Para una más vieja, buscala por nombre o WhatsApp.</p>}
      </div>)}
  </>;
}
