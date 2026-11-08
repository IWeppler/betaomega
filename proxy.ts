import { NextResponse, type NextRequest } from "next/server";
import { getSiteForHost } from "@/lib/site-registry";
import { isPanelHost, defaultPanelHosts } from "@/lib/sites";

// Each host gets its own site: nekurel.com/menta is served from /herboristeria/nekurel/menta,
// and the panel host from /panel/... Every path is prefixed, so no internal tree can be reached from another host.
// The host -> site lookup reads the `sites` registry (cached for a few seconds, with the code's list as fallback).
export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const { pathname, search } = request.nextUrl;
  if (isPanelHost(host, process.env.PANEL_HOSTS || defaultPanelHosts)) {
    return NextResponse.rewrite(new URL(`/panel${pathname === "/" ? "" : pathname}${search}`, request.url));
  }
  const site = await getSiteForHost(host, process.env.DEFAULT_SITE || undefined);
  if (!site) return new NextResponse("Sitio no encontrado", { status: 404 });
  // Preserve signed draft links while keeping their dynamic render out of public ISR.
  if (site.kind === "recetas" && request.nextUrl.searchParams.has("vista") && /^\/[^/]+\/?$/.test(pathname)) {
    return NextResponse.rewrite(new URL(`/recetas/${site.id}/vista-previa${pathname}${search}`, request.url));
  }
  // The store used to live under /catalogo; shared links keep working.
  if (site.kind === "herboristeria" && (pathname === "/catalogo" || pathname.startsWith("/catalogo/"))) {
    return NextResponse.redirect(new URL(`${pathname.slice("/catalogo".length) || "/"}${search}`, request.url), 308);
  }
  return NextResponse.rewrite(new URL(`/${site.kind}/${site.id}${pathname === "/" ? "" : pathname}${search}`, request.url));
}

export const config = {
  // APIs, Next's assets and files in public/ are shared by every site and are not rewritten.
  matcher: ["/((?!api/|_next/|favicon\.ico$|sw\.js$|panel-sw\.js$|.*\.(?:png|jpe?g|webp|svg|gif|ico)$).*)"],
};
