"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { BookingFlow, type BookingFlowData } from "./booking-flow";

const HASH = "#reservar";

const onHashChange = (listener: () => void) => {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
};

/**
 * The booking, over the page. It opens with the address: every "Reservar" is a plain link to #reservar, so the header and the server-rendered
 * sections need no shared state, the link also works from the terms page, and the browser's back button closes it.
 */
export function BookingDialog({ data }: { data: BookingFlowData }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const open = useSyncExternalStore(onHashChange, () => window.location.hash === HASH, () => false);

  // iOS Safari can still scroll the page behind a modal when only overflow is hidden.
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const previous = { position: body.style.position, top: body.style.top, width: body.style.width };
    body.style.position = "fixed"; body.style.top = `-${scrollY}px`; body.style.width = "100%";
    return () => { Object.assign(body.style, previous); window.scrollTo({ top: scrollY, behavior: "instant" }); };
  }, [open]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      // showModal puts the focus on the first control, the close button, and shows its ring for no reason. The title is where the person starts reading.
      element.querySelector("h2")?.focus();
    }
    if (!open && element.open) element.close();
  }, [open]);

  // Closing is forgetting the address; the effect above does the rest. Escape closes first and arrives here through the close event, which comes late,
  // so the buttons do not go that way: a quick "Reservar" right after would find the address still set and do nothing.
  // replaceState fires no event of its own, and the page must not jump to the top as `location.hash = ""` would make it.
  const forget = () => {
    if (window.location.hash !== HASH) return;
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };

  // On a phone the booking takes the whole screen (100dvh, so the browser's bars never hide its bottom) and the second step fits in it without
  // scrolling. From 640px it is a centered box: m-auto, because Tailwind's reset removes the margin a dialog centers itself with; 560px holds the seven
  // days in a row, and the height leaves the backdrop visible.
  return <dialog ref={dialog} aria-labelledby="booking-title" onClose={forget} onClick={event => { if (event.target === event.currentTarget) forget(); }} className="m-0 h-dvh max-h-none w-full max-w-none overflow-auto overscroll-contain bg-bg p-0 text-ink backdrop:bg-sunken/80 backdrop:backdrop-blur-sm sm:m-auto sm:h-auto sm:max-h-[92svh] sm:w-[min(560px,calc(100%-20px))] sm:rounded-card sm:shadow-lift [&_input]:text-base [&_select]:text-base">
    {open && <div className="relative flex min-h-full flex-col px-5 pt-5 sm:block sm:min-h-0 sm:px-8 sm:pt-6 sm:pb-5">
      <button type="button" aria-label="Cerrar reserva" className="absolute top-3.5 right-3.5 grid size-control place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-surface hover:text-ink" onClick={forget}><X size={18} strokeWidth={1.5} aria-hidden="true" /></button>
      <BookingFlow data={data} />
    </div>}
  </dialog>;
}
