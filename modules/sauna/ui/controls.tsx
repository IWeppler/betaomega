import type { ButtonHTMLAttributes, ReactNode } from "react";

// The visual pieces of this module. They use tokens only, so they work on the panel's theme and on the public site's. Free of @/platform/panel: the public site loads this file.

// Pressing shrinks it a little, so it answers the finger at once; without motion when the person asks for less of it.
// Tailwind 4 moves with the `translate` and `scale` properties, not `transform`, so they are what the transition has to list.
const base = "inline-flex min-h-control items-center justify-center gap-2 rounded-control font-semibold no-underline transition-[background-color,border-color,color,translate,scale] ease-out not-disabled:active:scale-[0.97] motion-reduce:not-disabled:active:scale-100 disabled:opacity-55";
const variants = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover",
  quiet: "border border-line-strong bg-surface text-ink hover:bg-sunken",
  danger: "border border-danger bg-surface text-danger hover:bg-sunken",
  /** On a night ground: the light twin of `primary`. */
  light: "bg-night-ink text-night hover:bg-white",
  /** On a night ground: the light twin of `quiet`. */
  "quiet-light": "border border-night-ink/45 text-night-ink hover:border-night-ink hover:bg-night-ink/10",
};
// `md` is the panel's; `lg` is the public site's: roomier, and it steps up on hover (never in the panel).
const sizes = {
  md: "px-3.5 duration-150",
  lg: "px-7 py-3 text-base duration-300 ease-standard motion-safe:not-disabled:hover:-translate-y-0.5 motion-safe:not-disabled:active:translate-y-0",
};

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export const buttonClass = (variant: ButtonVariant = "quiet", size: ButtonSize = "md") => `${base} ${sizes[size]} ${variants[variant]}`;

export function Button({ variant = "quiet", size = "md", type = "button", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={`${buttonClass(variant, size)} ${className}`} {...props} />;
}

export const inputClass = "min-h-control w-full rounded-field border border-line-strong bg-surface px-3 text-ink disabled:opacity-55";

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return <label className={`grid content-start gap-1 ${className}`}>
    <span className="font-semibold text-ink">{label}</span>
    {children}
    {hint && <span className="text-sm text-muted">{hint}</span>}
  </label>;
}

/** Around the panel's SaveForm: its save bar sticks out 20px to each side, more than a phone leaves. Clipped on one axis only, so the bar still sticks to the bottom. */
export function FormArea({ children }: { children: ReactNode }) {
  return <div className="overflow-x-clip">{children}</div>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-card border border-line bg-surface p-4 ${className}`}>{children}</section>;
}

export function Notice({ kind = "warn", children }: { kind?: "warn" | "error"; children: ReactNode }) {
  return kind === "error"
    ? <p role="alert" className="rounded-field border border-danger bg-surface px-3 py-2 text-danger">{children}</p>
    : <p className="rounded-field border border-warn-line bg-warn-bg px-3 py-2 text-warn-ink">{children}</p>;
}

export type TagTone = "plain" | "accent" | "success" | "warn" | "danger" | "faded" | "outline";

/**
 * A short label next to an item: a pill of one height for every tone, with an optional icon first, so a column of them lines up. The tones follow
 * the panel's rule: green confirmed, blue paid, amber waiting, red fell through, gray over.
 */
export function Tag({ children, tone = "plain" }: { children: ReactNode; tone?: TagTone }) {
  const tones: Record<TagTone, string> = {
    plain: "border-line bg-sunken text-muted",
    accent: "border-transparent bg-accent-soft text-accent-text",
    success: "border-success/25 bg-success-soft text-success",
    warn: "border-warn-line/50 bg-warn-bg text-warn-ink",
    danger: "border-danger/30 bg-danger/10 text-danger",
    // What simply lapsed: nobody did anything, so it looks the faintest.
    faded: "border-dashed border-line-strong bg-transparent text-muted",
    // What a thing is, not how it is going (a plan, a code): no color of a state.
    outline: "border-line-strong bg-surface text-ink",
  };
  return <span className={`inline-flex h-6 items-center gap-1 rounded-full border px-2.5 text-[13px] leading-none font-semibold whitespace-nowrap [&>svg]:shrink-0 ${tones[tone]}`}>{children}</span>;
}
