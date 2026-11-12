import type { ReactNode } from "react";
import { Cinzel_Decorative, Source_Sans_3 } from "next/font/google";
import { Share2 } from "lucide-react";
import { ShareButton } from "@/shared/ui/share-button";
import { Brand, CtaLink, reservePath } from "./site-parts";
import { SiteNav } from "./site-nav";
import { SiteHeader } from "./site-header";
import { SiteMotion } from "./site-motion";
import { SiteFooter } from "./site-footer";

// Cinzel carries the identity; Source Sans keeps reading and controls clear (docs/SAUNA.md §12).
const display = Cinzel_Decorative({ subsets: ["latin"], weight: ["400"], display: "swap", variable: "--font-cinzel-decorative" });
const reading = Source_Sans_3({ subsets: ["latin"], display: "swap", variable: "--font-source-sans" });

/** The theme, header and footer of the public site. `home` is where the page lives: the public root, or the panel's preview. */
export function SiteFrame({ siteName, home, termsHref, address = "", preview = false, children }: { siteName: string; home: string; termsHref: string; address?: string; preview?: boolean; children: ReactNode }) {
  const root = home || "/";
  // The size and the reset on <main> repeat the public site's defaults: the preview lives inside the panel, whose CSS would otherwise make it look different.
  return <div data-theme="sauna" className={`${display.variable} ${reading.variable} relative flex min-h-dvh flex-col bg-bg font-text text-lg/relaxed text-ink antialiased selection:bg-accent selection:text-accent-ink`}>
    <SiteMotion />
    <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-40 focus:rounded-control focus:bg-surface focus:p-3">Ir al contenido</a>
    {preview && <p role="status" className="fixed right-4 bottom-4 z-30 m-0 max-w-[calc(100%-2rem)] rounded-control border border-warn-line bg-warn-bg px-3 py-2 text-base text-warn-ink shadow-lift">Vista previa: sin publicar y sin tomar reservas.</p>}
    {/* Pages reserve the same header space, including the panel's preview. */}
    <SiteHeader home={root}>
      {/* Three columns: the section links (the menu button on a phone) on the left, the brand in the middle, share and booking on the right. */}
      <div className="flex items-center justify-start"><SiteNav home={home} /></div>
      {/* Above the phone menu's sheet (z-30), which opens under the header row. */}
      <div className="relative z-40 justify-self-center"><Brand name={siteName} href={root} src="/fropexio-logo-navbar.webp" /></div>
      <div className="flex items-center justify-end gap-2">
        <div className="flex items-center gap-2">
          {/* Always the home page: a reservation's or a plan's address is private to its owner. The preview is not public, so nothing to share. */}
          {!preview && <ShareButton path={root} title={siteName} label="Compartir" className="grid size-control place-items-center rounded-control text-ink transition-opacity duration-150 hover:opacity-60">
            <Share2 size={20} strokeWidth={1.5} aria-hidden="true" />
          </ShareButton>}
          {/* On a phone the hero's button is right below, and both would not fit next to the brand. */}
          <div className="hidden sm:block"><CtaLink href={reservePath(root)}>Reservar</CtaLink></div>
        </div>
      </div>
    </SiteHeader>
    <main id="contenido" className="m-0 w-full max-w-none flex-1 p-0">{children}</main>
    <SiteFooter siteName={siteName} home={root} termsHref={termsHref} address={address} preview={preview} />
  </div>;
}
