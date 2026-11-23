import { FaWhatsapp } from "react-icons/fa";
import { formatCents } from "@/platform/money";
import { moneyState } from "../domain/agenda";
import { effectiveStatus, type BookingStatus } from "../domain/booking";
import { contactMessage, transferProofMessage, whatsappLink } from "../domain/messages";
import type { Movement } from "../domain/payments";
import { describeRules, type PolicyRule } from "../domain/policy";
import type { TransferAccount } from "../domain/setup";
import { businessDate, businessTime, dayLabel } from "../domain/time";
import { buttonClass, Card, Tag } from "./controls";
import { PaymentChoice } from "./payment-choice";
import { AddToCalendar } from "./add-to-calendar";
import { BookAnother, ProgressSteps, ResultHero, type Stage } from "./result-parts";

export type PlanViewData = {
  plan: {
    name: string; turns: number; priceCents: number; rules: PolicyRule[]; customerName: string;
    bookings: {
      status: BookingStatus; expiresAt: string | null; depositCents: number; priceCents: number; discountCents: number;
      herbName?: string | null; startsAt: string; endsAt: string; typeName: string; movements: Movement[]; roomName: string;
    }[];
  };
  now: string;
  /** Street and district, for the calendar events. */
  address: string;
  contactWhatsapp: string | null;
  payment: { mercadopago: boolean; transfer: TransferAccount | null; returned: boolean };
};

const turnStatus: Partial<Record<BookingStatus, string>> = { cancelled: "Cancelado", expired: "Vencido", completed: "Realizado", no_show: "Sin asistencia" };

