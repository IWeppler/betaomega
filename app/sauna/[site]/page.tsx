import { publicHome } from "@/modules/sauna/server";
import { SiteHome } from "@/modules/sauna/ui/public";

export const dynamic = "force-dynamic";

export default async function SaunaHome({ params }: { params: Promise<{ site: string }> }) {
  const data = await publicHome((await params).site);
  if (!data) return <p className="mx-auto max-w-2xl px-4 py-14 text-muted">Las reservas todavía no están disponibles.</p>;
  return <SiteHome data={data} />;
}
