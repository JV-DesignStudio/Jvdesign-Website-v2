/* roblox-page-load.js - guards the 20s navigation budget for the Roblox pages
   that used to time out during CSS validation (A1829). Each page must reach
   DOMContentLoaded inside the same 20s budget validate-css.js uses, and the
   cheatsheet stub must redirect to the canonical tools page.

   Run: node tests/roblox-page-load.js
   Wrapper: tests/roblox-studio-cheatsheet-http.js calls run([...]) for the stub. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const BUDGET_MS = 20000;
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf', '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json'
};

const PAGES = [
  { page: '/workshops/roblox-sim-lockdown-3-canvas.html' },
  { page: '/workshops/roblox-sim-lockdown-2-workshop.html' },
  { page: '/workshops/roblox-studio-cheatsheet.html', redirectsTo: '/tools/roblox-cheatsheet.html' }
];

async function run(targets) {
  targets = targets || PAGES;
  let failures = 0;
  function check(name, ok, detail = '') {
    console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
    if (!ok) failures++;
  }

  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('missing ' + url);
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    for (const target of targets) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.setRequestInterception(true);
      page.on('request', (r) => r.url().startsWith(base) || r.url().startsWith('data:') || r.url().startsWith('blob:') ? r.continue() : r.abort());
      const started = Date.now();
      let resp = null;
      let timedOut = false;
      try {
        resp = await page.goto(base + target.page, { waitUntil: 'domcontentloaded', timeout: BUDGET_MS });
      } catch (e) {
        timedOut = /timeout/i.test(String(e && e.message));
      }
      const elapsed = Date.now() - started;
      const where = target.page;
      check(where + ' loads within ' + BUDGET_MS + 'ms', !timedOut, 'domcontentloaded ' + elapsed + 'ms');
      check(where + ' responds 200', !timedOut && !!resp && resp.status() === 200, 'status ' + (resp && resp.status()));
      if (target.redirectsTo) {
        const finalPath = new URL(page.url()).pathname;
        check(where + ' redirects to ' + target.redirectsTo, finalPath === target.redirectsTo, finalPath);
        const targetReady = await page.evaluate(() => document.readyState === 'complete' || document.readyState === 'interactive').catch(() => false);
        check(where + ' redirect target renders', targetReady);
      }
      check(where + ' no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }

  if (failures) {
    console.log('\n' + failures + ' FAILED across ' + targets.length + ' page(s)');
    process.exit(1);
  }
  console.log('\nPASS: ' + targets.length + ' Roblox page(s) load within the ' + BUDGET_MS + 'ms navigation budget');
}

module.exports = { run, PAGES };

if (require.main === module) {
  run().catch((e) => { console.error(e); process.exit(1); });
}
