// First-creation funnel: fires start/complete/share once per session per surface,
// is consent-gated via dataLayer, and loads on tools + workshops pages.
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!path.extname(p)) p = path.join(p, 'index.html');
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(d);
  });
});

const CONSENT = () => {
  try { localStorage.clear(); } catch (e) {}
  try { localStorage.setItem('jvds-cookie-consent', 'accepted'); } catch (e) {}
  try { document.cookie = 'jvds-cookie-consent=accepted;path=/'; } catch (e) {}
};

const countEvents = (name) => {
  const dl = window.dataLayer || [];
  let n = 0, last = null;
  for (const a of dl) if (a && a[0] === 'event' && a[1] === name) { n++; last = a[2]; }
  return { n, last };
};

(async () => {
  await new Promise(r => server.listen(8139, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => { if (/jvds-funnel/.test(e.stack || e.message)) errors.push(e.message); });
  await page.evaluateOnNewDocument(CONSENT);
  await page.setViewport({ width: 390, height: 900 });
  await page.goto('http://127.0.0.1:8139/workshops/build-a-game-15-min.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 900));

  const present = await page.evaluate(() => !!(window.JVDSFunnel && typeof window.gtag === 'function'));

  await page.evaluate(() => {
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  });
  const start = await page.evaluate(countEvents, 'first_create_start');

  await page.evaluate(() => {
    const a = document.createElement('a');
    a.download = 'thing.png';
    a.href = 'data:image/png;base64,iVBORw0KGgo=';
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
  const complete = await page.evaluate(countEvents, 'first_create_complete');

  await page.evaluate(() => { window.JVDSFunnel.share({ surface: 'workshops' }); });
  const share = await page.evaluate(countEvents, 'first_create_share');

  await page.evaluate(() => { window.JVDSFunnel.complete({ surface: 'workshops' }); });
  const completeAgain = await page.evaluate(countEvents, 'first_create_complete');

  // Tool page: the module must load there too.
  const toolPage = await browser.newPage();
  await toolPage.evaluateOnNewDocument(CONSENT);
  await toolPage.goto('http://127.0.0.1:8139/tools/pixel-studio.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 900));
  const toolPresent = await toolPage.evaluate(() => !!window.JVDSFunnel);
  await toolPage.close();

  const checks = {
    present,
    startFired: start.n === 1,
    startSurface: start.last && start.last.surface === 'workshops',
    completeFired: complete.n === 1,
    shareFired: share.n === 1,
    oncePerSession: completeAgain.n === 1,
    toolPresent,
    noErrors: errors.length === 0
  };
  const pass = Object.values(checks).every(Boolean);
  console.log('checks:', JSON.stringify(checks));
  console.log(pass ? 'FIRST CREATE FUNNEL SMOKE PASSED' : 'FAILURES PRESENT');

  await browser.close();
  server.close();
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
