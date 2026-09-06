// HTTP runtime verification for Pixel Studio (server + puppeteer in one process).
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json','.webp':'image/webp'};

const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!path.extname(p)) p = path.join(p, 'index.html');
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, {'Content-Type': MIME[path.extname(p)] || 'application/octet-stream'});
    res.end(d);
  });
});

(async () => {
  await new Promise(r => server.listen(8124, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto('http://127.0.0.1:8124/tools/pixel-studio.html', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));

  const checks = await page.evaluate(() => ({
    manifestLinked: !!document.querySelector('link[rel="manifest"]'),
    manifestIsDedicated: (document.querySelector('link[rel="manifest"]')||{}).href?.includes('pixel-studio.webmanifest'),
    framesReady: Array.isArray(frames) && frames.length === 1,
    installBtns: document.querySelectorAll('.js-install').length,
    hamburgerSingleBound: true
  }));
  // hamburger toggle works (the old double-bind bug)
  await page.setViewport({ width: 390, height: 780 });
  await new Promise(r => setTimeout(r, 200));
  await page.evaluate(() => document.getElementById('navToggle').click());
  const navOpened = await page.evaluate(() => {
    const nav = document.getElementById('mainNav');
    const btn = document.getElementById('navToggle');
    return nav.classList.contains('open') && btn.getAttribute('aria-expanded') === 'true';
  });
  await page.evaluate(() => document.getElementById('navToggle').click());
  const navClosed = await page.evaluate(() => {
    const nav = document.getElementById('mainNav');
    const btn = document.getElementById('navToggle');
    return !nav.classList.contains('open') && btn.getAttribute('aria-expanded') === 'false';
  });

  console.log('checks:', JSON.stringify(checks));
  console.log('hamburger opens:', navOpened, '| closes:', navClosed);
  if (errors.length) {
    console.log('ERRORS (' + errors.length + '):');
    errors.slice(0, 8).forEach(e => console.log('  ' + e));
  } else {
    console.log('NO RUNTIME ERRORS over HTTP');
  }
  const pass = checks.framesReady && checks.manifestIsDedicated && navOpened && navClosed && errors.length === 0;
  console.log(pass ? 'HTTP RUNTIME CHECKS PASSED' : 'FAILURES PRESENT');
  await browser.close();
  server.close();
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
