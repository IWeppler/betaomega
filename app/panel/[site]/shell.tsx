"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSelectedLayoutSegment } from "next/navigation";
import { BellRing, ExternalLink, LogOut, Menu, X } from "lucide-react";
import { api } from "@/app/admin-fields";
import { productWords } from "@/lib/products";
import { panelKinds } from "./kinds";
import { EmptyState } from "./list-tools";
import { SiteContext, usePanel } from "./panel-context";
import { useSiteNotices } from "./site-notices";
import { SiteSwitcher, type SiteSummary } from "./site-switcher";

// Icons have no colour of their own: they take the colour of their label.
const wordmark = "text-[15px] font-[650] tracking-[-0.02em]";
const iconButton = "inline-grid size-control place-items-center rounded-lg text-muted transition-colors duration-150 hover:bg-ink/6 hover:text-ink";
const navRow = "flex min-h-control w-full items-center gap-2.5 rounded-lg px-2.5 text-left font-medium text-muted transition-colors duration-150 hover:bg-ink/5 hover:text-ink";
const navRowCurrent = "aria-[current=page]:bg-surface-sidebar aria-[current=page]:font-semibold aria-[current=page]:text-ink";
const iconProps = { size: 18, strokeWidth: 1.75, "aria-hidden": true, className: "shrink-0" };
/** The menu of a site. A product site names its list section with its own word ("Voces sagradas"). */
const sections = (site: SiteSummary) => {
  const items = site.products?.items;
  return panelKinds[site.kind].sections.map(item => (items && item.path === "productos" ? { ...item, label: productWords(items).Many } : item));
};

export function PanelShell({ site, sites, children }: { site: SiteSummary; sites: SiteSummary[]; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { ready, loadError, reload, busy, flushRef, setError, badges } = usePanel();
  // Every site shares the [site] tree, so a section of another kind (/comidasdelcielo/tonicos) must not render.
  const segment = useSelectedLayoutSegment();
  // "avisos" belongs to the panel, not to a kind: every site opens the same screen (docs/tareas-notificaciones.md).
  const known = segment === null || segment === "avisos" || panelKinds[site.kind].sections.some(item => item.path === segment);
  const [open, setOpen] = useState(false);
  const notices = useSiteNotices(site.id, sites.map(item => item.id));
  const waiting = Object.values(notices).reduce((sum, notice) => sum + notice.count, 0);
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
  return <SiteContext.Provider value={site}><div className="grid min-h-dvh grid-cols-[minmax(0,1fr)] min-[900px]:grid-cols-[248px_minmax(0,1fr)]">
    <header className="sticky top-0 z-20 flex h-12 items-center gap-0.5 border-b border-line bg-bg/92 px-2.5 backdrop-blur-sm min-[900px]:hidden">
      <button className={`${iconButton} relative`} aria-label={waiting ? `Abrir menú. ${waiting} avisos en otros sitios` : "Abrir menú"} aria-expanded={open} aria-controls="panel-sidebar" onClick={() => setOpen(true)}>
        <Menu size={20} strokeWidth={1.75} aria-hidden="true" />
        {waiting > 0 && <span className="absolute top-1 right-1 size-2.5 rounded-full border-2 border-bg bg-danger" aria-hidden="true" />}
      </button>
      <span className={wordmark}>BetaOmega</span>
      <span className="ml-auto text-muted">{site.name}</span>
    </header>
    <aside id="panel-sidebar" aria-label="Navegación del panel" className={`flex h-dvh flex-col gap-4 border-r border-line bg-sidebar px-3 py-4 min-[900px]:sticky min-[900px]:top-0 max-[899px]:fixed max-[899px]:inset-y-0 max-[899px]:left-0 max-[899px]:z-40 max-[899px]:w-[min(300px,86vw)] max-[899px]:transition-transform max-[899px]:duration-250 max-[899px]:ease-standard ${open ? "max-[899px]:shadow-lift" : "max-[899px]:-translate-x-full"}`}>
      <div className="flex min-h-control items-center justify-between px-2">
        <span className={wordmark}>BetaOmega</span>
        <button className={`${iconButton} min-[900px]:hidden`} aria-label="Cerrar menú" onClick={() => setOpen(false)}><X size={20} strokeWidth={1.75} aria-hidden="true" /></button>
      </div>
      <SiteSwitcher site={site} sites={sites} notices={notices} onChange={id => void leave(`/${id}`)} />
      {Object.entries(notices).length > 0 && <ul className="m-0 grid list-none gap-1 p-0" aria-label="Avisos de otros sitios">
        {sites.filter(item => notices[item.id]).map(item => {
          const notice = notices[item.id];
          const href = `/${item.id}/${notice.path}`;
          return <li key={item.id}>
            <Link href={href} onClick={e => void leave(href, e)} className="flex items-center gap-2 rounded-lg border border-line bg-bg px-2.5 py-2 text-[13px] text-ink transition-colors duration-150 hover:border-line-strong">
              <span className="size-2 shrink-0 rounded-full bg-danger" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate"><strong className="font-semibold">{item.name}</strong> <span className="text-muted">· {notice.count >= 100 ? "99+" : notice.count} {notice.label}</span></span>
            </Link>
          </li>;
        })}
      </ul>}
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
        <Link className={`${navRow} ${navRowCurrent}`} href={`/${site.id}/avisos`} aria-current={current("avisos") ? "page" : undefined} onClick={e => void leave(`/${site.id}/avisos`, e)}><BellRing {...iconProps} />Avisos al celular</Link>
        <a className={navRow} href={site.inactive ? `/vista-previa/${site.id}` : site.url} target="_blank" rel="noopener noreferrer"><ExternalLink {...iconProps} />{site.inactive ? "Vista previa" : "Ver sitio"}</a>
        <button className={navRow} onClick={() => void logout()}><LogOut {...iconProps} />Cerrar sesión</button>
      </div>
    </aside>
    {open && <button className="fixed inset-0 z-30 bg-ink/32 min-[900px]:hidden" aria-hidden="true" tabIndex={-1} onClick={() => setOpen(false)} />}
    <main className="panel-main">
      {loadError && <div className="alert error" role="alert">{loadError}<button onClick={() => void reload()}>Reintentar</button></div>}
      {!known ? <EmptyState title="Esta sección no existe" text={`${site.name} no tiene esta sección. Elegí una del menú.`} />
        : ready ? children : !loadError && <div className="panel-skeleton" aria-busy="true" aria-label="Cargando">
        <span className="panel-skeleton-title" />
        {Array.from({ length: 6 }, (_, n) => <span key={n} className="panel-skeleton-row" />)}
      </div>}
    </main>
  </div></SiteContext.Provider>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <header className="panel-page-head">
    <div><h1>{title}</h1>{description && <p>{description}</p>}</div>
    {actions && <div className="panel-page-actions">{actions}</div>}
  </header>;
}