/** The person's own plan: every turn it holds and what is left to pay. Like a booking's page, only the secret link opens it. */
export function PlanView({ data, siteId, token, link, siteName }: { data: PlanViewData; siteId: string; token: string; link: string; siteName: string }) {
  const { plan, now, address, contactWhatsapp, payment } = data;
  const statuses = plan.bookings.map(booking => effectiveStatus(booking, now));
  const all = (status: BookingStatus) => statuses.length > 0 && statuses.every(each => each === status);
  const stage: Stage = all("held") ? "pay" : all("pending_transfer") ? "transfer" : statuses.some(each => each === "confirmed" || each === "completed") ? "done" : "closed";
  const money = plan.bookings.map(moneyState).reduce((sum, each) => ({
    paidCents: sum.paidCents + each.paidCents, depositDueCents: sum.depositDueCents + each.depositDueCents, owedCents: sum.owedCents + each.owedCents,
  }), { paidCents: 0, depositDueCents: 0, owedCents: 0 });
  const holds = plan.bookings.map(booking => booking.expiresAt).filter((value): value is string => value !== null).sort();
  const holdUntil = holds[0] ?? null;
  const first = plan.bookings[0]?.startsAt ?? now;
  const about = { siteName, startsAt: first, link };
  const canPay = payment.mercadopago || payment.transfer !== null;
  const firstName = plan.customerName.split(" ")[0];
  const titles: Record<Stage, string> = {
    pay: "Falta un paso: pagá la seña para confirmar tus turnos",
    transfer: "Cuando llegue la transferencia, confirmamos tus turnos",
    done: `¡Listo${firstName ? `, ${firstName}` : ""}! Tu plan está reservado`,
    closed: "Este plan ya no tiene turnos vigentes",
  };
  const eyebrows: Record<Stage, string> = { pay: "Turnos guardados", transfer: "Esperando tu transferencia", done: "Plan confirmado", closed: plan.name };

  return <div className="grid gap-5">
    {stage !== "closed" && <ProgressSteps stage={stage} />}
    <ResultHero stage={stage} eyebrow={eyebrows[stage]} title={titles[stage]}>
      <p className="m-0 text-muted">{plan.name} · {plan.turns} turnos · {formatCents(plan.priceCents)}</p>
    </ResultHero>

    <Card className={`grid gap-2 ${stage === "done" ? "border-accent" : ""}`}>
      <h2 className="m-0 text-xs font-normal text-muted">Tus turnos</h2>
      <ol className="m-0 grid list-none gap-2 p-0">
        {plan.bookings.map((booking, index) => {
          const label = turnStatus[statuses[index]];
          return <li key={booking.startsAt} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-line pt-2 first:border-0 first:pt-0">
            <span className="text-ink first-letter:uppercase">{dayLabel(businessDate(booking.startsAt))}</span>
            <span className="flex items-center gap-2 text-muted tabular-nums">
              {businessTime(booking.startsAt)} a {businessTime(booking.endsAt)}{booking.roomName && ` · ${booking.roomName}`}
              {booking.herbName && <Tag>Hierba: {booking.herbName}</Tag>}
              {label && <Tag>{label}</Tag>}
            </span>
          </li>;
        })}
      </ol>
    </Card>

    {stage === "pay" && holdUntil && <div className="grid gap-3">
      {payment.returned && money.paidCents === 0 && <p className="m-0 text-ink">Todavía no nos llegó la confirmación de Mercado Pago. Si ya pagaste, recargá la página en un minuto.</p>}
      <p className="m-0 text-ink">
        Guardamos tus turnos hasta las <strong className="font-semibold">{businessTime(holdUntil)}</strong>.{" "}
        {canPay ? `Para confirmarlos, pagá la seña de ${formatCents(money.depositDueCents)}.` : "Escribinos por WhatsApp para confirmarlos."}
      </p>
      {canPay && <PaymentChoice siteId={siteId} token={token} mercadopago={payment.mercadopago} transfer={payment.transfer !== null} plan />}
    </div>}

    {stage === "transfer" && holdUntil && <Card className="grid gap-3">
      <h2 className="m-0 font-display text-lg font-normal text-ink">Datos para transferir</h2>
      {payment.transfer
        ? <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted">Monto exacto</dt><dd className="m-0 text-right font-semibold text-ink tabular-nums select-all">{formatCents(money.depositDueCents)}</dd>
          {payment.transfer.alias && <><dt className="text-muted">Alias</dt><dd className="m-0 text-right font-semibold break-all text-ink select-all">{payment.transfer.alias}</dd></>}
          {payment.transfer.cbu && <><dt className="text-muted">CBU/CVU</dt><dd className="m-0 text-right font-semibold break-all text-ink tabular-nums select-all">{payment.transfer.cbu}</dd></>}
          <dt className="text-muted">Titular</dt><dd className="m-0 text-right font-semibold text-ink">{payment.transfer.holder}</dd>
        </dl>
        : <p className="m-0 text-ink">Escribinos por WhatsApp y te pasamos los datos para transferir {formatCents(money.depositDueCents)}.</p>}
      <p className="m-0 text-muted">Guardamos tus turnos hasta el {dayLabel(businessDate(holdUntil))} a las {businessTime(holdUntil)}. Cuando transfieras, mandanos el comprobante.</p>
      {contactWhatsapp && <div><a className={buttonClass("primary", "lg")} href={whatsappLink(contactWhatsapp, transferProofMessage({ ...about, amountCents: money.depositDueCents }))} target="_blank" rel="noopener noreferrer"><FaWhatsapp size={16} aria-hidden="true" />Enviar el comprobante</a></div>}
      {payment.mercadopago && <div className="grid gap-2 border-t border-line pt-3">
        <p className="m-0 text-muted">¿Preferís pagar ahora con Mercado Pago? Los turnos se confirman en el momento.</p>
        <PaymentChoice siteId={siteId} token={token} mercadopago transfer={false} plan />
      </div>}
    </Card>}

    {stage !== "closed" && <Card>
      <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        <dt className="text-muted">Precio del plan</dt><dd className="m-0 text-right text-ink tabular-nums">{formatCents(plan.priceCents)}</dd>
        {money.depositDueCents > 0 && <><dt className="text-muted">Seña</dt><dd className="m-0 text-right font-semibold text-ink tabular-nums">{formatCents(money.depositDueCents)}</dd></>}
        {money.paidCents > 0 && <><dt className="text-muted">Pagado</dt><dd className="m-0 text-right text-ink tabular-nums">{formatCents(money.paidCents)}</dd></>}
        <dt className="text-muted">A pagar en el lugar</dt><dd className="m-0 text-right text-ink tabular-nums">{formatCents(money.owedCents - money.depositDueCents)}</dd>
      </dl>
    </Card>}
    {stage === "done" && <p className="m-0 text-muted">Guardá esta página: desde este enlace ves tus turnos cuando quieras.</p>}
    <AddToCalendar now={now} link={link} events={plan.bookings.filter((_, index) => statuses[index] === "confirmed").map(booking => ({ title: `${siteName}: ${booking.typeName || plan.name}`, startsAt: booking.startsAt, endsAt: booking.endsAt, location: address, description: [plan.name, booking.herbName && `Hierba: ${booking.herbName}`].filter(Boolean).join(" · "), url: link }))} />

    <div className="flex flex-wrap gap-2">
      <BookAnother primary={stage === "done" || stage === "closed"} />
      {contactWhatsapp && <a className={buttonClass("quiet", "lg")} href={whatsappLink(contactWhatsapp, contactMessage(about))} target="_blank" rel="noopener noreferrer"><FaWhatsapp size={16} aria-hidden="true" />Consultar por WhatsApp</a>}
    </div>
    {stage !== "closed" && plan.rules.length > 0 && <Card className="grid gap-2">
      <h2 className="m-0 font-display text-lg font-normal text-ink">Si necesitás cancelar</h2>
      <p className="m-0 text-muted">Cada turno del plan se rige por estas reglas. Para cancelar, escribinos por WhatsApp.</p>
      <ul className="m-0 grid list-disc gap-1 pl-5 text-muted">{describeRules(plan.rules).map(line => <li key={line}>{line}</li>)}</ul>
    </Card>}
  </div>;
}
