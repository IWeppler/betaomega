// Types and pure helpers for the public sites. The live registry is the `sites` table (lib/site-registry.ts); this file only holds
// the seed used when the table is missing or unreachable, so the sites never go down with the database. Keep it free of server-only code.
export const siteKinds = ["herboristeria", "recetas", "productos", "sauna"] as const;
export type SiteKind = (typeof siteKinds)[number];
/** What changes between product sites (kind "productos"). */
export type ProductSiteOptions = {
  /** What the site calls what it publishes, in lower case. `productWords` (lib/products.ts) builds the phrases. */
  items: { one: string; many: string; feminine: boolean };
  /** Heading of the description, in the panel and on the public page. */
  descriptionLabel: string;
  /** Each product must say whether it is for drinking or for the skin, and the public pages show it as a warning sign. */
  application: boolean;
  /** Accent colour of the public site. It must keep 4.5:1 contrast with white text. */
  accent: string;
  /** Icon files in public/: with transparent corners, and full bleed for Android and Apple. Without them, /icon draws the site's initial. */
  icon?: { any: string; maskable: string };
};
export type Site = {
  id: string;
  kind: SiteKind;
  name: string;
  /** Hosts without "www." or port. The first one is not special: `url` is the canonical address. */
  domains: string[];
  /** Canonical origin for metadata and shared links. */
  url: string;
  /** Key of the catalogue document in app_data. Herboristerías only: recipe sites use the recipes table. */
  catalogKey?: string;
  /** App icon in public/, shown in the panel's site switcher. Without it, the switcher shows the site's initial. */
  panelIcon?: string;
  /** Product sites only. */
  products?: ProductSiteOptions;
  /** Being prepared: the panel manages it, the public cannot reach it. Only lib/site-registry.ts's panel functions return such a site. */
  inactive?: true;
};

/** The sites that existed before the registry table. Fallback only: read sites through lib/site-registry.ts. */
export const seedSites: Site[] = [
  { id: "nekurel", kind: "herboristeria", name: "Ñekurel", domains: ["nekurel.com", "nekurel.vercel.app", "nekurel.localhost"], url: "https://nekurel.vercel.app", catalogKey: "catalog" },
  // No own domain yet: add it to `domains` and `url` once it is bought.
  { id: "comidasdelcielo", kind: "recetas", name: "Comidas del cielo", domains: ["comidasdelcielo.vercel.app", "comidasdelcielo.localhost"], url: "https://comidasdelcielo.vercel.app", panelIcon: "/comidasdelcielo-icon.png" },
  { id: "purificacion", kind: "productos", name: "Purificación", domains: ["purificacion.vercel.app", "purificacion.localhost"], url: "https://purificacion.vercel.app", panelIcon: "/purificacion-icon.png", products: { items: { one: "agua", many: "aguas", feminine: true }, descriptionLabel: "Cómo se obtiene", application: true, accent: "#0b6e99", icon: { any: "/purificacion-icon.png", maskable: "/purificacion-icon-maskable.png" } } },
  { id: "yakuchil", kind: "productos", name: "Yakuchil", domains: ["yakuchil.vercel.app", "yakuchil.localhost"], url: "https://yakuchil.vercel.app", products: { items: { one: "voz sagrada", many: "voces sagradas", feminine: true }, descriptionLabel: "Descripción", application: false, accent: "#1f6f50" } },
];

export const normalizeHost = (host: string) => host.toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
export const findIn = (list: Site[], id: string) => list.find(site => site.id === id);
/** Unknown hosts (localhost, the shop tablet's LAN IP, preview deploys) get the default site. */
export function siteForHostIn(list: Site[], host: string, fallback = "nekurel"): Site | undefined {
  const name = normalizeHost(host);
  return list.find(site => site.domains.includes(name)) ?? findIn(list, fallback);
}

/** The central admin panel lives on its own neutral host. PANEL_HOSTS is a comma-separated list. */
export const defaultPanelHosts = "betayomega.vercel.app,panel.localhost";
export function isPanelHost(host: string, configured = defaultPanelHosts) {
  const name = normalizeHost(host);
  return configured.split(",").map(h => h.trim().toLowerCase()).filter(Boolean).includes(name);
}
