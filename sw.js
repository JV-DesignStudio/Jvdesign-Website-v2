// JVDesignStudio Service Worker v39 - A1998: refresh creation-share.js so the
// share-link warning reaches returning visitors on their next online load.
// JVDesignStudio Service Worker v37 - A1475: the Arcade Game Maker precaches itself (HTML + Phaser + its own modules) on demand, when its page opens, so the engine opens offline on a school network without forcing the ~2.4 MB on every visitor.
// JVDesignStudio Service Worker v35 - A1444: bump cache so the refreshed mascot art (hero/badge) + mascots.js replace cached concept sheets.
// JVDesignStudio Service Worker v29 - A207 school-network hardening: timeout only when cached exists, timer cleared, bump cache, Pip quest deps precached
// v21 - A69 offline-first for tools (school-computer rule): precache Pixel Studio + Sound Studio + World Builder
// v22 (A256): precache jvds-store.js (backpack + progress) and refresh nav.js (profile chip reads jvds_profile)
// v25 (A332): add pixel-studio shared dependencies so tool fully works offline on first visit
// v28 (A611): offline fallback uses the small pip-hero.webp instead of the 2.5 MB pip.png
// v29 (A675): precache the top create tools + their CSS and shared widgets for offline-first school use
// v30 (A809): ship the Pixel Studio phone layout fix and modal widget hiding (fresh CSS)
// v31 (A823): allow blob: in the CSP and self-host the BuildLab mobile chrome fix
// v32 (A831): self-host Prism so the Code Snippet Generator highlights offline
// v33 (A936): Icon Generator Help, real share links and a pinned mobile preview
// v34 (A648): precache testimonials.js for the honest social-proof strip + form
// v36 (A781): self-host JSZip + gifenc so precached tools export offline without any CDN.
// v38 (A1691): precache the core entry and hub pages (+ their CSS and shared scripts)
// and alias the clean nav URLs, so the whole site opens offline after one online visit.
const CACHE='jvds-v39';
const CORE=[
  '/',
  '/offline.html',
  '/manifest.json',
  '/style-shared.css',
  '/assets/css/tokens.css',
  '/nav.js',
  '/testimonials.js',
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
  // A675: top create tools precached for offline-first school use.
  // arcade-game-maker is NOT in CORE: its HTML is 1.27 MB and it loads a 1 MB
  // physics bundle, too heavy to force on every visitor. Instead it precaches
  // itself on demand (MAKER_DEPS below) the first time its page opens (A1475),
  // so it opens offline on a school network after one online visit.
  '/tools/trading-card-designer.html',
  '/style-tool-trading-card-designer.css',
  '/tools/colour-palette.html',
  '/style-tool-colour-palette.css',
  '/tools/particle-designer.html',
  '/style-tool-particle-designer.css',
  '/tools/bitmap-font-maker.html',
  '/style-tool-bitmap-font-maker.css',
  '/tools/sprite-animator.html',
  '/style-tool-sprite-animator.css',
  '/tools/icon-generator.html',
  '/style-tool-icon-generator.css',
  '/tools/gdd-builder.html',
  '/style-tool-gdd-builder.css',
  '/tools/story-editor.html',
  '/style-tool-story-editor.css',
  '/tools/code-snippet-generator.html',
  '/style-tool-code-snippet-generator.css',
  // A831: self-hosted Prism so the Code Snippet Generator highlights offline.
  '/assets/vendor/prism/prism.min.js',
  '/assets/vendor/prism/prism-jvds.css',
  '/assets/vendor/prism/components/prism-c.min.js',
  '/assets/vendor/prism/components/prism-cpp.min.js',
  '/assets/vendor/prism/components/prism-csharp.min.js',
  '/assets/vendor/prism/components/prism-python.min.js',
  '/assets/vendor/prism/components/prism-lua.min.js',
  '/assets/vendor/prism/components/prism-java.min.js',
  // A781: self-hosted export libraries so precached tools work offline with no CDN.
  '/assets/vendor/jszip/jszip.min.js',
  '/assets/vendor/gifenc/gifenc.esm.js',
  '/tools/buildlab.html',
  '/style-tool-buildlab.css',
  // Shared widget scripts those tools load, so they work on a first offline visit.
  '/creation-share.js',
  '/creation-keepsake.js',
  '/jvds-funnel.js',
  '/feedback-widget.js',
  '/mascots.js',
  '/hidpi-canvas.js',
  // A1691: core entry and hub pages, precached so the whole site opens offline
  // after one online visit (school-computer rule). Heavy game pages stay out.
  '/pages/workshop.html',
  '/pages/learn-hub.html',
  '/pages/dev-tools.html',
  '/arcade.html',
  '/learn/index.html',
  '/pick-your-path.html',
  '/workshops/start-here.html',
  '/style-workshop-bundle.css',
  '/style-workshop-hub.css',
  '/style-workshop-welcome.css',
  '/style-workshop.css',
  '/style-dev-tools.css',
  '/style-arcade.css',
  '/assets/fonts/fonts.css',
  '/assets/js/ui-delegate.js',
  '/assets/js/theme-init.js',
  '/weekly-challenge.js',
  '/daily-challenge.js',
  '/migrate-keys.js',
  '/analytics-loader.js',
  '/sw-register.js',
  '/games-registry.js',
  '/workshops/workshop-track.js',
  '/cookie-consent.js',
  '/assets/mascots/ember-hero.webp',
  '/assets/mascots/ember-badge.webp',
  '/assets/mascots/lumo-badge.webp',
  '/assets/mascots/pip-badge.webp',
  '/assets/mascots/pip-hero.webp',
  '/assets/mascots/pip.png',
  '/tools/gallery.html'
];

