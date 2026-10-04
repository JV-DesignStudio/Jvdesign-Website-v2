// Creation share: a consistent Share action appears on creation tools at
// 390/1440, shares a make-your-own message with the tool link, and fires
// jvds:shared. Also checks the arcade maker's shared-output CTA points home.
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

const STUB = () => {
  window.__shared = null;
  window.__sharedEvent = false;
  try { window.addEventListener('jvds:shared', () => { window.__sharedEvent = true; }); } catch (e) {}
  try { navigator.share = function (d) { window.__shared = d; return Promise.resolve(); }; } catch (e) {}
};

async function checkTool(browser, url, width) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => { if (/creation-share/.test(e.stack || e.message)) errors.push(e.message); });
  await page.evaluateOnNewDocument(STUB);
  await page.setViewport({ width, height: 900 });
  await page.goto('http://127.0.0.1:8143' + url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 700));

  const visible = await page.evaluate(() => {
    const b = document.getElementById('jvds-share-btn');
    if (!b) return false;
    const r = b.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  let shared = null, event = false;
  if (visible) {
    await page.evaluate(() => document.getElementById('jvds-share-btn').click());
    await new Promise(r => setTimeout(r, 200));
    const s = await page.evaluate(() => window.__shared);
    shared = s;
    event = await page.evaluate(() => window.__sharedEvent);
  }
  await page.close();
  return { url, width, visible, event, errors: errors.length, text: shared && shared.text, url2: shared && shared.url };
}

(async () => {
  await new Promise(r => server.listen(8143, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  const tools = ['/tools/pixel-studio.html', '/tools/bitmap-font-maker.html', '/tools/level-designer.html'];
  const results = [];
  for (const url of tools) for (const width of [390, 1440]) results.push(await checkTool(browser, url, width));

  const control = await browser.newPage();
  await control.evaluateOnNewDocument(STUB);
  await control.goto('http://127.0.0.1:8143/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 400));
  const controlAbsent = await control.evaluate(() => !document.getElementById('jvds-share-btn'));
  await control.close();

  const arcade = fs.readFileSync(path.join(ROOT, 'tools/arcade-game-maker.html'), 'utf8');
  const arcadeCta =
    arcade.includes('jvdesignstudio.co.uk/tools/arcade-game-maker.html') &&
    /make your own/i.test(arcade) &&
    !arcade.includes('jvdesignstudio.com/arcade-game-maker');

  let pass = controlAbsent && arcadeCta;
  for (const r of results) {
    const ok = r.visible && r.event && r.errors === 0 &&
      r.text && /Make your own/i.test(r.text) && /jvdesignstudio\.co\.uk\/tools\//.test(r.text) &&
      r.url2 && /jvdesignstudio\.co\.uk\/tools\//.test(r.url2);
    if (!ok) pass = false;
    console.log(`${r.width}px ${r.url} -> ${ok ? 'PASS' : 'FAIL'} ${JSON.stringify(r)}`);
  }
  console.log('control (index.html hides share):', controlAbsent ? 'PASS' : 'FAIL');
  console.log('arcade shared-output CTA links home:', arcadeCta ? 'PASS' : 'FAIL');
  console.log(pass ? 'CREATION SHARE SMOKE PASSED' : 'FAILURES PRESENT');

  await browser.close();
  server.close();
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
