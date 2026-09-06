// JVDesignStudio Service Worker v17 — trimmed CORE + ignoreSearch for ?v bust
const CACHE='jvds-v17';
const CORE=[
  '/',
  '/offline.html',
  '/manifest.json',
  '/style-shared.css',
  '/logo.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE)
      .then(c=>c.addAll(CORE).catch(err=>{ console.warn('[SW] CORE precache failed', err); }))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  if(url.hostname.includes('google-analytics')||url.hostname.includes('googletagmanager')||url.hostname.includes('doubleclick')) return;
  if(e.request.headers.has('range')) return;
  if(url.protocol==='chrome-extension:') return;

  // Network-first for HTML (always get latest app)
  if(url.pathname.endsWith('.html')||url.pathname==='/'){
    e.respondWith(
      fetch(e.request)
        .then(res=>{ if(res.ok) caches.open(CACHE).then(c=>c.put(e.request,res.clone())); return res; })
        .catch(()=>caches.match(e.request).then(r=>r||caches.match('/offline.html')))
    );
    return;
  }

  // Stale-while-revalidate for CSS/JS (serve fast, update in background) — ignore ?v= cache-bust param
  if(url.pathname.endsWith('.css')||url.pathname.endsWith('.js')){
    e.respondWith(
      caches.open(CACHE).then(cache=>{
        return cache.match(e.request, {ignoreSearch:true}).then(cached=>{
          const fetchPromise=fetch(e.request).then(res=>{
            if(res.ok)cache.put(e.request,res.clone());
            return res;
          }).catch(()=> cached || caches.match('/offline.html'));
          return cached||fetchPromise;
        });
      })
    );
    return;
  }

  // Cache-first for static assets (icons, images, fonts) — bounded, no opaque analytics
  e.respondWith(
    caches.match(e.request).then(cached=>{
      if(cached)return cached;
      return fetch(e.request).then(res=>{
        // Only cache successful, same-origin GETs; avoid opaque/analytics
        if(res.ok && res.type==='basic') caches.open(CACHE).then(c=>c.put(e.request,res.clone()));
        return res;
      }).catch(()=>caches.match('/offline.html'));
    })
  );
});
