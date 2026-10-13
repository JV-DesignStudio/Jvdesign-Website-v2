// CSP console-error guard for the Minecraft modding cheatsheet (A1501).
//
// workshops/minecraft-modding-cheatsheet.html logged a Content-Security-Policy
// console error at 390px (a stray character before the DOCTYPE pushed the meta
// CSP outside the head, so the policy was ignored). The stray character is
// gone. This pins zero console/page errors.
//
// Run: node tests/minecraft-cheatsheet-csp.js
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.xml': 'application/xml' };

const REL = 'workshops/minecraft-modding-cheatsheet.html';

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

let failures = 0;
const check = (name, ok, detail = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; };

(async () => {
  server.listen(0); await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message.split('\n')[0].slice(0, 140)));
    page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|ERR_ABORTED/i.test(m.text())) errors.push('console: ' + m.text().split('\n')[0].slice(0, 140)); });
    await page.setRequestInterception(true);
    page.on('request', r => { if (r.resourceType() === 'media') r.abort(); else r.continue(); });
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    await page.goto(base + '/' + REL, { waitUntil: 'load', timeout: 25000 });
    await new Promise(r => setTimeout(r, 600));
    const m = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
    check(`${REL} @ 390: zero console/page errors`, errors.length === 0, errors.length ? errors.slice(0, 3).join(' | ') : 'clean');
    check(`${REL} @ 390: no horizontal overflow`, m.overflow <= 1, `overflow=${m.overflow}`);
    await page.close();
  } finally {
    await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL MINECRAFT CHEATSHEET CSP CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
