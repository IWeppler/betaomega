import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { publicReservation } from "@/modules/sauna/server";
import { ReservationView } from "@/modules/sauna/ui/public";
import { getSite } from "@/platform/sites/server";

export const dynamic = "force-dynamic";

// The address is the secret: it must not reach another site through the Referer header, nor a search engine.
export const metadata: Metadata = { title: "Tu reserva", robots: { index: false, follow: false }, referrer: "no-referrer" };

type Props = { params: Promise<{ site: string; token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ReservationPage({ params, searchParams }: Props) {
  const { site: siteId, token } = await params;
  const site = await getSite(siteId);
  if (site?.kind !== "sauna") notFound();
  // Mercado Pago comes back with the payment's id: it is checked with Mercado Pago, never believed.
  const paymentId = (await searchParams).payment_id;
  const data = await publicReservation(site.id, token, typeof paymentId === "string" ? paymentId : undefined);
  if (!data) notFound();
  return <div className="mx-auto max-w-2xl px-4 pt-36 pb-16"><ReservationView data={data} siteId={site.id} token={token} link={`${site.url}/reserva/${token}`} siteName={site.name} /></div>;
}
