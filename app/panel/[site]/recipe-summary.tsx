"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, BookOpenText, CheckCircle, Globe, Plus, WarningCircle } from "@phosphor-icons/react";
import { emptyMoments, isScheduled, lacksContent, latestPublished, mostViewed, recipeGaps, sinceLabel, thinCategories, type Recipe } from "@/lib/recipes";
import { useSite } from "./panel-context";
import { useRecipes } from "./recipes-context";
import { QuickActions, type QuickAction } from "./list-tools";
import { PageHeader } from "./shell";
import { InstallPanelButton } from "./install-panel";
import { recipesHref } from "./recipe-views";

/** "a", "a y b", "a, b y c". */
const listJoin = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`);
/** The first five titles with what each one lacks, then "…". */
const withGaps = (recipes: Recipe[]) => `${recipes.slice(0, 5).map(r => `${r.title} (falta ${listJoin(recipeGaps(r))})`).join(", ")}${recipes.length > 5 ? "…" : ""}`;
const releaseDate = new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function RecipeSummary() {
  const { recipes } = useRecipes();
  const { site } = useParams<{ site: string }>();
  const { url: siteUrl } = useSite();
  if (!recipes) return null;
  const scheduled = recipes.filter(r => isScheduled(r));
  const published = recipes.filter(r => r.published && !isScheduled(r));
  const drafts = recipes.filter(r => !r.published);
  const top = mostViewed(published);
  const empty = published.filter(r => lacksContent(r));
  const incomplete = published.filter(r => !lacksContent(r) && recipeGaps(r).length);
  const upcoming = [...scheduled].sort((a, b) => Date.parse(a.publishedAt ?? "") - Date.parse(b.publishedAt ?? ""));
  const categories = new Set(published.flatMap(r => r.categories));
  const thin = thinCategories(published);
  const missingMoments = published.length ? emptyMoments(published) : [];
  const latest = latestPublished(recipes);
  const href = recipesHref(site);
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many.replace("#", String(n)));
  const issues = [
    !recipes.length && { text: "Todavía no hay recetas cargadas.", action: "Crear la primera", href: `${href}?nuevo` },
    empty.length > 0 && { text: `${plural(empty.length, "Una receta publicada no se puede cocinar", "# recetas publicadas no se pueden cocinar")}: ${withGaps(empty)}.`, action: "Completar", href: recipesHref(site, { view: "sin-contenido" }) },
    drafts.length > 0 && { text: `${plural(drafts.length, "Una receta está", "# recetas están")} en borrador: no se van a ver en el sitio.`, action: "Revisar borradores", href: recipesHref(site, { view: "borradores" }) },
    incomplete.length > 0 && { text: `${plural(incomplete.length, "Una receta publicada está incompleta", "# recetas publicadas están incompletas")}: ${withGaps(incomplete)}.`, action: "Completar", href: recipesHref(site, { view: "incompletas" }) },
    missingMoments.length > 0 && { text: `${missingMoments.length === 1 ? "El momento" : "Los momentos"} ${listJoin(missingMoments)} no ${missingMoments.length === 1 ? "tiene" : "tienen"} ninguna receta publicada: en el sitio ese filtro sale vacío.`, action: "Ver recetas", href },
    thin.length > 0 && { text: `${plural(thin.length, "Un tipo tiene", "# tipos tienen")} una sola receta publicada, así que su filtro en el sitio muestra solo esa: ${thin.slice(0, 8).join(", ")}${thin.length > 8 ? "…" : ""}. Conviene sumar recetas o juntarlo con otro tipo.`, action: "Ver tipos", href: `/${site}/categorias` },
  ].filter(Boolean) as { text: string; action: string; href: string }[];
  const stats = [
    { label: "Publicadas", value: published.length, note: scheduled.length ? `${scheduled.length} programadas` : `de ${recipes.length} recetas` },
    { label: "Borradores", value: drafts.length, note: "no se ven en el sitio" },
    { label: "Tipos", value: categories.size, note: "en recetas publicadas" },
    { label: "Con foto", value: published.filter(r => r.image).length, note: `de ${published.length} publicadas` },
  ];
  const actions: QuickAction[] = [
    { label: "Nueva receta", text: "Empezar una receta desde cero", href: `${href}?nuevo`, icon: Plus },
    { label: "Todas las recetas", text: "Buscar y editar las cargadas", href, icon: BookOpenText },
    ...(siteUrl ? [{ label: "Ver el sitio", text: "Como lo ven los visitantes", href: siteUrl, icon: Globe, external: true }] : []),
  ];
  return <>
    <PageHeader title="Resumen" description="El estado de las recetas y lo que conviene revisar." actions={<InstallPanelButton />} />
    {latest && <p className="panel-muted panel-latest">Última receta publicada <strong>{sinceLabel(latest.publishedAt as string)}</strong>: <Link href={recipesHref(site, { recipe: latest.id })}>{latest.title}</Link>.</p>}
    <section className="panel-card panel-stats" aria-label="Números de las recetas">
      {stats.map(s => <div key={s.label} className="panel-stat"><span>{s.label}</span><strong>{s.value}</strong><small>{s.note}</small></div>)}
    </section>
    <QuickActions actions={actions} />
    <section className="panel-card" aria-labelledby="top-title">
      <h2 id="top-title" className="panel-card-title">Más vistas</h2>
      {top.length ? <ol className="panel-top-list">
        {top.map(r => <li key={r.id}><Link href={recipesHref(site, { recipe: r.id })}>{r.title}</Link><span>{r.views} {r.views === 1 ? "vista" : "vistas"}</span></li>)}
      </ol> : <p className="panel-muted panel-card-note">Todavía no hay vistas registradas. Se cuentan las visitas reales a cada receta publicada (sin vistas previas ni buscadores).</p>}
    </section>
    {upcoming.length > 0 && <section className="panel-card" aria-labelledby="upcoming-title">
      <h2 id="upcoming-title" className="panel-card-title">Próximas a salir</h2>
      <ol className="panel-top-list">
        {upcoming.map(r => <li key={r.id}><Link href={recipesHref(site, { recipe: r.id })}>{r.title}</Link><span>{releaseDate.format(new Date(r.publishedAt as string))}</span></li>)}
      </ol>
    </section>}
    <section className="panel-card" aria-labelledby="issues-title">
      <h2 id="issues-title" className="panel-card-title">Para revisar</h2>
      {issues.length ? <ul className="panel-issues">
        {issues.map(issue => <li key={issue.text}><WarningCircle size={18} weight="fill" aria-hidden="true" /><p>{issue.text}</p><Link href={issue.href}>{issue.action}<ArrowRight size={14} aria-hidden="true" /></Link></li>)}
      </ul> : <p className="panel-all-good"><CheckCircle size={18} weight="fill" aria-hidden="true" />Todo en orden. No hay nada pendiente.</p>}
    </section>
  </>;
}
