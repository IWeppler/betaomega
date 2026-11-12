import type { Metadata } from "next";
import { SiteBookingPage } from "@/modules/sauna/ui/public";
import { cachedHome } from "../public-data";

export const metadata: Metadata = { title: "Reservar" };

// The shell comes from the cached home data; the turns are asked for by the browser, so reading the address here does not make the data stale.
export default async function BookingRoute({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ hierba?: string | string[]; plan?: string | string[] }> }) {
  const [{ site }, { hierba, plan }] = await Promise.all([params, searchParams]);
  const data = await cachedHome(site);
  if (!data) return <p className="mx-auto max-w-2xl px-4 py-14 pt-36 text-muted">Las reservas todavía no están disponibles.</p>;
  return <SiteBookingPage data={data} homeHref="/" initialHerbId={typeof hierba === "string" ? hierba : ""} initialPlanId={typeof plan === "string" ? plan : ""} />;
}
