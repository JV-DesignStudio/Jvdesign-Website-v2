// JVDesignStudio Service Worker v20 - unified Pixel Studio (Simple + Character + Draw + Animate)
const CACHE='jvds-v20';
const CORE=[
  '/',
  '/offline.html',
  '/manifest.json',
  '/style-shared.css',
  '/logo.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/assets/vendor/three/three.min.js',
  '/assets/vendor/three/GLTFExporter.js'
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
  // Navigation mode also covers extensionless routes and directory URLs.
  if(e.request.mode==='navigate'||url.pathname.endsWith('.html')||url.pathname==='/'){
    e.respondWith(cachePromise.then(async cache=>{
      try { return await remember(cache,e.request,await fetch(e.request)); }
      catch(err){
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
      try { return await remember(cache,e.request,await fetch(e.request)); }
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
