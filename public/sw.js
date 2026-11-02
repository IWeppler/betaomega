/* Offline support: the app shell and the public catalog are cached so the screen keeps working without wifi. */
const VERSION = "v23";
const SHELL = `nekurel-shell-${VERSION}`;
const DATA = `nekurel-data-${VERSION}`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (![SHELL, DATA].includes(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

const networkFirst = async (request, cacheName, allow = () => true) => {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok && allow(response)) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
};
const staleWhileRevalidate = async (request) => {
  const cache = await caches.open(SHELL);
  const cached = await cache.match(request);
  const fresh = fetch(request).then(response => { if (response.ok) cache.put(request, response.clone()); return response; }).catch(() => cached);
  return cached || fresh;
};

self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname === "/api/catalog") {
    /* Only the staff version is cached, never the administrator one (it includes drafts). */
    event.respondWith(networkFirst(request, DATA, response => response.headers.get("X-Catalog-Scope") === "public"));
  } else if (url.pathname.startsWith("/api/images/")) {
    event.respondWith(networkFirst(request, DATA));
  } else if (url.pathname.startsWith("/api/")) {
    return;
  } else if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL));
  } else if (url.pathname.startsWith("/_next/static/") || url.pathname === "/pwa-icon" || url.pathname === "/botanical-categories.png" || url.pathname === "/mate-ilustracion.png" || url.pathname === "/tonicos-ilustracion.png" || url.pathname === "/hierbas-ilustracion.png" || url.pathname === "/ingreso-botanico.png" || url.pathname === "/nekurel-logo.png") {
    event.respondWith(staleWhileRevalidate(request));
  }
});







