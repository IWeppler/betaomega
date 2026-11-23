import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { saunaIcon, SITE_IMAGE } from "@/modules/sauna/server";
import { SiteFrame } from "@/modules/sauna/ui/public";
import { cachedPage, cachedSite } from "./public-data";
import "@/app/globals.css";

type Props = { params: Promise<{ site: string }> };

const saunaSite = async (params: Props["params"]) => {
  // Cached: the home page below is ISR, and a no-store read here would make every page of the site dynamic again.
  const site = await cachedSite((await params).site);
  return site?.kind === "sauna" ? site : undefined;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await saunaSite(params);
  if (!site) return {};
  const { description } = await cachedPage(site.id);
  const image = { ...SITE_IMAGE, type: "image/jpeg", alt: site.name };
  return {
    metadataBase: new URL(site.url),
    title: { default: site.name, template: `%s | ${site.name}` },
    description,
    alternates: { canonical: "/" },
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: site.name, statusBarStyle: "black-translucent" },
    icons: { icon: [{ url: saunaIcon(32), sizes: "32x32", type: "image/png" }, { url: saunaIcon(192), sizes: "192x192", type: "image/png" }], apple: saunaIcon(180) },
    openGraph: { title: site.name, description, siteName: site.name, locale: "es_AR", type: "website", url: "/", images: [image] },
    twitter: { card: "summary_large_image", title: site.name, description, images: [image] },
  };
}
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#12110c" };

export default async function SaunaLayout({ children, params }: Props & { children: React.ReactNode }) {
  const site = await saunaSite(params);
  if (!site) notFound();
  const { address } = await cachedPage(site.id);
  return <SiteFrame siteName={site.name} home="/" termsHref="/terminos" address={address}>{children}</SiteFrame>;
}
