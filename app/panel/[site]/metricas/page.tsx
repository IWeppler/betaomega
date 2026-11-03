"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/app/admin-fields";
import { channelLabel, fillDays, reportRanges, sortRecipeRows, type MetricsReport, type RecipeRow, type RecipeSortKey } from "@/lib/metrics";
import { EmptyState } from "../list-tools";
import { useRecipes } from "../recipes-context";
import { PageHeader } from "../shell";
import { MetricsChart } from "./metrics-chart";

const count = (n: number) => n.toLocaleString("es-AR");
const columns: { key: RecipeSortKey; label: string; numeric: boolean }[] = [
  { key: "title", label: "Receta", numeric: false },
  { key: "views", label: "Vistas", numeric: true },
  { key: "shares", label: "Compartidos", numeric: true },
  { key: "total", label: "Vistas en total", numeric: true },
];

export default function MetricsPage() {
  const { site: siteId } = useParams<{ site: string }>();
  const { recipes } = useRecipes();
  const [days, setDays] = useState<number>(30);
  const [loaded, setLoaded] = useState<{ days: number; report?: MetricsReport; error?: string } | null>(null);
  const [sort, setSort] = useState<RecipeSortKey>("views");
  useEffect(() => {
    let cancelled = false;
    api<MetricsReport>(`/api/sites/${siteId}/metrics?days=${days}`)
      .then(report => { if (!cancelled) setLoaded({ days, report }); })
      .catch((e: Error) => { if (!cancelled) setLoaded({ days, error: e.message }); });
    return () => { cancelled = true; };
  }, [siteId, days]);
  const report = loaded?.days === days ? loaded.report : undefined;
  const rows = useMemo(() => {
    if (!report || !recipes) return [];
    const byId = new Map(report.recipes.map(r => [r.id, r]));
    // Published recipes always appear (a recipe nobody opened is news too); drafts only if they had activity.
    const list: RecipeRow[] = recipes.filter(r => r.published || byId.has(r.id)).map(r => ({
      id: r.id, title: r.title, views: byId.get(r.id)?.views ?? 0, shares: byId.get(r.id)?.shares ?? 0, total: r.views ?? 0,
    }));
    return sortRecipeRows(list, sort);
  }, [report, recipes, sort]);
  if (!recipes) return null;
  const error = loaded?.days === days ? loaded.error : undefined;
  const channels = report ? Object.entries(report.channels).sort((a, b) => b[1] - a[1]) : [];
  const topChannel = Math.max(1, ...channels.map(([, n]) => n));
  const empty = report && !report.totals.pageViews && !report.totals.recipeViews && !report.totals.shares;
  const tiles = report ? [
    { label: "Visitas al sitio", value: report.totals.pageViews, note: "páginas vistas" },
    { label: "Vistas de recetas", value: report.totals.recipeViews, note: "recetas abiertas" },
    { label: "Compartidos", value: report.totals.shares, note: "toques en Compartir" },
  ] : [];
  return <>
    <PageHeader title="Métricas" description="Cuánta gente entra al sitio, qué recetas abre y cuántas veces se comparte. No cuenta al administrador ni a los buscadores." actions={
      <div className="choice-chips" role="group" aria-label="Período">
        {reportRanges.map(r => <button type="button" key={r} aria-pressed={days === r} onClick={() => setDays(r)}>{r} días</button>)}
      </div>
    } />
    {error && <div className="alert error" role="alert">{error}</div>}
    {!report && !error && <div className="panel-skeleton" aria-busy="true" aria-label="Cargando"><span className="panel-skeleton-title" />{Array.from({ length: 4 }, (_, n) => <span key={n} className="panel-skeleton-row" />)}</div>}
    {report && <>
      <section className="panel-card panel-stats" aria-label={`Totales de los últimos ${report.days} días`}>
        {tiles.map(t => <div key={t.label} className="panel-stat"><span>{t.label}</span><strong>{count(t.value)}</strong><small>{t.note}, últimos {report.days} días</small></div>)}
      </section>
      {empty && <section className="panel-card"><p className="panel-muted panel-card-note metrics-note">Todavía no hay datos en este período. Las visitas se cuentan desde que se activó esta sección; las vistas que las recetas ya tenían se suman en “Vistas en total”.</p></section>}
      <section className="panel-card" aria-labelledby="daily-title">
        <h2 id="daily-title" className="panel-card-title">Visitas por día</h2>
        <MetricsChart rows={fillDays(report)} />
      </section>
      <section className="panel-card" aria-labelledby="channels-title">
        <h2 id="channels-title" className="panel-card-title">Cómo se comparte</h2>
        {channels.length > 0
          ? <ul className="metrics-bars">{channels.map(([id, n]) => <li key={id}>
            <span>{channelLabel(id)}</span>
            <span className="metrics-bar-track"><span className="metrics-bar" style={{ width: `${Math.max(2, (n / topChannel) * 100)}%` }} /></span>
            <strong>{count(n)}</strong>
          </li>)}</ul>
          : <p className="panel-muted panel-card-note">Nadie compartió en este período.</p>}
      </section>
      <section className="panel-card" aria-labelledby="recipes-title">
        <h2 id="recipes-title" className="panel-card-title">Recetas</h2>
        {rows.length > 0
          ? <table className="panel-table">
            <thead><tr>{columns.map(c => <th key={c.key} scope="col" className={c.numeric ? "is-num" : undefined} aria-sort={sort === c.key ? (c.key === "title" ? "ascending" : "descending") : "none"}>
              <button type="button" className="metrics-sort" aria-pressed={sort === c.key} onClick={() => setSort(c.key)}>{c.label}</button>
            </th>)}</tr></thead>
            <tbody>{rows.map(r => <tr key={r.id}><th scope="row">{r.title}</th><td className="is-num">{count(r.views)}</td><td className="is-num">{count(r.shares)}</td><td className="is-num">{count(r.total)}</td></tr>)}</tbody>
          </table>
          : <EmptyState title="Todavía no hay recetas publicadas" text="Cuando publiques recetas, acá vas a ver cuánto se abre y se comparte cada una." />}
        <p className="panel-muted panel-card-note">Vistas y compartidos son del período elegido. “Vistas en total” incluye todo lo contado desde siempre, también lo anterior a estas métricas.</p>
      </section>
    </>}
  </>;
}
