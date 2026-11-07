"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import type { ComponentProps } from "react";

/** shadcn/ui's Switch (Radix primitives), with this project's tokens instead of shadcn's. */
export function Switch({ className = "", ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return <SwitchPrimitive.Root className={`inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-150 disabled:opacity-55 data-[state=checked]:bg-accent data-[state=unchecked]:bg-line-strong ${className}`} {...props}>
    <SwitchPrimitive.Thumb className="block size-5 translate-x-0.5 rounded-full bg-surface shadow-card transition-transform duration-150 data-[state=checked]:translate-x-[18px]" />
  </SwitchPrimitive.Root>;
}