// A1475: the Arcade Game Maker precaches ITSELF on demand, the first time its
// page opens, so only people who use the engine download its ~2.4 MB (HTML,
// Phaser physics bundle and its own ES modules). On-demand keeps the global
// install light for everyone else while still letting the maker open offline.
const MAKER_DEPS=[
  '/tools/arcade-game-maker.html',
  '/phaser-arcade-physics.min.js',
  '/qrcode-generator.js',
  '/style-tool-arcade-game-maker.css',
  '/tool-handoff.js',
  '/assets/fonts/fonts.css',
  '/src/arcade-maker/liveConfig.js',
  '/src/arcade-maker/GameAudio.js',
  '/src/arcade-maker/genres.js',
  '/src/arcade-maker/achievements.js'
];

// A1691: GitHub Pages serves the clean nav URLs (for example /workshop, /dev-tools,
// /learn/) through 404.html, which a service worker cannot cache offline. After the
// real target page is precached we copy it under the clean URL too, so the main nav
// keeps working with the network down. Keep in sync with the clean-URL map in 404.html.
const ALIASES={
  '/workshop':'/pages/workshop.html',
  '/learn-hub':'/pages/learn-hub.html',
  '/dev-tools':'/pages/dev-tools.html',
  '/learn/':'/learn/index.html',
  '/games':'/arcade.html',
  '/pick-your-path':'/pick-your-path.html',
  '/workshops/start-here':'/workshops/start-here.html'
};

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE)
      // A1691: cache each entry on its own so one missing file cannot abort the
      // whole precache and leave the site with no offline core at all.
      .then(async c=>{
        const results=await Promise.allSettled(CORE.map(url=>c.add(url)));
        const failed=CORE.filter((_,i)=>results[i].status==='rejected');
        if(failed.length) console.warn('[SW] CORE precache skipped',failed.join(', '));
        for(const [clean,target] of Object.entries(ALIASES)){
          try{ const r=await c.match(target); if(r) await c.put(clean,r.clone()); }
          catch(err){ console.warn('[SW] clean-URL alias failed',clean,err); }
        }
      })
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

// A1475: on-demand precache for the Arcade Game Maker. The maker page posts
// {type:'precache-maker'} once it is controlled; we cache MAKER_DEPS so the
// engine opens offline afterwards. Replies with 'precache-maker-done' so the
// page (and tests) can wait for it.
self.addEventListener('message',e=>{
  const d=e.data||{};
  if(d.type==='precache-maker'){
    e.waitUntil(
      caches.open(CACHE).then(c=>c.addAll(MAKER_DEPS)).then(()=>{
        try{ if(e.source&&e.source.postMessage) e.source.postMessage({type:'precache-maker-done'}); }catch(_e){}
      }).catch(err=>console.warn('[SW] maker precache failed',err))
    );
  }
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
