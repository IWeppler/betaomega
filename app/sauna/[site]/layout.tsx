import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { publicPage, SITE_IMAGE } from "@/modules/sauna/server";
import { SiteFrame } from "@/modules/sauna/ui/public";
import { getSite } from "@/platform/sites/server";
import "@/app/globals.css";

type Props = { params: Promise<{ site: string }> };

const saunaSite = async (params: Props["params"]) => {
  const site = await getSite((await params).site);
  return site?.kind === "sauna" ? site : undefined;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await saunaSite(params);
  if (!site) return {};
  const { description } = await publicPage(site.id);
  const image = { url: SITE_IMAGE, width: 1200, height: 630, alt: site.name };
  return {
    metadataBase: new URL(site.url),
    title: { default: site.name, template: `%s | ${site.name}` },
    description,
    alternates: { canonical: "/" },
    openGraph: { title: site.name, description, siteName: site.name, locale: "es_AR", type: "website", url: "/", images: [image] },
    twitter: { card: "summary_large_image", title: site.name, description, images: [image] },
  };
}
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#12110c" };

export default async function SaunaLayout({ children, params }: Props & { children: React.ReactNode }) {
  const site = await saunaSite(params);
  if (!site) notFound();
  return <SiteFrame siteName={site.name} home="/" termsHref="/terminos">{children}</SiteFrame>;
}
