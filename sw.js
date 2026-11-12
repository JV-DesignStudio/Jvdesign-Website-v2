// JVDesignStudio Service Worker v57 - A2960: refresh Tabletop Studio with
// starter boards, first steps, a visible dice result and a quick help card.
// JVDesignStudio Service Worker v56 - A2960: precache Tabletop Studio so the
// board maker opens and plays with the network down after one online visit.
// JVDesignStudio Service Worker v55 - Call of the Cards v2: a faster card duel,
// a device-friendly board, and the game is back in the arcade as an experiment.
// JVDesignStudio Service Worker v54 - A2920: refresh the Lumo games again for
// the first-run coach, shape cues, run cards, lanterns and new thumbnails.
// JVDesignStudio Service Worker v53 - A2918: precache Pip's Cozy Cove page,
// styles, script and thumbnail so the fishing game opens and plays with the
// network fully down after one online visit.
// JVDesignStudio Service Worker v52 - A2919: refresh both Lumo games so the
// tactical Hive Strike rework and the Firefly hex match puzzle reach returning
// players on their next online load.
// JVDesignStudio Service Worker v48 - A2917: refresh Lumo's Firefly Shooter's
// page, CSS and script so the end-of-run book card, self-hosted fonts and
// larger touch targets reach returning players on their next online load.
// JVDesignStudio Service Worker v47 - A2676: the Arcade Game Maker on-demand
// precache now includes its UI scripts, shared CSS, fonts and manifest, so the
// maker boots and plays a game with the network fully down. Resiliant per-file
// caching keeps one missing asset from cancelling the whole maker offline pack.
// JVDesignStudio Service Worker v46 - A2656: precache the shared immersive
// studio chrome (tab CSS + JS) so every interactive studio keeps its full
// workspace offline on a school network.
// JVDesignStudio Service Worker v45 - A2107: precache studio-midi.js so Audio
// Studio can export and import .mid files offline on a school network.
// JVDesignStudio Service Worker v42 - A2177: ship arcade engine v2.1, so the
// cache-first maker HTML and its modules refresh for returning visitors.
// JVDesignStudio Service Worker v41 - engine: Custom Sandbox modules and the
// player-only export changed cache-first JS/CSS, so bump the cache.
// JVDesignStudio Service Worker v40 - A2012: refresh the floating tool helpers so
// they step aside from mobile bottom toolbars instead of covering export.
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
const CACHE='jvds-v57';
const CORE=[
  '/',
  '/offline.html',
  '/manifest.json',
  '/style-shared.css',
  '/assets/css/tokens.css',
  '/assets/css/immersive-tool.css',
  '/assets/js/immersive-tool.js',
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
  '/assets/js/studio-midi.js',
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
  '/style-tool-gdd-builder.css?v=20',
  // A-major: the GDD builder's fonts, icons and QR helper are proactively
  // cached so a first offline visit still has the full editor and art picker.
  '/qrcode-generator.js',
  '/tools/tabletop-studio.html',
  '/style-tool-tabletop-studio.css',
  '/assets/js/inline/tabletop-studio-1.js',
  '/assets/css/studio-shell.css?v=1',
  '/assets/fonts/inter-400-normal-latin-6ab57b19.woff2',
  '/assets/fonts/fredoka-400-normal-latin-a4a694ae.woff2',
  '/assets/mascots/echo-badge.webp',
  '/assets/mascots/stardust-badge.webp',
  '/assets/mascots/barnaby-badge.webp',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/tools/story-editor.html',
  '/style-tool-story-editor.css',
  '/tools/code-snippet-generator.html',
  '/style-tool-code-snippet-generator.css',
  '/style-code-snippet-theme.css',
  '/tools/csg-tokenizer.js',
  '/tools/csg-worker.js',
  '/tools/csg-explainers.js',
  '/tools/csg-starters.js',
  '/tools/error-guide.html',
  '/style-tool-error-guide.css',
  '/assets/js/inline/tools-error-guide-2.js',
  '/assets/js/error-guide-worker.js',
  '/data/error-guide/errors-scratch.json',
  '/data/error-guide/errors-roblox.json',
  '/data/error-guide/errors-godot.json',
  '/data/error-guide/errors-unity.json',
  '/data/error-guide/errors-python.json',
  '/data/error-guide/errors-javascript.json',
  // A2774: the Code Snippet Generator uses its own zero-dependency tokenizer,
  // so the old Prism bundles are no longer precached.
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
  // A2289: flagship courses precached so a dropped school network cannot end a lesson.
  '/workshops/my-first-browser-game.html',
  '/workshops/my-first-python-game.html',
  '/workshops/my-first-cpp-game.html',
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
  '/games/lumo_firefly_night.html',
  '/style-game-lumo_firefly_night.css',
  '/assets/js/inline/games-lumo-firefly-night-1.js',
  '/games/pips-cozy-cove.html',
  '/style-game-pips-cozy-cove.css',
  '/assets/js/inline/games-pips-cozy-cove.js',
  '/assets/game-thumbs/pips-cozy-cove.webp',
  '/story-run.js',
  '/story-run.css',
  '/game-system.js',
  '/game-system.css',
  '/game-system-score.js',
  '/game-system-save.js',
  '/audio-effects.js',
  '/game-shell.js',
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
  '/src/arcade-maker/achievements.js',
  '/src/arcade-maker/bus.js',
  // A2676: the rest of the maker shell, so a dropped connection still leaves a
  // usable editor rather than an unstyled page with unclickable controls.
  '/assets/js/theme-init.js',
  '/assets/js/jvds-manifest.js',
  '/assets/js/ui-delegate.js',
  '/assets/js/tool-kit.js',
  '/jvds-project-bundle.js',
  '/make-a-game-journey.js',
  '/compat-badge.js',
  '/nav.js?v=20',
  '/style-shared.css?v=17',
  '/style-mascots.css',
  '/ember-guide.css',
  '/assets/css/tokens.css',
  '/assets/css/immersive-tool.css',
  '/assets/css/studio-shell.css?v=1',
  '/assets/fonts/inter-400-normal-latin-6ab57b19.woff2',
  '/assets/fonts/fredoka-400-normal-latin-a4a694ae.woff2',
  '/arcade.webmanifest',
  '/logo.png',
  '/icons/icon-192.png',
  '/apple-touch-icon.png'
];

