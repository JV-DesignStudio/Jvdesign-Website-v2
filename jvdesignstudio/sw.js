/**
 * sw.js - Service Worker for JVDesignStudio offline support.
 * Cache-first strategy for static assets; network-first for data files.
 */

const CACHE_NAME = 'jvds-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './workspace.html',
  './manifest.json',
  './data/tracks.json',
  './data/achievements.json',
  './data/lore.json',
  './assets/css/variables.css',
  './assets/css/main.css',
  './assets/css/workspace.css',
  './assets/js/app.js',
  './assets/js/core/state.js',
  './assets/js/core/evaluator.js',
  './assets/js/core/skill-tree.js',
  './assets/js/core/fx.js',
  './assets/js/core/ui.js',
  './assets/js/core/stats.js',
  './assets/js/core/mobile-keys.js',
  './assets/js/core/printables.js',
  './assets/js/core/community.js',
  './assets/js/core/ai-assistant.js',
  './assets/js/core/profiles.js',
  './arcade.html',
];

/* ── Install: pre-cache all static assets ── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

/* ── Activate: clear old caches ── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── Fetch: cache-first for assets, network-first for data ── */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Network-first for data files (keep content fresh)
  if (url.pathname.includes('/data/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return res;
      });
    })
  );
});
