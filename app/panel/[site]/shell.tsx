"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSelectedLayoutSegment } from "next/navigation";
import { ArrowSquareOut, BookOpenText, CaretUpDown, Flask, Gear, Leaf, List, SignOut, SquaresFour, Storefront, Tag, X, type Icon } from "@phosphor-icons/react";
import { api } from "@/app/admin-fields";
import type { SiteKind } from "@/lib/sites";
import { EmptyState } from "./list-tools";
import { usePanel } from "./panel-context";

export type SiteSummary = { id: string; name: string; kind: SiteKind; url: string };
type NavItem = { path: string; label: string; icon: Icon };
// Each kind of site gets its own sections; "" is the summary page.
const nav: Record<SiteKind, NavItem[]> = {
  herboristeria: [
    { path: "", label: "Resumen", icon: SquaresFour },
    { path: "tonicos", label: "Tónicos", icon: Flask },
    { path: "hierbas", label: "Hierbas", icon: Leaf },
    { path: "categorias", label: "Categorías", icon: Tag },
    { path: "tienda", label: "Tienda", icon: Storefront },
  ],
  recetas: [
    { path: "", label: "Resumen", icon: SquaresFour },
    { path: "recetas", label: "Recetas", icon: BookOpenText },
    { path: "categorias", label: "Categorías", icon: Tag },
    { path: "sitio", label: "Sitio", icon: Gear },
  ],
};
const kindLabel: Record<SiteKind, string> = { herboristeria: "Herboristería", recetas: "Recetas" };

export function PanelShell({ site, sites, children }: { site: SiteSummary; sites: SiteSummary[]; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { ready, loadError, reload, busy, flushRef, setError } = usePanel();
  // Every site shares the [site] tree, so a section of another kind (/comidasdelcielo/tonicos) must not render.
  const segment = useSelectedLayoutSegment();
  const known = segment === null || nav[site.kind].some(item => item.path === segment);
  const [open, setOpen] = useState(false);
  // Leaving a page with an open form saves it first; a failed save keeps the person on the page.
  const leave = async (href: string, event?: MouseEvent) => {
    event?.preventDefault();
    if (busy || !(await flushRef.current())) return;
    setError("");
    setOpen(false);
    router.push(href);
  };
  const logout = async () => {
    if (!(await flushRef.current())) return;
    await api("/api/session", { method: "DELETE" }).catch(() => undefined);
    router.refresh();
  };
  const current = (path: string) => pathname === `/${site.id}${path ? `/${path}` : ""}` || (path !== "" && pathname.startsWith(`/${site.id}/${path}/`));
  return <div className="panel-shell" data-menu={open ? "open" : undefined}>
    <header className="panel-topbar">
      <button className="panel-icon-button" aria-label="Abrir menú" aria-expanded={open} aria-controls="panel-sidebar" onClick={() => setOpen(true)}><List size={20} aria-hidden="true" /></button>
      <span className="panel-wordmark">Betayomega</span>
      <span className="panel-topbar-site">{site.name}</span>
    </header>
    <aside id="panel-sidebar" className="panel-sidebar" aria-label="Navegación del panel">
      <div className="panel-sidebar-head">
        <span className="panel-wordmark">Betayomega</span>
        <button className="panel-icon-button panel-close" aria-label="Cerrar menú" onClick={() => setOpen(false)}><X size={20} aria-hidden="true" /></button>
      </div>
      <label className="panel-site-switch">
        <span className="sr-only">Sitio</span>
        <span className="panel-site-mark" aria-hidden="true">{site.name.slice(0, 1)}</span>
        <span className="panel-site-text"><strong>{site.name}</strong><small>{kindLabel[site.kind]}</small></span>
        <CaretUpDown size={16} aria-hidden="true" />
        <select value={site.id} disabled={sites.length < 2} onChange={e => void leave(`/${e.target.value}`)}>
          {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <nav className="panel-nav" aria-label="Secciones">
        {nav[site.kind].map(({ path, label, icon: ItemIcon }) => {
          const href = `/${site.id}${path ? `/${path}` : ""}`;
          return <Link key={path} href={href} aria-current={current(path) ? "page" : undefined} onClick={e => void leave(href, e)}>
            <ItemIcon size={18} weight={current(path) ? "fill" : "regular"} aria-hidden="true" />{label}
          </Link>;
        })}
      </nav>
      <div className="panel-sidebar-foot">
        <a href={site.url} target="_blank" rel="noopener noreferrer"><ArrowSquareOut size={18} aria-hidden="true" />Ver sitio</a>
        <button onClick={() => void logout()}><SignOut size={18} aria-hidden="true" />Cerrar sesión</button>
      </div>
    </aside>
    <button className="panel-scrim" aria-hidden="true" tabIndex={-1} onClick={() => setOpen(false)} />
    <main className="panel-main">
      {loadError && <div className="alert error" role="alert">{loadError}<button onClick={() => void reload()}>Reintentar</button></div>}
      {!known ? <EmptyState title="Esta sección no existe" text={`${site.name} no tiene esta sección. Elegí una del menú.`} />
        : ready ? children : !loadError && <div className="panel-skeleton" aria-busy="true" aria-label="Cargando">
        <span className="panel-skeleton-title" />
        {Array.from({ length: 6 }, (_, n) => <span key={n} className="panel-skeleton-row" />)}
      </div>}
    </main>
  </div>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <header className="panel-page-head">
    <div><h1>{title}</h1>{description && <p>{description}</p>}</div>
    {actions && <div className="panel-page-actions">{actions}</div>}
  </header>;
}
