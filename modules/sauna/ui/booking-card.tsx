"use client";

import { useState } from "react";
import { FaWhatsapp } from "react-icons/fa";
import { formatCents } from "@/platform/money";
import { useSite } from "@/platform/panel";
import { bookingActions, moneyState, statusLabels, type AgendaBooking } from "../domain/agenda";
import { effectiveStatus } from "../domain/booking";
import { showToast } from "@/shared/ui/toast";
import { cancellationMessage, confirmationMessage, reminderMessage, whatsappLink, type MessageBooking } from "../domain/messages";
import { businessDate, businessTime, dayLabel } from "../domain/time";
import { Button, buttonClass, inputClass, Notice, Tag } from "./controls";
import { sendJson } from "./fetch-json";

type Action = "confirm" | "transfer" | "complete" | "no_show" | "cancel";

/** What the WhatsApp messages say about a booking. */
export const messageOf = (booking: AgendaBooking, site: { name: string; url: string }): MessageBooking => ({
  siteName: site.name, customerName: booking.customerName, startsAt: booking.startsAt, kind: booking.kind, seats: booking.seats, owedCents: moneyState(booking).owedCents,
  link: `${site.url}/reserva/${booking.token}`,
});

/** The link only opens WhatsApp with the text written: the panel cannot know whether it was sent, so the notice says what it did. */
export const announceWhatsapp = (what: string, booking: AgendaBooking) =>
  showToast(`Se abrió WhatsApp con el mensaje de ${what} para ${booking.customerName || "la persona"}. Falta tocar Enviar.`, 5000);

/** A booking with what is left to collect and what can be done with it. `showTurn` is for lists that are not already grouped by turn. */
export function BookingCard({ booking, now, roomName, showTurn = false, onChanged }: { booking: AgendaBooking; now: string; roomName?: string; showTurn?: boolean; onChanged: () => Promise<void> }) {
  const site = useSite();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [note, setNote] = useState("");
  const status = effectiveStatus(booking, now);
  const money = moneyState(booking);
  const actions = bookingActions(booking, now);
  const run = async (action: Action) => {
    setBusy(true);
    setError("");
    try {
      const answer = await sendJson<{ message?: string }>(`/api/sites/${site.id}/sauna/bookings/${booking.id}`, "PATCH", { action, note });
      if (answer?.message) showToast(answer.message, 6000);
      setCancelling(false);
      await onChanged();
    } catch (failure) { setError((failure as Error).message); } finally { setBusy(false); }
  };
  const message = messageOf(booking, site);
  const whatsapp = (label: string, text: string, what: string) => booking.customerWhatsapp && <a className={buttonClass()} href={whatsappLink(booking.customerWhatsapp, text)} target="_blank" rel="noopener noreferrer" onClick={() => announceWhatsapp(what, booking)}>
    <FaWhatsapp size={16} aria-hidden="true" />{label}
  </a>;
  return <article className="grid gap-2 rounded-field border border-line bg-bg p-3">
    <div className="flex flex-wrap items-center gap-2">
      <strong className="text-ink">{booking.customerName || "Persona anonimizada"}</strong>
      <span className="text-muted">{booking.kind === "private" ? "Grupal" : "Individual"}</span>
      <Tag tone={status === "confirmed" || status === "completed" ? "accent" : status === "held" || status === "pending_transfer" ? "warn" : "plain"}>{statusLabels[status]}</Tag>
      {booking.status === "pending_transfer" && status === "expired" && <Tag>Esperaba transferencia</Tag>}
      {booking.needsRefund && <Tag tone="warn">Pago para devolver</Tag>}
    </div>
    {showTurn && <p className="m-0 text-muted">{dayLabel(businessDate(booking.startsAt))}, {businessTime(booking.startsAt)}{roomName ? ` · ${roomName}` : ""}</p>}
    <p className="m-0 text-muted">
      Total {formatCents(money.totalCents)}
      {money.depositDueCents > 0 && ` · Falta la seña: ${formatCents(money.depositDueCents)}`}
      {money.owedCents > 0 ? ` · Queda por cobrar ${formatCents(money.owedCents)}` : " · Pagado completo"}
      {(status === "held" || status === "pending_transfer") && booking.expiresAt && ` · Retenida hasta las ${businessTime(booking.expiresAt)}`}
    </p>
    {error && <Notice kind="error">{error}</Notice>}
    {cancelling
      ? <div className="grid gap-2">
        <label className="grid gap-1"><span className="font-semibold text-ink">Motivo (opcional)</span><input className={inputClass} value={note} maxLength={500} onChange={event => setNote(event.target.value)} /></label>
        <div className="flex flex-wrap gap-2">
          <Button variant="danger" disabled={busy} onClick={() => void run("cancel")}>{busy ? "Cancelando…" : "Sí, cancelar la reserva"}</Button>
          <Button disabled={busy} onClick={() => setCancelling(false)}>No, volver</Button>
        </div>
      </div>
      : <div className="flex flex-wrap gap-2">
        {actions.confirm && <Button variant="primary" disabled={busy} onClick={() => void run("confirm")}>Confirmar</Button>}
        {actions.transfer && <Button variant="primary" disabled={busy} onClick={() => void run("transfer")} title={`Registra una transferencia de ${formatCents(booking.depositCents)} y confirma la reserva si el turno sigue libre.`}>{busy ? "Registrando…" : "Confirmar transferencia"}</Button>}
        {actions.attendance && <Button variant="primary" disabled={busy} onClick={() => void run("complete")}>Asistió</Button>}
        {actions.attendance && <Button disabled={busy} onClick={() => void run("no_show")}>No vino</Button>}
        {status === "confirmed" && whatsapp("Confirmación", confirmationMessage(message), "confirmación")}
        {(status === "confirmed" || status === "held" || status === "pending_transfer") && whatsapp("Recordatorio", reminderMessage(message), "recordatorio")}
        {status === "cancelled" && whatsapp("Avisar la cancelación", cancellationMessage(message), "cancelación")}
        {actions.cancel && <Button variant="danger" disabled={busy} onClick={() => setCancelling(true)}>Cancelar</Button>}
      </div>}
  </article>;
}
