#!/usr/bin/env node
// tests/ui-delegate.js (A1503): the logo error-fallback and the cookie-settings
// link no longer use inline handlers; a shared external script handles both.
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

let failures = 0;
const ok = (n, c, d) => { console.log((c ? '  [PASS] ' : '  [FAIL] ') + n + (d ? ' - ' + d : '')); if (!c) failures++; };

// Static: index uses data attributes, not inline handlers.
const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
ok('index has data-fallback, not onerror placehold', idx.includes('data-fallback=') && !/onerror="this\.onerror=null;this\.src='https:\/\/placehold/.test(idx));
ok('index has data-cookie-settings, not the inline onclick', idx.includes('data-cookie-settings') && !idx.includes('onclick="if(window.JVDSCookies)'));
ok('index loads ui-delegate.js', idx.includes('/assets/js/ui-delegate.js'));

const server = http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base + '/index.html', { waitUntil: 'load', timeout: 30000 });

    const fallback = await page.evaluate(async () => {
      const img = document.createElement('img');
      img.setAttribute('data-fallback', '/logo.png');
      img.src = '/definitely-missing-xyz.png';
      document.body.appendChild(img);
      await new Promise((r) => setTimeout(r, 400));
      return img.getAttribute('src');
    });
    ok('image error falls back to data-fallback', /\/logo\.png$/.test(fallback || ''), String(fallback));

    await page.click('[data-cookie-settings]').catch(() => {});
    await new Promise((r) => setTimeout(r, 300));
    const banner = await page.evaluate(() => !!document.getElementById('cookie-banner'));
    ok('cookie-settings link reopens the banner', banner);

    const hover = await page.evaluate(() => {
      const d = document.createElement('div');
      d.setAttribute('data-hover', 'background:rgb(1,2,3)');
      d.setAttribute('data-hover-out', 'background:');
      document.body.appendChild(d);
      d.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      const on = d.style.background;
      d.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
      const off = d.style.background;
      return { on, off };
    });
    ok('data-hover applies on hover and clears on out', /rgb\(1, 2, 3\)/.test(hover.on) && hover.off === '', JSON.stringify(hover));

    ok('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} FAILED` : '\nui-delegate: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('harness error', e); process.exit(1); });
