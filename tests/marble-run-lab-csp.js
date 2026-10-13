#!/usr/bin/env node
// tests/marble-run-lab-csp.js (A1494): proves the pilot page needs no
// script-src 'unsafe-inline'. Serves the page with a strict Content-Security-Policy
// response header (scripts: 'self' only, no unsafe-inline) and checks the game
// still boots with zero CSP violations. Fails if any inline script/handler remains.
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const STRICT_CSP = [
  "default-src 'self'",
  "script-src 'self' blob: https://www.googletagmanager.com https://www.google-analytics.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self' blob:",
  "object-src 'none'", "base-uri 'self'",
  "frame-src 'self' blob:"
].join('; ');

let failures = 0;
const ok = (n, c, d) => { console.log((c ? '  [PASS] ' : '  [FAIL] ') + n + (d ? ' - ' + d : '')); if (!c) failures++; };

const server = http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  const headers = { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' };
  if (file.endsWith('.html')) headers['Content-Security-Policy'] = STRICT_CSP;
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const csp = [], errors = [];
    page.on('console', (msg) => {
      const t = msg.text();
      if (/Content Security Policy|Refused to (execute|load|apply|run)/i.test(t)) csp.push(t);
      else if (msg.type() === 'error' && !/ERR_NETWORK_ACCESS_DENIED|Failed to load resource/i.test(t)) errors.push(t);
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.evaluateOnNewDocument(() => { try { localStorage.setItem('jvds-marble-3d-seen', '1'); } catch (e) {} });
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(base + '/games/marble-run-lab.html', { waitUntil: 'load', timeout: 30000 });
    await page.waitForSelector('#tools [data-tool]', { timeout: 10000 });

    const tools = await page.$$eval('#tools [data-tool]', (els) => els.map((e) => e.dataset.tool));
    ok('game boots under script-src without unsafe-inline', tools.length > 0, tools.join(','));
    ok('no CSP violations', csp.length === 0, csp.slice(0, 2).join(' | '));
    ok('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} FAILED` : '\nMarble Run CSP-clean: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('harness error', e); process.exit(1); });
