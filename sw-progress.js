/* Service Worker - caches workshop progress pages and engine JS for offline use.
   Registered from workshop pages via workshop-engine.js.
   Strategy: network-first for HTML, cache-first for static assets. */
var CACHE = 'jvds-ws-v1';
var PRECACHE = [
  '/assets/fonts/fonts.css',
  '/style-workshop-bundle.css',
  '/workshops/workshop-engine.js',
  '/workshops/my-progress.html',
  '/workshops/my-achievements.html'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(PRECACHE);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE; })
          .map(function (n) { return caches.delete(n); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.pathname.indexOf('/workshops/') !== -1 || url.pathname.indexOf('workshop') !== -1) {
    e.respondWith(
      fetch(e.request).then(function (resp) {
        if (resp.ok) {
          var clone = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
        }
        return resp;
      }).catch(function () {
        return caches.match(e.request).then(function (cached) {
          return cached || new Response('Offline - progress is saved locally.', {
            status: 503, headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
    );
    return;
  }
  if (url.pathname.match(/\.(css|js|woff2?|png|webp|svg|ico)$/)) {
    e.respondWith(
      caches.match(e.request).then(function (cached) {
        return cached || fetch(e.request).then(function (resp) {
          if (resp.ok) {
            var clone = resp.clone();
            caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
          }
          return resp;
        });
      })
    );
  }
});
