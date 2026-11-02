// Network first: pages stay live during a tournament, and the last version of each page
// visited is shown when the venue's connection drops.
const CACHE = "blue-court-v1";

// The organizer area holds private data: it is never cached, so it cannot be shown to the
// next person using the device, even after sign-out.
const PRIVATE_PATHS = ["/organizer"];

const isPrivate = (url) =>
  PRIVATE_PATHS.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`));

self.addEventListener("install", () => self.skipWaiting());

// A new version of this worker drops the caches of older versions.
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  ),
);

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.mode !== "navigate") return;
  if (isPrivate(new URL(event.request.url))) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // An error page must not replace the last good copy.
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached ?? Response.error())),
  );
});
