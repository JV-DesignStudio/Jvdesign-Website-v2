const CACHE = 'jvds-v1';
const PRECACHE = [
  '/', '/index.html', '/games.html', '/books.html', '/workshop.html',
  '/dev-tools.html', '/freebies.html', '/content_hub.html',
  '/manifest.json', '/logo.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Only handle GET requests to same origin
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  // Network-first for HTML, cache-first for assets
  const isHTML = e.request.headers.get('accept')?.includes('text/html');
  e.respondWith(
    isHTML
      ? fetch(e.request).then(r => { caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r; })
          .catch(() => caches.match(e.request))
      : caches.match(e.request).then(r => r || fetch(e.request).then(res => {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        }))
  );
});
