"use client";

import { useState } from "react";
import { Ban, Check, CheckCheck, Clock3, Hourglass, Landmark, Layers, TicketPercent, UserX, type LucideIcon } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { formatCents } from "@/platform/money";
import { useSite } from "@/platform/panel";
import { bookingActions, moneyState, statusLabels, type AgendaBooking } from "../domain/agenda";
import { effectiveStatus, type BookingStatus } from "../domain/booking";
import { showToast } from "@/shared/ui/toast";
import { deferChange } from "@/shared/ui/undo";
import { cancellationMessage, confirmationMessage, reminderMessage, whatsappLink, type MessageBooking } from "../domain/messages";
import { businessDate, businessTime, dayLabel } from "../domain/time";
import { Button, buttonClass, inputClass, Tag, type TagTone } from "./controls";
import { sendJson } from "./fetch-json";

type Action = "confirm" | "transfer" | "complete" | "no_show" | "cancel";

/** What the WhatsApp messages say about a booking. */
export const messageOf = (booking: AgendaBooking, site: { name: string; url: string }): MessageBooking => ({
  herbName: booking.herbName,
  siteName: site.name, customerName: booking.customerName, startsAt: booking.startsAt, kind: booking.kind, seats: booking.seats, owedCents: moneyState(booking).owedCents,
  link: `${site.url}/reserva/${booking.token}`,
});

/** The link only opens WhatsApp with the text written: the panel cannot know whether it was sent, so the notice says what it did. */
export const announceWhatsapp = (what: string, booking: AgendaBooking) =>
  showToast(`Se abrió WhatsApp con el mensaje de ${what} para ${booking.customerName || "la persona"}. Falta tocar Enviar.`, 5000);

/**
 * One rule for every color of the sauna's panel, so a table can be read by color alone: green is confirmed, blue (the accent) is paid, amber is
 * waiting for someone, red fell through or has money to return, gray is over. A lapsed hold is the faintest gray: nobody did anything.
 */
export const statusTone = (status: BookingStatus): TagTone => ({
  confirmed: "success", completed: "plain", held: "warn", pending_transfer: "warn", cancelled: "danger", expired: "faded", no_show: "plain",
} as const)[status];

/**
 * A booking's state. Confirmed is the usual case, so it is only a green check: the word stays for screen readers and on hover. `label` replaces the
 * word, for a plan's counts ("3 confirmadas"); `count` goes next to the check.
 */
/** Each state has its own icon, so it can be told apart before it is read: a clock waits, a bank waits for a transfer, a slash fell through. */
const statusIcons: Record<BookingStatus, LucideIcon> = {
  confirmed: Check, held: Clock3, pending_transfer: Landmark, completed: CheckCheck, no_show: UserX, cancelled: Ban, expired: Hourglass,
};

/** A booking's state, in the same pill as every other: its icon and its word. `label` replaces the word, for a plan's counts ("3 confirmadas"). */
export function StatusTag({ status, label = statusLabels[status] }: { status: BookingStatus; label?: string; count?: number }) {
  const Icon = statusIcons[status];
  return <Tag tone={statusTone(status)}><Icon size={13} strokeWidth={2.5} aria-hidden="true" />{label}</Tag>;
}

/** What the booking used to get its price: a discount code or a pack session. */
export function BookingTags({ booking }: { booking: Pick<AgendaBooking, "code" | "fromPack" | "planName" | "herbName"> }) {
  return <>
    {booking.herbName && <Tag tone="outline">Hierba: {booking.herbName}</Tag>}
    {booking.planName && <Tag tone="outline"><Layers size={13} strokeWidth={2.5} aria-hidden="true" />{booking.planName}</Tag>}
    {booking.code && <Tag tone="outline"><TicketPercent size={13} strokeWidth={2.5} aria-hidden="true" />Código {booking.code}</Tag>}
    {booking.fromPack && <Tag>Pack</Tag>}
  </>;
}

/**
 * Runs an action on a booking. None of them can be taken back once made (a payment recorded, a seat given up), so each one waits while its notice
 * offers "Deshacer". `busy` lasts until it is made or undone.
 */
export function useBookingAction(booking: AgendaBooking, onChanged: () => Promise<void>) {
  const site = useSite();
  const [busy, setBusy] = useState(false);
  const run = (action: Action, note = "") => {
    const who = booking.customerName || "la persona";
    const pending: Record<Action, string> = {
      confirm: `Se va a confirmar la reserva de ${who}.`,
      transfer: booking.planPurchaseId ? `Se va a registrar la transferencia del plan de ${who}.` : `Se va a registrar la transferencia de ${who}.`,
      complete: `Se va a marcar que ${who} asistió.`,
      no_show: `Se va a marcar que ${who} no vino.`,
      cancel: `Se va a cancelar la reserva de ${who}.`,
    };
    setBusy(true);
    deferChange({
      message: pending[action],
      commit: async () => (await sendJson<{ message?: string }>(`/api/sites/${site.id}/sauna/bookings/${booking.id}`, "PATCH", { action, note }, { keepalive: true }))?.message,
      onSettled: () => { setBusy(false); void onChanged(); },
    });
  };
  return { run, busy };
}

