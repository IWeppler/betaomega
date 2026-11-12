"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { buttonClass } from "./controls";
import { InstallApp } from "./install-app";
import { reservePath } from "./site-parts";

const links = [
  { hash: "sesiones", label: "Las sesiones" },
  { hash: "espacio", label: "El espacio" },
  { hash: "preguntas", label: "Antes de venir" },
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
    const wide = window.matchMedia("(min-width: 64rem)");
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
    <nav aria-label="Navegación principal" className="hidden lg:flex lg:flex-row lg:gap-7">
      {links.map(link => <a key={link.hash} href={`${home}#${link.hash}`} className="flex min-h-control items-center text-base text-ink no-underline [background:linear-gradient(currentColor,currentColor)_0_calc(50%+0.9rem)/0_1px_no-repeat] transition-[background-size] duration-300 ease-standard hover:[background-size:100%_1px]">{link.label}</a>)}
    </nav>
    <div id={id} hidden={!open} className="fixed inset-0 z-30 flex h-dvh flex-col overflow-y-auto bg-bg pt-20 pb-[max(1.5rem,env(safe-area-inset-bottom))] motion-safe:transition-opacity motion-safe:duration-200 starting:opacity-0 lg:hidden">
      <nav aria-label="Navegación principal" className="flex flex-1 flex-col border-t border-line px-[6%]">
        {links.map((link, index) => (
          <a key={link.hash} ref={index === 0 ? first : undefined} href={`${home}#${link.hash}`} onClick={() => setOpen(false)}
            className="group flex min-h-16 items-center gap-5 border-b border-line py-4 text-ink no-underline">
            <span className="flex-1 font-display text-[clamp(1.5rem,7vw,2rem)]/tight transition-colors duration-150 group-hover:text-accent-text">{link.label}</span>
            <ArrowUpRight size={18} strokeWidth={1.5} aria-hidden="true" className="text-muted" />
          </a>
        ))}
      </nav>
      <div className="grid gap-3 px-[6%] pt-8">
        <a href={reservePath(home || "/")} onClick={() => setOpen(false)} className={`${buttonClass("primary", "lg")} w-full`}>
          Reservar<ArrowUpRight size={18} strokeWidth={1.75} aria-hidden="true" />
        </a>
        <InstallApp
          className={`${buttonClass("quiet", "lg")} w-full`}
          helpClassName="m-0 text-center text-base text-muted" />
      </div>
    </div>
    <button ref={trigger} type="button" className="relative z-40 grid size-control place-items-center text-ink lg:hidden" aria-label={open ? "Cerrar menú" : "Abrir menú"} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      {open ? <X size={22} strokeWidth={1.5} aria-hidden="true" /> : <Menu size={22} strokeWidth={1.5} aria-hidden="true" />}
    </button>
  </>;
}
