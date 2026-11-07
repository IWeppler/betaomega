// Facade over the legacy panel pieces a module screen needs. PanelShell stays out: the panel layout mounts it, not the modules.
//
// PageHeader lives in shell.tsx, which imports kinds.tsx, which imports each module's panel.tsx. That closes a cycle at runtime once a module
// is registered, so a module's panel.tsx must not use anything from this file while it loads: only inside its functions.
export { SaveForm } from "@/app/save-form";
export { PageHeader } from "@/app/panel/[site]/shell";
export { PanelContext, usePanel, useSite } from "@/app/panel/[site]/panel-context";
export type { PanelState } from "@/app/panel/[site]/panel-context";
export type { SiteSummary } from "@/app/panel/[site]/site-switcher";
export type { PanelKind, PanelSection } from "@/app/panel/[site]/kinds";
export { EmptyState, PAGE_SIZE, Paged, QuickActions, SearchBox, useNewFromLink, useSelection } from "@/app/panel/[site]/list-tools";
export type { QuickAction, Selection } from "@/app/panel/[site]/list-tools";
