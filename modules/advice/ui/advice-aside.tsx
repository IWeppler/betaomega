"use client";

import { ScrollText } from "lucide-react";
import { useEffect, useState } from "react";
import { adviceDay, readStoredAdvice, type AdviceCard } from "../domain/advice";
import { storageKey } from "./storage";

/**
 * Beside the home page: today's advice and a few more. Today's is the one the modal shows: the modal (in the layout, earlier in the page) keeps
 * it on the device, so this reads it there once both are on; until then, or with storage blocked, it shows the one the server drew for it.
 * It never writes: the first advice of the day is the modal's, which opens because it was not stored yet.
 */
export function AdviceAside({ siteId, chapterName, today, more }: { siteId: string; chapterName: string; today: AdviceCard; more: AdviceCard[] }) {
  const [shown, setShown] = useState(today);
  // Hidden (its space kept) until it knows which advice is today's, so the text does not swap in front of the reader.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // After the modal's effect, which runs first and stores today's advice.
    void Promise.resolve().then(() => {
      let raw: string | null = null;
      try { raw = window.localStorage.getItem(storageKey(siteId)); } catch { /* blocked storage: keep the drawn one */ }
      const stored = readStoredAdvice(raw);
      if (stored && stored.day === adviceDay(new Date())) setShown(stored.advice);
      setReady(true);
    });
  }, [siteId]);
  const others = more.filter(card => card.label !== shown.label).slice(0, 4);

  return <>
    {/* Its heading is the advice's own label ("Zanshei 103 · VI"), hidden with the text until it is known which advice is today's. */}
    {/* Editorial, not a colour block: white with a thin line; the green stays in the small label. */}
    <section className={`grid gap-3 rounded-card border border-line bg-white p-6 transition-opacity duration-300 motion-reduce:transition-none ${ready ? "opacity-100" : "opacity-0"}`} aria-labelledby="advice-today">
      <h2 id="advice-today" className="m-0 flex items-center gap-2 text-sm font-bold tracking-widest text-accent-text uppercase"><ScrollText size={18} aria-hidden="true" />{shown.label}</h2>
      <blockquote className="m-0 font-display text-2xl/tight font-bold text-pretty text-ink">{shown.text}</blockquote>
    </section>
    {others.length > 0 && <section className="grid gap-4" aria-labelledby="advice-more">
      <h2 id="advice-more" className="m-0 font-display text-3xl font-bold">{chapterName}</h2>
      <ul className="m-0 grid list-none gap-0 p-0">
        {others.map(card => <li key={card.label} className="grid gap-1 border-t border-line py-4 first:border-t-0 first:pt-0">
          <p className="m-0 line-clamp-4 text-base text-ink">{card.text}</p>
          <p className="m-0 text-sm font-semibold text-muted">{card.label}</p>
        </li>)}
      </ul>
    </section>}
  </>;
}
