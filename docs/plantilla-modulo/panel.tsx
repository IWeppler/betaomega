import { Box } from "lucide-react";
import type { PanelKind } from "@/platform/panel";

// Only a type comes from @/platform/panel here. A value would be part of the load cycle described in platform/README.md.
export const thingPanel: PanelKind = {
  sections: [{ path: "cosas", label: "Cosas", icon: Box, permission: "things.read" }],
  provider: (_site, children) => children,
};
