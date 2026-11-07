import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { listPanelSites } from "@/lib/site-registry";
import { findIn, type Site } from "@/lib/sites";
import { LoginForm } from "../login-form";
import { panelKinds } from "./kinds";
import { PanelShell } from "./shell";

export const dynamic = "force-dynamic";

export default async function SitePanelLayout({ children, params }: { children: React.ReactNode; params: Promise<{ site: string }> }) {
  const sites = await listPanelSites();
  const site = findIn(sites, (await params).site);
  if (!site) notFound();
  // The APIs check the session again on every read and write; this only decides what to render.
  if (!await isAdmin()) return <LoginForm />;
  const summary = ({ id, name, kind, url, panelIcon, products, inactive }: Site) => ({ id, name, kind, url, panelIcon, products, inactive });
  const shell = <PanelShell site={summary(site)} sites={sites.map(summary)}>{children}</PanelShell>;
  // Each kind of site loads its own data; the shell and the list tools read it through PanelContext.
  return panelKinds[site.kind].provider(site, shell);
}
