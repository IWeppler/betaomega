import { CalendarDays, ClipboardList, Clock, Settings } from "lucide-react";
import type { PanelKind } from "@/platform/panel";
import { SaunaProvider } from "./ui/sauna-provider";

// Only a type comes from @/platform/panel here. A value would be part of the load cycle described in platform/README.md.
// A section enters the menu in the phase that builds its page: packs (S4b), codigos (S4), politicas (S5) and pagos (S3) are still to come.
// The section names are unique across the whole panel (docs/ARCHITECTURE.md §4.1).
export const saunaPanel: PanelKind = {
  sections: [
    { path: "agenda", label: "Agenda", icon: CalendarDays, permission: "sauna.agenda" },
    { path: "reservas", label: "Reservas", icon: ClipboardList, permission: "sauna.reservas" },
    { path: "horarios-precios", label: "Horarios y precios", icon: Clock, permission: "sauna.horarios-precios" },
    { path: "ajustes", label: "Sitio", icon: Settings, permission: "sauna.ajustes" },
  ],
  provider: (_site, children) => <SaunaProvider>{children}</SaunaProvider>,
};
