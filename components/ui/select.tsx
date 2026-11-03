"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { CaretDown, Check } from "@phosphor-icons/react";

// shadcn/ui's Select (Radix primitives), with the recipe site's own CSS classes (`.r-sel-*` in recetas.css)
// instead of Tailwind utilities: the recipe pages do not load Tailwind's reset.
const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");

const Select = SelectPrimitive.Root;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<React.ElementRef<typeof SelectPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>>(
  ({ className, children, ...props }, ref) => (
    <SelectPrimitive.Trigger ref={ref} className={cx("r-sel-trigger", className)} {...props}>
      {children}
      <SelectPrimitive.Icon asChild><CaretDown size={14} weight="bold" aria-hidden="true" /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  ),
);
SelectTrigger.displayName = "SelectTrigger";

const SelectContent = React.forwardRef<React.ElementRef<typeof SelectPrimitive.Content>, React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>>(
  ({ className, children, position = "popper", ...props }, ref) => (
    // The popup is portaled: inside .recetas so it keeps the site's colors, fonts and variables.
    <SelectPrimitive.Portal container={typeof document === "undefined" ? undefined : document.querySelector<HTMLElement>(".recetas")}>
      <SelectPrimitive.Content ref={ref} position={position} sideOffset={6} className={cx("r-sel-content", className)} {...props}>
        <SelectPrimitive.Viewport className="r-sel-viewport">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  ),
);
SelectContent.displayName = "SelectContent";

const SelectItem = React.forwardRef<React.ElementRef<typeof SelectPrimitive.Item>, React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>>(
  ({ className, children, ...props }, ref) => (
    <SelectPrimitive.Item ref={ref} className={cx("r-sel-item", className)} {...props}>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="r-sel-check"><Check size={14} weight="bold" aria-hidden="true" /></SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  ),
);
SelectItem.displayName = "SelectItem";

export { Select, SelectValue, SelectTrigger, SelectContent, SelectItem };
