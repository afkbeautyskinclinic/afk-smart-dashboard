const CACHE_PREFIX = "afk-dashboard-";
const CACHE_NAME = "afk-dashboard-v1.5.36-private-data-cache-fix";
const APP_SHELL = [
  "./manifest.webmanifest?v=1.5.35-security-cutover",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];
const STATIC_URLS = new Set(APP_SHELL.map(path => new URL(path, self.registration.scope).href));

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  // Never intercept Workspace/API/media requests or cache authenticated data.
  if (url.origin !== self.location.origin) return;
  const acceptsHtml = event.request.mode === "navigate" ||
    (event.request.headers.get("accept") || "").includes("text/html");
  if (acceptsHtml) {
    event.respondWith(
      fetch(new Request(event.request, { cache: "no-store" }))
        .catch(() => new Response("AFK Growth Intelligence Dashboard sedang offline. Hubungkan internet lalu refresh halaman.", {
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        }))
    );
    return;
  }

  // An exact allowlist excludes query strings containing session credentials.
  if (!STATIC_URLS.has(url.href)) return;
  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok && response.type === "basic" && !response.redirected) {
        await cache.put(event.request, response.clone());
      }
      return response;
    })
  );
});
