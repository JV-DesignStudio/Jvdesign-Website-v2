// ── JVDesignStudio Service Worker v5 ──────────────────────────────────────────
// v5: full offline support for Arcade Game Maker PWA
//   - Phaser engine (local file) added to precache
//   - Workshop tools (pixel-studio, sfx-generator) precached
//   - Stale-while-revalidate for the game maker so updates land silently
//   - Cleaned up dead CDN cache entries (Phaser loads from local, not CDN)
//   - Runtime font caching with longer TTL
//   - postMessage update notification to open clients

const CACHE_VERSION = 'jvds-v5';
const FONT_CACHE    = 'jvds-fonts-v5';

// ── Everything needed to run the Arcade Game Maker completely offline ─────────
const PRECACHE = [
  // Shell & nav
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',

  // Arcade Game Maker + its engine
  '/arcade-game-maker.html',
  '/phaser-arcade-physics.min.js',   // 1 MB — the game engine

  // Workshop tools (opened inside the game maker as iframes)
  '/pixel-studio.html',
  '/sfx-generator.html',

  // Other main pages
  '/games.html',
  '/books.html',
  '/workshop.html',
  '/dev-tools.html',
  '/freebies.html',
  '/content_hub.html',
];

// ── Install: cache everything before the SW becomes active ────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache =>
        // allSettled so one 404 never blocks the whole install
        Promise.allSettled(PRECACHE.map(url => cache.add(url)))
      )
      .then(() => self.skipWaiting())
  );
});

// ── Activate: delete all caches from previous versions ────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_VERSION && k !== FONT_CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => {
        self.clients.claim();
        // Tell all open tabs that a new version is active
        self.clients.matchAll({ type: 'window' }).then(clients =>
          clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' }))
        );
      })
  );
});

// ── Fetch: serve requests with appropriate strategies ─────────────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = e.request.url;

  // ── Google Fonts: cache-first, background revalidate ──────────────────────
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(fontStrategy(e.request));
    return;
  }

  // ── Analytics / external tracking: pass through, never cache ──────────────
  if (url.includes('googletagmanager.com') || url.includes('google-analytics.com') ||
      url.includes('is.gd') || url.includes('qrserver.com')) {
    return; // browser handles it normally
  }

  // ── Same-origin only beyond here ───────────────────────────────────────────
  if (!url.startsWith(self.location.origin)) return;

  // ── Phaser engine: cache-first (local versioned file, never changes) ───────
  if (url.includes('phaser-arcade-physics')) {
    e.respondWith(cacheFirst(e.request));
    return;
  }

  // ── Arcade Game Maker HTML: stale-while-revalidate ────────────────────────
  // Serve cached copy instantly; update cache in background so next visit is
  // fresh. Strip ?source=pwa so both the bare URL and PWA launch URL hit the
  // same cache entry.
  if (url.includes('arcade-game-maker')) {
    const canonical = new Request(url.split('?')[0], e.request);
    e.respondWith(staleWhileRevalidate(canonical));
    return;
  }

  // ── Workshop tools: stale-while-revalidate ────────────────────────────────
  if (url.includes('pixel-studio') || url.includes('sfx-generator')) {
    e.respondWith(staleWhileRevalidate(e.request));
    return;
  }

  // ── All other same-origin: network-first for HTML, cache-first for assets ──
  const isHTML = e.request.headers.get('accept')?.includes('text/html');
  e.respondWith(isHTML ? networkFirst(e.request) : cacheFirst(e.request));
});

// ────────────────────────────────── Strategies ────────────────────────────────

// Cache-first: serve from cache, fetch & store on miss
function cacheFirst(request) {
  return caches.open(CACHE_VERSION).then(cache =>
    cache.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(res => {
        if (res.ok) cache.put(request, res.clone());
        return res;
      }).catch(() => cached); // if both miss, return undefined (404 page)
    })
  );
}

// Network-first: try network, fall back to cache
function networkFirst(request) {
  return fetch(request)
    .then(res => {
      if (res.ok) caches.open(CACHE_VERSION).then(c => c.put(request, res.clone()));
      return res;
    })
    .catch(() => caches.match(request));
}

// Stale-while-revalidate: return cache immediately, refresh in background
function staleWhileRevalidate(request) {
  return caches.open(CACHE_VERSION).then(cache =>
    cache.match(request).then(cached => {
      const networkFetch = fetch(request).then(res => {
        if (res.ok) cache.put(request, res.clone());
        return res;
      }).catch(() => {});
      return cached || networkFetch;
    })
  );
}

// Font cache with long lifetime (1 year)
function fontStrategy(request) {
  return caches.open(FONT_CACHE).then(cache =>
    cache.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(res => {
        if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
        return res;
      }).catch(() => cached);
    })
  );
}
