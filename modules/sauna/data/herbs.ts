import "server-only";
import { readCatalog } from "@/platform/catalog/server";
import { getSite } from "@/platform/sites/server";
import { saunaHerbs } from "../domain/herbs";

/** The catalogue is currently unique to Ñekurel (docs/ARCHITECTURE.md). */
export async function listSaunaHerbs(siteId: string) {
  if (siteId !== "fropexio" || (await getSite("nekurel"))?.kind !== "herboristeria") return [];
  return saunaHerbs((await readCatalog()).plants);
}
