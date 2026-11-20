// tests/workshop-step-images.js - A3103
// Every covered build step keeps its expected-result image, the engine shows it,
// and it stays lazy and inside the viewport at 390 and 1440.
// Run: node tests/workshop-step-images.js
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond || !extra ? '' : ' :: ' + extra));
  if (!cond) failures++;
};

let out = '';
let checkOk = false;
try {
  out = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'capture-workshop-steps.js'), '--check'], {
    cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
  });
  checkOk = true;
} catch (e) {
  out = String(e.stdout || '') + String(e.stderr || '');
}
ok('step-image manifest is complete', checkOk, out.trim().split('\n').slice(-3).join(' | '));

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'workshop-step-images.json'), 'utf8'));
const series = manifest.series || {};
ok('manifest covers the flagship series', !!series['js-flappy-workshop'] && Object.keys(series['js-flappy-workshop']).length === 6);

const engine = fs.readFileSync(path.join(ROOT, 'workshop-canvas-engine.js'), 'utf8');
ok('engine loads the step-image manifest', /loadStepImages/.test(engine) && /workshop-step-images\.json/.test(engine));
ok('engine renders a lazy expected-result image', /cw-expect-img/.test(engine) && /loading = 'lazy'/.test(engine));

const css = fs.readFileSync(path.join(ROOT, 'workshop-canvas.css'), 'utf8');
ok('expected-result image is responsive', /\.cw-expect-img img\{[^}]*width:100%/.test(css));

const countProblems = [];
for (const slug of Object.keys(series)) {
  const page = path.join(ROOT, 'workshops', slug + '.html');
  if (!fs.existsSync(page)) continue;
  const html = fs.readFileSync(page, 'utf8');
  const total = Number((html.match(/WORKSHOP_TOTAL\s*=\s*(\d+)/) || [])[1]);
  if (Number.isFinite(total) && total > 0 && Object.keys(series[slug]).length !== total) {
    countProblems.push(slug + ' has ' + Object.keys(series[slug]).length + ' images for ' + total + ' steps');
  }
}
ok('every covered step still has an image', countProblems.length === 0, countProblems.slice(0, 3).join('; '));

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon'
};
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.normalize(path.join(ROOT, url));
  if (!file.startsWith(path.normalize(ROOT))) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, body) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  });
});

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (r) => (r.url().startsWith(base) || /^data:|^blob:/.test(r.url()) ? r.continue() : r.abort()));
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(base + '/workshops/js-flappy-workshop.html', { waitUntil: 'load' });
    await page.waitForSelector('.cw-expect-img img', { timeout: 15000 });
    const figures = await page.$$eval('.cw-expect-img img', (imgs) => imgs.map((i) => ({ src: i.getAttribute('src'), lazy: i.getAttribute('loading') })));
    ok('all six step images render', figures.length === 6, 'found ' + figures.length);
    ok('step images use native lazy loading', figures.every((f) => f.lazy === 'lazy'));
    await page.evaluate(() => document.querySelector('.cw-expect-img img').scrollIntoView({ block: 'center' }));
    await page.waitForFunction(() => {
      const img = document.querySelector('.cw-expect-img img');
      return img && img.complete && img.naturalWidth > 0;
    }, { timeout: 8000 }).catch(() => {});
    const loaded = await page.evaluate(() => {
      const img = document.querySelector('.cw-expect-img img');
      return !!img && img.complete && img.naturalWidth > 0;
    });
    ok('expected-result image loads on screen', loaded);
    for (const width of [390, 1440]) {
      await page.setViewport({ width, height: 900 });
      await new Promise((r) => setTimeout(r, 150));
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      ok('no horizontal overflow at ' + width + 'px', scrollWidth <= width, 'scrollWidth ' + scrollWidth);
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) {
    console.log('\nFAIL workshop-step-images: ' + failures + ' check(s) failed');
    process.exit(1);
  }
  console.log('\nPASS workshop-step-images: every covered step shows a lazy expected-result image');
})().catch((e) => { console.error(e); process.exit(1); });
