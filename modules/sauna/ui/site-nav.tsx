"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { hash: "esencia", label: "Nuestra esencia" },
  { hash: "sesiones", label: "Las sesiones" },
  { hash: "espacio", label: "El espacio" },
  { hash: "horarios", label: "Horarios" },
];

/** Inline from tablets up; on a phone, a button that opens the links under the header. The section links go through `home`, so they also work from the terms page. */
export function SiteNav({ home }: { home: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open]);
  return <>
    <nav id={id} aria-label="Navegación principal" className={`${open ? "flex" : "hidden"} absolute inset-x-0 top-full flex-col gap-1 border-b border-line bg-surface px-[6%] py-4 md:static md:flex md:flex-row md:gap-8 md:border-0 md:bg-transparent md:p-0`}>
      {links.map(link => <a key={link.hash} href={`${home}#${link.hash}`} onClick={() => setOpen(false)} className="flex min-h-control items-center text-sm text-ink no-underline transition-opacity duration-150 hover:opacity-60 md:text-[13px]">{link.label}</a>)}
    </nav>
    <button ref={trigger} type="button" className="grid size-control place-items-center text-ink md:hidden" aria-label={open ? "Cerrar menú" : "Abrir menú"} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      {open ? <X size={22} strokeWidth={1.5} aria-hidden="true" /> : <Menu size={22} strokeWidth={1.5} aria-hidden="true" />}
    </button>
  </>;
}
