#!/usr/bin/env node
/*
 * tests/first-create-funnel-local.js , A2618
 * Proves the privacy-safe first-creation funnel is local only:
 *   - on index.html the first-make CTA records home_first_make_opened
 *   - on Pixel Studio it records studio_opened, first_pixel_painted,
 *     first_save and first_export in that order
 *   - the counters survive a reload
 *   - no analytics request is made while consent is declined
 *   - /me.html?funnel=1 shows the local ledger
 * Run: node tests/first-create-funnel-local.js
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer');

const ROOT = process.env.JVDS_SITE || path.join(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.wav': 'audio/wav'
};
const ORDER = ['home_first_make_opened', 'studio_opened', 'first_pixel_painted', 'first_save', 'first_export'];

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = http.createServer((req, res) => {
  let rel = req.url.split('?')[0];
  try { rel = decodeURIComponent(rel); } catch (e) {}
  if (rel === '/') rel = '/index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('Not found');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

async function journey(browser, base, width) {
  const context = browser.createBrowserContext ? await browser.createBrowserContext() : await browser.createIncognitoBrowserContext();
  const page = await context.newPage();
  const analyticsRequests = [];
  await page.setViewport({ width, height: width < 700 ? 844 : 900, isMobile: width < 700, hasTouch: width < 700, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => {
    try { localStorage.setItem('jvds-cookie-consent', 'declined'); } catch (e) {}
  });
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (/google-analytics|googletagmanager|doubleclick/i.test(url)) { analyticsRequests.push(url); return req.abort(); }
    if (/^https?:/i.test(url) && !url.startsWith(base)) return req.abort();
    req.continue();
  });

  const label = width + 'px';
  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 40000 });
  await page.waitForSelector('#fmStart', { timeout: 20000 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 40000 }),
    page.evaluate(() => document.getElementById('fmStart').click())
  ]);
  await page.waitForSelector('#main-canvas', { timeout: 40000 });
  await page.waitForFunction(() => window.JVDSFunnel && typeof window.JVDSFunnel.localReport === 'function', { timeout: 20000 });

  // Paint: the same pointer event a finger produces on the drawing canvas.
  await page.evaluate(() => {
    const c = document.getElementById('main-canvas');
    c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', clientX: 8, clientY: 8 }));
  });
  await sleep(150);
  await page.evaluate(() => { const b = document.querySelector('[data-on="saveProject"]'); if (b) b.click(); });
  await sleep(150);
  await page.evaluate(() => { const b = document.querySelector('[data-on="exportPNG"]'); if (b) b.click(); });
  await sleep(250);

  const ledger = await page.evaluate(() => window.JVDSFunnel.localReport());
  check(label + ' records every step', ORDER.every((s) => ledger.counts[s] >= 1), JSON.stringify(ledger.counts));
  check(label + ' records the steps in order', ORDER.every((s, i) => ledger.order.indexOf(s) === i), ledger.order.join(' -> '));
  check(label + ' makes no analytics request before consent', analyticsRequests.length === 0, analyticsRequests.slice(0, 2).join(' | '));

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 40000 });
  await sleep(300);
  const after = await page.evaluate(() => window.JVDSFunnel.localReport());
  check(label + ' counters survive reload', ORDER.every((s) => after.counts[s] >= ledger.counts[s]), JSON.stringify(after.counts));

  // Dev-only view on My Studio.
  await page.goto(base + '/me.html?funnel=1', { waitUntil: 'domcontentloaded', timeout: 40000 });
  const panel = await page.waitForSelector('#jvds-funnel-debug', { timeout: 15000 }).then((el) => el).catch(() => null);
  const text = panel ? await page.evaluate(() => document.getElementById('jvds-funnel-debug').textContent) : '';
  check(label + ' shows the local ledger on me.html?funnel=1', !!panel && /first_save/.test(text) && /home_first_make_opened/.test(text), text.slice(0, 120));

  await context.close();
}

(async () => {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    for (const width of [390, 1440]) await journey(browser, base, width);
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) {
    console.log('\n' + failures + ' CHECK(S) FAILED');
    process.exit(1);
  }
  console.log('\nALL FIRST-CREATE FUNNEL CHECKS PASSED');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
