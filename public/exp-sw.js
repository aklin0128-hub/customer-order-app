/* Minimal service worker for EXP offline shell caching. */
const CACHE = "exp-shell-v1";
const PRECACHE = ["/exp", "/exp-manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache authenticated API payloads here — EXP data lives in IndexedDB.
  if (url.pathname.startsWith("/api/")) return;

  const isExpPage = url.pathname === "/exp" || url.pathname.startsWith("/exp/");
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".webmanifest") ||
    url.pathname === "/exp-sw.js";

  if (!isExpPage && !isStatic) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const network = await fetch(req);
        if (network.ok) {
          cache.put(req, network.clone());
        }
        return network;
      } catch {
        const cached = await cache.match(req);
        if (cached) return cached;
        if (isExpPage) {
          const fallback = await cache.match("/exp");
          if (fallback) return fallback;
        }
        throw new Error("Offline and not cached");
      }
    })()
  );
});
