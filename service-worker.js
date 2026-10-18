/* Xfit Gym service worker
   - App files: cache-first with background refresh (opens instantly, even offline)
   - Google Apps Script API (bookings, counts, ratings): always network, never cached
   Bump CACHE_VERSION whenever you change index.html so users get the update. */
const CACHE_VERSION = "xfitm-v2";
const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  /* Never touch the booking/rating API or other cross-origin requests */
  if (url.origin !== self.location.origin) return;

  /* Only the booking page (index) is cached; account/admin pages always go to the network */
  const isIndex = /\/(index\.html)?$/.test(url.pathname);
  if (req.mode === "navigate" && !isIndex) return;

  /* Pages: network first (fresh when online), fall back to cache when offline */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then(c => c.put("./index.html", copy));
          }
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  /* Static files: cache first, refresh in background */
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});

/* Push notifications (class reminders) */
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data.json(); } catch (x) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Xfit Gym", {
    body: d.body || "",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    lang: d.lang || "ar",
    dir: d.dir || "rtl",
    data: { url: d.url || "./" }
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) { if ("focus" in c) return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
