import type { ReactNode } from "react";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { buttonClass } from "./controls";

// Shared brand, section captions, headings and calls to action for the public site.

/** Keep the supplied artwork whole, including its wordmark. */
export function BrandMark({ className = "size-10" }: { className?: string }) {
  return <Image src="/fropexio-logo.webp" width={1536} height={1024} alt="" className={`shrink-0 object-contain ${className}`} />;
}

export function Brand({ name, href, compact = false, src = "/fropexio-logo.webp" }: { name: string; href: string; compact?: boolean; src?: string }) {
  return <a href={href} aria-label={name} className="flex shrink-0 items-center no-underline">
    <Image src={src} width={1536} height={1024} alt={name} loading="eager" className={compact ? "h-16 w-24 object-contain" : "h-14 w-21 object-contain lg:h-16 lg:w-24"} />
  </a>;
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`block text-base text-muted ${className}`}>{children}</span>;
}

// Fluid sizes: these titles carry the page's look, and no fixed step of the type scale holds on both a phone and a wide screen.
const titleSizes = {
  section: "text-[clamp(1.875rem,3.2vw,3rem)]/[1.35]",
  panel: "text-[clamp(1.75rem,2.6vw,2.375rem)]/[1.35]",
  closing: "text-[clamp(2.25rem,4vw,3.25rem)]/[1.35]",
};

/** Keep a single text colour so the type itself carries the section's hierarchy. */
export function Title({ lines, accent, size = "section", className = "", dark = false }: { lines: string[]; accent: string; size?: keyof typeof titleSizes; className?: string; dark?: boolean }) {
  return <h2 className={`m-0 font-display font-normal tracking-tight ${dark ? "text-night-ink" : "text-ink"} ${titleSizes[size]} ${className}`}>
    {lines.map(line => <span key={line} className="block">{line}</span>)}
    <span className="block">{accent}</span>
  </h2>;
}

/** Where the booking lives, from the page that hosts the site: "/" gives "/reservar", the panel's preview gives its own "/…/reservar". */
export const reservePath = (home: string) => `${home === "/" ? "" : home.replace(/\/+$/, "")}/reservar`;

// The public site has one button family (`buttonClass`, size `lg`) in two grounds: light (bordó on cream) and night (cream on bordó); each has a filled and an outlined form.
const ctaKinds = {
  solid: "primary",
  outline: "quiet",
  light: "light",
  "outline-light": "quiet-light",
} as const;

/** The site's call to action: one size, the label and a small arrow that steps away on hover. */
export function CtaLink({ href, kind = "solid", external = false, arrow = true, className = "", children }: { href: string; kind?: keyof typeof ctaKinds; external?: boolean; arrow?: boolean; className?: string; children: ReactNode }) {
  return <a href={href} {...external ? { target: "_blank", rel: "noopener noreferrer" } : {}} className={`group/cta ${buttonClass(ctaKinds[kind], "lg")} ${className}`}>
    {children}
    {arrow && <ArrowUpRight size={18} strokeWidth={1.75} aria-hidden="true" className="transition-transform duration-300 ease-standard group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5" />}
  </a>;
}

/** A text link with no underline at rest: it draws in from the left on hover. */
export const textLinkClass = "inline-flex min-h-control items-center text-base font-medium no-underline [background:linear-gradient(currentColor,currentColor)_0_calc(100%-0.55rem)/0_1px_no-repeat] transition-[background-size] duration-300 ease-standard hover:[background-size:100%_1px]";
