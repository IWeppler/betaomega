import type { ReactNode } from "react";
import { ArrowUpRight, Clock3, Layers } from "lucide-react";
import { formatCents } from "@/platform/money";
import type { TurnType } from "../domain/hours";
import { planSummary } from "../domain/plans";
import type { PublicPlan } from "./booking-flow";

/** Every offer on the home page, a single session or a plan, is this one card: a label, a title, a few lines, and a footer with the price and the arrow. */
function OfferCard({ href, kicker, title, lines, footer }: { href: string; kicker: ReactNode; title: string; lines: string[]; footer: ReactNode }) {
  return <a href={href} className="group grid content-between gap-8 rounded-card border border-line-strong bg-surface p-6 text-ink no-underline transition-[translate,border-color] duration-300 ease-standard hover:-translate-y-0.5 hover:border-accent md:p-8">
    <div className="grid content-start gap-3">
      <span className="flex items-center gap-2 text-base text-muted">{kicker}</span>
      <h4 className="m-0 font-display text-2xl/snug font-normal">{title}</h4>
      {lines.map(line => <p key={line} className="m-0 text-base leading-6 text-muted">{line}</p>)}
    </div>
    <div className="flex items-end justify-between gap-4 border-t border-line pt-5">
      {footer}
      <span className="grid size-11 shrink-0 place-items-center rounded-full border border-line-strong text-accent-text transition-[background-color,border-color,color,translate,scale] duration-300 ease-standard group-hover:border-accent group-hover:bg-accent group-hover:text-accent-ink group-active:scale-95"><ArrowUpRight size={20} aria-hidden="true" /><span className="sr-only">Reservar</span></span>
    </div>
  </a>;
}

const amount = "font-text text-2xl font-medium tabular-nums";

export function SessionCard({ type, depositPercent, reserveHref }: { type: TurnType; depositPercent: number; reserveHref: string }) {
  const deposit = type.depositPercent ?? depositPercent;
  const prices = [
    type.priceCents !== null && { label: "Individual", cents: type.priceCents },
    type.privatePriceCents !== null && { label: "Grupal", cents: type.privatePriceCents },
  ].filter((price): price is { label: string; cents: number } => Boolean(price));
  const durationInName = new RegExp(`\\b${type.durationMinutes}\\b`).test(type.name);
  return <OfferCard
    href={reserveHref}
    kicker={<><Clock3 size={16} aria-hidden="true" />Un turno</>}
    title={type.name}
    lines={[...durationInName ? [] : [`${type.durationMinutes} minutos.`], deposit > 0 ? `Seña del ${deposit} % para reservar. El resto se paga en el lugar.` : "Sin seña: se paga en el lugar."]}
    footer={<dl className="m-0 flex flex-wrap gap-x-6 gap-y-2">
      {prices.map(price => <div key={price.label} className="grid gap-1">
        <dt className="text-base text-muted">{price.label}</dt>
        <dd className={`m-0 ${amount}`}>{formatCents(price.cents)}</dd>
      </div>)}
    </dl>}
  />;
}

/** A plan: several turns for one price, chosen together when booking. It takes the person to the booking with that plan already selected. */
export function PlanCard({ plan, reserveHref }: { plan: PublicPlan; reserveHref: string }) {
  const perTurn = Math.round(plan.priceCents / plan.turns);
  return <OfferCard
    href={`${reserveHref}?plan=${encodeURIComponent(plan.id)}`}
    kicker={<><Layers size={16} aria-hidden="true" />{plan.turns} turnos</>}
    title={plan.name}
    lines={[...plan.description ? [plan.description] : [], `${planSummary(plan)}.`]}
    footer={<div className="grid gap-1">
      <span className={amount}>{formatCents(plan.priceCents)}</span>
      <span className="text-base text-muted">{formatCents(perTurn)} por turno</span>
    </div>}
  />;
}
