import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "@/app/globals.css";
import "./panel.css";
import { RegisterPanelServiceWorker } from "./register-panel-sw";

// Geist only for the panel: it reads as a work tool, apart from the sites' own brands.
const geist = Geist({ subsets: ["latin"], display: "swap", variable: "--font-geist" });

export const metadata: Metadata = {
  title: { default: "Betayomega", template: "%s | Betayomega" },
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Betayomega", statusBarStyle: "default" },
  icons: { apple: "/betayomega-icon-192.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f7f8f7" };

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return <div className={`panel ${geist.variable}`}>{children}<RegisterPanelServiceWorker /></div>;
}
