#!/usr/bin/env node
/*
 * tests/first-create-funnel-extra.js
 * A2806: the local first-creation ledger covers share, keep and return too.
 *   - jvds:shared records first_share
 *   - jvds:backpack-downloaded records first_keep
 *   - a second visit records return_visit
 *   - /me.html?funnel=1 shows the extended ledger
 *   - no analytics request is made while consent is declined
 * Run: node tests/first-create-funnel-extra.js
 */
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.FUNNELEXTRA_PORT || 8152;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' [' + detail + ']' : ''));
  if (!ok) failures++;
}

(async () => {
  const server = http.createServer((req, res) => {
    let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!path.extname(p)) p = path.join(p, 'index.html');
    fs.readFile(p, (e, d) => {
      if (e) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      res.end(d);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const analyticsRequests = [];
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.evaluateOnNewDocument(() => {
    try { localStorage.setItem('jvds-cookie-consent', 'declined'); } catch (e) {}
  });
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (/google-analytics|googletagmanager|doubleclick/i.test(url)) { analyticsRequests.push(url); return req.abort(); }
    req.continue();
  });
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  const ledger = () => page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('jvds_funnel_local') || '{}'); } catch (e) { return {}; }
  });

  try {
    await page.goto(`http://127.0.0.1:${PORT}/tools/pixel-studio.html`, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.evaluate(() => { try { localStorage.clear(); localStorage.setItem('jvds-cookie-consent', 'declined'); localStorage.setItem('jvds_pixel_seen', '1'); } catch (e) {} });
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 600));

    await page.evaluate(() => {
      setCanvasSize(8, 8, false);
      frames = [[new ImageData(8, 8)]];
      setPixel(getID(), 1, 1, 255, 0, 0, 255);
      renderAll();
      window.dispatchEvent(new CustomEvent('jvds:shared'));
      window.dispatchEvent(new CustomEvent('jvds:backpack-downloaded'));
    });
    await new Promise(r => setTimeout(r, 200));
    const afterEvents = await ledger();
    check('jvds:shared records first_share', (afterEvents.counts || {}).first_share >= 1, JSON.stringify(afterEvents.counts || {}));
    check('jvds:backpack-downloaded records first_keep', (afterEvents.counts || {}).first_keep >= 1, JSON.stringify(afterEvents.counts || {}));
    check('the ledger keeps an order', Array.isArray(afterEvents.order) && afterEvents.order.indexOf('first_share') !== -1, JSON.stringify(afterEvents.order || []));

    // A new day is a return (not just the next page in the same session).
    await page.evaluate(() => { try { localStorage.setItem('jvds_funnel_last_day', '2000-01-01'); } catch (e) {} });
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 400));
    const afterReturn = await ledger();
    check('a second visit records return_visit', (afterReturn.counts || {}).return_visit >= 1, JSON.stringify(afterReturn.counts || {}));

    // The dev ledger lists the new steps.
    await page.goto(`http://127.0.0.1:${PORT}/me.html?funnel=1`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 500));
    const debug = await page.evaluate(() => {
      const el = document.getElementById('jvds-funnel-debug');
      return el ? el.textContent : '';
    });
    check('/me.html?funnel=1 lists share, keep and return', /first_share/.test(debug) && /first_keep/.test(debug) && /return_visit/.test(debug), debug);
    check('no analytics request while consent is declined', analyticsRequests.length === 0, analyticsRequests.slice(0, 2).join(' | '));
    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }

  console.log(failures ? 'FAILURES PRESENT (' + failures + ')' : 'ALL FIRST-CREATE FUNNEL EXTRA CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
