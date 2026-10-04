// Feedback widget: renders on tools + workshops at 390/1440, saves locally with
// no account, submits a consent-gated event, and stays off non-tool pages.
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

async function runPage(browser, url, width) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => { if (/feedback-widget/.test(e.stack || e.message)) errors.push(e.message); });
  page.on('console', m => { if (m.type() === 'error' && /feedback-widget/.test(m.text())) errors.push(m.text()); });
  await page.evaluateOnNewDocument(CONSENT);
  await page.setViewport({ width, height: 900 });
  await page.goto('http://127.0.0.1:8137' + url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 800));

  const visible = await page.evaluate(() => {
    const b = document.getElementById('jvfb-btn');
    if (!b) return false;
    const r = b.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });

  let result = { url, width, visible, opened: false, recorded: false, event: false, note: false, noteEvent: false, dialog: false };
  if (visible) {
    await page.evaluate(() => document.getElementById('jvfb-btn').click());
    await new Promise(r => setTimeout(r, 200));
    result.opened = await page.evaluate(() => {
      const p = document.getElementById('jvfb-panel');
      return p && !p.hidden && !!p.querySelector('.jvfb-yes');
    });
    result.dialog = await page.evaluate(() => {
      const p = document.getElementById('jvfb-panel');
      return p && p.getAttribute('role') === 'dialog';
    });
    await page.evaluate(() => document.querySelector('#jvfb-panel .jvfb-yes').click());
    await new Promise(r => setTimeout(r, 200));
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('jvds-feedback') || '[]'));
    result.recorded = stored.length === 1 && stored[0].worked === true && !stored[0].note;
    result.event = await page.evaluate(() => (window.dataLayer || []).some(a => a[0] === 'event' && a[1] === 'jvds_feedback'));
    await page.evaluate(() => {
      const ta = document.querySelector('#jvfb-panel .jvfb-note');
      ta.value = 'The colour picker confused me';
      document.querySelector('#jvfb-panel .jvfb-yes').click();
    });
    await new Promise(r => setTimeout(r, 200));
    const stored2 = await page.evaluate(() => JSON.parse(localStorage.getItem('jvds-feedback') || '[]'));
    result.note = stored2.length === 1 && /colour picker/.test(stored2[0].note || '');
    result.noteEvent = await page.evaluate(() => (window.dataLayer || []).some(a => a[0] === 'event' && a[1] === 'jvds_feedback_note'));
  }
  result.errors = errors.length;
  await page.close();
  return result;
}

(async () => {
  await new Promise(r => server.listen(8137, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  const pages = ['/tools/pixel-studio.html', '/workshops/build-a-game-15-min.html'];
  const results = [];
  for (const url of pages) {
    for (const width of [390, 1440]) results.push(await runPage(browser, url, width));
  }

  // Control: a non-tool/workshop page must not show the widget.
  const control = await browser.newPage();
  await control.goto('http://127.0.0.1:8137/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 500));
  const controlAbsent = await control.evaluate(() => !document.getElementById('jvfb-btn'));
  await control.close();

  let pass = controlAbsent;
  for (const r of results) {
    const ok = r.visible && r.opened && r.dialog && r.recorded && r.event && r.note && r.noteEvent && r.errors === 0;
    if (!ok) pass = false;
    console.log(`${r.width}px ${r.url} -> ${ok ? 'PASS' : 'FAIL'} ${JSON.stringify(r)}`);
  }
  console.log('control (index.html hides widget):', controlAbsent ? 'PASS' : 'FAIL');
  console.log(pass ? 'FEEDBACK WIDGET SMOKE PASSED' : 'FAILURES PRESENT');

  await browser.close();
  server.close();
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
