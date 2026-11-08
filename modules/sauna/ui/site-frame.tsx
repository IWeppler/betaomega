import type { ReactNode } from "react";
import { Cinzel_Decorative } from "next/font/google";
import { Brand, CtaLink } from "./site-parts";
import { SiteNav } from "./site-nav";
import { SiteMotion } from "./site-motion";
import { InstallApp } from "./install-app";

// One typeface for the brand and every title; reading text stays in the system sans (docs/SAUNA.md §12).
const display = Cinzel_Decorative({ subsets: ["latin"], weight: ["400"], display: "swap", variable: "--font-cinzel-decorative" });

/** The theme, header and footer of the public site. `home` is where the page lives: the public root, or the panel's preview. */
export function SiteFrame({ siteName, home, termsHref, preview = false, children }: { siteName: string; home: string; termsHref: string; preview?: boolean; children: ReactNode }) {
  const root = home || "/";
  // The size and the reset on <main> repeat the public site's defaults: the preview lives inside the panel, whose CSS would otherwise make it look different.
  return <div data-theme="sauna" className={`${display.variable} relative flex min-h-dvh flex-col bg-bg font-text text-[15px]/normal text-ink antialiased selection:bg-accent selection:text-accent-ink`}>
    <SiteMotion />
    <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-40 focus:rounded-control focus:bg-surface focus:p-3">Ir al contenido</a>
    {preview && <p role="status" className="fixed right-4 bottom-4 z-30 m-0 max-w-[calc(100%-2rem)] rounded-control border border-warn-line bg-warn-bg px-3 py-2 text-[13px] text-warn-ink shadow-lift">Vista previa: sin publicar y sin tomar reservas.</p>}
    {/* Over the hero; pages without one leave room for it with `pt-36`. */}
    <header className="absolute inset-x-0 top-0 z-20 flex h-24 items-center justify-between gap-4 border-b border-ink/20 px-[6%] text-ink lg:h-28 lg:px-[5%]">
      {/* Above the phone menu's sheet (z-30), which opens under the header row. */}
      <div className="relative z-40"><Brand name={siteName} href={root} /></div>
      <div className="flex items-center gap-2 md:contents">
        <SiteNav home={home} />
        {/* On a phone the hero's button is right below, and both would not fit next to the brand. */}
        <div className="hidden sm:block"><CtaLink href={`${home}#reservar`} kind="overlay">Reservar una pausa</CtaLink></div>
      </div>
    </header>
    <main id="contenido" className="m-0 w-full max-w-none flex-1 p-0">{children}</main>
    <footer className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-t border-line px-[7%] pt-10 lg:px-[5%] ${preview ? "pb-20" : "pb-10"}`}>
      <Brand name={siteName} href={root} compact />
      <p className="m-0 font-serif text-[15px] text-muted italic">Un espacio para volver a vos.</p>
      <div className="flex w-full flex-wrap gap-x-5 gap-y-1 text-xs text-muted sm:w-auto">
        <a className="text-muted underline underline-offset-4 hover:text-ink" href={termsHref}>Términos y condiciones</a>
        <InstallApp className="inline-flex items-center gap-1.5 text-muted underline underline-offset-4 hover:text-ink" helpClassName="m-0 w-full text-xs text-muted" />
        <span>© {new Date().getFullYear()} {siteName}</span>
      </div>
    </footer>
  </div>;
}
