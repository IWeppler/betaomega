import type { ButtonHTMLAttributes, ReactNode } from "react";

// The visual pieces of this module. They use tokens only, so they work on the panel's theme and on the public site's. Free of @/platform/panel: the public site loads this file.

const base = "inline-flex min-h-control items-center justify-center gap-1.5 rounded-control px-3.5 font-semibold no-underline transition-colors duration-150 disabled:opacity-55";
const variants = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover",
  quiet: "border border-line-strong bg-surface text-ink hover:bg-sunken",
  danger: "border border-danger bg-surface text-danger hover:bg-sunken",
};

export type ButtonVariant = keyof typeof variants;

export const buttonClass = (variant: ButtonVariant = "quiet") => `${base} ${variants[variant]}`;

export function Button({ variant = "quiet", type = "button", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button type={type} className={`${buttonClass(variant)} ${className}`} {...props} />;
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

/** A short state label next to an item. */
export function Tag({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "accent" | "warn" }) {
  const tones = { plain: "bg-sunken text-muted", accent: "bg-accent-soft text-accent-text", warn: "bg-warn-bg text-warn-ink" };
  return <span className={`inline-flex items-center rounded-control px-2 py-0.5 text-sm font-semibold ${tones[tone]}`}>{children}</span>;
}
