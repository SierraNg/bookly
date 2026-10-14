/* Bookly offline cache. Bump VERSION when files change so phones pick up the update. */
var VERSION = "bookly-2026-10-14-1";
var CORE = ["./", "index.html", "localdb.js", "seed.json", "manifest.webmanifest", "icons/mark.svg", "icons/icon-32.png", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "fonts/instrument-sans-latin-400-normal.woff2","fonts/instrument-sans-latin-500-normal.woff2","fonts/instrument-sans-latin-600-normal.woff2","fonts/instrument-sans-latin-700-normal.woff2","fonts/literata-latin-400-italic.woff2","fonts/literata-latin-400-normal.woff2","fonts/literata-latin-500-normal.woff2","fonts/literata-latin-600-normal.woff2"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  var fresh = req.mode === "navigate" || /\/(index\.html|seed\.json|localdb\.js)?$/.test(url.pathname) || url.pathname.endsWith("seed.json") || url.pathname.endsWith("localdb.js");
  if (fresh) {
    e.respondWith(fetch(req).then(function (res) {
      if (res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req.mode === "navigate" ? "index.html" : req, copy); }); }
      return res;
    }).catch(function () { return caches.match(req.mode === "navigate" ? "index.html" : req, { ignoreSearch: true }); }));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (hit) { return hit || fetch(req); }));
});
