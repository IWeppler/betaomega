import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Fraunces, Nunito_Sans } from "next/font/google";
import { brand, getSettings, ogImage, recipeSite } from "./brand";
import "./recetas.css";

// Fraunces (a warm serif) for titles and Nunito Sans for reading: a cookbook, apart from Ñekurel and the panel.
const display = Fraunces({ subsets: ["latin"], display: "swap", style: ["normal", "italic"], variable: "--font-recipe-display" });
const text = Nunito_Sans({ subsets: ["latin"], display: "swap", variable: "--font-recipe-text" });

type Props = { params: Promise<{ site: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await recipeSite(params);
  if (!site) return {};
  const settings = await getSettings(site.id);
  const title = `${site.name} | ${settings.tagline}`;
  const image = ogImage(site.name, settings.tagline);
  return {
    metadataBase: new URL(site.url),
    title: { default: title, template: `%s | ${site.name}` },
    description: settings.description,
    alternates: { canonical: "/" },
    openGraph: { title, description: settings.description, siteName: site.name, locale: "es_AR", type: "website", url: "/", images: [image] },
    twitter: { card: "summary_large_image", title, description: settings.description, images: [image] },
    icons: { icon: [{ url: "/icon", type: "image/png" }], apple: "/icon?size=180" },
  };
}
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: brand.background };

export default async function RecipeSiteLayout({ children, params }: Props & { children: React.ReactNode }) {
  if (!await recipeSite(params)) notFound();
  return <div className={`recetas ${display.variable} ${text.variable}`}>{children}</div>;
}
