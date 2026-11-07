import type { ReactNode } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUpRight, Plus } from "lucide-react";
import { formatCents } from "@/platform/money";
import type { TurnType } from "../domain/hours";
import type { PageContent } from "../domain/page";
import { describeRules, type PolicyRule } from "../domain/policy";
import { BookingDialog } from "./booking-dialog";
import type { BookingFlowData } from "./booking-flow";
import { BrandMark, CtaLink, Eyebrow, Title } from "./site-parts";

// The headline, intro and every list come from the panel. The brand lines around them are fixed here, on purpose: they are part of the design and promise nothing about health (docs/SAUNA.md §12).

export type SiteHomeData = {
  booking: BookingFlowData;
  page: PageContent;
  types: TurnType[];
  depositPercent: number;
  rules: PolicyRule[];
  hours: string[];
  contactLink: string | null;
};

const RESERVE = "#reservar";
const sectionX = "px-[7%] lg:px-[8%]";
const reading = "m-0 text-[15px] leading-7 text-muted";

/** "Afuera, el mundo. Adentro, la calma." becomes two lines, the last one in the accent. A single sentence stays as it is. */
function HeroTitle({ text }: { text: string }) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const last = sentences.length > 1 ? sentences.at(-1) : undefined;
  return <h1 className="m-0 mt-7 mb-6 font-display text-[clamp(2.5rem,5.3vw,5rem)]/[1.25] font-normal tracking-tight text-ink">
    {(last ? sentences.slice(0, -1) : sentences).map(sentence => <span key={sentence} className="block">{sentence}</span>)}
    {last && <span className="block text-accent-text">{last}</span>}
  </h1>;
}

function SectionLabel({ number, children, aside }: { number: string; children: ReactNode; aside?: ReactNode }) {
  return <div className="flex items-start justify-between gap-4">
    <Eyebrow>{number} / {children}</Eyebrow>
    {aside && <div className="hidden sm:block">{aside}</div>}
  </div>;
}

function SessionRow({ type, index, depositPercent }: { type: TurnType; index: number; depositPercent: number }) {
  const deposit = type.depositPercent ?? depositPercent;
  return <a href={RESERVE} className="group flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line-strong px-1 py-8 text-inherit no-underline transition-colors duration-150 hover:bg-bg sm:flex-nowrap sm:gap-x-12">
    <span className="self-start pt-5 font-serif text-[15px] text-muted" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
    <div className="grid min-w-0 flex-1 basis-56 gap-2">
      <Eyebrow>{type.durationMinutes} minutos</Eyebrow>
      <h3 className="m-0 font-display text-[clamp(1.25rem,2vw,1.625rem)] font-normal text-ink">{type.name}</h3>
      <p className={`${reading} text-sm`}>{deposit > 0 ? `Seña del ${deposit} % para reservar. El resto se paga en el lugar.` : "Sin seña: se paga en el lugar."}</p>
    </div>
    <dl className="m-0 grid gap-2 sm:text-right">
      {type.priceCents !== null && <div><dd className="m-0 font-display text-2xl text-accent-text">{formatCents(type.priceCents)}</dd><dt className="text-xs text-muted">individual</dt></div>}
      {type.privatePriceCents !== null && <div><dd className="m-0 font-display text-lg text-ink">{formatCents(type.privatePriceCents)}</dd><dt className="text-xs text-muted">grupal</dt></div>}
    </dl>
    <span className="ml-auto grid size-11 shrink-0 place-items-center rounded-full border border-line-strong text-ink transition-colors duration-150 group-hover:border-accent group-hover:text-accent-text" aria-hidden="true"><ArrowUpRight size={20} strokeWidth={1.25} /></span>
  </a>;
}

function PlainList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return <div className="grid content-start gap-2">
    <Eyebrow>{title}</Eyebrow>
    <ul className="m-0 list-none p-0">{items.map(item => <li key={item} className="border-b border-line-strong/60 py-2.5 text-sm leading-6 text-ink">{item}</li>)}</ul>
  </div>;
}

function Question({ title, open = false, children }: { title: string; open?: boolean; children: ReactNode }) {
  return <details open={open} className="group border-b border-line-strong py-5">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-[15px] text-ink [&::-webkit-details-marker]:hidden">
      {title}
      <Plus size={20} strokeWidth={1.25} aria-hidden="true" className="shrink-0 transition-transform duration-150 group-open:rotate-45" />
    </summary>
    <div className="pt-4 text-sm leading-7 text-muted">{children}</div>
  </details>;
}

