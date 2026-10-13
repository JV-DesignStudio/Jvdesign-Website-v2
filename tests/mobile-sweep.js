// mobile-sweep.js , site-wide mobile audit (mass mobile pass, report-only).
//
// Loads every public HTML page at a phone viewport and emits a ranked offender
// list: missing viewport meta, horizontal overflow, blank / no-main pages,
// runtime errors, sub-40px tap targets and sub-12px body text.
//
// This is the scoreboard for the mobile pass. It does not fix anything.
//
// Usage:
//   node tests/mobile-sweep.js                 # 390x844, all pages
//   node tests/mobile-sweep.js --width 320     # smaller phone
//   node tests/mobile-sweep.js --limit 50      # quick sample
//   node tests/mobile-sweep.js --out report.json
//
// Exit code is always 0 (report-only) unless the harness itself errors.

const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.xml': 'application/xml',
  '.txt': 'text/plain', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.mp4': 'video/mp4' };

const args = process.argv.slice(2);
const getArg = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const WIDTH = parseInt(getArg('width', '390'), 10);
const HEIGHT = parseInt(getArg('height', '844'), 10);
const LIMIT = parseInt(getArg('limit', '0'), 10);
const OUT = getArg('out', '');
const CONCURRENCY = parseInt(getArg('concurrency', '6'), 10);

const ROOTS = ['tools', 'games', 'workshops', 'pages', 'books', 'learn'];
const SKIP_DIR = /^(node_modules|quest-board-deploy|generated-images|\.worktrees|\.git|partials|assets|generated-images)$/;

function discover() {
  const pages = [];
  for (const f of fs.readdirSync(ROOT)) {
    if (f.endsWith('.html')) pages.push(f);
  }
  for (const dir of ROOTS) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    (function walk(d) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.name.startsWith('.')) continue;
        const f = path.join(d, e.name);
        if (e.isDirectory()) { if (!SKIP_DIR.test(e.name)) walk(f); }
        else if (e.name.endsWith('.html')) pages.push(path.relative(ROOT, f).replace(/\\/g, '/'));
      }
    })(abs);
  }
  return pages.sort();
}

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

async function audit(browser, base, rel) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message.split('\n')[0].slice(0, 120)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR_|Failed to load resource|ERR_ABORTED/i.test(m.text())) errors.push(m.text().split('\n')[0].slice(0, 120)); });
  await page.setRequestInterception(true);
  page.on('request', r => { const t = r.resourceType(); if (t === 'media') r.abort(); else r.continue(); });
  await page.setViewport({ width: WIDTH, height: HEIGHT, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });

  const rec = { page: rel, overflow: 0, hasViewport: false, controls: 0, smallTargets: [], tinyText: 0, errors: [], chars: 0, ok: true };
  try {
    await page.goto(base + '/' + rel, { waitUntil: 'load', timeout: 25000 });
    await new Promise(r => setTimeout(r, 250));
    const m = await page.evaluate(() => {
      const doc = document.documentElement;
      const hasViewport = !!document.querySelector('meta[name="viewport"]');
      const main = document.querySelector('main') || document.body;
      const vis = el => { const r = el.getBoundingClientRect(), st = getComputedStyle(el);
        return r.width >= 1 && r.height >= 1 && st.display !== 'none' && st.visibility !== 'hidden' && st.pointerEvents !== 'none'; };
      let controls = 0; const small = [];
      for (const el of main.querySelectorAll('a,button,[role="button"],input,select,textarea,[tabindex]')) {
        if (!vis(el)) continue; controls++;
        const r = el.getBoundingClientRect();
        // offsetWidth/Height give the real layout size; getBoundingClientRect is
        // distorted by ancestor CSS 3D transforms (e.g. the marble-run board).
        const w = el.offsetWidth || r.width, h = el.offsetHeight || r.height;
        const min = Math.min(w, h);
        const isBtn = el.matches('button,.btn,[role="button"],input[type="submit"],select');
        if (isBtn && min < 40) {
          const label = (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 22) || el.tagName;
          small.push(label);
        }
      }
      let tiny = 0, scanned = 0;
      for (const el of main.querySelectorAll('p,span,li,small,label,td,th,figcaption,div')) {
        if (scanned++ > 2500) break;
        let hasText = false;
        for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim().length > 1) { hasText = true; break; }
        if (!hasText || !vis(el)) continue;
        if (parseFloat(getComputedStyle(el).fontSize) < 12) tiny++;
      }
      return { overflow: doc.scrollWidth - doc.clientWidth, hasViewport, controls, small, tiny, chars: main.textContent.trim().length };
    });
    rec.overflow = m.overflow; rec.hasViewport = m.hasViewport; rec.controls = m.controls;
    rec.smallTargets = m.small.slice(0, 6); rec.smallCount = m.small.length; rec.tinyText = m.tiny; rec.chars = m.chars;
  } catch (e) {
    rec.ok = false; rec.loadError = e.message.split('\n')[0].slice(0, 120);
  }
  rec.errors = errors.slice(0, 4);
  await page.close();
  return rec;
}

(async () => {
  server.listen(0); await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  let pages = discover();
  if (LIMIT) pages = pages.slice(0, LIMIT);
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < pages.length) {
      const rel = pages[idx++];
      const rec = await audit(browser, base, rel);
      results.push(rec);
      if (results.length % 25 === 0) process.stderr.write(`  ... ${results.length}/${pages.length}\n`);
    }
  }
  try {
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  } finally { await browser.close().catch(() => {}); await new Promise(r => server.close(r)); }

  const isCritical = r => !r.ok || !r.hasViewport || r.overflow > 2 || r.errors.length > 0 || (r.controls === 0 && r.chars < 80);
  const crit = results.filter(isCritical);
  const warn = results.filter(r => !isCritical(r) && (r.smallCount > 0 || r.tinyText > 0));

  const reasons = r => {
    const out = [];
    if (!r.ok) out.push('LOAD_ERROR ' + (r.loadError || ''));
    if (!r.hasViewport) out.push('no-viewport');
    if (r.overflow > 2) out.push('overflow ' + r.overflow + 'px');
    if (r.errors.length) out.push(r.errors.length + ' err');
    if (r.controls === 0 && r.chars < 80) out.push('blank/no-main');
    return out.join('; ');
  };

  console.log('\n=== MOBILE SWEEP ' + WIDTH + 'x' + HEIGHT + ' , ' + results.length + ' pages ===');
  console.log('CRITICAL: ' + crit.length + '   WARN (targets/text): ' + warn.length + '   clean: ' + (results.length - crit.length - warn.length));
  console.log('\n--- CRITICAL (ranked) ---');
  crit.sort((a, b) => (b.overflow - a.overflow) || (a.page < b.page ? -1 : 1));
  crit.forEach(r => console.log(`${r.page.padEnd(46)} ${reasons(r)}`));
  console.log('\n--- WARN: undersized tap targets / tiny text (ranked) ---');
  warn.sort((a, b) => (b.smallCount + b.tinyText) - (a.smallCount + a.tinyText));
  warn.slice(0, 80).forEach(r => console.log(`${r.page.padEnd(46)} small=${String(r.smallCount).padStart(3)} tinyText=${String(r.tinyText).padStart(4)}  ${(r.smallTargets || []).slice(0, 4).join(', ')}`));

  if (OUT) {
    fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify({ width: WIDTH, height: HEIGHT, generated: new Date().toISOString(), total: results.length, critical: crit.length, warn: warn.length, results }, null, 2));
    console.log('\nFull JSON written to ' + OUT);
  }
  console.log('\nreport-only: no files changed');
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
