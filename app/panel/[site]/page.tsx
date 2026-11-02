import { notFound } from "next/navigation";
import { findSite } from "@/lib/sites";
import { HerbSummary } from "./herb-summary";
import { RecipeSummary } from "./recipe-summary";

// The summary depends on the kind of site; the layout already checked the session.
export default async function SummaryPage({ params }: { params: Promise<{ site: string }> }) {
  const site = findSite((await params).site);
  if (!site) notFound();
  return site.kind === "recetas" ? <RecipeSummary /> : <HerbSummary />;
}
