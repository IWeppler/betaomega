"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { PageHeader, usePanel, useSite } from "@/platform/panel";
import type { Config } from "./config";
import { Button, Notice } from "./controls";
import { WeekForm } from "./horarios-screen";
import { TypesForm } from "./precios-screen";
import { useResource } from "./use-resource";

export function HorariosPreciosScreen() {
  const site = useSite();
  const { flushRef } = usePanel();
  const { data, error, reload } = useResource<Config>(`/api/sites/${site.id}/sauna/config`);
  const typesRef = useRef<() => Promise<boolean>>(async () => true);
  const weekRef = useRef<() => Promise<boolean>>(async () => true);
  const [typesRound, setTypesRound] = useState(0);
  const [weekRound, setWeekRound] = useState(0);
  // A leave operation can save both forms in sequence: commit the refreshed revision before the next form reads it.
  const saved = async (reset: () => void) => { await reload(); flushSync(reset); };
  useEffect(() => {
    const flush = async () => (await typesRef.current()) && (await weekRef.current());
    flushRef.current = flush;
    return () => { flushRef.current = async () => true; };
  }, [flushRef]);
  const header = <PageHeader title="Horarios y precios" description="Primero definí los tipos de turno y después los horarios que los ofrecen. Las reservas ya hechas no cambian." />;
  if (!data) return <>{header}{error ? <div className="grid justify-items-start gap-2"><Notice kind="error">{error}</Notice><Button onClick={() => void reload()}>Reintentar</Button></div> : <p className="text-muted" aria-busy="true">Cargando…</p>}</>;
  if (!data.settings) return <>{header}<Notice kind="error">Falta la configuración del sitio: corré supabase/schema.sql.</Notice></>;
  return <>{header}
    {error && <Notice kind="error">{error}</Notice>}
    <section className="mb-8" aria-labelledby="types-heading">
      <h2 id="types-heading" className="mb-4 text-xl font-semibold text-ink">Tipos de turno y precios</h2>
      <TypesForm key={typesRound} types={data.types} settings={data.settings} flushRef={typesRef} onSaved={() => saved(() => setTypesRound(value => value + 1))} onDiscard={() => setTypesRound(value => value + 1)} />
    </section>
    <section aria-labelledby="hours-heading">
      <h2 id="hours-heading" className="mb-4 text-xl font-semibold text-ink">Horarios</h2>
      <WeekForm key={weekRound} config={data} settings={data.settings} flushRef={weekRef} onSaved={() => saved(() => setWeekRound(value => value + 1))} onDiscard={() => setWeekRound(value => value + 1)} />
    </section>
  </>;
}