// A1691: GitHub Pages serves the clean nav URLs (for example /workshop, /dev-tools,
// /learn/) through 404.html, which a service worker cannot cache offline. After the
// real target page is precached we copy it under the clean URL too, so the main nav
// keeps working with the network down. Keep in sync with the clean-URL map in 404.html.
const ALIASES={
  '/workshop':'/pages/workshop.html',
  '/learn-hub':'/pages/learn-hub.html',
  '/create':'/pages/dev-tools.html',
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
      caches.open(CACHE)
        .then(async c=>{
          // A2676: cache each dependency on its own. A single blocked or moved
          // asset must not cancel the whole offline pack for the maker.
          const results=await Promise.allSettled(MAKER_DEPS.map(url=>c.add(url)));
          const failed=MAKER_DEPS.filter((_,i)=>results[i].status==='rejected');
          if(failed.length) console.warn('[SW] maker precache skipped',failed.join(', '));
        })
        .then(()=>{
          try{ if(e.source&&e.source.postMessage) e.source.postMessage({type:'precache-maker-done'}); }catch(_e){}
        })
        .catch(err=>console.warn('[SW] maker precache failed',err))
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
  // Stale-while-revalidate for the GDD builder: a school Chromebook gets the
  // cached editor instantly, and the refreshed copy is ready for next session.
  if(url.pathname==='/tools/gdd-builder.html'&&(e.request.mode==='navigate'||url.pathname.endsWith('.html'))){
    const refresh=cachePromise.then(async cache=>{
      try{ return await remember(cache,e.request,await fetchWithTimeout(e.request,5000)); }
      catch(err){ return await cache.match(e.request)||new Response('Offline',{status:503,headers:{'Content-Type':'text/plain'}}); }
    });
    e.waitUntil(refresh.then(()=>{}));
    e.respondWith(cachePromise.then(async cache=>await cache.match(e.request)||refresh));
    return;
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
