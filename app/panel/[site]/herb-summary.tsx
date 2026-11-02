"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, CheckCircle, Flask, Leaf, Storefront, Tag, WarningCircle } from "@phosphor-icons/react";
import { findSite } from "@/lib/sites";
import { brokenCombos, effectivePrice, isComboInStore, isInStore, storeToday } from "@/lib/catalog";
import { useCatalog } from "./catalog-context";
import { QuickActions, type QuickAction } from "./list-tools";
import { PageHeader } from "./shell";

export function HerbSummary() {
  const { catalog } = useCatalog();
  const { site } = useParams<{ site: string }>();
  if (!catalog) return null;
  const today = storeToday();
  const products = [...catalog.preparations, ...catalog.plants];
  const inStore = products.filter(p => isInStore(catalog, p));
  const drafts = catalog.preparations.filter(p => !p.published);
  const hidden = products.filter(p => p.published && !isInStore(catalog, p));
  const noPrice = inStore.filter(p => p.price === undefined);
  const offers = inStore.filter(p => effectivePrice(p, today).onPromo);
  const combos = (catalog.combos ?? []).filter(c => isComboInStore(catalog, c));
  const broken = brokenCombos(catalog);
  const href = (path: string) => `/${site}/${path}`;
  // Things the owner can act on, most important first. Each one links to where it is fixed.
  const issues = [
    !catalog.store?.whatsapp && { text: "La tienda no tiene WhatsApp cargado: nadie puede hacer pedidos.", link: href("tienda"), action: "Cargar datos" },
    broken.length > 0 && { text: `${broken.length === 1 ? "Un combo activo no se muestra" : `${broken.length} combos activos no se muestran`} porque tiene un producto oculto o en borrador: ${broken.map(c => c.name).join(", ")}.`, link: href("tienda"), action: "Revisar combos" },
    drafts.length > 0 && { text: `${drafts.length === 1 ? "Un tónico está" : `${drafts.length} tónicos están`} en borrador: el equipo y la tienda no los ven.`, link: href("tonicos"), action: "Revisar tónicos" },
    noPrice.length > 0 && { text: `${noPrice.length === 1 ? "Un producto de la tienda no tiene" : `${noPrice.length} productos de la tienda no tienen`} precio y se muestran como "Consultar".`, link: href("tienda"), action: "Cargar precios" },
  ].filter(Boolean) as { text: string; link: string; action: string }[];
  const stats = [
    { label: "En la tienda", value: inStore.length, note: `${hidden.length} fuera de la tienda` },
    { label: "Tónicos", value: catalog.preparations.length, note: `${drafts.length} en borrador` },
    { label: "Hierbas", value: catalog.plants.length, note: `${catalog.plants.filter(p => isInStore(catalog, p)).length} en la tienda` },
    { label: "Ofertas vigentes", value: offers.length, note: `${combos.length} combos a la venta` },
  ];
  const storeUrl = findSite(site)?.url;
  const actions: QuickAction[] = [
    { label: "Nuevo tónico", text: "Cargar una preparación", href: href("tonicos?nuevo"), icon: Flask },
    { label: "Nueva hierba", text: "Sumar una planta al catálogo", href: href("hierbas?nuevo"), icon: Leaf },
    { label: "Precios y combos", text: "Datos de la tienda y ofertas", href: href("tienda"), icon: Tag },
    ...(storeUrl ? [{ label: "Ver la tienda", text: "Como la ven los clientes", href: storeUrl, icon: Storefront, external: true }] : []),
  ];
  return <>
    <PageHeader title="Resumen" description="El estado del catálogo y de la tienda, y lo que conviene revisar." />
    <section className="panel-card panel-stats" aria-label="Números del catálogo">
      {stats.map(s => <div key={s.label} className="panel-stat"><span>{s.label}</span><strong>{s.value}</strong><small>{s.note}</small></div>)}
    </section>
    <QuickActions actions={actions} />
    <section className="panel-card" aria-labelledby="issues-title">
      <h2 id="issues-title" className="panel-card-title">Para revisar</h2>
      {issues.length ? <ul className="panel-issues">
        {issues.map(issue => <li key={issue.text}><WarningCircle size={18} weight="fill" aria-hidden="true" /><p>{issue.text}</p><Link href={issue.link}>{issue.action}<ArrowRight size={14} aria-hidden="true" /></Link></li>)}
      </ul> : <p className="panel-all-good"><CheckCircle size={18} weight="fill" aria-hidden="true" />Todo en orden. No hay nada pendiente.</p>}
    </section>
  </>;
}
