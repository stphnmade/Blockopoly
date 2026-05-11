const CACHE_NAME = "blockopoly-assets-v1";
const RUNTIME_ASSET_PATTERNS = [
  "/assets/",
  "/sfx/",
  "/favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const shouldCache = RUNTIME_ASSET_PATTERNS.some((pattern) =>
    url.pathname.startsWith(pattern)
  );
  if (!shouldCache) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
  );
});
