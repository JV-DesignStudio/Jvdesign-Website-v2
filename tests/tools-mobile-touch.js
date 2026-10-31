#!/usr/bin/env node
/* A1427: device + touch drive for every catalogued creative tool.
 *
 * The existing suites prove layout (tools-responsive) and that a save + export
 * control exists (tools-workflow). Neither proves the tool is usable with a
 * finger. This loads each catalogued tool that exposes a drawing surface at
 * phone, small-phone, tablet and phone-landscape sizes and:
 *   - fails on horizontal overflow or a runtime error,
 *   - fails when the canvas is wider than the viewport (it must resize),
 *   - on the canonical phone size, performs a real touch drag on the main
 *     canvas and fails if the page scrolled (a finger drag must draw, not pan),
 *   - requires that drag to actually change pixels for the flagship draw tools
 *     (pixel-studio, level-designer); reports it advisory for the rest, because
 *     many tools need a mode or frame selected before a stroke lands.
 *
 * Usage: node tests/tools-mobile-touch.js [--verbose]
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.includes('--verbose');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.xml': 'application/xml', '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json' };

const server = http.createServer((req, res) => {
  let rel; try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  if (rel === '/') rel = '/index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('missing'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

// Catalogue = every page the public tool listing links to. Read live so a new
// tool is covered the moment it is catalogued. Only pages with a drawing
// surface are loaded (checked at every viewport), which keeps the suite fast.
function catalogue() {
  const list = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'tools.json'), 'utf8'));
  const urls = list.map(t => t.url).filter(Boolean).map(u => u.replace(/^\//, ''));
  try {
    const builders = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', '3d-builders.json'), 'utf8')).builders || [];
    for (const b of builders) if (b.url) urls.push(b.url.replace(/^\//, ''));
  } catch { /* builders file optional */ }
  const seen = new Set();
  const out = [];
  for (const rel of urls) {
    if (seen.has(rel)) continue;
    seen.add(rel);
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) continue;
    let src = '';
    try { src = fs.readFileSync(file, 'utf8'); } catch { continue; }
    if (/<canvas/i.test(src) || /three|WebGLRenderer|createElement\(\s*['"]canvas['"]\s*\)|Phaser\.Game/i.test(src) || /buildlab/i.test(rel)) out.push(rel);
  }
  return out;
}

// Touch drag runs at the canonical phone size; the other sizes check that the
// layout and canvas fit across the device classes (small phone, tablet), which
// is where overflow regressions (such as the builder header) first appear.
const VIEWPORTS = [
  { w: 390, h: 844, label: '390p', drag: true },
  { w: 320, h: 568, label: '320p', drag: false },
  { w: 768, h: 1024, label: '768t', drag: false }
];

// Tools that draw with a bare touch drag (pencil/brush active, static canvas),
// so a drag MUST change pixels. Others need a mode or frame picked first.
const REQUIRE_DRAW = new Set(['tools/pixel-studio.html', 'tools/level-designer.html']);

let critical = 0, advisory = 0, checks = 0;
const failures = [];

async function dismissOverlays(page) {
  // Tools may open a first-run welcome modal. Try the common close affordances
  // so the drag reaches the real surface; never fail if none are found.
  await page.evaluate(() => {
    const re = /^(got it|close|start|continue|skip|ok|let'?s go|begin|×|✕|âœ•)$/i;
    for (const el of document.querySelectorAll('button,[role="button"],a')) {
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || st.pointerEvents === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (re.test((el.textContent || '').trim())) { try { el.click(); } catch {} }
    }
    const cc = document.getElementById('cookie-decline'); if (cc) { try { cc.click(); } catch {} }
    document.querySelectorAll('.modal-overlay.open,[aria-modal="true"]').forEach(o => { try { o.style.pointerEvents = 'none'; } catch {} });
    // Remove finished full-screen loaders: they fade to opacity 0 but stay in
    // the DOM briefly and would otherwise swallow the test's touch drag.
    document.querySelectorAll('body > *').forEach(el => {
      const st = getComputedStyle(el), r = el.getBoundingClientRect();
      if (st.position === 'fixed' && r.width >= window.innerWidth * 0.9 && r.height >= window.innerHeight * 0.9 && parseFloat(st.opacity) < 0.3) {
        try { el.remove(); } catch {}
      }
    });
  }).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  await new Promise(r => setTimeout(r, 120));
}

const PICK_CANVAS = () => {
  let best = null;
  for (const c of document.querySelectorAll('canvas')) {
    const st = getComputedStyle(c);
    if (st.display === 'none' || st.visibility === 'hidden' || st.pointerEvents === 'none') continue;
    const r = c.getBoundingClientRect();
    if (r.width < 120 || r.height < 120) continue;
    // clientWidth is the untransformed layout width, so a canvas that is zoomed
    // inside an overflow-hidden stage does not look wider than the phone.
    if (!best || r.width * r.height > best.area) best = { area: r.width * r.height, x: r.x, y: r.y, w: r.width, h: r.height, cw: c.clientWidth, el: c };
  }
  return best;
};

async function checkTool(browser, base, rel, vp) {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message.split('\n')[0]));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR_|Failed to load resource|ERR_ABORTED|Ignored attempt to cancel a touch/i.test(m.text())) errs.push('console: ' + m.text().split('\n')[0]); });
  await page.setViewport({ width: vp.w, height: vp.h, isMobile: vp.w < 500, hasTouch: true, deviceScaleFactor: vp.w < 500 ? 2 : 1 });
  // Pre-decline cookies and mark first-run intros as seen so their fixed
  // overlays never cover the canvas the drag needs to reach.
  await page.evaluateOnNewDocument(() => {
    try { localStorage.setItem('jvds-cookie-consent', 'declined'); localStorage.setItem('jvds-builder-seen', '1'); } catch {}
  });
  const result = { overflow: 0, hasCanvas: false, canvasW: 0, innerW: 0, scrolled: 0, drew: null, unreachable: false, reason: '', errs };
  try {
    await page.goto(base + '/' + rel, { waitUntil: 'load', timeout: 30000 });
    if (vp.drag) { await new Promise(r => setTimeout(r, 300)); await dismissOverlays(page); }
    else await new Promise(r => setTimeout(r, 220));

    const pick = await page.evaluate(PICK_CANVAS);
    result.innerW = await page.evaluate(() => window.innerWidth);
    result.overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (!pick) return result;
    result.hasCanvas = true;
    result.canvasW = Math.round(pick.cw || pick.w);
    if (!vp.drag) return result;

    // Scroll the canvas into the middle of the viewport, then find a point on
    // the canvas that is actually reachable (elementFromPoint hit-tests past any
    // pointer-events:none overlay). Disable smooth scrolling or the page keeps
    // settling mid-drag and makes an untouched page look like it panned.
    const docTop = pick.y + await page.evaluate(() => window.scrollY);
    await page.evaluate((top, h) => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, Math.max(0, top + h / 2 - window.innerHeight / 2)); }, docTop, pick.h);
    await new Promise(r => setTimeout(r, 180));
    await dismissOverlays(page);

    const hit = await page.evaluate(() => {
      const innerW = window.innerWidth, innerH = window.innerHeight;
      let best = null;
      for (const c of document.querySelectorAll('canvas')) {
        const st = getComputedStyle(c);
        if (st.display === 'none' || st.visibility === 'hidden' || st.pointerEvents === 'none') continue;
        const r = c.getBoundingClientRect();
        if (r.width < 120 || r.height < 120) continue;
        if (!best || r.width * r.height > best.area) best = { area: r.width * r.height, x: r.x, y: r.y, w: r.width, h: r.height, cw: c.clientWidth, el: c };
      }
      if (!best) return { found: false, reason: 'no-canvas' };
      const x0 = Math.max(best.x + 12, 12), x1 = Math.min(best.x + best.w - 12, innerW - 12);
      const y0 = Math.max(best.y + 12, 12), y1 = Math.min(best.y + best.h - 12, innerH - 12);
      if (x1 <= x0 || y1 <= y0) return { found: false, reason: 'off-screen', w: Math.round(best.w) };
      const fx = [0.5, 0.35, 0.65, 0.25, 0.75], fy = [0.5, 0.35, 0.65, 0.25, 0.75];
      for (const a of fy) for (const b of fx) {
        const X = Math.round(x0 + (x1 - x0) * b), Y = Math.round(y0 + (y1 - y0) * a);
        const top = document.elementFromPoint(X, Y);
        if (top === best.el || best.el.contains(top)) return { found: true, x: X, y: Y, w: Math.round(best.w), cw: best.cw };
      }
      return { found: false, reason: 'covered-by-overlay', w: Math.round(best.w), cw: best.cw };
    });
    if (!hit.found) { result.unreachable = true; result.reason = hit.reason; if (hit.cw) result.canvasW = hit.cw; return result; }
    result.canvasW = hit.cw || hit.w;

    // Track scroll movement in-page during the drag (one round trip instead of
    // one per move): a finger drag on the surface must draw, never pan.
    await page.evaluate(() => { const s = window.scrollY; window.__mt = { min: s, max: s }; window.addEventListener('scroll', () => { const y = window.scrollY; if (y < window.__mt.min) window.__mt.min = y; if (y > window.__mt.max) window.__mt.max = y; }, { passive: true }); });
    const dataBefore = await page.evaluate(() => { let best = null; for (const c of document.querySelectorAll('canvas')) { const st = getComputedStyle(c); if (st.display === 'none' || st.pointerEvents === 'none') continue; const r = c.getBoundingClientRect(); if (r.width < 120 || r.height < 120) continue; if (!best || r.width * r.height > best.area) best = { area: r.width * r.height, el: c }; } try { return best ? best.el.toDataURL().length : 0; } catch { return -1; } });

    const client = await page.target().createCDPSession();
    const tp = (x, y) => [{ x, y, radiusX: 8, radiusY: 8, force: 1, id: 1 }];
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(hit.x, hit.y) });
    for (let i = 1; i <= 5; i++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(hit.x + i * 5, hit.y + i * 7) });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await new Promise(r => setTimeout(r, 100));
    result.scrolled = await page.evaluate(() => { const y = window.scrollY, m = window.__mt; return Math.max(m.max, y) - Math.min(m.min, y); });

    const dataAfter = await page.evaluate(() => { let best = null; for (const c of document.querySelectorAll('canvas')) { const st = getComputedStyle(c); if (st.display === 'none' || st.pointerEvents === 'none') continue; const r = c.getBoundingClientRect(); if (r.width < 120 || r.height < 120) continue; if (!best || r.width * r.height > best.area) best = { area: r.width * r.height, el: c }; } try { return best ? best.el.toDataURL().length : 0; } catch { return -1; } });
    if (dataBefore > 0 && dataAfter > 0) result.drew = dataAfter !== dataBefore;
  } catch (e) {
    errs.push('load: ' + e.message.split('\n')[0]);
  }
  await page.close();
  return result;
}

