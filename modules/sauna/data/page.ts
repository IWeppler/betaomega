import { siteDocument } from "@/platform/db";
import { cleanPage, pageDefaults, type PageContent } from "../domain/page";
import { SetupError } from "../domain/setup";
import { SetupConflictError } from "./setup";

/** The home page's content. Without a stored document, or with an invalid one, the site says the defaults instead of going down. */
export async function readPage(siteId: string): Promise<PageContent> {
  const stored = await siteDocument("saunaPage", siteId).read();
  if (!stored) return pageDefaults();
  try {
    return cleanPage(stored);
  } catch (error) {
    if (!(error instanceof SetupError)) throw error;
    console.warn("[sauna] invalid page document, using defaults");
    return pageDefaults();
  }
}

export async function savePage(siteId: string, page: PageContent): Promise<void> {
  if (!await siteDocument("saunaPage", siteId).save({ ...page, revision: page.revision + 1 }, page.revision)) throw new SetupConflictError();
}
