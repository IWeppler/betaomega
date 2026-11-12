import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatCents } from "@/platform/money";
import { describeRules } from "../domain/policy";
import { planSummary } from "../domain/plans";
import { BookingFlow } from "./booking-flow";
import type { SiteHomeData } from "./site-home";

/**
 * The booking, on a page of its own. Next to the steps (a card the width the seven days need) sits what a person checks before paying: the sessions with
 * their prices, the deposit and the cancellation policy. The steps keep their own state, so the page only has to hand them the chosen herb, if any.
 */
export function SiteBookingPage({ data, homeHref, initialHerbId = "", initialPlanId = "" }: { data: SiteHomeData; homeHref: string; initialHerbId?: string; initialPlanId?: string }) {
  const { booking, types, depositPercent, rules } = data;
  return <div className="px-[7%] pt-32 pb-20 lg:px-[8%] lg:pt-40">
    <div className="mx-auto max-w-6xl">
      <Link href={homeHref} className="inline-flex min-h-control items-center gap-2 text-base text-muted no-underline transition-colors duration-200 hover:text-ink"><ArrowLeft size={16} aria-hidden="true" />Volver al inicio</Link>
      <h1 className="sr-only">Reservar una sesión</h1>
      <div className="mt-4 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,35rem)] lg:gap-16">
        <div className="min-w-0 rounded-card border border-line bg-surface p-5 sm:p-8 lg:order-2">
          <BookingFlow data={{ ...booking, initialHerbId, initialPlanId }} />
        </div>
        <aside aria-label="Antes de confirmar" className="grid content-start gap-8 lg:order-1 lg:pt-3">
          {types.length > 0 && <section>
            <h2 className="m-0 mb-4 font-display text-2xl/snug font-normal text-ink">Las sesiones</h2>
            <ul className="m-0 list-none border-t border-line-strong p-0">
              {types.map(type => <li key={type.id} className="grid gap-1 border-b border-line-strong py-4">
                <span className="text-lg font-medium text-ink">{type.name}</span>
                <span className="text-base text-muted">
                  {[type.priceCents !== null && `Individual ${formatCents(type.priceCents)}`, type.privatePriceCents !== null && `Grupal ${formatCents(type.privatePriceCents)}`].filter(Boolean).join(" · ")}
                </span>
              </li>)}
            </ul>
            <p className="m-0 mt-4 text-base leading-6 text-muted">{(types[0].depositPercent ?? depositPercent) > 0 ? "Pagás una seña para guardar el lugar y el resto en la sesión." : "Sin seña: se paga en el lugar."}</p>
          </section>}
          {booking.plans.length > 0 && <section>
            <h2 className="m-0 mb-4 font-display text-2xl/snug font-normal text-ink">Planes</h2>
            <ul className="m-0 list-none border-t border-line-strong p-0">
              {booking.plans.map(plan => <li key={plan.id} className="grid gap-1 border-b border-line-strong py-4">
                <span className="flex items-baseline justify-between gap-4 text-lg font-medium text-ink"><span>{plan.name}</span><span className="tabular-nums">{formatCents(plan.priceCents)}</span></span>
                <span className="text-base text-muted">{planSummary(plan)}.</span>
              </li>)}
            </ul>
          </section>}
          {rules.length > 0 && <section>
            <h2 className="m-0 mb-4 font-display text-2xl/snug font-normal text-ink">Si necesitás cancelar</h2>
            <ul className="m-0 grid list-disc gap-2 pl-5 text-base leading-6 text-muted marker:text-accent-text">{describeRules(rules).map(line => <li key={line} className="pl-1">{line}</li>)}</ul>
          </section>}
        </aside>
      </div>
    </div>
  </div>;
}