/** The one thing a booking asks for next, if any: what a row offers without opening. */
export function primaryAction(booking: AgendaBooking, now: string): { action: Action; label: string } | null {
  const actions = bookingActions(booking, now);
  if (actions.transfer) return { action: "transfer", label: "Confirmar transferencia" };
  if (actions.confirm) return { action: "confirm", label: "Confirmar" };
  if (actions.attendance) return { action: "complete", label: "Asistió" };
  return null;
}

/** What can be done with a booking, under its row or its card. Asking for the reason of a cancellation happens in place. `hidePrimary` leaves out
 * the action its row already shows. */
export function BookingActions({ booking, now, onChanged, hidePrimary = false }: { booking: AgendaBooking; now: string; onChanged: () => Promise<void>; hidePrimary?: boolean }) {
  const site = useSite();
  const { run, busy } = useBookingAction(booking, onChanged);
  const [cancelling, setCancelling] = useState(false);
  const [note, setNote] = useState("");
  const status = effectiveStatus(booking, now);
  const actions = bookingActions(booking, now);
  const shown = hidePrimary ? primaryAction(booking, now)?.action : undefined;
  const message = messageOf(booking, site);
  const whatsapp = (label: string, text: string, what: string) => booking.customerWhatsapp && <a className={buttonClass()} href={whatsappLink(booking.customerWhatsapp, text)} target="_blank" rel="noopener noreferrer" onClick={() => announceWhatsapp(what, booking)}>
    <FaWhatsapp size={16} aria-hidden="true" />{label}
  </a>;
  if (cancelling) return <div className="grid gap-2">
    <label className="grid gap-1"><span className="font-semibold text-ink">Motivo (opcional)</span><input className={inputClass} value={note} maxLength={500} onChange={event => setNote(event.target.value)} /></label>
    <div className="flex flex-wrap gap-2">
      <Button variant="danger" disabled={busy} onClick={() => { setCancelling(false); run("cancel", note); }}>Sí, cancelar la reserva</Button>
      <Button disabled={busy} onClick={() => setCancelling(false)}>No, volver</Button>
    </div>
  </div>;
  return <div className="flex flex-wrap gap-2">
    {actions.confirm && shown !== "confirm" && <Button variant="primary" disabled={busy} onClick={() => run("confirm")}>Confirmar</Button>}
    {actions.transfer && shown !== "transfer" && <Button variant="primary" disabled={busy} onClick={() => run("transfer")} title={`Registra una transferencia de ${formatCents(booking.depositCents)} y confirma la reserva si el turno sigue libre.`}>Confirmar transferencia</Button>}
    {actions.attendance && shown !== "complete" && <Button variant="primary" disabled={busy} onClick={() => run("complete")}>Asistió</Button>}
    {actions.attendance && <Button disabled={busy} onClick={() => run("no_show")}>No vino</Button>}
    {status === "confirmed" && whatsapp("Confirmación", confirmationMessage(message), "confirmación")}
    {(status === "confirmed" || status === "held" || status === "pending_transfer") && whatsapp("Recordatorio", reminderMessage(message), "recordatorio")}
    {status === "cancelled" && whatsapp("Avisar la cancelación", cancellationMessage(message), "cancelación")}
    {actions.cancel && <Button variant="danger" disabled={busy} onClick={() => setCancelling(true)}>Cancelar</Button>}
  </div>;
}

/** What is left to collect, in one line. */
export function moneyLine(booking: AgendaBooking, now: string) {
  const money = moneyState(booking);
  const status = effectiveStatus(booking, now);
  return `Total ${formatCents(money.totalCents)}`
    + (money.depositDueCents > 0 ? ` · Falta la seña: ${formatCents(money.depositDueCents)}` : "")
    + (money.owedCents > 0 ? ` · Queda por cobrar ${formatCents(money.owedCents)}` : " · Pagado completo")
    + ((status === "held" || status === "pending_transfer") && booking.expiresAt ? ` · Retenida hasta las ${businessTime(booking.expiresAt)}` : "");
}

/** A booking with what is left to collect and what can be done with it. `showTurn` is for lists that are not already grouped by turn. */
export function BookingCard({ booking, now, roomName, showTurn = false, onChanged }: { booking: AgendaBooking; now: string; roomName?: string; showTurn?: boolean; onChanged: () => Promise<void> }) {
  const status = effectiveStatus(booking, now);
  return <article className="grid gap-2 rounded-field border border-line bg-bg p-3">
    <div className="flex flex-wrap items-center gap-2">
      <strong className="text-ink">{booking.customerName || "Persona anonimizada"}</strong>
      <span className="text-muted">{booking.kind === "private" ? "Grupal" : "Individual"}</span>
      <StatusTag status={status} />
      <BookingTags booking={booking} />
      {booking.status === "pending_transfer" && status === "expired" && <Tag>Esperaba transferencia</Tag>}
      {booking.needsRefund && <Tag tone="warn">Pago para devolver</Tag>}
    </div>
    {showTurn && <p className="m-0 text-muted">{dayLabel(businessDate(booking.startsAt))}, {businessTime(booking.startsAt)}{roomName ? ` · ${roomName}` : ""}</p>}
    <p className="m-0 text-muted">{moneyLine(booking, now)}</p>
    <BookingActions booking={booking} now={now} onChanged={onChanged} />
  </article>;
}
