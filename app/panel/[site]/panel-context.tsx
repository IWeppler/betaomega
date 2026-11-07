"use client";

import { createContext, useContext, type MutableRefObject } from "react";
import type { SiteSummary } from "./site-switcher";

/** What the shell and the list tools need from any site's data provider (catalogue, recipes…). */
export type PanelState = {
  /** The site's data arrived; until then the shell shows a skeleton. */
  ready: boolean;
  loadError: string;
  reload: () => Promise<void>;
  /** Last save error, shown by whichever form is open. */
  error: string;
  setError: (message: string) => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  /** The open edit form registers here; leaving a page asks it first (save, discard or stay). */
  flushRef: MutableRefObject<() => Promise<boolean>>;
  /** True while a page holds unsaved work that a background refresh must not replace. */
  setDirty: (dirty: boolean) => void;
  /** Counts shown next to a section of the menu, by section path (comments waiting for review). */
  badges?: Record<string, number>;
};
export const PanelContext = createContext<PanelState | null>(null);
export function usePanel() {
  const value = useContext(PanelContext);
  if (!value) throw new Error("usePanel fuera del panel");
  return value;
}

/** The site being managed, as the server's registry describes it. Set by the shell, so pages never need the site list themselves. */
export const SiteContext = createContext<SiteSummary | null>(null);
export function useSite() {
  const value = useContext(SiteContext);
  if (!value) throw new Error("useSite fuera del panel");
  return value;
}
