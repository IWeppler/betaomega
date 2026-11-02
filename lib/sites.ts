// Every public site the platform serves. proxy.ts imports this, so keep it free of server-only code.
export type SiteKind = "herboristeria" | "recetas";
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
};

export const sites: Site[] = [
  { id: "nekurel", kind: "herboristeria", name: "Ñekurel", domains: ["nekurel.com", "nekurel.vercel.app", "nekurel.localhost"], url: "https://nekurel.vercel.app", catalogKey: "catalog" },
  // No own domain yet: add it to `domains` and `url` once it is bought.
  { id: "comidasdelcielo", kind: "recetas", name: "Comidas del cielo", domains: ["comidasdelcielo.vercel.app", "comidasdelcielo.localhost"], url: "https://comidasdelcielo.vercel.app" },
];

export const findSite = (id: string) => sites.find(site => site.id === id);
/** Unknown hosts (localhost, the shop tablet's LAN IP, preview deploys) get the default site. */
export function siteForHost(host: string, fallback = "nekurel"): Site | undefined {
  const name = host.toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
  return sites.find(site => site.domains.includes(name)) ?? findSite(fallback);
}

/** The central admin panel lives on its own neutral host. PANEL_HOSTS is a comma-separated list. */
export const defaultPanelHosts = "betayomega.vercel.app,panel.localhost";
export function isPanelHost(host: string, configured = defaultPanelHosts) {
  const name = host.toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
  return configured.split(",").map(h => h.trim().toLowerCase()).filter(Boolean).includes(name);
}
