import type { ButtonHTMLAttributes, ReactNode } from "react";

// The visual pieces of the advice screens, with tokens only. Same shapes as the sauna's (modules may not share code), kept to what is used here.

const base = "inline-flex min-h-control items-center justify-center gap-2 rounded-control px-3.5 font-semibold transition-[background-color,border-color,color,scale] duration-150 ease-out not-disabled:active:scale-[0.97] motion-reduce:not-disabled:active:scale-100 disabled:opacity-55";
const variants = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover",
  quiet: "border border-line-strong bg-surface text-ink hover:bg-sunken",
  danger: "border border-danger bg-surface text-danger hover:bg-sunken",
};

export function Button({ variant = "quiet", type = "button", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return <button type={type} className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export const textareaClass = "w-full rounded-field border border-line-strong bg-surface px-3 py-2 text-ink disabled:opacity-55";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-card border border-line bg-surface p-4 ${className}`}>{children}</section>;
}

export function Notice({ children }: { children: ReactNode }) {
  return <p role="alert" className="m-0 rounded-field border border-danger bg-surface px-3 py-2 text-danger">{children}</p>;
}
