const CACHE_VERSION = "tgi-manager-shell-v1";
const PRECACHE_URLS = [
  "/offline.html",
  "/icons/icon.svg",
  "/logo.png.jpeg",
];
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;
const CACHE_PREFIX = "tgi-manager-";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isNeverCache(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match("/offline.html");
        return offline || Response.error();
      }),
    );
    return;
  }

  if (url.pathname.startsWith("/assets/") || request.destination === "font") {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (
    request.destination === "image" &&
    (url.pathname.startsWith("/icons/") ||
      url.pathname.startsWith("/images/") ||
      url.pathname === "/logo.png.jpeg")
  ) {
    event.respondWith(staleWhileRevalidate(event, request, IMAGE_CACHE));
  }
});

function isNeverCache(url) {
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();
  return (
    path.startsWith("/api/") ||
    path === "/api" ||
    host.includes("googleapis.com") ||
    host.includes("firebaseapp.com") ||
    host.includes("identitytoolkit") ||
    host.includes("securetoken") ||
    host.includes("firestore.googleapis.com") ||
    host.includes("firebaseio.com") ||
    host.includes("firebaseinstallations")
  );
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isCacheableStatic(response)) await cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(event, request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const refresh = fetch(request).then(async (response) => {
    if (isCacheableStatic(response)) await cache.put(request, response.clone());
    return response;
  });
  if (cached) {
    event.waitUntil(refresh.catch(() => undefined));
    return cached;
  }
  return refresh;
}

function isCacheableStatic(response) {
  return response.status === 200 && response.type === "basic";
}
