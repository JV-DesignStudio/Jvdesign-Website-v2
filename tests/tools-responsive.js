#!/usr/bin/env node
/* A625/A677: responsive checks for EVERY tool page.
 * Loads each tools/*.html at 390 / 1440 (add 768 with TR_WIDTHS=390,768,1440)
 * and fails on horizontal overflow or runtime errors, so mobile layout
 * regressions and CSS bloat are caught.
 *
 * Runs fast (single reused page, images/fonts blocked, domcontentloaded) so it
 * stays inside the review bot's per-test timeout. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.TR_PORT || 8195);
const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.avif':'image/avif','.webmanifest':'application/manifest+json'};

// Every tool page on disk - no hand-maintained list to drift.
const TOOLS = fs.readdirSync(path.join(ROOT, 'tools')).filter(f => f.endsWith('.html')).sort();
const WIDTHS = (process.env.TR_WIDTHS ? process.env.TR_WIDTHS.split(',') : [390, 1440]).map(Number);

const server = http.createServer((req, res) => {
  let rel; try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  if (rel === '/') rel = '/index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const failures = [];
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', req => {
    const t = req.resourceType();
    if (t === 'image' || t === 'font' || t === 'media') return req.abort();
    req.continue();
  });
  try {
    for (const width of WIDTHS) {
      await page.setViewport({ width, height: 800, isMobile: width < 700 });
      for (const tool of TOOLS) {
        const errs = [];
        const onErr = e => errs.push(e.message);
        page.on('pageerror', onErr);
        try {
          await page.goto(`http://127.0.0.1:${PORT}/tools/${tool}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await new Promise(r => setTimeout(r, 200));
        } catch (e) { errs.push('goto: ' + e.message); }
        const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth })).catch(() => ({ sw: -1, iw: width }));
        page.off('pageerror', onErr);
        const overflow = m.sw - m.iw;
        if (overflow > 1 || errs.length) failures.push(`${tool} @${width}: overflow +${overflow}px ${errs.slice(0, 1).join(' | ')}`);
      }
    }
  } finally { await browser.close(); server.close(); }

  if (failures.length) { failures.forEach(f => console.log('  [FAIL] ' + f)); process.exitCode = 1; }
  else console.log(`  [PASS] tools responsive: ${TOOLS.length} tools clean at ${WIDTHS.join('/')} (no overflow, no errors)`);
})().catch(e => { console.error('harness error', e); process.exit(1); });
