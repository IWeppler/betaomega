import "server-only";

// Facade over the live site registry, which reads the database.
export { getPanelSite, getSite, listSites } from "@/lib/site-registry";
// Public ISR window and cache tags; the panel's writes call refreshPublic.
export { publicRevalidate, publicTags, refreshPublic } from "./public-cache";
