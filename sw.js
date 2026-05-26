// ── JVDesignStudio Service Worker v6 ──────────────────────────────────────────
// Full site offline support:
//   • Precaches core pages + Phaser on install (~2 MB — fast)
//   • Runtime-caches every page & image the user visits (grows as you browse)
//   • Stale-while-revalidate for HTML — instant load + silent background update
//   • Cache-first for images & assets — no re-downloading things you already have
//   • Skips huge files (WAV, large PDFs, videos) — too big to cache usefully
//   • offline.html fallback for any page not yet in cache

const V           = 'v6';
const CORE_CACHE  = `jvds-core-${V}`;
const PAGE_CACHE  = `jvds-pages-${V}`;
const IMAGE_CACHE = `jvds-images-${V}`;
const FONT_CACHE  = `jvds-fonts-${V}`;

const ALL_CACHES = [CORE_CACHE, PAGE_CACHE, IMAGE_CACHE, FONT_CACHE];

// ── Precached on install (always available offline from first visit) ───────────
const CORE_PRECACHE = [
  '/offline.html',          // fallback — must be first
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',

  // Game Maker + engine
  '/arcade-game-maker.html',
  '/phaser-arcade-physics.min.js',

  // Workshop tools (opened as iframes inside game maker)
  '/pixel-studio.html',
  '/sfx-generator.html',

  // Main nav pages
  '/games.html',
  '/books.html',
  '/workshop.html',
  '/dev-tools.html',
  '/freebies.html',
  '/content_hub.html',
  '/404.html',
];

// ── File types too large / unsuitable to cache automatically ─────────────────
const SKIP_EXTENSIONS = ['.wav', '.mp3', '.mp4', '.webm', '.ogg'];
// PDFs over ~3 MB are skipped (smaller ones cache fine)
const MAX_PDF_SIZE    = 3 * 1024 * 1024;
// Images over 3 MB are skipped (most book covers are under that)
const MAX_IMAGE_SIZE  = 3 * 1024 * 1024;

// ── Install ────────────────────────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CORE_CACHE)
      .then(cache => Promise.allSettled(CORE_PRECACHE.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: wipe caches from previous versions ──────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !ALL_CACHES.includes(k)).map(k => caches.delete(k))
      ))
      .then(() => {
        self.clients.claim();
        // Tell all open tabs a new SW is active
        self.clients.matchAll({ type: 'window' }).then(clients =>
          clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' }))
        );
      })
  );
});

// ── Fetch ──────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url  = new URL(e.request.url);
  const path = url.pathname.toLowerCase();
  const ext  = path.slice(path.lastIndexOf('.'));

  // ── Never intercept: analytics, tracking, sharing APIs ───────────────────
  if (
    url.hostname.includes('googletagmanager.com') ||
    url.hostname.includes('google-analytics.com') ||
    url.hostname.includes('is.gd') ||
    url.hostname.includes('qrserver.com')
  ) return;

  // ── Skip audio and video (too large) ─────────────────────────────────────
  if (SKIP_EXTENSIONS.includes(ext)) return;

  // ── Google Fonts: cache-first ─────────────────────────────────────────────
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    e.respondWith(cacheFirst(e.request, FONT_CACHE, { opaque: true }));
    return;
  }

  // ── Same-origin only beyond here ──────────────────────────────────────────
  if (url.origin !== self.location.origin) return;

  // ── Phaser engine & small JS files: cache-first ───────────────────────────
  if (ext === '.js') {
    e.respondWith(cacheFirst(e.request, CORE_CACHE));
    return;
  }

  // ── Images: cache-first, skip if too large ────────────────────────────────
  if (['.png','.jpg','.jpeg','.gif','.webp','.svg','.ico'].includes(ext)) {
    e.respondWith(imageStrategy(e.request));
    return;
  }

  // ── PDFs: cache small ones on demand, skip large ─────────────────────────
  if (ext === '.pdf') {
    e.respondWith(pdfStrategy(e.request));
    return;
  }

  // ── HTML pages: stale-while-revalidate (instant + silent updates) ─────────
  // Strip query strings so ?source=pwa etc. all hit the same cache entry
  if (ext === '.html' || ext === '' || path === '/') {
    const canonical = new Request(url.origin + url.pathname, e.request);
    e.respondWith(pageStrategy(canonical));
    return;
  }

  // ── Everything else same-origin: cache-first ─────────────────────────────
  e.respondWith(cacheFirst(e.request, PAGE_CACHE));
});

// ────────────────────────── Strategies ────────────────────────────────────────

// Stale-while-revalidate for pages
// Returns cached copy immediately; fetches fresh copy in background for next time
// Falls back to offline.html if page was never cached
async function pageStrategy(request) {
  const cache  = await caches.open(PAGE_CACHE);
  const coreC  = await caches.open(CORE_CACHE);
  const cached = await cache.match(request) || await coreC.match(request);

  const networkFetch = fetch(request)
    .then(res => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);

  if (cached) {
    // Fire-and-forget background update
    networkFetch.catch(() => {});
    return cached;
  }

  // Not in cache — try network, show offline page on fail
  const fresh = await networkFetch;
  if (fresh) return fresh;

  const offlinePage = await coreC.match('/offline.html');
  return offlinePage || new Response('You are offline', {
    status: 503,
    headers: { 'Content-Type': 'text/plain' }
  });
}

// Cache-first for assets (fonts, JS, etc.)
async function cacheFirst(request, cacheName, options = {}) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const res = await fetch(request);
    if (res.ok || (options.opaque && res.type === 'opaque')) {
      cache.put(request, res.clone());
    }
    return res;
  } catch (_) {
    return cached || new Response('', { status: 503 });
  }
}

// Images: cache-first but skip responses over MAX_IMAGE_SIZE
async function imageStrategy(request) {
  const cache  = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const res = await fetch(request);
    if (res.ok) {
      // Check Content-Length before caching — skip huge images
      const len = parseInt(res.headers.get('content-length') || '0', 10);
      if (len === 0 || len < MAX_IMAGE_SIZE) {
        cache.put(request, res.clone());
      }
    }
    return res;
  } catch (_) {
    return new Response('', { status: 503 });
  }
}

// PDFs: cache small ones, let large ones pass through uncached
async function pdfStrategy(request) {
  const cache  = await caches.open(PAGE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const res = await fetch(request);
    if (res.ok) {
      const len = parseInt(res.headers.get('content-length') || '0', 10);
      if (len === 0 || len < MAX_PDF_SIZE) {
        cache.put(request, res.clone());
      }
    }
    return res;
  } catch (_) {
    return new Response('PDF unavailable offline', { status: 503 });
  }
}
