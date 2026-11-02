"use client";

import { StoreTab } from "@/app/store-tab";
import { useCatalog } from "../catalog-context";
import { PageHeader } from "../shell";

export default function StorePage() {
  const { catalog, busy, error, setError, flushRef, save, reload, setDirty } = useCatalog();
  if (!catalog) return null;
  return <>
    <PageHeader title="Tienda" description="Datos de contacto, precios, visibilidad, promociones y combos de la tienda online." />
    <StoreTab catalog={catalog} busy={busy} error={error} active flushRef={flushRef} onSave={save} onReload={() => void reload()} onClearError={() => setError("")} onDirty={setDirty} />
  </>;
}
