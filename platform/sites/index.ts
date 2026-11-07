// Client-safe facade over the site types. The seed list stays out on purpose: client components receive what they need from the server.
export { siteKinds } from "@/lib/sites";
export type { ProductSiteOptions, Site, SiteKind } from "@/lib/sites";
