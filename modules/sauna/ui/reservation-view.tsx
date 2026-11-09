import type { ReactNode } from "react";
import { FaWhatsapp } from "react-icons/fa";
import { formatCents } from "@/platform/money";
import { moneyState } from "../domain/agenda";
import { effectiveStatus, type BookingKind, type BookingStatus } from "../domain/booking";
import { cancellationRequestMessage, contactMessage, transferProofMessage, whatsappLink } from "../domain/messages";
import type { Movement } from "../domain/payments";
import { describeRules, type PolicyRule } from "../domain/policy";
import type { TransferAccount } from "../domain/setup";
import { businessDate, businessTime, dayLabel } from "../domain/time";
import { buttonClass, Card } from "./controls";
import { PaymentChoice } from "./payment-choice";
import { BookAnother, ProgressSteps, ResultHero, stageOf } from "./result-parts";

export type ReservationViewData = {
  booking: {
    status: BookingStatus; kind: BookingKind; seats: number; priceCents: number; discountCents: number; depositCents: number; expiresAt: string | null;
    customerName: string; typeName: string; startsAt: string; endsAt: string; movements: Movement[]; rules: PolicyRule[];
  };
  now: string;
  contactWhatsapp: string | null;
  roomName: string;
  showRoom: boolean;
  /** What the site takes, and whether the person just came back from Mercado Pago. */
  payment: { mercadopago: boolean; transfer: TransferAccount | null; returned: boolean };
};

/** The short line above the title, and the title itself: what happened, in the words of whoever booked. */
const statusText: Record<BookingStatus, { eyebrow: string; title: (name: string) => string }> = {
  held: { eyebrow: "Lugar guardado", title: () => "Falta un paso: pagá la seña para confirmar" },
  pending_transfer: { eyebrow: "Esperando tu transferencia", title: () => "Cuando llegue la transferencia, confirmamos tu turno" },
  confirmed: { eyebrow: "Reserva confirmada", title: name => `¡Listo${name ? `, ${name.split(" ")[0]}` : ""}! Te esperamos` },
  cancelled: { eyebrow: "Reserva cancelada", title: () => "Esta reserva se canceló" },
  expired: { eyebrow: "La reserva venció", title: () => "El lugar se liberó" },
  completed: { eyebrow: "Turno realizado", title: () => "Gracias por venir" },
  no_show: { eyebrow: "Turno sin asistencia", title: () => "Este turno pasó sin asistencia" },
};

const until = (instant: string) => `${dayLabel(businessDate(instant))} a las ${businessTime(instant)}`;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <><dt className="text-muted">{label}</dt><dd className="m-0 text-right font-semibold break-all text-ink tabular-nums select-all">{children}</dd></>;
}

