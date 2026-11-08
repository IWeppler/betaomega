"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { InstallApp } from "./install-app";

const links = [
  { hash: "esencia", label: "Nuestra esencia" },
  { hash: "sesiones", label: "Las sesiones" },
  { hash: "espacio", label: "El espacio" },
  { hash: "horarios", label: "Horarios" },
];

/**
 * Inline from tablets up. On a phone, a button that opens the links over the whole screen (100dvh), with the booking and the app at the bottom. The
 * brand and the button stay above the sheet (they sit in the header's `z-40`), so it closes from the same place it opened. The section links go
 * through `home`, so they also work from the terms page.
 */
export function SiteNav({ home }: { home: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = () => { setOpen(false); trigger.current?.focus(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    // Growing to a tablet shows the inline links: the sheet would stay open behind them.
    const wide = window.matchMedia("(min-width: 48rem)");
    const onWide = () => { if (wide.matches) setOpen(false); };
    // The page behind does not scroll while the sheet covers it.
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    first.current?.focus();
    document.addEventListener("keydown", escape);
    wide.addEventListener("change", onWide);
    return () => { root.style.overflow = overflow; document.removeEventListener("keydown", escape); wide.removeEventListener("change", onWide); };
  }, [open]);
  return <>
    <nav aria-label="Navegación principal" className="hidden md:flex md:flex-row md:gap-8">
      {links.map(link => <a key={link.hash} href={`${home}#${link.hash}`} className="flex min-h-control items-center text-[13px] text-ink no-underline transition-opacity duration-150 hover:opacity-60">{link.label}</a>)}
    </nav>
    <div id={id} hidden={!open} className="fixed inset-0 z-30 flex h-dvh flex-col overflow-y-auto bg-bg pt-24 pb-[max(1.5rem,env(safe-area-inset-bottom))] motion-safe:transition-opacity motion-safe:duration-200 starting:opacity-0 md:hidden">
      <nav aria-label="Navegación principal" className="flex flex-1 flex-col border-t border-line px-[6%]">
        {links.map((link, index) => (
          <a key={link.hash} ref={index === 0 ? first : undefined} href={`${home}#${link.hash}`} onClick={() => setOpen(false)}
            className="group flex min-h-16 items-center gap-5 border-b border-line py-4 text-ink no-underline">
            <span className="w-6 text-[11px] tracking-[0.2em] text-muted">{String(index + 1).padStart(2, "0")}</span>
            <span className="flex-1 font-display text-[clamp(1.5rem,7vw,2rem)]/tight transition-colors duration-150 group-hover:text-accent-text">{link.label}</span>
            <ArrowUpRight size={18} strokeWidth={1.5} aria-hidden="true" className="text-muted" />
          </a>
        ))}
      </nav>
      <div className="grid gap-3 px-[6%] pt-8">
        <a href={`${home}#reservar`} onClick={() => setOpen(false)} className="inline-flex min-h-control items-center justify-between gap-10 rounded-control bg-accent px-5 py-4 text-sm text-accent-ink no-underline transition-colors duration-150 hover:bg-accent-hover">
          Reservar una pausa<ArrowUpRight size={18} strokeWidth={1.5} aria-hidden="true" />
        </a>
        <InstallApp
          className="inline-flex min-h-control items-center justify-center gap-2 rounded-control border border-line-strong px-5 py-4 text-sm text-ink transition-colors duration-150 hover:bg-surface"
          helpClassName="m-0 text-center text-xs text-muted" />
      </div>
    </div>
    <button ref={trigger} type="button" className="relative z-40 grid size-control place-items-center text-ink md:hidden" aria-label={open ? "Cerrar menú" : "Abrir menú"} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      {open ? <X size={22} strokeWidth={1.5} aria-hidden="true" /> : <Menu size={22} strokeWidth={1.5} aria-hidden="true" />}
    </button>
  </>;
}