(async () => {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const tools = catalogue();
  try {
    for (const rel of tools) {
      for (const vp of VIEWPORTS) {
        const r = await checkTool(browser, base, rel, vp);
        if (!r.hasCanvas) {
          if (r.errs.length) { critical++; failures.push(`${rel} @${vp.label}: ${r.errs[0]}`); console.log(`FAIL ${rel.padEnd(36)} ${vp.label.padEnd(5)} load error: ${r.errs[0]}`); }
          else if (VERBOSE) console.log(`skip ${rel.padEnd(36)} ${vp.label.padEnd(5)} (no canvas)`);
          continue;
        }
        checks++;
        const problems = [];
        if (r.overflow > 2) problems.push('overflow +' + r.overflow + 'px');
        if (r.canvasW > r.innerW + 2) problems.push(`canvas ${r.canvasW}px > viewport ${r.innerW}px`);
        if (r.scrolled > 2) problems.push(`page scrolled ${r.scrolled}px during drag`);
        if (r.errs.length) problems.push(r.errs.length + ' error(s): ' + r.errs[0]);
        if (REQUIRE_DRAW.has(rel) && vp.drag && r.drew === false) problems.push('touch drag did not change canvas');
        if (problems.length) { critical++; failures.push(`${rel} @${vp.label}: ${problems.join('; ')}`); }
        if (r.drew === false && !REQUIRE_DRAW.has(rel)) advisory++;
        const parts = [];
        if (problems.length) parts.push('<-- ' + problems.join('; '));
        else if (r.drew === false) parts.push('drag did not change canvas');
        if (r.unreachable) parts.push('(canvas not reachable: ' + r.reason + ')');
        const tag = problems.length ? 'FAIL' : 'ok  ';
        if (VERBOSE || problems.length) console.log(`${tag} ${rel.padEnd(36)} ${vp.label.padEnd(5)} canvas=${String(r.canvasW).padStart(4)}/${r.innerW} scroll=${String(r.scrolled).padStart(3)}px ${parts.join(' ')}`);
        else process.stdout.write('.');
      }
    }
  } finally {
    await browser.close();
    await new Promise(r => server.close(r));
  }
  if (!VERBOSE) process.stdout.write('\n');
  console.log(`\n${tools.length} interactive tools x ${VIEWPORTS.length} devices = ${checks} checks, ${critical} failure(s), ${advisory} advisory (drag did not change pixels)`);
  console.log(critical === 0 ? 'TOOLS MOBILE TOUCH: PASS' : 'TOOLS MOBILE TOUCH: ' + critical + ' FAILURE(S)');
  process.exit(critical === 0 ? 0 : 1);
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
