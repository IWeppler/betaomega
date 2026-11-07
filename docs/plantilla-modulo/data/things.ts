import { siteTable } from "@/platform/db";
import type { Thing } from "../domain/thing";

type Row = { id: string; site_id: string; name: string };

const things = (siteId: string) => siteTable<Row>("things", siteId, "Falta la tabla things: corré supabase/schema.sql.");

// siteId always comes first: siteTable scopes every query to it, so one site can never read another's rows.
export async function listThings(siteId: string): Promise<Thing[]> {
  const rows = await things(siteId)("select=id,site_id,name&order=name.asc");
  return rows.map(row => ({ id: row.id, name: row.name }));
}
