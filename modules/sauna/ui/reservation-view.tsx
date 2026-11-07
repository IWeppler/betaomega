import { MessageCircle } from "lucide-react";
import { formatCents } from "@/platform/money";
import { moneyState } from "../domain/agenda";
import { effectiveStatus, type BookingKind, type BookingStatus } from "../domain/booking";
import { cancellationRequestMessage, contactMessage, whatsappLink } from "../domain/messages";
import type { Movement } from "../domain/payments";
import { describeRules, type PolicyRule } from "../domain/policy";
import { businessDate, businessTime, dayLabel } from "../domain/time";
import { buttonClass, Card, Tag } from "./controls";

export type ReservationViewData = {
  booking: {
    status: BookingStatus; kind: BookingKind; seats: number; priceCents: number; discountCents: number; depositCents: number; expiresAt: string | null;
    customerName: string; typeName: string; startsAt: string; endsAt: string; movements: Movement[]; rules: PolicyRule[];
  };
  now: string;
  contactWhatsapp: string | null;
  roomName: string;
  showRoom: boolean;
};

const statusText: Record<BookingStatus, { title: string; tone: "accent" | "warn" | "plain" }> = {
  held: { title: "Lugar retenido", tone: "warn" },
  pending_transfer: { title: "Esperando tu transferencia", tone: "warn" },
  confirmed: { title: "Reserva confirmada", tone: "accent" },
  cancelled: { title: "Reserva cancelada", tone: "plain" },
  expired: { title: "La reserva venció", tone: "plain" },
  completed: { title: "Turno realizado", tone: "plain" },
  no_show: { title: "Turno sin asistencia", tone: "plain" },
};

/** The person's own booking. Their link is the only thing that opens it, and it shows nothing about anyone else. */
export function ReservationView({ data, link, siteName }: { data: ReservationViewData; link: string; siteName: string }) {
  const { booking, now, contactWhatsapp, roomName, showRoom } = data;
  const status = effectiveStatus(booking, now);
  const money = moneyState(booking);
  const open = status === "held" || status === "pending_transfer" || status === "confirmed";
  const about = { siteName, startsAt: booking.startsAt, link };
  return <div className="grid gap-4">
    <div className="grid justify-items-start gap-2">
      <Tag tone={statusText[status].tone}>{statusText[status].title}</Tag>
      <h1 className="m-0 font-display text-3xl/snug font-normal text-ink first-letter:uppercase">{dayLabel(businessDate(booking.startsAt))}, {businessTime(booking.startsAt)}</h1>
      <p className="m-0 text-muted">
        {booking.customerName && `${booking.customerName} · `}
        {booking.typeName && `${booking.typeName} · `}
        {booking.kind === "private" ? "Grupal" : "Individual"}
        {showRoom && roomName && ` · ${roomName}`}
      </p>
    </div>
    {status === "held" && booking.expiresAt && <p className="m-0 text-ink">Guardamos tu lugar hasta las {businessTime(booking.expiresAt)}. Escribinos por WhatsApp para confirmar la reserva.</p>}
    {status === "expired" && <p className="m-0 text-ink">El lugar se liberó porque la reserva no se confirmó a tiempo. Podés hacer otra cuando quieras.</p>}
    {open && <Card>
      <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        <dt className="text-muted">Precio</dt><dd className="m-0 text-right text-ink tabular-nums">{formatCents(money.totalCents)}</dd>
        {money.depositDueCents > 0 && <><dt className="text-muted">Seña</dt><dd className="m-0 text-right font-semibold text-ink tabular-nums">{formatCents(money.depositDueCents)}</dd></>}
        {money.paidCents > 0 && <><dt className="text-muted">Pagado</dt><dd className="m-0 text-right text-ink tabular-nums">{formatCents(money.paidCents)}</dd></>}
        <dt className="text-muted">A pagar en el lugar</dt><dd className="m-0 text-right text-ink tabular-nums">{formatCents(money.owedCents - money.depositDueCents)}</dd>
      </dl>
    </Card>}
    {contactWhatsapp && <div className="flex flex-wrap gap-2">
      <a className={buttonClass("primary")} href={whatsappLink(contactWhatsapp, contactMessage(about))} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} aria-hidden="true" />Consultar por WhatsApp</a>
      {open && <a className={buttonClass()} href={whatsappLink(contactWhatsapp, cancellationRequestMessage(about))} target="_blank" rel="noopener noreferrer">Pedir la cancelación</a>}
    </div>}
    {open && booking.rules.length > 0 && <Card className="grid gap-2">
      <h2 className="m-0 font-display text-lg font-normal text-ink">Si necesitás cancelar</h2>
      <ul className="m-0 grid list-disc gap-1 pl-5 text-muted">{describeRules(booking.rules).map(line => <li key={line}>{line}</li>)}</ul>
    </Card>}
  </div>;
}
