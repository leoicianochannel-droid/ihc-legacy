/**
 * Infinity Hoop Community service worker.
 *
 * Strategy:
 *  - Static assets (icons, fonts, _next/static) → cache-first.
 *  - Navigation requests (HTML pages) → network-first with offline fallback,
 *    so members always see the freshest content when online but get something
 *    useful when their connection drops mid-workout.
 *  - API and POST requests → never cached, always go to network. The platform
 *    is dynamic (auth, comments, likes) and we don't want stale state.
 *
 * Bumping CACHE_VERSION invalidates everything on next visit — change it
 * whenever you ship a meaningful navigation or asset update.
 */
const CACHE_VERSION = "ih-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGES_CACHE = `${CACHE_VERSION}-pages`;
const OFFLINE_URL = "/offline";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {})
  );
  // Activate the new SW immediately so users see updates on the next nav
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GETs
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Never cache API routes (auth, mutations, dynamic data)
  if (url.pathname.startsWith("/api/")) return;

  // Static assets — cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon-") ||
    url.pathname.startsWith("/apple-touch-icon") ||
    url.pathname.startsWith("/favicon") ||
    /\.(?:png|jpg|jpeg|webp|svg|woff2?|ttf|ico|css|js)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Navigation / page requests — network-first with offline fallback
  if (
    request.mode === "navigate" ||
    request.headers.get("accept")?.includes("text/html")
  ) {
    event.respondWith(networkFirst(request));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    return new Response("", { status: 504 });
  }
}

// ─── Push notifications ──────────────────────────────────────────
// Server sends a JSON body that matches the PushPayload type in lib/push.ts:
//   { title, body, url, tag, icon, badge }
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Infinity Hoop", body: event.data.text() };
  }
  const title = payload.title || "Infinity Hoop";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/icon-192.png",
    tag: payload.tag,                         // collapses duplicates per thread
    data: { url: payload.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Tapping a notification focuses an existing tab if we have one open at the
// destination, otherwise opens a fresh window. Avoids the "every tap opens
// a new tab" antipattern.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        try {
          const url = new URL(client.url);
          if (url.pathname === targetUrl || url.pathname.startsWith(targetUrl)) {
            client.focus();
            return;
          }
        } catch {}
      }
      // No matching tab — open a new one
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});

async function networkFirst(request) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response("Offline", {
      status: 503,
      headers: { "content-type": "text/plain" },
    });
  }
}
