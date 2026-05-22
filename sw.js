// ── JVDesignStudio Service Worker v3 ──────────────────────────────────────────
// v2 → v3: cache arcade-game-maker.html + Phaser CDN for offline gameplay
const CACHE     = 'jvds-v3';
const CDN_CACHE = 'jvds-cdn-v3'; // separate cache for cross-origin CDN assets

// Same-origin pages to cache on install
const PRECACHE = [
  '/',
  '/index.html',
  '/games.html',
  '/books.html',
  '/workshop.html',
  '/dev-tools.html',
  '/freebies.html',
  '/content_hub.html',
  '/arcade-game-maker.html',
  '/manifest.json',
  '/logo.png',
];

// Cross-origin CDN assets — fetched and cached on install so the game works offline
const CDN_PRECACHE = [
  'https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser-arcade-physics.min.js',
];

// ── Install ────────────────────────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    Promise.all([
      // Cache same-origin pages (ignore any individual 404s)
      caches.open(CACHE).then(c =>
        Promise.allSettled(PRECACHE.map(url => c.add(url)))
      ),
      // Cache CDN assets with no-cors mode so they can be served offline
      caches.open(CDN_CACHE).then(c =>
        Promise.allSettled(
          CDN_PRECACHE.map(url =>
            fetch(url, { mode: 'no-cors' })
              .then(res => c.put(url, res))
              .catch(() => {}) // skip if CDN unreachable during install
          )
        )
      ),
    ]).then(() => self.skipWaiting())
  );
});

// ── Activate — clean up old caches ────────────────────────────────────────────
self.addEventListener('activate', e => {
  const KEEP = [CACHE, CDN_CACHE];
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !KEEP.includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ──────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = e.request.url;

  // CDN assets: cache-first (versioned URLs never change)
  if (CDN_PRECACHE.some(u => url.startsWith(u.split('?')[0]))) {
    e.respondWith(
      caches.open(CDN_CACHE).then(c =>
        c.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request, { mode: 'no-cors' }).then(res => {
            c.put(e.request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // Google Fonts: cache-first, revalidate in background
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.open(CDN_CACHE).then(c =>
        c.match(e.request).then(cached => {
          const networkFetch = fetch(e.request).then(res => {
            c.put(e.request, res.clone());
            return res;
          }).catch(() => cached);
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // Same-origin only beyond here
  if (!url.startsWith(self.location.origin)) return;

  // arcade-game-maker.html: network-first so updates always land
  if (url.includes('arcade-game-maker')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // All other same-origin: network-first for HTML, cache-first for assets
  const isHTML = e.request.headers.get('accept')?.includes('text/html');
  e.respondWith(
    isHTML
      ? fetch(e.request)
          .then(r => { if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r; })
          .catch(() => caches.match(e.request))
      : caches.match(e.request).then(r =>
          r || fetch(e.request).then(res => {
            if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
            return res;
          })
        )
  );
});
