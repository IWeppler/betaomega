import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { publicReservation } from "@/modules/sauna/server";
import { ReservationView } from "@/modules/sauna/ui/public";
import { getSite } from "@/platform/sites/server";

export const dynamic = "force-dynamic";

// The address is the secret: it must not reach another site through the Referer header, nor a search engine.
export const metadata: Metadata = { title: "Tu reserva", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function ReservationPage({ params }: { params: Promise<{ site: string; token: string }> }) {
  const { site: siteId, token } = await params;
  const site = await getSite(siteId);
  if (site?.kind !== "sauna") notFound();
  const data = await publicReservation(site.id, token);
  if (!data) notFound();
  return <div className="mx-auto max-w-2xl px-4 pt-36 pb-16"><ReservationView data={data} link={`${site.url}/reserva/${token}`} siteName={site.name} /></div>;
}
