#!/usr/bin/env node
/* A625: responsive spot checks for the primary tools.
 * Loads each tool at 390 / 768 / 1440 and fails on horizontal overflow or
 * runtime errors, so mobile layout regressions are caught in CI. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.TR_PORT || 8195);
const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.avif':'image/avif','.webmanifest':'application/manifest+json'};

const TOOLS = [
  'pixel-studio.html', 'sprite-animator.html', 'level-designer.html',
  'particle-designer.html', 'bitmap-font-maker.html', 'icon-generator.html',
  'game-logo-maker.html', 'screenshot-generator.html', 'colour-palette.html',
  'code-snippet-generator.html', 'story-editor.html', 'trading-card-designer.html'
];
const WIDTHS = [390, 768, 1440];

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
  try {
    for (const tool of TOOLS) {
      for (const width of WIDTHS) {
        const page = await browser.newPage();
        const errs = [];
        page.on('pageerror', e => errs.push(e.message));
        await page.setViewport({ width, height: 800, isMobile: width < 700 });
        try {
          await page.goto(`http://127.0.0.1:${PORT}/tools/${tool}`, { waitUntil: 'networkidle2', timeout: 20000 });
          await new Promise(r => setTimeout(r, 400));
        } catch (e) { errs.push('goto: ' + e.message); }
        const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth })).catch(() => ({ sw: -1, iw: width }));
        const overflow = m.sw - m.iw;
        if (overflow > 1 || errs.length) failures.push(`${tool} @${width}: overflow +${overflow}px ${errs.slice(0, 1).join(' | ')}`);
        await page.close();
      }
    }
  } finally { await browser.close(); server.close(); }

  if (failures.length) { failures.forEach(f => console.log('  [FAIL] ' + f)); process.exitCode = 1; }
  else console.log(`  [PASS] tools responsive: ${TOOLS.length} tools clean at ${WIDTHS.join('/')} (no overflow, no errors)`);
})().catch(e => { console.error('harness error', e); process.exit(1); });
