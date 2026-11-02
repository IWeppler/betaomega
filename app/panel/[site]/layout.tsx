import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { findSite, sites } from "@/lib/sites";
import { LoginForm } from "../login-form";
import { CatalogProvider } from "./catalog-context";
import { RecipesProvider } from "./recipes-context";
import { PanelShell } from "./shell";

export const dynamic = "force-dynamic";

export default async function SitePanelLayout({ children, params }: { children: React.ReactNode; params: Promise<{ site: string }> }) {
  const site = findSite((await params).site);
  if (!site) notFound();
  // The APIs check the session again on every read and write; this only decides what to render.
  if (!await isAdmin()) return <LoginForm />;
  const summary = ({ id, name, kind, url }: typeof site) => ({ id, name, kind, url });
  const shell = <PanelShell site={summary(site)} sites={sites.map(summary)}>{children}</PanelShell>;
  // Each kind of site loads its own data; the shell and the list tools read it through PanelContext.
  return site.kind === "recetas" ? <RecipesProvider siteId={site.id}>{shell}</RecipesProvider> : <CatalogProvider>{shell}</CatalogProvider>;
}
