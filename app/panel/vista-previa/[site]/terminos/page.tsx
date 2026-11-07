import { notFound, redirect } from "next/navigation";
import { publicPage } from "@/modules/sauna/server";
import { SiteFrame } from "@/modules/sauna/ui/public";
import { isAdmin } from "@/platform/auth/server";
import { getPanelSite } from "@/platform/sites/server";

export const dynamic = "force-dynamic";

export default async function PreviewTermsPage({ params }: { params: Promise<{ site: string }> }) {
  if (!await isAdmin()) redirect("/");
  const site = await getPanelSite((await params).site);
  if (site?.kind !== "sauna") notFound();
  const home = `/vista-previa/${site.id}`;
  const { terms } = await publicPage(site.id);
  return <SiteFrame siteName={site.name} home={home} termsHref={`${home}/terminos`} preview>
    <article className="mx-auto grid max-w-2xl gap-5 px-4 pt-36 pb-16">
      <h1 className="m-0 font-display text-4xl/snug font-normal text-ink">Términos y condiciones</h1>
      {terms.split(/\n\s*\n/).map(paragraph => <p key={paragraph} className="m-0 leading-7 text-muted">{paragraph}</p>)}
    </article>
  </SiteFrame>;
}
