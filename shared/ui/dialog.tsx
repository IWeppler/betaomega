"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { themeRoot } from "./theme-root";

/** shadcn/ui's Dialog (Radix primitives), with this project's tokens instead of shadcn's. */
export function Dialog({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: ReactNode }) {
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal container={themeRoot()}>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/32" />
      <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 grid max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-3 overflow-y-auto rounded-card border border-line bg-bg p-5 text-ink shadow-lift" {...(description ? {} : { "aria-describedby": undefined })}>
        <DialogPrimitive.Title className="m-0 pr-8 text-lg font-semibold">{title}</DialogPrimitive.Title>
        {description && <DialogPrimitive.Description className="m-0 text-muted">{description}</DialogPrimitive.Description>}
        {children}
        <DialogPrimitive.Close aria-label="Cerrar" className="absolute top-4 right-4 inline-grid size-control place-items-center rounded-control text-muted hover:bg-sunken hover:text-ink"><X size={18} aria-hidden="true" /></DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}
