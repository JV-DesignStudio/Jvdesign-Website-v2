#!/usr/bin/env node
// tests/sw-version-prompt.js (A2329)
// Proves the service worker update flow:
//   1. no prompt on the first install,
//   2. a newer worker shows a non-blocking refresh prompt,
//   3. "Later" dismisses it,
//   4. "Refresh" reloads the page and clears the prompt,
//   5. the real sw.js versions its caches and retires the old ones.
// Run: node tests/sw-version-prompt.js
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
let revision = 1;

function fixtureWorker(rev) {
  return [
    "const CACHE='jvds-test-v" + rev + "';",
    "self.addEventListener('install', e => { e.waitUntil(self.skipWaiting()); });",
    "self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });",
    "self.addEventListener('fetch', () => {});"
  ].join('\n');
}

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failures++;
}

(async () => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/sw.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.setHeader('Cache-Control', 'no-store');
      return res.end(fixtureWorker(revision));
    }
    if (url.pathname === '/sw-register.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.setHeader('Cache-Control', 'no-store');
      return res.end(fs.readFileSync(path.join(ROOT, 'sw-register.js')));
    }
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'no-store');
    res.end('<!doctype html><html lang="en"><head><title>SW prompt test</title></head>' +
      '<body><p>Test page</p><script src="/sw-register.js"></script></body></html>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;

  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.evaluateOnNewDocument(() => {
      try {
        if (sessionStorage.getItem('sw-prompt-reload-test') === '1') {
          sessionStorage.removeItem('sw-prompt-reload-test');
          window.__swPromptReloaded = true;
        }
      } catch (e) {}
    });
    await page.goto(base, { waitUntil: 'load' });
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
      }
    });

    check('no prompt on the first install', await page.evaluate(() => !document.getElementById('jvds-update-banner')));

    revision = 2;
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg.update();
    });
    await page.waitForSelector('#jvds-update-banner', { timeout: 15000 });
    const banner = await page.evaluate(() => {
      const el = document.getElementById('jvds-update-banner');
      return el ? {
        text: el.textContent,
        role: el.getAttribute('role'),
        live: el.getAttribute('aria-live'),
        position: el.style.position,
        buttons: Array.from(el.querySelectorAll('button')).map((b) => b.textContent)
      } : null;
    });
    check('a newer worker shows the refresh prompt', !!banner && /newer version/i.test(banner.text), banner && banner.text);
    check('the prompt is non-blocking and announced', !!banner && banner.position === 'fixed' && banner.role === 'status' && banner.live === 'polite', banner && JSON.stringify(banner));
    check('the prompt offers Refresh and Later', !!banner && banner.buttons.includes('Refresh') && banner.buttons.includes('Later'), banner && banner.buttons.join(','));

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('#jvds-update-banner button'));
      const later = buttons.find((b) => /Later/.test(b.textContent));
      if (later) later.click();
    });
    check('Later dismisses the prompt', await page.evaluate(() => !document.getElementById('jvds-update-banner')));

    revision = 3;
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg.update();
    });
    await page.waitForSelector('#jvds-update-banner', { timeout: 15000 });
    await page.evaluate(() => {
      try { sessionStorage.setItem('sw-prompt-reload-test', '1'); } catch (e) {}
      const buttons = Array.from(document.querySelectorAll('#jvds-update-banner button'));
      const refresh = buttons.find((b) => /Refresh/.test(b.textContent));
      if (refresh) refresh.click();
    });
    await page.waitForFunction(() => window.__swPromptReloaded === true, { timeout: 15000 });
    check('Refresh reloads the page and clears the prompt', await page.evaluate(() => !document.getElementById('jvds-update-banner')));

    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    check('sw.js versions its cache', /CACHE\s*=\s*['"]jvds-v\d+['"]/.test(sw));
    check('sw.js retires old versioned caches', /caches\.delete/.test(sw) && /\^jvds-v/.test(sw));

    check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nSERVICE WORKER VERSION PROMPT CHECKS PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
