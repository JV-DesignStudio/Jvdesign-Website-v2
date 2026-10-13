#!/usr/bin/env node
// tests/theme-init.js (A1495): the dark-mode bootstrap is now external
// (/assets/js/theme-init.js). Proves it still applies before paint and works
// under a script-src WITHOUT unsafe-inline, and that pages no longer carry the
// inline snippet.
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const STRICT_CSP = "default-src 'self'; script-src 'self' blob: https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' blob:; object-src 'none'; base-uri 'self'";

let failures = 0;
const ok = (n, c, d) => { console.log((c ? '  [PASS] ' : '  [FAIL] ') + n + (d ? ' - ' + d : '')); if (!c) failures++; };

// Static: no page should still carry the inline theme snippet, and index references the file.
const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
ok('index.html references /assets/js/theme-init.js', idx.includes('/assets/js/theme-init.js'));
ok('index.html has no inline theme snippet', !/getItem\('jvds-theme'\)/.test(idx));

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
    // dark preference set -> data-theme=dark, applied by the external script, no CSP errors
    const p1 = await browser.newPage();
    const cspErrors = [];
    p1.on('console', (m) => { if (/Content Security Policy|Refused to (execute|load|apply|run)/i.test(m.text())) cspErrors.push(m.text()); });
    await p1.evaluateOnNewDocument(() => { try { localStorage.setItem('jvds-theme', 'dark'); } catch (e) {} });
    await p1.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const themed = await p1.evaluate(() => document.documentElement.getAttribute('data-theme'));
    ok('dark preference applies data-theme=dark', themed === 'dark', String(themed));
    ok('theme-init.js is not blocked under strict script-src', !cspErrors.some((e) => /theme-init\.js/.test(e)), cspErrors.filter((e) => /theme-init/.test(e)).slice(0, 1).join(' | '));
    await p1.close();

    // no preference -> not dark
    const p2 = await browser.newPage();
    await p2.evaluateOnNewDocument(() => { try { localStorage.removeItem('jvds-theme'); } catch (e) {} });
    await p2.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const plain = await p2.evaluate(() => document.documentElement.getAttribute('data-theme'));
    ok('no preference leaves the light theme', plain !== 'dark', String(plain));
    await p2.close();
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} FAILED` : '\nTheme init: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('harness error', e); process.exit(1); });
