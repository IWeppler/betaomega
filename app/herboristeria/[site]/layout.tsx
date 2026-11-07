import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "@/app/globals.css";
import "@/app/legacy.css";
import { RegisterServiceWorker } from "@/app/register-sw";
import { getSite } from "@/lib/site-registry";
import { ogImage } from "./og-image";

type Props = { params: Promise<{ site: string }> };
const herbSite = async (params: Props["params"]) => {
  const site = await getSite((await params).site);
  return site?.kind === "herboristeria" ? site : undefined;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await herbSite(params);
  if (!site) return {};
  const title = `${site.name} | Hierbas y preparados`;
  const description = "Encontrá hierbas y preparados de la casa. Consultá sus usos tradicionales, ingredientes y advertencias, y compartí la receta.";
  return {
    metadataBase: new URL(site.url),
    title,
    description,
    manifest: "/manifest.webmanifest",
    openGraph: { title, description, siteName: site.name, locale: "es_AR", type: "website", url: "/", images: [ogImage] },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
    robots: { index: false, follow: false },
    appleWebApp: { capable: true, title: site.name, statusBarStyle: "default" },
    // public/favicon.ico, named here so recipe sites do not inherit it.
    icons: { icon: "/favicon.ico", apple: "/pwa-icon?size=180" },
  };
}
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1c7a4d" };

export default async function HerbSiteLayout({ children, params }: Props & { children: React.ReactNode }) {
  if (!await herbSite(params)) notFound();
  return <>{children}<RegisterServiceWorker /></>;
}
