"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSelectedLayoutSegment } from "next/navigation";
import { BookOpenText, ChartLine, ExternalLink, FlaskConical, LayoutGrid, Leaf, LogOut, Menu, MessageSquareText, Package, Settings, Store, Tag, X, type LucideIcon } from "lucide-react";
import { api } from "@/app/admin-fields";
import { productWords } from "@/lib/products";
import { findSite, type SiteKind } from "@/lib/sites";
import { EmptyState } from "./list-tools";
import { usePanel } from "./panel-context";
import { SiteSwitcher, type SiteSummary } from "./site-switcher";

type NavItem = { path: string; label: string; icon: LucideIcon };
// Each kind of site gets its own sections; "" is the summary page.
const nav: Record<SiteKind, NavItem[]> = {
  herboristeria: [
    { path: "", label: "Resumen", icon: LayoutGrid },
    { path: "tonicos", label: "Tónicos", icon: FlaskConical },
    { path: "hierbas", label: "Hierbas", icon: Leaf },
    { path: "categorias", label: "Categorías", icon: Tag },
    { path: "tienda", label: "Tienda", icon: Store },
  ],
  recetas: [
    { path: "", label: "Resumen", icon: LayoutGrid },
    { path: "recetas", label: "Recetas", icon: BookOpenText },
    { path: "categorias", label: "Tipos", icon: Tag },
    { path: "comentarios", label: "Comentarios", icon: MessageSquareText },
    { path: "metricas", label: "Métricas", icon: ChartLine },
    { path: "sitio", label: "Sitio", icon: Settings },
  ],
  productos: [
    { path: "", label: "Resumen", icon: LayoutGrid },
    { path: "productos", label: "Productos", icon: Package },
    { path: "sitio", label: "Sitio", icon: Settings },
  ],
};
// The `!` utilities beat the unlayered `a` and `button` rules of globals.css, which outrank Tailwind's layers.
// Icons have no colour of their own: they take the colour of their label.
const wordmark = "text-[15px] font-[650] tracking-[-0.02em]";
const iconButton = "inline-grid size-(--control) place-items-center rounded-lg text-muted! transition-colors duration-150 hover:bg-ink/6! hover:text-ink!";
const navRow = "flex min-h-(--control) w-full items-center gap-2.5 rounded-lg px-2.5! text-left font-medium text-muted! transition-colors duration-150 hover:bg-ink/5! hover:text-ink!";
const navRowCurrent = "aria-[current=page]:bg-surface-sidebar! aria-[current=page]:font-semibold aria-[current=page]:text-ink!";
const iconProps = { size: 18, strokeWidth: 1.75, "aria-hidden": true, className: "shrink-0" };
/** The menu of a site. A product site names its list section with its own word ("Voces sagradas"). */
const sections = (site: SiteSummary) => {
  const items = findSite(site.id)?.products?.items;
  return nav[site.kind].map(item => (items && item.path === "productos" ? { ...item, label: productWords(items).Many } : item));
};

export function PanelShell({ site, sites, children }: { site: SiteSummary; sites: SiteSummary[]; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { ready, loadError, reload, busy, flushRef, setError, badges } = usePanel();
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
  return <div className="grid min-h-dvh grid-cols-[minmax(0,1fr)] min-[900px]:grid-cols-[248px_minmax(0,1fr)]">
    <header className="sticky top-0 z-20 flex h-12 items-center gap-0.5 border-b border-line bg-bg/92 px-2.5 backdrop-blur-sm min-[900px]:hidden">
      <button className={iconButton} aria-label="Abrir menú" aria-expanded={open} aria-controls="panel-sidebar" onClick={() => setOpen(true)}><Menu size={20} strokeWidth={1.75} aria-hidden="true" /></button>
      <span className={wordmark}>BetaOmega</span>
      <span className="ml-auto text-muted">{site.name}</span>
    </header>
    <aside id="panel-sidebar" aria-label="Navegación del panel" className={`flex h-dvh flex-col gap-4 border-r border-line bg-sidebar px-3 py-4 min-[900px]:sticky min-[900px]:top-0 max-[899px]:fixed max-[899px]:inset-y-0 max-[899px]:left-0 max-[899px]:z-40 max-[899px]:w-[min(300px,86vw)] max-[899px]:transition-transform max-[899px]:duration-250 max-[899px]:ease-(--ease) ${open ? "max-[899px]:shadow-(--shadow-lift)" : "max-[899px]:-translate-x-full"}`}>
      <div className="flex min-h-(--control) items-center justify-between px-2">
        <span className={wordmark}>BetaOmega</span>
        <button className={`${iconButton} min-[900px]:hidden`} aria-label="Cerrar menú" onClick={() => setOpen(false)}><X size={20} strokeWidth={1.75} aria-hidden="true" /></button>
      </div>
      <SiteSwitcher site={site} sites={sites} onChange={id => void leave(`/${id}`)} />
      <nav className="grid gap-0.5" aria-label="Secciones">
        {sections(site).map(({ path, label, icon: ItemIcon }) => {
          const href = `/${site.id}${path ? `/${path}` : ""}`;
          return <Link key={path} href={href} className={`${navRow} ${navRowCurrent}`} aria-current={current(path) ? "page" : undefined} onClick={e => void leave(href, e)}>
            <ItemIcon {...iconProps} />{label}
            {Boolean(badges?.[path]) && <span className="ml-auto min-w-5 rounded-full bg-accent px-1.5 py-px text-center text-xs font-semibold text-accent-ink tabular-nums" aria-label={`${badges?.[path]} pendientes`}>{badges?.[path]}</span>}
          </Link>;
        })}
      </nav>
      <div className="mt-auto grid gap-0.5 border-t border-line pt-3">
        <a className={navRow} href={site.url} target="_blank" rel="noopener noreferrer"><ExternalLink {...iconProps} />Ver sitio</a>
        <button className={navRow} onClick={() => void logout()}><LogOut {...iconProps} />Cerrar sesión</button>
      </div>
    </aside>
    {open && <button className="fixed inset-0 z-30 bg-ink/32! min-[900px]:hidden" aria-hidden="true" tabIndex={-1} onClick={() => setOpen(false)} />}
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
