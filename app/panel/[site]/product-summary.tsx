"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, ArrowSquareOut, CheckCircle, Plus, WarningCircle } from "@phosphor-icons/react";
import { findSite } from "@/lib/sites";
import { InstallPanelButton } from "./install-panel";
import { QuickActions, type QuickAction } from "./list-tools";
import { useProducts } from "./products-context";
import { PageHeader } from "./shell";

export function ProductSummary() {
  const { products } = useProducts();
  const { site: siteId } = useParams<{ site: string }>();
  const site = findSite(siteId);
  if (!products || !site) return null;
  const published = products.filter(p => p.published);
  const drafts = products.length - published.length;
  const noImage = published.filter(p => !p.image).length;
  const list = `/${site.id}/productos`;
  const stats = [
    { label: "Publicados", value: published.length, note: "Se ven en el sitio" },
    { label: "Borradores", value: drafts, note: "Solo se ven en el panel" },
    ...(site.products?.application ? [
      { label: "Bebibles", value: published.filter(p => p.application === "beber").length, note: "Publicados" },
      { label: "Uso externo", value: published.filter(p => p.application === "piel").length, note: "Publicados" },
    ] : []),
  ];
  const issues = [
    noImage > 0 && `${noImage === 1 ? "Un producto publicado no tiene" : `${noImage} productos publicados no tienen`} imagen.`,
    drafts > 0 && `${drafts === 1 ? "Un producto está" : `${drafts} productos están`} en borrador.`,
  ].filter((issue): issue is string => Boolean(issue));
  const actions: QuickAction[] = [
    { label: "Nuevo producto", text: "Cargar un producto", href: `${list}?nuevo`, icon: Plus },
    { label: "Ver el sitio", text: "Como lo ve la gente", href: site.url, icon: ArrowSquareOut, external: true },
  ];
  return <>
    <PageHeader title="Resumen" description="Los productos del sitio y lo que conviene revisar." actions={<InstallPanelButton />} />
    <section className="panel-card panel-stats" aria-label="Números de los productos">
      {stats.map(s => <div key={s.label} className="panel-stat"><span>{s.label}</span><strong>{s.value}</strong><small>{s.note}</small></div>)}
    </section>
    <QuickActions actions={actions} />
    <section className="panel-card" aria-labelledby="issues-title">
      <h2 id="issues-title" className="panel-card-title">Para revisar</h2>
      {issues.length ? <ul className="panel-issues">
        {issues.map(text => <li key={text}><WarningCircle size={18} weight="fill" aria-hidden="true" /><p>{text}</p><Link href={list}>Revisar<ArrowRight size={14} aria-hidden="true" /></Link></li>)}
      </ul> : <p className="panel-all-good"><CheckCircle size={18} weight="fill" aria-hidden="true" />Todo en orden. No hay nada pendiente.</p>}
    </section>
  </>;
}
