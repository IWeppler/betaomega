"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@/app/admin-fields";
import { offerUndo } from "@/shared/ui/undo";
import type { Product, ProductList } from "@/lib/products";
import type { ProductSiteOptions } from "@/lib/sites";
import { PanelContext } from "./panel-context";
import { liveRefreshMs } from "@/shared/lib/live-refresh";

type Value = {
  products: Product[] | null;
  /** How this site names and describes its products (from the registry). */
  options: ProductSiteOptions | undefined;
  /** Saves one product and returns the stored version, or null (the error is in the panel state). */
  save: (product: Product) => Promise<Product | null>;
  remove: (id: string) => Promise<boolean>;
};
const ProductsContext = createContext<Value | null>(null);
export function useProducts() {
  const value = useContext(ProductsContext);
  if (!value) throw new Error("useProducts fuera de un sitio de productos");
  return value;
}

const byName = (a: Product, b: Product) => a.name.localeCompare(b.name, "es");

// Same rules as the catalogue: loaded once for the whole panel, refreshed on focus and every few minutes (liveRefreshMs) unless something is being edited.
export function ProductsProvider({ siteId, options, children }: { siteId: string; options: ProductSiteOptions | undefined; children: ReactNode }) {
  const base = `/api/sites/${siteId}/products`;
  const [list, setList] = useState<ProductList | null>(null);
  // Latest list, also between renders: every save builds on it.
  const listRef = useRef<ProductList | null>(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const flushRef = useRef<() => Promise<boolean>>(async () => true);
  const store = useCallback((next: ProductList) => {
    listRef.current = next;
    setList(next);
  }, []);
  const reload = useCallback(async () => {
    try {
      store(await api<ProductList>(base));
      setLoadError("");
    } catch (e) { setLoadError((e as Error).message); }
  }, [base, store]);
  useEffect(() => { void Promise.resolve().then(reload); }, [reload]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible" && !busy && !dirty) void reload(); };
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, liveRefreshMs);
    return () => { window.removeEventListener("focus", refresh); window.clearInterval(timer); };
  }, [reload, busy, dirty]);
  const put = useCallback(async (products: Product[]) => {
    const revision = listRef.current?.revision ?? 0;
    setBusy(true);
    setError("");
    try {
      const saved = await api<ProductList>(base, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision, products }) });
      store(saved);
      return saved;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally { setBusy(false); }
  }, [base, store]);
  // "Deshacer" saves the previous list back over the revision just saved, so a save made by someone else in between is refused, not lost.
  const undoTo = useCallback((before: Product[], message: string) => offerUndo(message, async () => {
    if (!(await put(before))) throw new Error("No se pudo deshacer. Recargá la página y revisalo a mano.");
  }), [put]);
  const save = useCallback(async (product: Product) => {
    const current = listRef.current?.products ?? [];
    const saved = await put(current.some(p => p.id === product.id) ? current.map(p => (p.id === product.id ? product : p)) : [...current, product]);
    if (saved) undoTo(current, "Se guardó correctamente.");
    return saved?.products.find(p => p.id === product.id) ?? null;
  }, [put, undoTo]);
  const remove = useCallback(async (id: string) => {
    const current = listRef.current?.products ?? [];
    const saved = await put(current.filter(p => p.id !== id));
    if (saved) undoTo(current, `Se eliminó ${current.find(p => p.id === id)?.name ?? "el producto"}.`);
    return Boolean(saved);
  }, [put, undoTo]);
  const products = list ? [...list.products].sort(byName) : null;
  return <PanelContext.Provider value={{ ready: Boolean(list), loadError, reload, error, setError, busy, setBusy, flushRef, setDirty }}>
    <ProductsContext.Provider value={{ products, options, save, remove }}>{children}</ProductsContext.Provider>
  </PanelContext.Provider>;
}
