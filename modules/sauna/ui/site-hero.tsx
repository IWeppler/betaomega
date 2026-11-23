import { HeroImage } from "./site-hero-image";
import { CtaLink, textLinkClass } from "./site-parts";

/** Short facts about what is sold, built from the session types: they sit under the buttons so the first screen says what, how long and how. */
export function SiteHero({ reserveHref, headline, intro, hasSessions, facts }: { reserveHref: string; headline: string; intro: string; hasSessions: boolean; facts: string[] }) {
  // Text sits on the photograph's dark gradient. Each line rises once on load (`animate-rise`), in reading order.
  // The photograph sits inside a margin of page colour, like a framed picture; the header floats over the frame's top edge.
  return <section className="w-full p-3 sm:p-4 lg:p-5">
    <div className="relative isolate flex min-h-[calc(100svh-1.5rem)] w-full items-end overflow-hidden rounded-[1.25rem] sm:min-h-[calc(100svh-2rem)] sm:rounded-[1.5rem] lg:min-h-[min(880px,calc(100svh-2.5rem))] lg:items-center lg:rounded-[2rem]">
    <HeroImage />
    <div className="relative z-10 flex w-full flex-col px-[7%] pt-40 pb-12 sm:px-[10%] lg:max-w-[52rem] lg:py-16 lg:pt-32 lg:pl-[8%]">
      <h1 className="m-0 max-w-[14ch] animate-rise text-balance font-display text-[clamp(2.4rem,4.6vw,5rem)]/[1.18] font-normal tracking-tight text-night-ink [animation-delay:120ms]">{headline}</h1>
      <div className="mt-7 max-w-md">
        {intro && <p className="m-0 animate-rise text-xl leading-8 text-night-ink/90 [animation-delay:260ms]">{intro}</p>}
        <div className="mt-8 flex animate-rise flex-wrap items-center gap-x-7 gap-y-3 [animation-delay:400ms]">
          <CtaLink href={reserveHref} kind="light">Reservar mi sesión</CtaLink>
          {hasSessions && <a href="#sesiones" className={`${textLinkClass} text-night-ink`}>Ver sesiones y precios</a>}
        </div>
        {facts.length > 0 && <ul className="m-0 mt-10 flex animate-rise list-none flex-wrap gap-x-6 gap-y-2 border-t border-night-ink/25 p-0 pt-5 text-base text-night-ink/85 [animation-delay:540ms]">
          {facts.map(fact => <li key={fact}>{fact}</li>)}
        </ul>}
      </div>
    </div>
    </div>
  </section>;
}
