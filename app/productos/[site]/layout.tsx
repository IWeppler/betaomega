import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Atkinson_Hyperlegible, Barlow_Condensed } from "next/font/google";
import { getDonation, productSite, siteDescription } from "./brand";
import { FooterActions, HeaderDonate } from "./site-actions";
import "./productos.css";

// Barlow Condensed lets long product names stay big in capitals; Atkinson Hyperlegible for reading.
const display = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700"], display: "swap", variable: "--font-product-display" });
const text = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--font-product-text" });

type Props = { params: Promise<{ site: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await productSite(params);
  if (!site) return {};
  const description = siteDescription(site.name);
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
    icons: { icon: [{ url: "/icon", type: "image/png" }], apple: "/icon?size=180" },
  };
}
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f6f8f8" };

export default async function ProductSiteLayout({ children, params }: Props & { children: React.ReactNode }) {
  const site = await productSite(params);
  if (!site?.products) notFound();
  const donation = await getDonation(site.id);
  return <div className={`productos ${display.variable} ${text.variable}`} style={{ "--p-accent": site.products.accent } as CSSProperties}>
    <HeaderDonate donation={donation} />
    {children}
    <footer className="p-foot"><FooterActions donation={donation} />© {new Date().getFullYear()} {site.name}.</footer>
  </div>;
}
