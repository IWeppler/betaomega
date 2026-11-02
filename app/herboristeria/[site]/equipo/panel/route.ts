import { defaultPanelHosts, findSite } from "@/lib/sites";

export const dynamic = "force-dynamic";

// "Administrador" in /equipo: administration lives in the central panel, on its own host (PANEL_HOSTS).
// Locally (*.localhost) it goes to panel.localhost on the same port; otherwise to the first real panel host over https.
export async function GET(request: Request, context: { params: Promise<{ site: string }> }) {
  const site = findSite((await context.params).site);
  if (!site) return new Response("No encontrado", { status: 404 });
  const hosts = (process.env.PANEL_HOSTS || defaultPanelHosts).split(",").map(h => h.trim()).filter(Boolean);
  const host = request.headers.get("host") ?? "";
  const local = /(^|\.)localhost(:\d+)?$/i.test(host);
  const panel = hosts.find(h => /(^|\.)localhost$/i.test(h) === local) ?? hosts[0];
  const port = local ? host.match(/:\d+$/)?.[0] ?? "" : "";
  return Response.redirect(`${local ? "http" : "https"}://${panel}${port}/${site.id}`, 307);
}
