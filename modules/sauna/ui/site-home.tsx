import Image from "next/image";
import jungleLight from "../../../public/selvatropical.webp";
import type { TurnType } from "../domain/hours";
import type { PageContent } from "../domain/page";
import { type PolicyRule } from "../domain/policy";
import type { BookingFlowData } from "./booking-flow";
import { CtaLink, Eyebrow, Title } from "./site-parts";
import { SiteVisitGuide } from "./site-visit-guide";
import { SiteHero } from "./site-hero";
import { PlanCard, SessionCard } from "./site-session";
import { SiteLocation } from "./site-location";
import type { MapLocation } from "../domain/map-location";

// The headline, intro and every list come from the panel. The brand lines around them are fixed here, on purpose: they are part of the design and promise nothing about health (docs/SAUNA.md §12).

export type SiteHomeData = {
  booking: BookingFlowData;
  page: PageContent;
  types: TurnType[];
  depositPercent: number;
  rules: PolicyRule[];
  hours: string[];
  contactLink: string | null;
  location: MapLocation | null;
};

const sectionX = "px-[7%] lg:px-[8%]";
const reading = "m-0 text-lg leading-8 text-muted";

function PlainList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="grid content-start gap-2">
      <span className="block text-base font-medium text-brand-highlight">{title}</span>
      <ul className="m-0 list-none p-0">
        {items.map((item) => (
          <li
            key={item}
            className="border-b border-night-muted/30 py-2.5 text-base leading-6 text-night-ink"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteHome({ data, reserveHref = "/reservar" }: { data: SiteHomeData; reserveHref?: string }) {
  const {
    booking,
    page,
    types,
    depositPercent,
    rules,
    hours,
    contactLink,
    location,
  } = data;
  const hasPlace =
    hours.length > 0 || Boolean(page.address) || Boolean(location);
  const minutes = [...new Set(types.map((type) => type.durationMinutes))].sort((a, b) => a - b);
  const individual = types.some((type) => type.priceCents !== null);
  const group = types.some((type) => type.privatePriceCents !== null);
  const facts = [
    minutes.length > 0 && `Sesiones de ${minutes.join(" o ")} minutos`,
    individual && group ? "Individual o grupal" : individual ? "Individual" : group ? "Grupal" : "",
    types.length > 0 && "Seña online",
  ].filter((fact): fact is string => Boolean(fact));
  return (
    <>
      <SiteHero reserveHref={reserveHref} headline={page.headline} intro={page.intro} hasSessions={types.length > 0} facts={facts} />


      {(types.length > 0 || booking.plans.length > 0) && (
        <section
          id="sesiones"
          className={`${sectionX} scroll-mt-4 bg-sand py-20 md:py-28`}
        >
          <div className="mb-9 max-w-2xl">
            <h2 className="m-0 font-display text-3xl/snug font-normal md:text-4xl">Las sesiones</h2>
            <p className={`${reading} mt-4`}>{booking.plans.length > 0 ? "Venís una vez o armás un plan de varios turnos a un precio único." : "Elegí cuánto tiempo y con quién venís."} El precio y la seña los ves antes de confirmar.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {types.map((type) => <SessionCard key={type.id} reserveHref={reserveHref} type={type} depositPercent={depositPercent} />)}
            {booking.plans.map(plan => <PlanCard key={plan.id} plan={plan} reserveHref={reserveHref} />)}
          </div>
        </section>
      )}

      {!!booking.herbs?.length && <section id="fropexionekurel" className="grid gap-6 px-[7%] py-16 lg:px-[8%]">
        <Eyebrow>FropexioÑekurel</Eyebrow>
        <h2 className="m-0 font-display text-3xl font-normal">Una hierba para tu sesión</h2>
        <p className="m-0 text-muted">Conocé las opciones y elegí una al reservar. También podés venir sin hierba.</p>
        <div>{booking.herbs.map(herb => <article key={herb.id} className="grid gap-3 border-t border-line py-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div><h3 className="m-0 font-display text-xl font-normal">{herb.name}</h3>{herb.description && <p className="mt-2 mb-0 whitespace-pre-line text-base leading-6 text-muted">{herb.description}</p>}</div>
          <a href={`${reserveHref}?hierba=${encodeURIComponent(herb.id)}`} className="flex min-h-control items-center text-base text-accent-text no-underline underline-offset-4 hover:underline">Reservar con esta hierba</a>
        </article>)}</div>
      </section>}

      <section
        id="espacio"
        className="grid scroll-mt-4 md:min-h-[650px] md:grid-cols-2"
      >
        <div className="relative h-92 overflow-hidden md:h-auto">
          <Image
            src={jungleLight}
            alt="Hojas grandes de selva tropical, con vapor y rayos de sol dorados entre la vegetación."
            fill
            placeholder="blur"
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover object-center"
          />
        </div>
        <div className="flex flex-col items-start justify-center bg-night px-[9%] py-16 md:py-20 lg:px-[12%]">
          <Title lines={["La belleza de"]} accent="lo esencial." size="panel" dark />
          <p className="m-0 mt-5 text-lg leading-8 text-night-muted">
            Texturas que invitan a sentir. Luz que acompaña. El aroma de la
            madera y el sonido de tu propia respiración.
          </p>
          {(page.includes.length > 0 || page.bring.length > 0) && (
            <div className="mt-9 grid w-full gap-8 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
              <PlainList title="Qué incluye" items={page.includes} />
              <PlainList title="Qué traer" items={page.bring} />
            </div>
          )}
        </div>
      </section>

      <SiteVisitGuide page={page} rules={rules} />

      {hasPlace && (
        <section
          id="horarios"
          className={`${sectionX} grid scroll-mt-4 gap-x-20 gap-y-8 bg-sand py-20 md:grid-cols-[1fr_1.25fr] md:py-28`}
        >
          <div className="grid content-start gap-8">
            <Title
              lines={page.address ? ["Cuándo venir"] : ["Cuándo"]}
              accent={page.address ? "y cómo llegar." : "venir."}
            />
          </div>
          <div className="grid content-start justify-items-start gap-6">
            {page.address && (
              <p className="m-0 text-lg text-ink">{page.address}</p>
            )}
            {hours.length > 0 && (
              <ul className="m-0 w-full list-none border-t border-line-strong p-0">
                {hours.map((line) => (
                  <li
                    key={line}
                    className="border-b border-line-strong py-4 text-lg text-ink"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            )}
            {(page.mapUrl || contactLink) && (
              <div className="flex flex-wrap gap-2">
                {page.mapUrl && (
                  <CtaLink href={page.mapUrl} kind="outline" external>
                    Abrir el mapa
                  </CtaLink>
                )}
                {contactLink && (
                  <CtaLink href={contactLink} kind="outline" external>
                    Escribinos por WhatsApp
                  </CtaLink>
                )}
              </div>
            )}
          </div>
          {location && (
            <div className="min-w-0 md:col-span-2">
              <SiteLocation
                location={location}
                address={page.address}
                mapUrl={page.mapUrl}
              />
            </div>
          )}
        </section>
      )}

      <section className="grid items-center gap-8 bg-night px-[7%] py-16 md:grid-cols-[1fr_auto] md:py-20 lg:px-[8%]">
        <Title
          lines={["Tu momento"]}
          accent="empieza acá."
          size="closing"
          dark
        />
        <CtaLink href={reserveHref} kind="light" className="w-fit gap-12">
          Reservar
        </CtaLink>
      </section>

    </>
  );
}
