import "server-only";

// Facade over the legacy data layer (docs/ARCHITECTURE.md §4.2). The raw `supabase` client stays out on purpose: tables of a site are read
// through siteTable and SQL functions through rpc, so a module cannot build an unscoped query.
export { rpc, SupabaseError } from "@/lib/supabase";
export { MissingTableError, panelTable, siteDocument, siteTable } from "@/lib/site-table";
