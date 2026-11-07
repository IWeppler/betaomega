import { Poppins, Atkinson_Hyperlegible } from "next/font/google";

// Shared by every site. Metadata, styles and the service worker belong to each site's own layout.
/* Poppins: friendly geometric sans, for titles. Atkinson Hyperlegible: designed for legibility, for everything else.
   They sit on <html> because globals.css resolves its font tokens on :root. Move them per site when a site needs other fonts. */
const display = Poppins({ subsets: ["latin"], weight: ["600", "700"], display: "swap", variable: "--font-poppins" });
const body = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--font-atkinson" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es" className={`${display.variable} ${body.variable}`}><body>{children}</body></html>;
}
