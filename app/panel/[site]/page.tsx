import { notFound } from "next/navigation";
import { getPanelSite } from "@/lib/site-registry";
import { SaunaSummary } from "@/modules/sauna/ui";
import { HerbSummary } from "./herb-summary";
import { ProductSummary } from "./product-summary";
import { RecipeSummary } from "./recipe-summary";

// The summary depends on the kind of site; the layout already checked the session.
export default async function SummaryPage({ params }: { params: Promise<{ site: string }> }) {
  const site = await getPanelSite((await params).site);
  if (!site) notFound();
  if (site.kind === "sauna") return <SaunaSummary />;
  if (site.kind === "productos") return <ProductSummary />;
  return site.kind === "recetas" ? <RecipeSummary /> : <HerbSummary />;
}
