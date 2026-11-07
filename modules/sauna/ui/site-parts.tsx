import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

// The small pieces every part of the public site repeats: the brand, the tiny spaced labels, the two-tone titles and the arrow button.

/** Same mark as the original Fropexio site: a sauna's nested arches, with heat rising. */
export function BrandMark({ className = "size-10" }: { className?: string }) {
  return <svg viewBox="0 0 52 52" fill="none" aria-hidden="true" className={`shrink-0 ${className}`}>
    <path d="M9 43V24a17 17 0 0 1 34 0v19M15 43V24a11 11 0 0 1 22 0v19M21 43V24a5 5 0 0 1 10 0v19M5 43h42M26 1v5M3 15l5 2M44 17l5-2" stroke="currentColor" strokeWidth="1.1" />
  </svg>;
}

export function Brand({ name, href, compact = false }: { name: string; href: string; compact?: boolean }) {
  return <a href={href} className="flex items-center gap-3 text-inherit no-underline">
    <BrandMark className={compact ? "size-9" : "size-10 lg:size-12"} />
    <span className={`grid font-logo tracking-[0.15em] uppercase ${compact ? "text-xl" : "text-xl lg:text-2xl"}`}>
      {name}
      {/* 10px, like every small label here: the smallest size that still reads on a phone. */}
      <small className="mt-1 font-text text-[10px] tracking-[0.25em] whitespace-nowrap">Sauna &amp; bienestar</small>
    </span>
  </a>;
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`block text-[11px] tracking-[0.2em] text-muted uppercase ${className}`}>{children}</span>;
}

// Fluid sizes: these titles carry the page's look, and no fixed step of the type scale holds on both a phone and a wide screen.
const titleSizes = {
  section: "text-[clamp(1.875rem,3.2vw,3rem)]/[1.35]",
  panel: "text-[clamp(1.75rem,2.6vw,2.375rem)]/[1.35]",
  closing: "text-[clamp(2.25rem,4vw,3.25rem)]/[1.35]",
};

/** A section's title: the last line takes the accent. */
export function Title({ lines, accent, size = "section", className = "" }: { lines: string[]; accent: string; size?: keyof typeof titleSizes; className?: string }) {
  return <h2 className={`m-0 font-display font-normal tracking-tight text-ink ${titleSizes[size]} ${className}`}>
    {lines.map(line => <span key={line} className="block">{line}</span>)}
    <span className="block text-accent-text">{accent}</span>
  </h2>;
}

const ctaKinds = {
  solid: "bg-accent text-accent-ink hover:bg-accent-hover",
  outline: "border border-line-strong text-ink hover:bg-surface",
  /** Over a photo, where the theme's lines would disappear. */
  overlay: "border border-ink/50 text-ink hover:bg-ink/10",
};

/** The site's call to action: wide, with the arrow pushed to the far side. */
export function CtaLink({ href, kind = "solid", external = false, className = "", children }: { href: string; kind?: keyof typeof ctaKinds; external?: boolean; className?: string; children: ReactNode }) {
  return <a href={href} {...external ? { target: "_blank", rel: "noopener noreferrer" } : {}} className={`inline-flex min-h-control items-center justify-between gap-10 rounded-control px-5 py-4 text-sm no-underline transition-colors duration-150 ${ctaKinds[kind]} ${className}`}>
    {children}
    <ArrowUpRight size={18} strokeWidth={1.5} aria-hidden="true" />
  </a>;
}
