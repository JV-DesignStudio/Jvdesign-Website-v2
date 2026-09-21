// JVDesignStudio Service Worker v26 - A207 school-network hardening: timeout only when cached exists, timer cleared, bump cache, Pip quest deps precached
// v21 - A69 offline-first for tools (school-computer rule): precache Pixel Studio + Sound Studio + World Builder
// v22 (A256): precache jvds-store.js (backpack + progress) and refresh nav.js (profile chip reads jvds_profile)
// v24 (A68-A76): precache new offline-first tools - migrate, gallery, collab, accessibility, challenges, backup, subscription, localize
// v25 (A332): add pixel-studio shared dependencies so tool fully works offline on first visit
const CACHE='jvds-v26';
const CORE=[
  '/',
  '/offline.html',
  '/manifest.json',
  '/style-shared.css',
  '/assets/css/tokens.css',
  '/nav.js',
  '/jvds-store.js',
  '/style-mascots.css',
  '/ember-guide.css',
  '/ember-guide.js',
  '/logo.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/assets/vendor/three/three.min.js',
  '/assets/vendor/three/GLTFExporter.js',
  '/tools/pixel-studio.html',
  '/tools/pixel-studio-landing.html',
  '/style-tool-pixel-studio.css',
  '/tools/pixel-studio-unified-characters.js',
  '/tools/pixel-studio-unified-adapter.js',
  '/shared-modal.js',
  '/player-profile.js',
  '/tool-xp.js',
  '/tool-analytics.js',
  '/quest-system.js',
  '/tools/sound-studio.html',
  '/style-tool-sound-studio.css',
  '/tools/level-designer.html',
  '/style-tool-level-designer.css',
  '/assets/mascots/ember-hero.webp',
  '/assets/mascots/ember-badge.webp',
  '/assets/mascots/lumo-badge.webp',
  '/assets/mascots/pip-badge.webp',
  '/tools/storage-migrate.html',
  '/tools/gallery.html',
  '/tools/collab.html',
  '/tools/accessibility.html',
  '/tools/challenges.html',
  '/tools/backup-restore.html',
  '/tools/subscription.html',
  '/tools/localize.html'
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
      // CacheStorage is shared by every app on this origin. Only retire our
      // numbered website caches, never another worker's offline data.
      .then(keys=>Promise.all(keys.filter(k=>/^jvds-v\d+$/.test(k)&&k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

async function remember(cache,request,response){
  if(response.ok){
    try { await cache.put(request,response.clone()); }
    catch(err){ console.warn('[SW] Cache write failed',err); }
  }
  return response;
}

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  if(url.origin!==self.location.origin||e.request.headers.has('range'))return;

  const cachePromise=caches.open(CACHE);
  function fetchWithTimeout(req, ms=5000){
    let timer;
    const p = Promise.race([fetch(req), new Promise((_,rej)=>{ timer=setTimeout(()=>rej(new Error('timeout')), ms); })]);
    return p.finally(()=> clearTimeout(timer));
  }
  // Navigation: only race timeout when a cached response exists; otherwise wait for network (slow school net with no cache would wrongly show offline.html).
  if(e.request.mode==='navigate'||url.pathname.endsWith('.html')||url.pathname==='/'){
    e.respondWith(cachePromise.then(async cache=>{
      const cached = await cache.match(e.request);
      try {
        const fetched = cached ? await fetchWithTimeout(e.request,5000) : await fetch(e.request);
        return await remember(cache,e.request,fetched);
      } catch(err){
        if(cached) return cached;
        return await cache.match(e.request)||await cache.match('/offline.html')||
          new Response('Offline',{status:503,headers:{'Content-Type':'text/plain'}});
      }
    }));
    return;
  }

  if(url.pathname.endsWith('.css')||url.pathname.endsWith('.js')){
    // Keep background refresh alive even after a cached response is delivered.
    // A new ?v= URL must never match an older asset version.
    const refresh=cachePromise.then(async cache=>{
      try { return await remember(cache,e.request,await fetchWithTimeout(e.request,5000)); }
      catch(err){ return await cache.match(e.request)||new Response('',{status:504,statusText:'Offline'}); }
    });
    e.waitUntil(refresh.then(()=>{}));
    e.respondWith(cachePromise.then(async cache=>await cache.match(e.request)||refresh));
    return;
  }

  // Read only this website's cache, rather than every cache on the origin.
  e.respondWith(cachePromise.then(async cache=>{
    const cached=await cache.match(e.request);
    if(cached)return cached;
    try { return await remember(cache,e.request,await fetch(e.request)); }
    catch(err){ return new Response('',{status:504,statusText:'Offline'}); }
  }));
});
