"use client";

import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";

/**
 * Editor panel that slides in from the right over the list (shadcn's Sheet, on Radix Dialog). Nothing renders while `children` is empty.
 * Radix gives the focus trap, the inert page behind it and Escape; closing is left to `onClose`,
 * so the page can still ask the open form first (save, discard or stay).
 * It is portaled inside .panel, where the colour tokens are defined.
 */
export function SideSheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return <Dialog.Root open={Boolean(children)} onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal container={typeof document === "undefined" ? undefined : document.querySelector<HTMLElement>(".panel")}>
      <Dialog.Overlay className="panel-sheet-overlay" />
      <Dialog.Content className="panel-sheet" aria-labelledby="panel-editor-title" aria-describedby={undefined}>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
