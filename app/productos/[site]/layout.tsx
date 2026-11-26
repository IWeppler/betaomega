import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Atkinson_Hyperlegible, Barlow_Condensed } from "next/font/google";
import { drawAdvice } from "@/modules/advice/server";
import { DailyAdvice } from "@/modules/advice/ui/public";
import { getSiteLinks, productIcon, productSite, siteDescription } from "./brand";
import { FooterActions, HeaderActions, NewsFooter, NewsNav } from "./site-actions";
// globals.css brings Tailwind for the new components. productos.css sits in its legacy layer: it beats Tailwind's base, utilities beat it.
import "@/app/globals.css";
import "./productos.css";

// Barlow Condensed lets long product names stay big in capitals; Atkinson Hyperlegible for reading.
const display = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700"], display: "swap", variable: "--font-product-display" });
const text = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--font-product-text" });

type Props = { params: Promise<{ site: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await productSite(params);
  if (!site) return {};
  const description = siteDescription(site);
  const image = { url: "/og", width: 1200, height: 630, alt: site.name };
  return {
    metadataBase: new URL(site.url),
    title: { default: site.name, template: `%s | ${site.name}` },
    description,
    alternates: { canonical: "/" },
    openGraph: { title: site.name, description, siteName: site.name, locale: "es_AR", type: "website", url: "/", images: [image] },
    twitter: { card: "summary_large_image", title: site.name, description, images: [image] },
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: site.name, statusBarStyle: "default" },
    icons: { icon: [{ url: productIcon(site, 64), type: "image/png" }], apple: productIcon(site, 180) },
  };
}
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f6f8f8" };

export default async function ProductSiteLayout({ children, params }: Props & { children: React.ReactNode }) {
  const site = await productSite(params);
  if (!site?.products) notFound();
  const [{ donation, youtube }, advice] = await Promise.all([getSiteLinks(site.id), drawAdvice(site.id)]);
  // The news home page has its own theme (white, warm neutrals, globals.css); the other product sites keep productos' pale grey.
  const news = site.products.landing === "news";
  return <div data-theme={news ? "voces" : "productos"} className={`productos ${display.variable} ${text.variable} ${news ? "bg-bg text-ink" : ""}`} style={{ "--p-accent": site.products.accent, "--color-accent": site.products.accent } as CSSProperties}>
    {news
      ? <NewsNav siteName={site.name} donation={donation} youtube={youtube}>{advice && <DailyAdvice siteId={site.id} drawn={advice} button={false} />}</NewsNav>
      : <HeaderActions donation={donation} youtube={youtube}>{advice && <DailyAdvice siteId={site.id} drawn={advice} />}</HeaderActions>}
    {children}
    {news
      ? <NewsFooter siteName={site.name} donation={donation} />
      : <footer className="p-foot"><FooterActions donation={donation} />© {new Date().getFullYear()} {site.name}.</footer>}
  </div>;
}
