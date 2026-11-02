"use client";

import { CategoryImageEditor } from "@/app/category-images";
import { getCategories } from "@/lib/catalog";
import { useCatalog } from "../catalog-context";
import { PageHeader } from "../shell";

export function HerbCategories() {
  const { catalog, catalogRef, save, error } = useCatalog();
  if (!catalog) return null;
  return <>
    <PageHeader title="Categorías" description="Nombres, imágenes y visibilidad en la tienda. Ocultar una categoría oculta sus productos sin tocar sus fichas." />
    <section className="panel-card panel-pad">
      <CategoryImageEditor inline initial={catalog.categoryImages ?? {}} initialCategories={getCategories(catalog)} error={error} onClose={() => undefined}
        onSave={(categories, images) => save({ ...(catalogRef.current ?? catalog), categories, categoryImages: images })} />
    </section>
  </>;
}