const Lines = ({ items }: { items: string[] }) => <ul className="m-0 grid list-none gap-1.5 p-0">{items.map(item => <li key={item}>{item}</li>)}</ul>;

export function SiteHome({ data }: { data: SiteHomeData }) {
  const { booking, page, types, depositPercent, rules, hours, contactLink } = data;
  const hasPlace = hours.length > 0 || Boolean(page.address);
  const order = ["esencia", types.length > 0 && "sesiones", "espacio", "preguntas", hasPlace && "horarios"].filter(Boolean);
  const number = (id: string) => String(order.indexOf(id) + 1).padStart(2, "0");
  return <>
    {/* Tall enough for the title on a short laptop, but never so tall the photo loses its shape on a huge monitor. */}
    <section className="relative h-svh min-h-[720px] max-h-[1100px] overflow-hidden bg-sunken">
      <Image src="/fropexio-paisaje.jpg" alt="" fill priority sizes="100vw" className="animate-arrive object-cover object-[60%_center] md:object-center" />
      {/* Warm dark wash, from the theme's background, so the photo takes the brand's colours and the text keeps its contrast. */}
      <div className="absolute inset-0 bg-linear-to-r from-bg/90 to-bg/35" />
      <div className="absolute inset-0 bg-linear-to-t from-bg/70 via-transparent to-bg/30" />
      <div className="relative grid h-full content-center justify-items-start px-[7%] pt-24 pb-24 lg:px-[8%]">
        <span className="flex items-center gap-3 text-[11px] tracking-[0.2em] text-ink uppercase"><i className="size-1.5 rounded-full bg-accent" />Un refugio para volver a vos</span>
        <HeroTitle text={page.headline} />
        {page.intro && <p className="m-0 max-w-[46ch] text-[15px] leading-7 text-ink">{page.intro}</p>}
        <CtaLink href={RESERVE} className="mt-9 gap-12">Encontrá tu momento</CtaLink>
      </div>
      <div className="absolute inset-x-[7%] bottom-7 flex items-center justify-between lg:inset-x-[5%]">
        <a href="#esencia" className="flex items-center gap-4 text-[11px] tracking-[0.2em] text-ink uppercase no-underline">
          <span className="grid size-10 place-items-center rounded-full border border-ink/40"><ArrowDown size={16} strokeWidth={1.25} aria-hidden="true" /></span>
          Descubrí Fropexio
        </a>
        <p className="m-0 hidden font-serif text-[15px] text-ink/85 italic md:block">Madera. Calor. Silencio.</p>
        <span className="text-[11px] tracking-[0.2em] text-ink" aria-hidden="true">01 <span className="ml-2 opacity-50">/ {String(order.length).padStart(2, "0")}</span></span>
      </div>
      <span className="absolute top-1/2 right-7 hidden text-[10px] tracking-[0.3em] text-ink/80 uppercase [writing-mode:vertical-rl] lg:block" aria-hidden="true">El arte de hacer una pausa</span>
    </section>

    <section id="esencia" className={`${sectionX} grid gap-9 py-20 md:grid-cols-[1fr_2.6fr] md:gap-[7%] md:py-28`}>
      <SectionLabel number={number("esencia")}>Nuestra esencia</SectionLabel>
      <div>
        <Eyebrow className="mb-7">Menos ruido. Más presencia.</Eyebrow>
        <Title lines={["Hay lugares a los que vas."]} accent="Y otros a los que volvés." />
        <div className="mt-9 grid gap-5 md:grid-cols-2 md:gap-11">
          <p className={reading}>Fropexio nace de una idea simple: necesitamos un lugar para parar. Un refugio donde el calor de la madera y la quietud te inviten a dejar afuera lo que pesa.</p>
          <p className={reading}>Llegá. Respirá profundo. Acá no hay nada que alcanzar, solo un momento para sentirte presente.</p>
        </div>
      </div>
    </section>

    {types.length > 0 && <section id="sesiones" className={`${sectionX} scroll-mt-4 bg-surface py-20 md:py-28`}>
      <SectionLabel number={number("sesiones")} aside={<Eyebrow>Un tiempo a tu medida</Eyebrow>}>Las sesiones</SectionLabel>
      <div className="my-10 flex flex-wrap items-end justify-between gap-6 md:my-14">
        <Title lines={["Tu pausa,"]} accent="tu manera." />
        <p className={`${reading} max-w-xs text-sm`}>No todos los días piden lo mismo. Elegí cómo querés vivir el tuyo.</p>
      </div>
      <div className="border-t border-line-strong">{types.map((type, index) => <SessionRow key={type.id} type={type} index={index} depositPercent={depositPercent} />)}</div>
    </section>}

    <section id="espacio" className="grid scroll-mt-4 md:min-h-[650px] md:grid-cols-2">
      <div className="relative h-92 md:h-auto">
        <Image src="/fropexio-sala.jpg" alt="Sauna de madera con bancos, estufa de piedras y una luz cálida." fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover object-[75%_center]" />
      </div>
      <div className="flex flex-col items-start justify-center bg-surface-sidebar px-[9%] py-16 md:py-20 lg:px-[12%]">
        <Eyebrow>{number("espacio")} / El espacio</Eyebrow>
        <BrandMark className="mt-9 mb-5 size-12 text-accent-text" />
        <Title lines={["La belleza de"]} accent="lo esencial." size="panel" />
        <p className={`${reading} mt-5`}>Texturas que invitan a sentir. Luz que acompaña. El aroma de la madera y el sonido de tu propia respiración.</p>
        {(page.includes.length > 0 || page.bring.length > 0) && <div className="mt-9 grid w-full gap-8 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
          <PlainList title="Qué incluye" items={page.includes} />
          <PlainList title="Qué traer" items={page.bring} />
        </div>}
      </div>
    </section>

    <section id="preguntas" className={`${sectionX} grid scroll-mt-4 gap-x-20 gap-y-8 py-20 md:grid-cols-[1fr_1.25fr] md:py-28`}>
      <Eyebrow className="md:col-span-2">{number("preguntas")} / Antes de tu visita</Eyebrow>
      <Title lines={["Venís a relajarte."]} accent="Empezá por acá." />
      <div className="border-t border-line-strong">
        <Question title="¿Cómo reservo un turno?">Elegí el día y el horario, y dejá tu nombre y tu WhatsApp. Antes de confirmar vas a ver el precio y la seña. Tu lugar queda guardado por un rato y la reserva se confirma por WhatsApp.</Question>
        {page.recommendations.length > 0 && <Question title="Recomendaciones"><Lines items={page.recommendations} /></Question>}
        {page.indications.length > 0 && <Question title="Indicaciones"><Lines items={page.indications} /></Question>}
        {/* Open from the start: it is the one answer nobody should miss by not clicking. */}
        {page.contraindications.length > 0 && <Question title="Contraindicaciones" open><p className="m-0 mb-3 text-ink">Si estás en alguna de estas situaciones, consultá con tu médico antes de venir.</p><Lines items={page.contraindications} /></Question>}
        {rules.length > 0 && <Question title="Si necesitás cancelar"><Lines items={describeRules(rules)} /></Question>}
      </div>
    </section>

    {hasPlace && <section id="horarios" className={`${sectionX} grid scroll-mt-4 gap-x-20 gap-y-8 border-t border-line py-20 md:grid-cols-[1fr_1.25fr] md:py-28`}>
      <div className="grid content-start gap-8">
        <Eyebrow>{number("horarios")} / Horarios</Eyebrow>
        <Title lines={page.address ? ["Cuándo venir"] : ["Cuándo"]} accent={page.address ? "y cómo llegar." : "venir."} />
      </div>
      <div className="grid content-start justify-items-start gap-6">
        {page.address && <p className="m-0 text-[15px] text-ink">{page.address}</p>}
        {hours.length > 0 && <ul className="m-0 w-full list-none border-t border-line-strong p-0">{hours.map(line => <li key={line} className="border-b border-line-strong py-4 text-[15px] text-ink">{line}</li>)}</ul>}
        {(page.mapUrl || contactLink) && <div className="flex flex-wrap gap-2">
          {page.mapUrl && <CtaLink href={page.mapUrl} kind="outline" external>Abrir el mapa</CtaLink>}
          {contactLink && <CtaLink href={contactLink} kind="outline" external>Escribinos por WhatsApp</CtaLink>}
        </div>}
      </div>
    </section>}

    <section className="grid justify-items-center bg-accent-soft px-[7%] py-20 text-center md:py-24">
      <Eyebrow>El mundo puede esperar un poco.</Eyebrow>
      <Title lines={["Tu momento"]} accent="empieza acá." size="closing" className="mt-6" />
      <CtaLink href={RESERVE} className="mt-9 gap-12">Reservar una pausa</CtaLink>
    </section>

    <BookingDialog data={booking} />
  </>;
}
