"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowSquareOut, CaretLeft, CaretRight, MagnifyingGlass, type Icon } from "@phosphor-icons/react";
import type { Plant, Preparation } from "@/lib/catalog";
import { usePanel } from "./panel-context";

export type Selection<T> = { item: T; mode: "edit" | "delete" } | null;

/** Selected row of a list page. Changing it asks the open form first (save, discard or stay), and background refreshes wait while it is open. */
export function useSelection<T>() {
  const { flushRef, busy, setError, setDirty } = usePanel();
  const [selection, setSelection] = useState<Selection<T>>(null);
  useEffect(() => { setDirty(Boolean(selection)); return () => setDirty(false); }, [selection, setDirty]);
  const select = async (next: Selection<T>) => {
    if (busy || !(await flushRef.current())) return;
    setError("");
    setSelection(next);
  };
  return { selection, setSelection, select };
}

export function SearchBox({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return <label className="panel-search">
    <MagnifyingGlass size={16} aria-hidden="true" />
    <span className="sr-only">{label}</span>
    <input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={label} />
  </label>;
}

export function StatusBadges({ item }: { item: Plant | Preparation }) {
  return <>
    {!item.published && <span className="panel-badge is-draft">Borrador</span>}
    {item.hidden && <span className="panel-badge">Oculto</span>}
  </>;
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="panel-empty"><h3>{title}</h3><p>{text}</p></div>;
}

/** Opens a blank editor when the page is reached with ?nuevo (the summary's quick actions), then drops the parameter so a reload does not open it again. */
export function useNewFromLink(open: () => void) {
  const router = useRouter();
  const pathname = usePathname();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !new URLSearchParams(window.location.search).has("nuevo")) return;
    done.current = true;
    router.replace(pathname, { scroll: false });
    open();
  // Runs once, on arrival.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export type QuickAction = { label: string; text: string; href: string; icon: Icon; external?: boolean };
export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return <section className="panel-card" aria-labelledby="quick-title">
    <h2 id="quick-title" className="panel-card-title">Accesos rápidos</h2>
    <ul className="panel-quick">
      {actions.map(({ label, text, href, icon: ActionIcon, external }) => {
        const body = <><span className="panel-quick-icon" aria-hidden="true"><ActionIcon size={18} /></span><span><strong>{label}{external && <ArrowSquareOut size={13} aria-label="(se abre en otra pestaña)" />}</strong><small>{text}</small></span></>;
        return <li key={label}>{external ? <a href={href} target="_blank" rel="noopener noreferrer">{body}</a> : <Link href={href}>{body}</Link>}</li>;
      })}
    </ul>
  </section>;
}

export const PAGE_SIZE = 12;

/** Shows `rows` a page at a time under the table `children` draws. Going back to page 1 when `resetKey` (the search or view) changes. */
export function Paged<T>({ rows, resetKey, children }: { rows: T[]; resetKey: string; children: (shown: T[]) => ReactNode }) {
  const [state, setState] = useState({ page: 0, key: resetKey });
  const pages = Math.ceil(rows.length / PAGE_SIZE);
  const page = Math.min(state.key === resetKey ? state.page : 0, pages - 1);
  const first = page * PAGE_SIZE;
  const go = (next: number) => setState({ page: next, key: resetKey });
  return <>
    {children(rows.slice(first, first + PAGE_SIZE))}
    {pages > 1 && <nav className="panel-pager" aria-label="Paginación">
      <span aria-live="polite">{first + 1}–{Math.min(first + PAGE_SIZE, rows.length)} de {rows.length}</span>
      <div>
        <button className="button" disabled={page === 0} onClick={() => go(page - 1)}><CaretLeft size={14} aria-hidden="true" />Anterior</button>
        <span>Página {page + 1} de {pages}</span>
        <button className="button" disabled={page >= pages - 1} onClick={() => go(page + 1)}>Siguiente<CaretRight size={14} aria-hidden="true" /></button>
      </div>
    </nav>}
  </>;
}
