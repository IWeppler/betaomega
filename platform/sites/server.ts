import "server-only";

// Facade over the live site registry, which reads the database.
export { getPanelSite, getSite, listSites } from "@/lib/site-registry";
