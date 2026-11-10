"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { api } from "@/app/admin-fields";
import { offerUndo } from "@/shared/ui/undo";
import type { Catalog } from "@/lib/catalog";
import { PanelContext } from "./panel-context";

type Value = {
  catalog: Catalog | null;
  /** Latest catalogue, also between renders: editors build their saves on it. */
  catalogRef: MutableRefObject<Catalog | null>;
  loadError: string;
  /** Last save error, shown by whichever form is open. */
  error: string;
  setError: (message: string) => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  /** Saves and offers to undo it. `message` says what changed: "Se guardó correctamente." if left out. */
  save: (next: Catalog, message?: string) => Promise<boolean>;
  reload: () => Promise<void>;
  /** The open edit form registers here; leaving a page asks it first (save, discard or stay). */
  flushRef: MutableRefObject<() => Promise<boolean>>;
  /** True while a page holds unsaved work that a background refresh must not replace. */
  setDirty: (dirty: boolean) => void;
};
const CatalogContext = createContext<Value | null>(null);
export function useCatalog() {
  const value = useContext(CatalogContext);
  if (!value) throw new Error("useCatalog fuera del panel");
  return value;
}

// The catalogue is loaded once for every panel page and refreshed on focus and every 30 s, unless something is being edited.
export function CatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const catalogRef = useRef<Catalog | null>(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const flushRef = useRef<() => Promise<boolean>>(async () => true);
  const reload = useCallback(async () => {
    try {
      const data = await api<Catalog>("/api/catalog");
      catalogRef.current = data;
      setCatalog(data);
      setLoadError("");
    } catch (e) { setLoadError((e as Error).message); }
  }, []);
  useEffect(() => { void Promise.resolve().then(reload); }, [reload]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible" && !busy && !dirty) void reload(); };
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => { window.removeEventListener("focus", refresh); window.clearInterval(timer); };
  }, [reload, busy, dirty]);
  const put = useCallback(async (next: Catalog) => {
    const saved = await api<Catalog>("/api/catalog", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
    catalogRef.current = saved;
    setCatalog(saved);
  }, []);
  const save = useCallback(async (next: Catalog, message = "Se guardó correctamente.") => {
    const before = catalogRef.current;
    setBusy(true);
    setError("");
    try {
      await put(next);
      // The whole catalogue goes back as it was, over the revision just saved: if someone saved after, the server refuses it.
      if (before) offerUndo(message, () => put({ ...before, revision: catalogRef.current?.revision ?? before.revision }));
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally { setBusy(false); }
  }, [put]);
  return <PanelContext.Provider value={{ ready: Boolean(catalog), loadError, reload, error, setError, busy, setBusy, flushRef, setDirty }}>
    <CatalogContext.Provider value={{ catalog, catalogRef, loadError, error, setError, busy, setBusy, save, reload, flushRef, setDirty }}>{children}</CatalogContext.Provider>
  </PanelContext.Provider>;
}
