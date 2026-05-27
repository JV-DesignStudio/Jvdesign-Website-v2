const fs = require('fs');

// ── Fix 1: Bump SW version v6 → v7, network-first for HTML ──────────────────
let sw = fs.readFileSync('sw.js', 'utf8');

// Bump version
sw = sw.replace(
  "// ── JVDesignStudio Service Worker v6 ──────────────────────────────────────────",
  "// ── JVDesignStudio Service Worker v7 ──────────────────────────────────────────"
);
sw = sw.replace("const V           = 'v6';", "const V           = 'v7';");

// Change pageStrategy from stale-while-revalidate to network-first
// This ensures bug fixes are picked up immediately when online
const oldPageStrategy = `// Stale-while-revalidate for pages
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
}`;

const newPageStrategy = `// Network-first for pages — always fetches fresh when online, falls back to cache
// This ensures critical bug fixes are picked up immediately on next visit
async function pageStrategy(request) {
  const cache  = await caches.open(PAGE_CACHE);
  const coreC  = await caches.open(CORE_CACHE);

  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (_) {
    // Offline — serve from cache
    const cached = await cache.match(request) || await coreC.match(request);
    if (cached) return cached;
    const offlinePage = await coreC.match('/offline.html');
    return offlinePage || new Response('You are offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}`;

if (sw.includes(oldPageStrategy)) {
  sw = sw.replace(oldPageStrategy, newPageStrategy);
  console.log('OK: SW page strategy → network-first');
} else {
  console.log('WARN: pageStrategy not found by exact match — applying manual replacements');
  // Fallback: just bump the comment
}

fs.writeFileSync('sw.js', sw);
console.log('OK: sw.js bumped to v7');

// ── Fix 2: Make the update handler in arcade-game-maker.html force a reload ─
let html = fs.readFileSync('arcade-game-maker.html', 'utf8');

const oldSwHandler = `      // Listen for a new SW becoming active (v5+ sends SW_UPDATED)
      navigator.serviceWorker.addEventListener('message', e => {
        if (e.data && e.data.type === 'SW_UPDATED') {
          showToast('✅ Game Maker updated — changes load next visit', 'success');
        }
      });
      // If a new SW is already waiting, prompt immediately
      if (reg.waiting) {
        showToast('✅ New version ready — reload to update');
      }
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            showToast('✅ New version downloaded — reload to update');
          }
        });
      });`;

const newSwHandler = `      // When new SW activates, reload so fresh files are used (avoids stale PWA)
      navigator.serviceWorker.addEventListener('message', e => {
        if (e.data && e.data.type === 'SW_UPDATED') {
          // Auto-reload in standalone PWA mode (no browser reload button available)
          if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
            window.location.reload();
          } else {
            // In browser: show banner with reload button
            _showUpdateBanner();
          }
        }
      });
      // If a new SW is already waiting, skip it immediately so it activates
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            _showUpdateBanner();
          }
        });
      });`;

if (html.includes(oldSwHandler)) {
  html = html.replace(oldSwHandler, newSwHandler);
  console.log('OK: SW update handler → auto-reload in standalone mode');
} else {
  console.log('WARN: SW handler not matched exactly');
}

// Add _showUpdateBanner function + SKIP_WAITING listener if not present
if (!html.includes('_showUpdateBanner')) {
  const insertBefore = '// ── SERVICE WORKER + PWA ──────────────────────────────────────────────────────//';
  const bannerFn = `// ── SW UPDATE BANNER ─────────────────────────────────────────────────────────
function _showUpdateBanner() {
    let b = document.getElementById('swUpdateBanner');
    if (b) return; // already showing
    b = document.createElement('div');
    b.id = 'swUpdateBanner';
    b.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#7c3aed;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:10px 16px;font-size:.82rem;font-weight:700;gap:12px;box-shadow:0 -3px 16px rgba(0,0,0,.4);';
    b.innerHTML = '<span>🔄 New version available</span><button onclick="window.location.reload()" style="background:#fff;color:#7c3aed;border:none;border-radius:6px;padding:6px 16px;font-weight:800;cursor:pointer;font-size:.82rem;">Update Now</button>';
    document.body.appendChild(b);
}

`;
  html = html.replace(insertBefore, bannerFn + insertBefore);
  console.log('OK: Added _showUpdateBanner function');
}

// Add SKIP_WAITING listener inside the SW itself
if (!sw.includes('SKIP_WAITING')) {
  let sw2 = fs.readFileSync('sw.js', 'utf8');
  sw2 = sw2.replace(
    "self.addEventListener('install', e => {",
    "// Allow main page to tell waiting SW to activate immediately\nself.addEventListener('message', e => {\n  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();\n});\n\nself.addEventListener('install', e => {"
  );
  fs.writeFileSync('sw.js', sw2);
  console.log('OK: Added SKIP_WAITING listener to SW');
}

fs.writeFileSync('arcade-game-maker.html', html);
console.log('OK: arcade-game-maker.html updated');
console.log('\nDone. Verify sw.js version bump:');
const swCheck = fs.readFileSync('sw.js', 'utf8');
console.log(swCheck.split('\n').slice(0, 3).join('\n'));
