// JVDesignStudio Service Worker v4
const CACHE='jvds-v4';
const CORE=[
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/style-shared.css',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/privacy-policy.html'
];

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE)
      .then(c=>c.addAll(CORE).catch(()=>{})) // don't fail install if icons missing yet
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
  // Network-first for HTML (always get latest app)
  if(url.pathname.endsWith('.html')||url.pathname==='/'){
    e.respondWith(
      fetch(e.request)
        .then(res=>{caches.open(CACHE).then(c=>c.put(e.request,res.clone()));return res;})
        .catch(()=>caches.match(e.request).then(r=>r||caches.match('/offline.html')))
    );
    return;
  }
  // Cache-first for everything else (icons, manifest)
  e.respondWith(
    caches.match(e.request).then(cached=>{
      if(cached)return cached;
      return fetch(e.request).then(res=>{
        if(res.ok)caches.open(CACHE).then(c=>c.put(e.request,res.clone()));
        return res;
      }).catch(()=>caches.match('/offline.html'));
    })
  );
});
