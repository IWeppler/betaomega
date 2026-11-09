/* Worker of the admin panel. It makes the panel installable (every request goes to the network, nothing is cached) and shows the panel's
   notices (docs/tareas-notificaciones.md, point 3). The payload comes from platform/notifications: { title, body, url, tag }. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", event => event.respondWith(fetch(event.request)));

self.addEventListener("push", event => {
  let notice = { title: "BetaOmega", body: "Hay novedades en el panel.", url: "/", tag: "panel" };
  try { notice = { ...notice, ...event.data.json() }; } catch { /* a push without a readable payload still says something */ }
  event.waitUntil(self.registration.showNotification(notice.title, {
    body: notice.body,
    tag: notice.tag,
    // A notice with the tag of one already shown replaces it, and still rings.
    renotify: true,
    icon: "/betayomega-icon-192.png",
    badge: "/betayomega-icon-192.png",
    data: { url: notice.url },
  }));
});

// Opens the notice's page: in a panel window already open if there is one, in a new one otherwise. Only addresses of this panel.
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin);
  const url = target.origin === self.location.origin ? target.href : self.location.origin;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const open = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (open) {
      await open.focus();
      return open.navigate(url).catch(() => self.clients.openWindow(url));
    }
    return self.clients.openWindow(url);
  })());
});
