"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronsUpDown } from "lucide-react";
import type { ComponentProps } from "react";
import { themeRoot } from "./theme-root";

/** shadcn/ui's Select (Radix primitives), with this project's tokens instead of shadcn's. */
export const Select = SelectPrimitive.Root;

export function SelectTrigger({ className = "", placeholder, ...props }: ComponentProps<typeof SelectPrimitive.Trigger> & { placeholder?: string }) {
  return <SelectPrimitive.Trigger className={`inline-flex min-h-control w-full items-center justify-between gap-2 rounded-field border border-line-strong bg-surface px-3 text-ink disabled:opacity-55 ${className}`} {...props}>
    <SelectPrimitive.Value placeholder={placeholder} />
    <SelectPrimitive.Icon asChild><ChevronsUpDown size={15} className="shrink-0 text-muted" aria-hidden="true" /></SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>;
}

export function SelectContent({ children, ...props }: ComponentProps<typeof SelectPrimitive.Content>) {
  return <SelectPrimitive.Portal container={themeRoot()}>
    <SelectPrimitive.Content position="popper" sideOffset={4} className="z-50 max-h-72 min-w-(--radix-select-trigger-width) overflow-hidden rounded-field border border-line bg-surface text-ink shadow-lift" {...props}>
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>;
}

export function SelectItem({ children, ...props }: ComponentProps<typeof SelectPrimitive.Item>) {
  return <SelectPrimitive.Item className="flex min-h-control cursor-pointer items-center justify-between gap-3 rounded-control px-2.5 outline-none select-none data-highlighted:bg-accent-soft" {...props}>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator><Check size={15} className="text-accent-text" aria-hidden="true" /></SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>;
}
