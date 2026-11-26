"use client";

import { ExternalLink } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, PageHeader, useSite } from "@/platform/panel";
import { fillDays, reportRanges, type MetricsReport, type ReportRange } from "../domain/metrics";
import { Button, Card, Choice, Notice } from "./panel-controls";

type Data = { report: MetricsReport; voices: { id: string; name: string; slug: string }[] };
const number = (value: number) => value.toLocaleString("es-AR");
const dayLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("es-AR", { day: "numeric", month: "short", timeZone: "UTC" });

/** A headline number: the label above, the figure big. */
function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return <Card className="grid gap-1">
    <h2 className="m-0 text-sm font-semibold text-muted">{label}</h2>
    <p className="m-0 text-3xl font-semibold text-ink tabular-nums">{number(value)}</p>
    <p className="m-0 text-sm text-muted">{hint}</p>
  </Card>;
}

/**
 * Visits per day, one series: thin bars with rounded tops on a recessive baseline, 2px apart, the exact figure on hover or focus. The title
 * names the series, so there is no legend; the same figures are in a table for screen readers.
 */
function DailyBars({ report }: { report: MetricsReport }) {
  const rows = fillDays(report);
  const max = Math.max(1, ...rows.map(row => row.pageViews));
  const [active, setActive] = useState<number | null>(null);
  const shown = active === null ? null : rows[active];
  return <Card className="grid gap-3">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="m-0 text-base font-semibold text-ink">Visitas por día</h2>
      <p className="m-0 min-h-6 text-sm text-muted" aria-live="polite">{shown ? `${dayLabel(shown.day)}: ${number(shown.pageViews)} visitas, ${number(shown.voiceViews)} voces vistas, ${number(shown.searches)} búsquedas` : `Máximo: ${number(max)} en un día`}</p>
    </div>
    <div className="flex h-40 items-end gap-0.5 border-b border-line" aria-hidden="true" onMouseLeave={() => setActive(null)}>
      {rows.map((row, n) => <button key={row.day} type="button" tabIndex={-1} onMouseEnter={() => setActive(n)} onFocus={() => setActive(n)}
        className="group flex h-full min-w-0 flex-1 items-end" aria-label={`${dayLabel(row.day)}: ${row.pageViews}`}>
        {/* The height is the figure itself, so it is the one inline style: no class can carry a value that comes from the data. */}
        <span className={`block w-full rounded-t-sm transition-opacity ${active === null || active === n ? "opacity-100" : "opacity-40"} ${row.pageViews ? "bg-accent" : "bg-line"}`}
          style={{ height: row.pageViews ? `${Math.max(3, (row.pageViews / max) * 100)}%` : "2px" }} />
      </button>)}
    </div>
    <div className="flex justify-between text-sm text-muted" aria-hidden="true"><span>{dayLabel(rows[0].day)}</span><span>{dayLabel(rows.at(-1)!.day)}</span></div>
    <table className="sr-only">
      <caption>Visitas, voces vistas y búsquedas por día</caption>
      <thead><tr><th scope="col">Día</th><th scope="col">Visitas</th><th scope="col">Voces vistas</th><th scope="col">Búsquedas</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.day}><th scope="row">{dayLabel(row.day)}</th><td>{row.pageViews}</td><td>{row.voiceViews}</td><td>{row.searches}</td></tr>)}</tbody>
    </table>
  </Card>;
}

/** The panel's metrics of a voces sagradas site: visits, the most seen voices and what people search, for the last 7, 30 or 90 days. */
export function MetricsScreen() {
  const site = useSite();
  const [days, setDays] = useState<ReportRange>(30);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/sites/${site.id}/voices/metrics?days=${days}`, { cache: "no-store" });
      const body = await response.json().catch(() => null) as (Data & { error?: string }) | null;
      if (!response.ok || !body) throw new Error(body?.error ?? "No se pudieron leer las métricas.");
      setData(body);
      setError("");
    } catch (failure) { setError((failure as Error).message); }
  }, [site.id, days]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const report = data?.report;
  const name = (id: string) => data?.voices.find(voice => voice.id === id);
  return <>
    <PageHeader title="Métricas" description="Visitas, voces más vistas y lo que busca la gente en el sitio. No cuentan tus propias visitas ni las de buscadores." />
    <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Período">
      {reportRanges.map(range => <Choice key={range} pressed={days === range} onClick={() => setDays(range)}>Últimos {range} días</Choice>)}
    </div>
    {error && <div className="mb-3 grid justify-items-start gap-2"><Notice>{error}</Notice><Button onClick={() => void load()}>Reintentar</Button></div>}
    {!report && !error && <p className="text-muted" aria-busy="true">Cargando…</p>}
    {report && <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Visitas" value={report.totals.pageViews} hint="Páginas abiertas en el sitio." />
        <Stat label="Voces vistas" value={report.totals.voiceViews} hint="Veces que se abrió una voz sagrada." />
        <Stat label="Búsquedas" value={report.totals.searches} hint="Búsquedas escritas en la portada." />
      </div>
      <DailyBars report={report} />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="grid gap-3">
          <h2 className="m-0 text-base font-semibold text-ink">Voces más vistas</h2>
          {report.voices.length === 0
            ? <EmptyState title="Todavía sin datos" text="Aparecen cuando alguien abre una voz sagrada." />
            : <table className="w-full border-collapse text-left">
              <thead><tr className="text-sm text-muted"><th scope="col" className="py-2 font-medium">Voz</th><th scope="col" className="py-2 text-right font-medium">Vistas</th></tr></thead>
              <tbody>{report.voices.slice(0, 20).map(row => {
                const voice = name(row.id);
                return <tr key={row.id} className="border-t border-line">
                  <th scope="row" className="py-2 font-normal">
                    {voice
                      ? <a href={`${site.url}/${voice.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-ink underline-offset-2 hover:underline">{voice.name}<ExternalLink size={13} aria-label="(se abre en otra pestaña)" /></a>
                      : <span className="text-muted">Voz no publicada</span>}
                  </th>
                  <td className="py-2 text-right tabular-nums">{number(row.views)}</td>
                </tr>;
              })}</tbody>
            </table>}
        </Card>
        <Card className="grid gap-3">
          <h2 className="m-0 text-base font-semibold text-ink">Lo más buscado</h2>
          {report.searches.length === 0
            ? <EmptyState title="Todavía sin búsquedas" text="Se cuentan cuando alguien escribe en el buscador de la portada y deja de tipear un momento." />
            : <table className="w-full border-collapse text-left">
              <thead><tr className="text-sm text-muted"><th scope="col" className="py-2 font-medium">Búsqueda</th><th scope="col" className="py-2 text-right font-medium">Veces</th></tr></thead>
              <tbody>{report.searches.slice(0, 20).map(row => <tr key={row.term} className="border-t border-line">
                <th scope="row" className="py-2 font-normal text-ink">{row.term}</th>
                <td className="py-2 text-right tabular-nums">{number(row.count)}</td>
              </tr>)}</tbody>
            </table>}
        </Card>
      </div>
    </div>}
  </>;
}