/** The person's own booking. Their link is the only thing that opens it, and it shows nothing about anyone else. */
export function ReservationView({ data, siteId, token, link, siteName }: { data: ReservationViewData; siteId: string; token: string; link: string; siteName: string }) {
  const { booking, now, contactWhatsapp, roomName, showRoom, payment } = data;
  const status = effectiveStatus(booking, now);
  const money = moneyState(booking);
  const open = status === "held" || status === "pending_transfer" || status === "confirmed";
  const about = { siteName, startsAt: booking.startsAt, link };
  const canPay = payment.mercadopago || payment.transfer !== null;
  const stage = stageOf(status);
  return <div className="grid gap-5">
    {stage !== "closed" && <ProgressSteps stage={stage} />}
    <ResultHero stage={stage} eyebrow={statusText[status].eyebrow} title={statusText[status].title(booking.customerName)} />

    {/* The turn itself, the thing to remember: day and time large, the rest below. */}
    <Card className={`grid gap-1 ${stage === "done" ? "border-accent" : ""}`}>
      <span className="text-xs text-muted">Tu turno</span>
      <strong className="font-display text-2xl/snug font-normal text-ink first-letter:uppercase">{dayLabel(businessDate(booking.startsAt))}</strong>
      <span className="text-lg text-ink tabular-nums">{businessTime(booking.startsAt)} a {businessTime(booking.endsAt)}</span>
      <span className="text-muted">
        {booking.typeName && `${booking.typeName} · `}
        {booking.kind === "private" ? "Grupal" : "Individual"}
        {showRoom && roomName && ` · ${roomName}`}
      </span>
    </Card>
    {stage === "done" && <p className="m-0 text-muted">Guardá esta página: desde este enlace ves tu reserva cuando quieras.</p>}

    {status === "held" && booking.expiresAt && <div className="grid gap-3">
      {payment.returned && money.paidCents === 0 && <p className="m-0 text-ink">Todavía no nos llegó la confirmación de Mercado Pago. Si ya pagaste, recargá la página en un minuto. Si el pago no se completó, podés intentarlo de nuevo.</p>}
      <p className="m-0 text-ink">
        Guardamos tu lugar hasta las <strong className="font-semibold">{businessTime(booking.expiresAt)}</strong>.{" "}
        {canPay ? `Para confirmar la reserva, pagá la seña de ${formatCents(money.depositDueCents)}.` : "Escribinos por WhatsApp para confirmar la reserva."}
      </p>
      {canPay && <PaymentChoice siteId={siteId} token={token} mercadopago={payment.mercadopago} transfer={payment.transfer !== null} />}
    </div>}

    {status === "pending_transfer" && booking.expiresAt && <Card className="grid gap-3">
      <h2 className="m-0 font-display text-lg font-normal text-ink">Datos para transferir</h2>
      {payment.transfer
        ? <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <Row label="Monto exacto">{formatCents(money.depositDueCents)}</Row>
          {payment.transfer.alias && <Row label="Alias">{payment.transfer.alias}</Row>}
          {payment.transfer.cbu && <Row label="CBU/CVU">{payment.transfer.cbu}</Row>}
          <Row label="Titular">{payment.transfer.holder}</Row>
        </dl>
        : <p className="m-0 text-ink">Escribinos por WhatsApp y te pasamos los datos para transferir {formatCents(money.depositDueCents)}.</p>}
      <p className="m-0 text-muted">Guardamos tu lugar hasta el {until(booking.expiresAt)}. Cuando transfieras, mandanos el comprobante: confirmamos la reserva al ver el dinero en la cuenta.</p>
      {contactWhatsapp && <div className="flex flex-wrap gap-2">
        <a className={buttonClass("primary")} href={whatsappLink(contactWhatsapp, transferProofMessage({ ...about, amountCents: money.depositDueCents }))} target="_blank" rel="noopener noreferrer"><FaWhatsapp size={16} aria-hidden="true" />Enviar el comprobante</a>
      </div>}
      {payment.mercadopago && <div className="grid gap-2 border-t border-line pt-3">
        <p className="m-0 text-muted">¿Preferís pagar ahora con Mercado Pago? La reserva se confirma en el momento.</p>
        <PaymentChoice siteId={siteId} token={token} mercadopago transfer={false} />
      </div>}
    </Card>}

    {status === "expired" && (money.paidCents > 0
      ? <p className="m-0 text-ink">Recibimos tu pago, pero llegó cuando el lugar ya no estaba disponible. Te vamos a devolver el dinero: escribinos por WhatsApp para coordinarlo.</p>
      : <p className="m-0 text-ink">El lugar se liberó porque la seña no se pagó a tiempo. Podés hacer otra reserva cuando quieras.</p>)}

    {open && <Card>
      <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        <dt className="text-muted">Precio</dt><dd className="m-0 text-right text-ink tabular-nums">{formatCents(money.totalCents)}</dd>
        {money.depositDueCents > 0 && <><dt className="text-muted">Seña</dt><dd className="m-0 text-right font-semibold text-ink tabular-nums">{formatCents(money.depositDueCents)}</dd></>}
        {money.paidCents > 0 && <><dt className="text-muted">Pagado</dt><dd className="m-0 text-right text-ink tabular-nums">{formatCents(money.paidCents)}</dd></>}
        <dt className="text-muted">A pagar en el lugar</dt><dd className="m-0 text-right text-ink tabular-nums">{formatCents(money.owedCents - money.depositDueCents)}</dd>
      </dl>
    </Card>}
    <div className="flex flex-wrap gap-2">
      <BookAnother primary={stage === "done" || stage === "closed"} />
      {contactWhatsapp && <a className={buttonClass()} href={whatsappLink(contactWhatsapp, contactMessage(about))} target="_blank" rel="noopener noreferrer"><FaWhatsapp size={16} aria-hidden="true" />Consultar por WhatsApp</a>}
      {contactWhatsapp && open && <a className={buttonClass()} href={whatsappLink(contactWhatsapp, cancellationRequestMessage(about))} target="_blank" rel="noopener noreferrer">Pedir la cancelación</a>}
    </div>
    {open && booking.rules.length > 0 && <Card className="grid gap-2">
      <h2 className="m-0 font-display text-lg font-normal text-ink">Si necesitás cancelar</h2>
      <ul className="m-0 grid list-disc gap-1 pl-5 text-muted">{describeRules(booking.rules).map(line => <li key={line}>{line}</li>)}</ul>
    </Card>}
  </div>;
}
