import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Atkinson_Hyperlegible, Instrument_Sans } from "next/font/google";
import { brand, getSettings, ogImage, recipeIcon, recipeSite } from "./brand";
import { Splash } from "./splash";
import "./recetas.css";

// Instrument Sans (medium weight, light and clean) for titles, Atkinson Hyperlegible for reading.
const display = Instrument_Sans({ subsets: ["latin"], weight: ["500", "600"], display: "swap", variable: "--font-recipe-display" });
const text = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--font-recipe-text" });

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
    manifest: "/manifest.webmanifest",
    icons: { icon: [{ url: recipeIcon(64), type: "image/png" }], apple: recipeIcon(180) },
  };
}
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: brand.background };

export default async function RecipeSiteLayout({ children, params }: Props & { children: React.ReactNode }) {
  if (!await recipeSite(params)) notFound();
  return <div data-theme="recetas" className={`recetas ${display.variable} ${text.variable}`} suppressHydrationWarning><Splash logo={brand.logo} />{children}</div>;
}
