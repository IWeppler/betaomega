import { SiteHome } from "@/modules/sauna/ui/public";
import { cachedHome } from "./public-data";

// ISR: rendered on the first visit and kept for an hour, or until the panel changes something it shows. See public-data.ts.
export function generateStaticParams() { return []; }
// Same as publicRevalidate (platform/sites/public-cache.ts); segment config must be a literal.
export const revalidate = 3600;

export default async function SaunaHome({ params }: { params: Promise<{ site: string }> }) {
  const data = await cachedHome((await params).site);
  if (!data) return <p className="mx-auto max-w-2xl px-4 py-14 text-muted">Las reservas todavía no están disponibles.</p>;
  return <SiteHome data={data} />;
}
