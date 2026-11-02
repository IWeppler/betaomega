"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, BookOpenText, CheckCircle, Globe, Plus, WarningCircle } from "@phosphor-icons/react";
import { isScheduled, mostViewed, recipeGaps } from "@/lib/recipes";
import { findSite } from "@/lib/sites";
import { useRecipes } from "./recipes-context";
import { QuickActions, type QuickAction } from "./list-tools";
import { PageHeader } from "./shell";

export function RecipeSummary() {
  const { recipes } = useRecipes();
  const { site } = useParams<{ site: string }>();
  if (!recipes) return null;
  const scheduled = recipes.filter(r => isScheduled(r));
  const published = recipes.filter(r => r.published && !isScheduled(r));
  const drafts = recipes.filter(r => !r.published);
  const top = mostViewed(published);
  const incomplete = published.filter(r => recipeGaps(r).length);
  const categories = new Set(published.flatMap(r => r.categories));
  const href = `/${site}/recetas`;
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many.replace("#", String(n)));
  const issues = [
    !recipes.length && { text: "Todavía no hay recetas cargadas.", action: "Crear la primera" },
    drafts.length > 0 && { text: `${plural(drafts.length, "Una receta está", "# recetas están")} en borrador: no se van a ver en el sitio.`, action: "Revisar borradores" },
    incomplete.length > 0 && { text: `${plural(incomplete.length, "Una receta publicada no tiene", "# recetas publicadas no tienen")} foto, descripción, categoría o tiempo: ${incomplete.slice(0, 5).map(r => r.title).join(", ")}${incomplete.length > 5 ? "…" : ""}.`, action: "Completar" },
  ].filter(Boolean) as { text: string; action: string }[];
  const stats = [
    { label: "Publicadas", value: published.length, note: scheduled.length ? `${scheduled.length} programadas` : `de ${recipes.length} recetas` },
    { label: "Borradores", value: drafts.length, note: "no se ven en el sitio" },
    { label: "Categorías", value: categories.size, note: "en recetas publicadas" },
    { label: "Con foto", value: published.filter(r => r.image).length, note: `de ${published.length} publicadas` },
  ];
  const siteUrl = findSite(site)?.url;
  const actions: QuickAction[] = [
    { label: "Nueva receta", text: "Empezar una receta desde cero", href: `${href}?nuevo`, icon: Plus },
    { label: "Todas las recetas", text: "Buscar y editar las cargadas", href, icon: BookOpenText },
    ...(siteUrl ? [{ label: "Ver el sitio", text: "Como lo ven los visitantes", href: siteUrl, icon: Globe, external: true }] : []),
  ];
  return <>
    <PageHeader title="Resumen" description="El estado de las recetas y lo que conviene revisar." />
    <section className="panel-card panel-stats" aria-label="Números de las recetas">
      {stats.map(s => <div key={s.label} className="panel-stat"><span>{s.label}</span><strong>{s.value}</strong><small>{s.note}</small></div>)}
    </section>
    <QuickActions actions={actions} />
    <section className="panel-card" aria-labelledby="top-title">
      <h2 id="top-title" className="panel-card-title">Más vistas</h2>
      {top.length ? <ol className="panel-top-list">
        {top.map(r => <li key={r.id}><Link href={`${href}`}>{r.title}</Link><span>{r.views} {r.views === 1 ? "vista" : "vistas"}</span></li>)}
      </ol> : <p className="panel-muted panel-card-note">Todavía no hay vistas registradas. Se cuentan las visitas reales a cada receta publicada (sin vistas previas ni buscadores).</p>}
    </section>
    <section className="panel-card" aria-labelledby="issues-title">
      <h2 id="issues-title" className="panel-card-title">Para revisar</h2>
      {issues.length ? <ul className="panel-issues">
        {issues.map(issue => <li key={issue.text}><WarningCircle size={18} weight="fill" aria-hidden="true" /><p>{issue.text}</p><Link href={href}>{issue.action}<ArrowRight size={14} aria-hidden="true" /></Link></li>)}
      </ul> : <p className="panel-all-good"><CheckCircle size={18} weight="fill" aria-hidden="true" />Todo en orden. No hay nada pendiente.</p>}
    </section>
  </>;
}
