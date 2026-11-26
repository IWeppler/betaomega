"use client";

import { DownloadSimple, Heart, ShareNetwork } from "@phosphor-icons/react";
import { Heart as HeartIcon, Share2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useDonate, useInstall } from "@/app/recetas/[site]/site-hooks";
import { ShareButton } from "@/shared/ui/share-button";

/** After copying a Mercado Pago alias: the same message as the recipe sites. */
function DonationNote({ alias }: { alias: string }) {
  return <p className="p-note" role="status">Alias copiado: <strong>{alias}</strong>. Pegalo en Mercado Pago y poné el monto que quieras: la donación es voluntaria. ¡Gracias!</p>;
}

/**
 * The round buttons at the top of every page: sharing the page being viewed and, when the panel set an alias, the heart for donating.
 * `children` goes first: the layout puts there what a site adds (the advice of the day).
 */
export function HeaderActions({ donation, youtube = "", children }: { donation: string; youtube?: string; children?: ReactNode }) {
  const { donate, copied } = useDonate(donation);
  return <div className="p-top">
    <div className="p-actions">
      {children}
      {youtube && <a href={youtube} target="_blank" rel="noopener noreferrer" className="p-heart" aria-label="Canal de YouTube (se abre en otra pestaña)" title="Canal de YouTube"><YoutubeMark /></a>}
      <ShareButton className="p-heart" label="Compartir"><ShareNetwork size={22} weight="bold" aria-hidden="true" /></ShareButton>
      {donation && <button type="button" className="p-heart" aria-label="Hacer una donación" title="Hacer una donación" onClick={() => void donate()}><Heart size={22} weight="bold" aria-hidden="true" /></button>}
    </div>
    {copied && <DonationNote alias={donation} />}
  </div>;
}

/** Install button (only where the browser can install the site; iPhone has no prompt, so it explains the steps) and donation button, at the end of every page. */
export function FooterActions({ donation }: { donation: string }) {
  const { canInstall, install, help } = useInstall();
  const { donate, copied } = useDonate(donation);
  if (!canInstall && !donation) return null;
  return <div className="p-actions">
    {canInstall && <button type="button" className="p-button" onClick={() => void install()}><DownloadSimple size={20} aria-hidden="true" />Instalar la app</button>}
    {donation && <button type="button" className="p-button" onClick={() => void donate()}><Heart size={20} aria-hidden="true" />Hacer una donación</button>}
    {help && <p className="p-note" role="status">En iPhone: tocá Compartir y elegí «Agregar a inicio».</p>}
    {copied && <DonationNote alias={donation} />}
  </div>;
}

/** YouTube's own mark in its own colours: a red rounded rectangle with a white play triangle. Drawn here, never tinted by the text colour. */
function YoutubeMark() {
  return <svg width="26" height="18" viewBox="0 0 28 20" aria-hidden="true">
    <rect width="28" height="20" rx="5.5" fill="#FF0000" />
    <path d="M11.2 5.6v8.8l7.6-4.4z" fill="#FFFFFF" />
  </svg>;
}

/** The round icon buttons of the news bar: a thin ring on white, the icon in ink; they darken under the pointer and press on click. */
export const navIconButton = "inline-grid size-11 shrink-0 place-items-center rounded-full border border-line bg-white text-ink transition-[background-color,border-color,scale] duration-150 hover:border-line-strong hover:bg-sunken active:scale-95 motion-reduce:active:scale-100";

/**
 * The top bar of a site with the news home page: its name on the left, linking home; on the right what the site adds (`children`: the advice
 * of the day), the YouTube channel, sharing and donating. Light, like a news site's bar, instead of the solid round buttons of the other sites.
 */
export function NewsNav({ siteName, donation, youtube, children }: { siteName: string; donation: string; youtube: string; children?: ReactNode }) {
  const { donate, copied } = useDonate(donation);
  return <header className="mx-auto w-full max-w-[1360px] px-4 pt-4 sm:px-8">
    {/* 1360px: the width of the news pages (modules/voices), so the bar and the content share both edges. */}
    <div className="flex items-center justify-between gap-3 border-b border-line pb-4">
      <Link href="/" className="inline-flex min-h-11 items-center font-display text-3xl/none font-bold tracking-wide uppercase no-underline sm:text-4xl/none">{siteName}</Link>
      <nav className="flex items-center gap-2" aria-label="Acciones del sitio">
        {children}
        {youtube && <a href={youtube} target="_blank" rel="noopener noreferrer" className={navIconButton} aria-label="Canal de YouTube (se abre en otra pestaña)" title="Canal de YouTube"><YoutubeMark /></a>}
        <ShareButton className={navIconButton} label="Compartir"><Share2 size={20} strokeWidth={2} aria-hidden="true" /></ShareButton>
        {donation && <button type="button" className={navIconButton} aria-label="Hacer una donación" title="Hacer una donación" onClick={() => void donate()}><HeartIcon size={20} strokeWidth={2} aria-hidden="true" /></button>}
      </nav>
    </div>
    {copied && <div className="mt-3 flex justify-end"><DonationNote alias={donation} /></div>}
  </header>;
}

/** The big pill buttons of the news footer: 56px tall, room around the words; they step on hover and press on click. */
const footerButton = "inline-flex min-h-14 items-center justify-center gap-3 rounded-full px-8 text-lg font-semibold transition-[background-color,border-color,scale] duration-150 active:scale-[0.98] motion-reduce:active:scale-100";

/**
 * The foot of a site with the news home page: the same two actions as the other sites (donate, install), bigger and quieter in colour: the
 * donation dark as the main one, the install outlined.
 */
export function NewsFooter({ siteName, donation }: { siteName: string; donation: string }) {
  const { canInstall, install, help } = useInstall();
  const { donate, copied } = useDonate(donation);
  return <footer className="mt-auto border-t border-line">
    <div className="mx-auto grid w-full max-w-[1360px] justify-items-center gap-6 px-4 py-12 text-center sm:px-8">
      {(donation || canInstall) && <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
        {donation && <button type="button" className={`${footerButton} bg-ink text-white hover:bg-ink/85`} onClick={() => void donate()}><HeartIcon size={22} aria-hidden="true" />Hacer una donación</button>}
        {canInstall && <button type="button" className={`${footerButton} border border-line-strong bg-white text-ink hover:border-ink hover:bg-sunken`} onClick={() => void install()}><DownloadSimple size={22} aria-hidden="true" />Instalar la app</button>}
      </div>}
      {help && <p className="m-0 text-base text-muted" role="status">En iPhone: tocá Compartir y elegí «Agregar a inicio».</p>}
      {copied && <DonationNote alias={donation} />}
      <p className="m-0 text-sm text-muted">© {new Date().getFullYear()} {siteName}.</p>
    </div>
  </footer>;
}
