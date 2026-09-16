// nav-loop-links.js - A259: verify Imagine and Improve links appear in nav
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.json':'application/json','.webmanifest':'application/manifest+json'};
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!path.extname(p)) p = path.join(p, 'index.html');
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, {'Content-Type': MIME[path.extname(p)] || 'application/octet-stream'});
    res.end(d);
  });
});

let failures = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) failures++; };

const CHECK_PAGES = [
  '/index.html',
  '/tools/pixel-studio.html',
  '/pages/echo.html',
  '/pages/stardust.html',
];

(async () => {
  await new Promise(r => server.listen(8127, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'], defaultViewport: null });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => {
    if (m.type() === 'error'
      && !m.text().includes("Content Security Policy directive 'media-src'")
      && !m.text().includes('Failed to load resource'))
      errors.push('console: ' + m.text());
  });

  for (const pg of CHECK_PAGES) {
    await page.goto('http://127.0.0.1:8127' + pg, { waitUntil: 'networkidle2', timeout: 20000 });
    const links = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('a'));
      return {
        imagineHref: (all.find(a => a.textContent.includes('Imagine')) || {}).href || '',
        improveHref: (all.find(a => a.textContent.includes('Improve')) || {}).href || '',
      };
    });
    ok(pg + ': Imagine link present', links.imagineHref.includes('stardust'));
    ok(pg + ': Improve link present', links.improveHref.includes('echo'));
  }

  // stardust.html and echo.html themselves render (200, h1 visible)
  for (const [pg, h1] of [['/pages/stardust.html','Stardust'],['/pages/echo.html','Echo']]) {
    await page.goto('http://127.0.0.1:8127' + pg, { waitUntil: 'networkidle2', timeout: 20000 });
    const heading = await page.evaluate(() => (document.querySelector('main h1') || {}).textContent || '');
    ok(pg + ': page h1 renders', heading.includes(h1.split('-')[0].trim()));
  }

  if (errors.length) {
    console.log('\nRUNTIME ERRORS:');
    errors.slice(0, 8).forEach(e => console.log('  ' + e));
  } else {
    console.log('\nNo runtime errors.');
  }
  const allPass = failures === 0 && errors.length === 0;
  console.log(allPass ? '\nALL NAV-LOOP CHECKS PASSED' : '\n' + failures + ' FAILURES, ' + errors.length + ' errors');
  await browser.close();
  server.close();
  process.exit(allPass ? 0 : 1);
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
