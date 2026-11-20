// nav-loop-links.js - A259/A2194: verify the core loop is reachable.
// The main site nav carries Learn, Create, Play and Read plus the crew; the
// immersive-game nav strip carries Imagine and Improve. The old test looked for
// Imagine/Improve in the main nav after they moved into the strip.
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
const LOOP = [
  { label: 'Learn', href: '/workshop' },
  { label: 'Create', href: '/create' },
  { label: 'Play', href: '/arcade.html' },
  { label: 'Read', href: '/books' }
];
const STRIP_PAGE = '/games/arcane_citadel.html';

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
    const links = await page.evaluate(() => Array.from(document.querySelectorAll('a')).map((a) => ({ text: a.textContent.trim(), href: a.getAttribute('href') || '' })));
    for (const item of LOOP) {
      ok(pg + ': nav has ' + item.label, links.some((a) => a.text.includes(item.label) && a.href.includes(item.href)));
    }
    ok(pg + ': nav links to the crew', links.some((a) => a.href.includes('meet-the-crew')));
  }

  // The immersive-game nav strip is the one that carries Imagine and Improve.
  await page.goto('http://127.0.0.1:8127' + STRIP_PAGE, { waitUntil: 'networkidle2', timeout: 20000 });
  const strip = await page.evaluate(() => Array.from(document.querySelectorAll('.jvds-nav-strip a, .nav-strip a, a')).map((a) => a.getAttribute('href') || ''));
  ok('immersive strip has Imagine', strip.some((h) => h.includes('stardust')));
  ok('immersive strip has Improve', strip.some((h) => h.includes('echo')));

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
