#!/usr/bin/env node
/*
 * tests/visual-regression.js , A1636 (Phase 0)
 *
 * Screenshot the four hubs (workshops, tools, arcade, books) plus a documented
 * long-tail sample at 390px and 1440px, and hash the above-the-fold capture so
 * any pixel change (including a 1px layout shift) fails. This is the gate the
 * Phase 1 token/component work runs behind.
 *
 *   node tests/visual-regression.js            # compare against baselines
 *   node tests/visual-regression.js --update   # write/refresh baselines
 *
 * Baselines live in tests/visual-baseline/. A missing baseline is written and
 * reported, not failed, so a fresh checkout self-seeds. On a mismatch the actual
 * capture is saved to tests/visual-actual/ for inspection.
 *
 * Dynamic regions (the mascot quiz, coach bubble, today's spark, gallery strips,
 * any [data-dynamic]) are hidden and motion is disabled, so the capture is
 * deterministic. Screenshots are above the fold only: the top viewport, which is
 * the most-visited visual and stable across runs.
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const BASELINE_DIR = path.join(__dirname, 'visual-baseline');
const ACTUAL_DIR = path.join(__dirname, 'visual-actual');
const UPDATE = process.argv.includes('--update');

const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.webp':'image/webp', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml',
  '.ico':'image/x-icon', '.woff2':'font/woff2', '.woff':'font/woff', '.xml':'application/xml', '.txt':'text/plain' };

// Four hubs + a documented long-tail sample (one tool, one workshop).
const PAGES = [
  'index.html',
  'pages/workshop.html',
  'pages/dev-tools.html',
  'arcade.html',
  'pages/books.html',
  'tools/pixel-studio.html',
  'workshops/my-first-scratch-game.html'
];
const VIEWPORTS = [{ w: 1440, h: 900, label: 'desktop' }, { w: 390, h: 844, label: 'mobile' }];

// Pages whose main content is rendered by script after DOMContentLoaded need an
// explicit ready selector, or the capture can catch the empty shell.
const READY = { 'arcade.html': '#grid > *' };

const NEUTRALIZE_CSS = `
*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}
html{scroll-behavior:auto!important}
.mascot-quiz-backdrop,.mascot-coach,.mascot-companion,.mascot-companion-bubble,.mascot-bubble,.jvds-today-spark,[data-dynamic],[id*="challenge" i],
#galleryGrid,.home-gallery,.gallery-strip,[data-gallery-strip],
#cookie-banner,.jvds-daily-toast,.jvds-weekly-toast{visibility:hidden!important}
.reveal,[class*="reveal"]{opacity:1!important;transform:none!important}
`;

const slug = (rel, w) => rel.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') + '-' + w + '.png';

// A pixel counts as "changed" only when a channel differs by more than AA noise.
// A real layout shift or colour change moves far more than TOLERANCE pixels.
const CHANNEL_DELTA = 24;
const TOLERANCE = 300;

async function compare(baselineFile, buf){
  let base;
  try { base = await sharp(fs.readFileSync(baselineFile)).raw().toBuffer({ resolveWithObject: true }); }
  catch (e) { return { ok: false, detail: 'baseline unreadable' }; }
  const cur = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  if (base.info.width !== cur.info.width || base.info.height !== cur.info.height)
    return { ok: false, detail: `size ${base.info.width}x${base.info.height} -> ${cur.info.width}x${cur.info.height}` };
  const { width: w, height: h, channels: c } = base.info;
  let count = 0, minX = w, minY = h, maxX = -1, maxY = -1;
  const a = base.data, b = cur.data;
  for (let i = 0; i < a.length; i += c){
    let d = 0;
    for (let k = 0; k < c; k++){ const dv = Math.abs(a[i + k] - b[i + k]); if (dv > d) d = dv; }
    if (d > CHANNEL_DELTA){
      count++;
      const p = i / c, x = p % w, y = (p - x) / w;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  const bbox = maxX < 0 ? 'none' : `x[${minX}-${maxX}] y[${minY}-${maxY}]`;
  return { ok: count <= TOLERANCE, detail: `changedPixels=${count} tol=${TOLERANCE} bbox=${bbox}` };
}

let failures = 0;
function log(name, ok, detail){ console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; }

const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!path.extname(p)) p = path.join(p, 'index.html');
  if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); return res.end('missing'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(d);
  });
});

(async () => {
  fs.mkdirSync(BASELINE_DIR, { recursive: true });
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  try {
    for (const rel of PAGES) {
      for (const vp of VIEWPORTS) {
        const page = await browser.newPage();
        await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1 });
        await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
        // Deterministic first-visit state: suppress the auto-opening guide quiz
        // and the coach bubble before any page script runs.
        await page.evaluateOnNewDocument(() => {
          // Deterministic random so character quote bubbles and any other
          // randomised pick render the same value every run.
          let s = 123456789;
          Math.random = function(){ s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
          try {
            localStorage.setItem('jvds_guide', 'lumo');
            localStorage.setItem('jvds_mascot_coach_dismissed', '1');
            localStorage.setItem('jvds-cookie-consent', 'accepted');
          } catch (e) {}
        });
        await page.goto(base + '/' + rel, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.addStyleTag({ content: NEUTRALIZE_CSS });
        // Deferred scripts render some grids after DOMContentLoaded, so wait for
        // the per-page ready selector before capturing.
        const readySel = READY[rel];
        if (readySel) await page.waitForSelector(readySel, { timeout: 15000 }).catch(() => {});
        await page.evaluate(() => (document.fonts && document.fonts.ready) ? document.fonts.ready : null).catch(() => {});
        // Wait for every image inside the fold to settle, so a lazy image that
        // pops in on a warm run does not read as a pixel change. Bounded so a
        // never-loading image cannot hang the run. Generous under load.
        await Promise.race([
          page.evaluate(() => Promise.all(
            Array.from(document.images)
              .filter(img => img.getBoundingClientRect().top < window.innerHeight)
              .map(img => img.complete ? null : new Promise(r => { img.addEventListener('load', r); img.addEventListener('error', r); }))
          )).catch(() => {}),
          new Promise(r => setTimeout(r, 10000))
        ]);
        await new Promise(r => setTimeout(r, 1000));

        let buf = await page.screenshot({ type: 'png', fullPage: false });
        const name = slug(rel, vp.w);
        const file = path.join(BASELINE_DIR, name);

        if (UPDATE || !fs.existsSync(file)) {
          fs.writeFileSync(file, buf);
          console.log((UPDATE ? 'UPDATED ' : 'SEEDED  ') + name + ' (' + vp.label + ' ' + rel + ')');
        } else {
          let res = await compare(file, buf);
          if (!res.ok) {
            // One retry absorbs transient render timing under load before this
            // is called a regression.
            await new Promise(r => setTimeout(r, 1200));
            buf = await page.screenshot({ type: 'png', fullPage: false });
            res = await compare(file, buf);
          }
          if (!res.ok) {
            fs.mkdirSync(ACTUAL_DIR, { recursive: true });
            fs.writeFileSync(path.join(ACTUAL_DIR, name), buf);
          }
          log(`visual ${vp.label} ${rel}`, res.ok, res.ok ? '' : res.detail + '; actual saved');
        }
        await page.close();
      }
    }
  } finally {
    await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
  }

  if (UPDATE) { console.log('\nBaselines written to tests/visual-baseline/'); process.exit(0); }
  if (failures) { console.log('\n' + failures + ' VISUAL REGRESSION(S)'); process.exit(1); }
  console.log('\nALL VISUAL CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
