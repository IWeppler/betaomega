import { notFound, redirect } from "next/navigation";
import { publicHome } from "@/modules/sauna/server";
import { SiteFrame, SiteHome } from "@/modules/sauna/ui/public";
import { isAdmin } from "@/platform/auth/server";
import { getPanelSite } from "@/platform/sites/server";

export const dynamic = "force-dynamic";

// How to see a site before publishing it: behind the panel's session, so an inactive site stays closed to everyone else.
export default async function PreviewPage({ params }: { params: Promise<{ site: string }> }) {
  if (!await isAdmin()) redirect("/");
  const site = await getPanelSite((await params).site);
  if (site?.kind !== "sauna") notFound();
  const home = `/vista-previa/${site.id}`;
  const data = await publicHome(site.id, { termsHref: `${home}/terminos`, preview: true });
  if (!data) notFound();
  return <SiteFrame siteName={site.name} home={home} termsHref={`${home}/terminos`} preview><SiteHome data={data} /></SiteFrame>;
}
