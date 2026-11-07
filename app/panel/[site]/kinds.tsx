import type { ReactNode } from "react";
import { BookOpenText, ChartLine, FlaskConical, LayoutGrid, Leaf, MessageSquareText, Package, Settings, Store, Tag, type LucideIcon } from "lucide-react";
import type { Site, SiteKind } from "@/lib/sites";
import { saunaPanel } from "@/modules/sauna/panel";
import { CatalogProvider } from "./catalog-context";
import { ProductsProvider } from "./products-context";
import { RecipesProvider } from "./recipes-context";

// The one place that says what the panel of each kind of site is made of. A new kind of site is one entry here (plus its pages under
// app/panel/[site]/<section>/): the shell builds the menu from `sections` and the layout wraps the pages in `provider`.
// Typed as a Record over SiteKind, so adding a kind to lib/sites.ts without registering it here does not compile.

export type PanelSection = {
  /** The URL segment after the site ("" is the summary page). */
  path: string;
  label: string;
  icon: LucideIcon;
  /** Needed to see the section (lib/panel-access.ts). Without one, anyone who enters the site's panel sees it. */
  permission?: string;
};

export type PanelKind = {
  sections: PanelSection[];
  /** Loads this kind's data and shares it with the shell and the pages through its context. */
  provider: (site: Site, children: ReactNode) => ReactNode;
};

const summary: PanelSection = { path: "", label: "Resumen", icon: LayoutGrid };

export const panelKinds: Record<SiteKind, PanelKind> = {
  herboristeria: {
    sections: [
      summary,
      { path: "tonicos", label: "Tónicos", icon: FlaskConical },
      { path: "hierbas", label: "Hierbas", icon: Leaf },
      { path: "categorias", label: "Categorías", icon: Tag },
      { path: "tienda", label: "Tienda", icon: Store },
    ],
    provider: (_site, children) => <CatalogProvider>{children}</CatalogProvider>,
  },
  recetas: {
    sections: [
      summary,
      { path: "recetas", label: "Recetas", icon: BookOpenText },
      { path: "categorias", label: "Tipos", icon: Tag },
      { path: "comentarios", label: "Comentarios", icon: MessageSquareText },
      { path: "metricas", label: "Métricas", icon: ChartLine },
      { path: "sitio", label: "Sitio", icon: Settings },
    ],
    provider: (site, children) => <RecipesProvider siteId={site.id}>{children}</RecipesProvider>,
  },
  productos: {
    sections: [
      summary,
      { path: "productos", label: "Productos", icon: Package },
      { path: "sitio", label: "Sitio", icon: Settings },
    ],
    // The key drops the loaded list on a site change, so one site's products can never be saved into another.
    provider: (site, children) => <ProductsProvider key={site.id} siteId={site.id} options={site.products}>{children}</ProductsProvider>,
  },
  sauna: { sections: [summary, ...saunaPanel.sections], provider: saunaPanel.provider },
};
