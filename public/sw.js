// Kill-switch version marker — bump on every release to guarantee byte-level change
// so browsers re-fetch this script, clear caches, unregister, and reload clients.
const KILLSWITCH_VERSION = "0.9.984";
// Kill-switch service worker.
// The app no longer uses a service worker, but devices that installed the old
// one are stuck serving a stale cached app shell (users see v0.9.972 forever).
// The browser re-fetches this script URL from the network on its update checks,
// so shipping this file replaces the zombie: it activates immediately, deletes
// every cache on the origin, unregisters itself, and reloads all open clients
// so they load fresh from the network. Keep this file deployed permanently.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch (e) {}
      try {
        await self.registration.unregister();
      } catch (e) {}
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => {
        try {
          client.navigate(client.url);
        } catch (e) {}
      });
    })()
  );
});

// No fetch handler: while briefly active, all requests go straight to network.
