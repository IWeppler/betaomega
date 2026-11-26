"use client";

import { ScrollText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/shared/ui/dialog";
import { adviceDay, readStoredAdvice, todaysAdvice, type AdviceCard } from "../domain/advice";

const storageKey = (siteId: string) => `advice:${siteId}`;

/**
 * The advice of the day: opens by itself on the first visit of the day and stays behind a round button at the top, to read it again.
 * `drawn` is the advice the server picked for this visit; the device keeps the first one of each day, so every page shows the same one.
 * Storage may be blocked (private browsing): then the advice simply opens on every visit.
 */
export function DailyAdvice({ siteId, drawn }: { siteId: string; drawn: AdviceCard }) {
  const [advice, setAdvice] = useState(drawn);
  const [open, setOpen] = useState(false);
  const decided = useRef(false);

  // After hydration only: the server cannot know what this device already saw today. Once per mount: a second run (React's strict mode in
  // development) would find today's advice already stored and close it.
  useEffect(() => {
    if (decided.current) return;
    decided.current = true;
    let raw: string | null = null;
    try { raw = window.localStorage.getItem(storageKey(siteId)); } catch { /* blocked storage: treat as a first visit */ }
    const day = adviceDay(new Date());
    const today = todaysAdvice(readStoredAdvice(raw), drawn, day);
    if (today.store) {
      try { window.localStorage.setItem(storageKey(siteId), JSON.stringify({ day, advice: today.advice })); } catch { /* it opens again next visit */ }
    }
    setAdvice(today.advice);
    setOpen(today.open);
  }, [siteId, drawn]);

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label="Consejo del día" title="Consejo del día" className="grid size-12 place-items-center rounded-full bg-accent text-accent-ink hover:bg-accent-hover active:translate-y-px">
      <ScrollText size={22} strokeWidth={2.25} aria-hidden="true" />
    </button>
    <Dialog open={open} onOpenChange={setOpen} title="Consejo del día">
      <p className="m-0 text-base font-bold tracking-wide text-accent-text">{advice.label}</p>
      <blockquote className="m-0 font-display text-2xl/tight font-bold text-pretty sm:text-3xl/tight">{advice.text}</blockquote>
      <p className="m-0 text-base text-muted">Lo podés volver a leer cuando quieras con el botón de arriba.</p>
      <button type="button" onClick={() => setOpen(false)} className="mt-1 inline-flex min-h-12 items-center justify-center justify-self-start rounded-full bg-accent px-6 font-bold text-accent-ink hover:bg-accent-hover active:translate-y-px">Listo</button>
    </Dialog>
  </>;
}
