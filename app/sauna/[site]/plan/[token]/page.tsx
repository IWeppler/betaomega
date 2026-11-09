import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { publicPlan } from "@/modules/sauna/server";
import { PlanView } from "@/modules/sauna/ui/public";
import { getSite } from "@/platform/sites/server";

export const dynamic = "force-dynamic";

// The address is the secret, as for a single booking: no Referer, no search engine.
export const metadata: Metadata = { title: "Tu plan", robots: { index: false, follow: false }, referrer: "no-referrer" };

type Props = { params: Promise<{ site: string; token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PlanPage({ params, searchParams }: Props) {
  const { site: siteId, token } = await params;
  const site = await getSite(siteId);
  if (site?.kind !== "sauna") notFound();
  const paymentId = (await searchParams).payment_id;
  const data = await publicPlan(site.id, token, typeof paymentId === "string" ? paymentId : undefined);
  if (!data) notFound();
  return <div className="mx-auto max-w-2xl px-4 pt-36 pb-16"><PlanView data={data} siteId={site.id} token={token} link={`${site.url}/plan/${token}`} siteName={site.name} /></div>;
}
