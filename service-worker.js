const CACHE_NAME = "afk-dashboard-v1.5.29";
const APP_SHELL = [
  "./manifest.webmanifest?v=1.5.29",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const acceptsHtml = event.request.mode === "navigate" || (event.request.headers.get("accept") || "").includes("text/html");
  if (acceptsHtml) {
    event.respondWith(
      fetch(new Request(event.request, { cache: "no-store" }))
        .catch(() => new Response("AFK Growth Intelligence Dashboard sedang offline. Hubungkan internet lalu refresh halaman.", {
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        }))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
