import { notFound, redirect } from "next/navigation";
import { publicHome } from "@/modules/sauna/server";
import { SiteBookingPage, SiteFrame } from "@/modules/sauna/ui/public";
import { isAdmin } from "@/platform/auth/server";
import { getPanelSite } from "@/platform/sites/server";

export const dynamic = "force-dynamic";

// The booking as the panel previews it: same page, behind the panel's session, flagged as a preview so nothing is taken.
export default async function PreviewBookingPage({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ hierba?: string | string[]; plan?: string | string[] }> }) {
  if (!await isAdmin()) redirect("/");
  const [{ site: siteId }, { hierba, plan }] = await Promise.all([params, searchParams]);
  const site = await getPanelSite(siteId);
  if (site?.kind !== "sauna") notFound();
  const home = `/vista-previa/${site.id}`;
  const data = await publicHome(site.id, { termsHref: `${home}/terminos`, preview: true });
  if (!data) notFound();
  return <SiteFrame siteName={site.name} home={home} termsHref={`${home}/terminos`} preview><SiteBookingPage data={data} homeHref={home} initialHerbId={typeof hierba === "string" ? hierba : ""} initialPlanId={typeof plan === "string" ? plan : ""} /></SiteFrame>;
}
