"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { newestId, searchProducts } from "@/platform/products";
import { searchTerm } from "../domain/metrics";
import { sendMetric, VoiceTracker } from "./tracker";
import { FeaturedVoice, VoiceCard, type Voice } from "./voice-card";

const pageSize = 12;

/**
 * The home page of a voces sagradas site, in the news layout: the title and the search on top; a bento of the last one published (big) and the
 * two before it (small, side by side) with `aside` (the advice of the day) beside it on wide screens and after it on a phone; the others across
 * the whole width in a grid of large cards, with a "see more" button. A search replaces the front page with its results. `voices` come newest first; the search stays in the address (?q=), so shared searches open filled in.
 */
export function VoicesHome({ siteId, title, voices, initialQuery, aside }: { siteId: string; title: string; voices: Voice[]; initialQuery: string; aside?: ReactNode }) {
  const [query, setQuery] = useState(initialQuery);
  const [shown, setShown] = useState(pageSize);
  const newest = newestId(voices);
  const searching = query.trim() !== "";
  const results = searching ? searchProducts(voices, query) : [];
  const [lead, ...others] = voices;
  const recent = others.slice(0, 2);
  const list = searching ? results : others.slice(2);
  const input = useRef<HTMLInputElement>(null);
  const change = (value: string) => {
    setQuery(value);
    setShown(pageSize);
    const url = new URL(window.location.href);
    if (value.trim()) url.searchParams.set("q", value); else url.searchParams.delete("q");
    window.history.replaceState(null, "", url);
  };
  // A search counts once the person stops typing for a moment (not every letter), and the same words only once per visit.
  const counted = useRef(new Set<string>());
  useEffect(() => {
    const term = searchTerm(query);
    if (!term || counted.current.has(term)) return;
    const timer = window.setTimeout(() => { counted.current.add(term); sendMetric(siteId, { kind: "search", term }); }, 1500);
    return () => window.clearTimeout(timer);
  }, [query, siteId]);
  // "/" jumps to the search from anywhere on the page, as on news and documentation sites, unless the person is already typing somewhere.
  useEffect(() => {
    const jump = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey || target?.closest("input, textarea, select, [contenteditable=true]")) return;
      event.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", jump);
    return () => window.removeEventListener("keydown", jump);
  }, []);

  return <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 pt-8 pb-18 sm:px-8 sm:pt-12">
    {/* 1360px: the width of the news bar (NewsNav), so both edges line up. */}
    <VoiceTracker siteId={siteId} />
    <header className="mx-auto grid max-w-3xl justify-items-center gap-4 text-center">
      <h1 className="m-0 font-display text-5xl/none font-bold sm:text-7xl/none">{title}</h1>
      <p className="m-0 text-lg text-muted">{voices.length === 1 ? "1 voz sagrada" : `${voices.length} voces sagradas`}. Buscá por nombre o por lo que estás necesitando.</p>
      {/* Quiet until used: a thin line and a soft shadow; in use, the line darkens and a neutral halo shows where the typing goes. */}
      <div className="group mt-2 flex h-14 w-full max-w-2xl items-center gap-3 rounded-full border border-line bg-white pr-2 pl-5 shadow-xs transition-[border-color,box-shadow] duration-150 hover:border-line-strong focus-within:border-ink focus-within:shadow-none focus-within:ring-4 focus-within:ring-ink/8">
        <Search size={20} aria-hidden="true" className="shrink-0 text-muted transition-colors group-focus-within:text-ink" />
        <label htmlFor="voices-search" className="sr-only">Buscá por nombre o para qué sirve</label>
        <input id="voices-search" ref={input} type="search" value={query} onChange={event => change(event.target.value)} onKeyDown={event => { if (event.key === "Escape" && query) { event.preventDefault(); change(""); } }}
          placeholder="Buscá por nombre o para qué sirve" autoComplete="off" enterKeyHint="search"
          className="h-full min-w-0 flex-1 border-0 bg-transparent text-left text-lg outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:appearance-none" />
        {query
          ? <button type="button" onClick={() => { change(""); input.current?.focus(); }} aria-label="Borrar la búsqueda" title="Borrar (Esc)"
            className="inline-grid size-10 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-sunken hover:text-ink">
            <X size={18} aria-hidden="true" />
          </button>
          : <kbd className="mr-2 hidden h-7 min-w-7 shrink-0 place-items-center rounded-md border border-line px-2 font-sans text-sm text-muted sm:inline-grid" title="Apretá / para buscar">/</kbd>}
      </div>
    </header>

    {searching
      ? <p className="mt-10 mb-0 text-center font-semibold text-muted" role="status">{results.length === 0 ? `No encontramos voces para “${query.trim()}”. Probá con otra palabra.` : results.length === 1 ? "1 voz sagrada" : `${results.length} voces sagradas`}</p>
      : <div className="mt-10 grid items-start gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
        {lead
          ? <div className="grid gap-8">
            <FeaturedVoice voice={lead} isNew={lead.id === newest} />
            {recent.length > 0 && <section aria-labelledby="voices-recent">
              {/* Its own heading, hidden: these two are not part of the lead story above. */}
              <h2 id="voices-recent" className="sr-only">Anteriores</h2>
              <ul className="m-0 grid list-none gap-x-8 gap-y-10 p-0 sm:grid-cols-2">
                {recent.map(voice => <li key={voice.id}><VoiceCard voice={voice} isNew={voice.id === newest} compact /></li>)}
              </ul>
            </section>}
          </div>
          : <p className="m-0 text-lg text-muted">Estamos preparando las primeras voces sagradas.</p>}
        {aside && <aside className="grid gap-6" aria-label="Consejos">{aside}</aside>}
      </div>}

    {list.length > 0 && <section className="mt-16 grid gap-8" aria-labelledby="voices-list">
      <h2 id="voices-list" className={searching ? "sr-only" : "m-0 border-t border-line pt-8 font-display text-4xl font-bold"}>{searching ? "Resultados" : "Más voces sagradas"}</h2>
      <ul className="m-0 grid list-none gap-x-8 gap-y-12 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {list.slice(0, shown).map(voice => <li key={voice.id}><VoiceCard voice={voice} isNew={voice.id === newest} /></li>)}
      </ul>
      {list.length > shown && <button type="button" onClick={() => setShown(count => count + pageSize)}
        className="justify-self-center rounded-full border border-line-strong bg-white px-6 py-3 font-semibold transition-colors hover:border-ink hover:bg-sunken active:translate-y-px">
        Ver más voces ({list.length - shown})
      </button>}
    </section>}
  </main>;
}
