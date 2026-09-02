// JVDesignStudio Service Worker v15
const CACHE='jvds-v15';
const CORE=[
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/style-shared.css',
  '/style-workshop.css',
  '/workshop-enhancements.js',
  '/cookie-consent.js',
  '/content-data.js',
  '/content-loader.js',
  '/logo.png',
  '/workshop',
  '/pages/workshop.html',
  '/games',
  '/pages/games.html',
  '/books',
  '/pages/books.html',
  '/workshops/my-progress.html',
  '/learn-hub',
  '/pages/learn-hub.html',
  '/dev-tools',
  '/pages/dev-tools.html',
  '/freebies',
  '/pages/freebies.html',
  '/downloads',
  '/pages/downloads.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/arcade.html',
  '/arcade.webmanifest',
  '/games-registry.js',
  '/game-system.js',
  '/game-system.css',
  '/player-profile.js',
  '/audio-effects.js',
  '/icons/arcade-192.png',
  '/icons/arcade-512.png',
  '/icons/arcade-180.png',
  '/tools/pixel-studio.html',
  '/tools/pixel-studio.webmanifest',
  '/tools/pixel-studio-landing.html',
  '/icons/pixel-studio-192.png',
  '/icons/pixel-studio-512.png',
  '/icons/pixel-studio-maskable-512.png',
  '/tools/map-generator.html',
  '/tools/map-generator-landing.html',
  '/tools/level-designer.html',
  '/tools/level-designer.webmanifest',
  '/icons/level-designer-192.png',
  '/icons/level-designer-512.png',
  '/icons/level-designer-maskable-512.png'
];

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE)
      .then(c=>c.addAll(CORE).catch(()=>{}))
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

  // Stale-while-revalidate for CSS/JS (serve fast, update in background)
  if(url.pathname.endsWith('.css')||url.pathname.endsWith('.js')){
    e.respondWith(
      caches.open(CACHE).then(cache=>{
        return cache.match(e.request).then(cached=>{
          const fetchPromise=fetch(e.request).then(res=>{
            if(res.ok)cache.put(e.request,res.clone());
            return res;
          }).catch(()=>cached);
          return cached||fetchPromise;
        });
      })
    );
    return;
  }

  // Cache-first for static assets (icons, images, fonts)
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
