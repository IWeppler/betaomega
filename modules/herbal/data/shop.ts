import "server-only";
import { readCatalog } from "@/platform/catalog/server";
import { buildHerbalShop } from "../sales";

export async function loadHerbalShop() {
  return buildHerbalShop(await readCatalog());
}
