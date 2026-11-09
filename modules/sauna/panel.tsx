import { CalendarDays, ClipboardList, Clock, Layers, Settings, TicketPercent } from "lucide-react";
import type { PanelKind } from "@/platform/panel";
import { SaunaProvider } from "./ui/sauna-provider";

// Only a type comes from @/platform/panel here. A value would be part of the load cycle described in platform/README.md.
// A section enters the menu in the phase that builds its page: politicas (S5) and pagos are still to come. Planes replaced the packs of S4b.
// The section names are unique across the whole panel (docs/ARCHITECTURE.md §4.1).
export const saunaPanel: PanelKind = {
  sections: [
    { path: "agenda", label: "Agenda", icon: CalendarDays, permission: "sauna.agenda" },
    { path: "reservas", label: "Reservas", icon: ClipboardList, permission: "sauna.reservas" },
    { path: "horarios-precios", label: "Horarios y precios", icon: Clock, permission: "sauna.horarios-precios" },
    { path: "planes", label: "Planes", icon: Layers, permission: "sauna.planes" },
    { path: "codigos", label: "Códigos", icon: TicketPercent, permission: "sauna.codigos" },
    { path: "ajustes", label: "Configuración", icon: Settings, permission: "sauna.ajustes" },
  ],
  provider: (_site, children) => <SaunaProvider>{children}</SaunaProvider>,
};
