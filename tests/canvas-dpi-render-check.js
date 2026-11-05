#!/usr/bin/env node
// tests/canvas-dpi-render-check.js (A2532): Rustfall used a fixed 480x672 backing
// store and let the browser upscale it, which looks soft on 2x screens. Proves the
// canvas now sizes its backing store from the CSS box and device pixel ratio while
// keeping the same logical drawing space, at 1080p and simulated 4K/2x.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19256;
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(root, url));
  if (!file.startsWith(path.normalize(root))) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
  if (!ok) failures++;
}

const readCanvas = () => {
  const c = document.getElementById('game');
  if (!c) return null;
  const ctx = c.getContext('2d');
  const t = ctx && ctx.getTransform ? ctx.getTransform().a : 0;
  return {
    width: c.width,
    height: c.height,
    transform: t,
    logicalW: t ? c.width / t : 0,
    logicalH: t ? c.height / t : 0,
    cssW: parseFloat(getComputedStyle(c).width),
    cssH: parseFloat(getComputedStyle(c).height),
    inlineW: c.style.width,
    helper: typeof window.JVDS_DPR === 'function',
    helperScale: window.__jvdsCanvasScale || 0,
    overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth)
  };
};

(async () => {
  await new Promise(r => server.listen(port, r));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  try {
    const runs = {};
    for (const vp of [
      { name: '1080p-dpr1', w: 1920, h: 1080, dpr: 1 },
      { name: '4k-2x', w: 1920, h: 1080, dpr: 2 }
    ]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: vp.dpr });
      await page.goto('http://127.0.0.1:' + port + '/games/rustfall.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('#game', { timeout: 20000 });
      await new Promise(r => setTimeout(r, 1200));
      const r = await page.evaluate(readCanvas);
      if (!r) { check(vp.name + ': game canvas present', false); await page.close(); continue; }
      runs[vp.name] = r;

      check(vp.name + ': shared DPI helper loaded', r.helper);
      check(vp.name + ': canvas has a backing store', r.width > 0 && r.height > 0, r.width + 'x' + r.height);
      check(vp.name + ': transform matches the backing-store scale', Math.abs(r.transform - r.helperScale) < 0.01, 'transform=' + r.transform.toFixed(3) + ' helper=' + r.helperScale.toFixed(3));
      check(vp.name + ': logical canvas stays 480x672', Math.abs(r.logicalW - 480) < 1 && Math.abs(r.logicalH - 672) < 1, Math.round(r.logicalW) + 'x' + Math.round(r.logicalH));
      check(vp.name + ': aspect ratio preserved', Math.abs((r.width / r.height) - (480 / 672)) < 0.01, (r.width / r.height).toFixed(4));
      check(vp.name + ': backing store matches logical x scale', Math.abs(r.width - r.logicalW * r.transform) < 1.5, r.width + ' vs ' + (r.logicalW * r.transform).toFixed(1));
      check(vp.name + ': CSS size is still set by the layout', r.cssW > 0 && r.cssH > 0 && /px$/.test(r.inlineW), r.inlineW + ' computed=' + r.cssW.toFixed(1));
      check(vp.name + ': no horizontal overflow', r.overflow <= 2, String(r.overflow));
      check(vp.name + ': no runtime errors', errors.length === 0, errors.join(' | '));
      await page.close();
    }

    const one = runs['1080p-dpr1'];
    const two = runs['4k-2x'];
    check('1x: canvas is at least its logical resolution', !!one && one.transform >= 1, one ? one.transform.toFixed(3) : 'missing');
    check('2x: backing store grows with the device ratio', !!one && !!two && two.width > one.width, one && two ? one.width + ' -> ' + two.width : 'missing');
    check('2x: scale is higher than 1x', !!one && !!two && two.transform > one.transform, one && two ? one.transform.toFixed(3) + ' -> ' + two.transform.toFixed(3) : 'missing');
    check('2x: same logical drawing space as 1x', !!one && !!two && Math.abs(two.logicalW - 480) < 1 && Math.abs(two.logicalH - 672) < 1, two ? Math.round(two.logicalW) + 'x' + Math.round(two.logicalH) : 'missing');
    check('2x: backing store exceeds the CSS pixel box', !!two && two.width > two.cssW, two ? two.width + ' vs css ' + two.cssW.toFixed(0) : 'missing');
    check('2x: stays inside the fill-rate budget', !!two && two.width * two.height <= 1250000 * 1.02, two ? String(two.width * two.height) : 'missing');
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\nFAILED: ' + failures + ' check(s)'); process.exit(1); }
  console.log('\nCanvas DPI render: all checks passed');
})();
