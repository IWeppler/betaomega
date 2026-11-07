"use client";

import Image from "next/image";
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { productWords } from "@/lib/products";
import type { ProductSiteOptions, SiteKind } from "@/lib/sites";

/** What the panel's client side knows of a site. The server fills it from the registry: client code must not import the site list. */
export type SiteSummary = { id: string; name: string; kind: SiteKind; url: string; panelIcon?: string; products?: ProductSiteOptions; inactive?: boolean };

const kindLabel: Record<SiteKind, string> = { herboristeria: "Hierbas", recetas: "Recetas", productos: "Productos", sauna: "Reservas" };
/** Under the site's name: its kind, or what a product site calls its items ("Voces sagradas"). */
const siteLabel = (site: SiteSummary) => {
  const items = site.products?.items;
  const label = items ? productWords(items).Many : kindLabel[site.kind];
  return site.inactive ? `${label} · sin publicar` : label;
};

/** The site's app icon, or its initial while it has none. */
function SiteMark({ site }: { site: SiteSummary }) {
  const icon = site.panelIcon;
  if (icon) return <Image src={icon} alt="" width={32} height={32} className="size-8 flex-none rounded-lg" />;
  return <span aria-hidden="true" className="grid size-8 flex-none place-items-center rounded-lg bg-accent font-[650] text-accent-ink">{site.name.slice(0, 1)}</span>;
}

function SiteRow({ site }: { site: SiteSummary }) {
  return <span className="flex min-w-0 flex-1 flex-row items-center gap-2.5">
    <SiteMark site={site} />
    <span className="grid min-w-0 leading-tight">
      <strong className="truncate font-semibold text-ink">{site.name}</strong>
      <small className="truncate text-xs text-muted">{siteLabel(site)}</small>
    </span>
  </span>;
}

/**
 * Changes the site being managed. The value only follows the page, so a change the open form refuses leaves it where it was.
 */
export function SiteSwitcher({ site, sites, onChange }: { site: SiteSummary; sites: SiteSummary[]; onChange: (id: string) => void }) {
  return <Select.Root value={site.id} disabled={sites.length < 2} onValueChange={onChange}>
    <Select.Trigger aria-label={`Sitio: ${site.name}. Cambiar de sitio`} className="group flex w-full items-center gap-2.5 rounded-lg border border-transparent bg-surface-sidebar p-2 text-left text-ink enabled:hover:border-line-strong data-[state=open]:border-line-strong disabled:cursor-default disabled:opacity-100">
      <Select.Value className="flex min-w-0 flex-1 items-center gap-2.5"><SiteRow site={site} /></Select.Value>
      <Select.Icon asChild><ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" className="flex-none transition-transform duration-150 group-data-[state=open]:rotate-180" /></Select.Icon>
    </Select.Trigger>
    {/* Portaled inside .panel, where the colour tokens are defined. */}
    <Select.Portal container={typeof document === "undefined" ? undefined : document.querySelector<HTMLElement>(".panel")}>
      <Select.Content position="popper" sideOffset={6} className="z-50 max-h-(--radix-select-content-available-height) w-(--radix-select-trigger-width) overflow-hidden rounded-xl border border-line bg-surface shadow-lift">
        <Select.Viewport className="p-1">
          {sites.map(s => <Select.Item key={s.id} value={s.id} className="flex cursor-pointer items-center gap-2 rounded-lg p-1.5 outline-none data-highlighted:bg-sunken data-[state=checked]:bg-accent-soft data-highlighted:data-[state=checked]:bg-accent-wash">
            <Select.ItemText className="flex min-w-0 flex-1 items-center gap-2.5"><SiteRow site={s} /></Select.ItemText>
            <Select.ItemIndicator className="flex-none text-ink"><Check size={16} strokeWidth={1.75} aria-hidden="true" /></Select.ItemIndicator>
          </Select.Item>)}
        </Select.Viewport>
      </Select.Content>
    </Select.Portal>
  </Select.Root>;
}
