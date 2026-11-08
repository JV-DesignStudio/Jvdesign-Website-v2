#!/usr/bin/env node
// tests/buildlab-url-share.js (A2752)
// A small BuildLab model travels as a compressed URL hash. Opening that hash
// restores the build with no server. Legacy base64 share codes still decode, and
// a build that is too big for a link falls back to the copy/paste share code.
// Run: node tests/buildlab-url-share.js
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19256;
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(root, url));
  if (!file.startsWith(path.normalize(root))) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(port, r));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const text = m.text();
      if (/ERR_NETWORK_ACCESS_DENIED|Failed to load resource/.test(text)) return;
      errors.push('console: ' + text);
    });
    await page.setViewport({ width: 1200, height: 900 });
    await page.goto('http://127.0.0.1:' + port + '/tools/buildlab.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#viewport canvas, #viewport.engine-error', { timeout: 20000 }).catch(() => {});
    await page.waitForFunction(() => typeof window.quickBuild === 'function', { timeout: 30000 }).catch(() => {});
    await sleep(500);
    await page.evaluate(() => {
      try { window.closeModal('welcomeModal'); } catch (e) {}
      const w = document.getElementById('welcomeModal');
      if (w) w.classList.remove('open');
      document.body.classList.remove('bl-modal-open');
    });

    const small = await page.evaluate(() => {
      window.quickBuild('castle');
      const p = window.buildSharePayload();
      const code = window.getShareCode();
      const dec = window.decodeShareCode(code);
      const legacy = btoa(unescape(encodeURIComponent(JSON.stringify({ n: 'Legacy', v: 2, b: [{ x: 0, y: 0, z: 0, w: 1, h: 1, d: 1, c: 16711680, s: 'box' }], g: [], im: [] }))))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const legacyDec = window.decodeShareCode(legacy);
      return {
        compressed: !!p && p.compressed,
        codeStart: code.charAt(0),
        codeLen: code.length,
        legacyLen: p ? p.legacyLen : -1,
        blocks: dec ? (dec.b || []).length : -1,
        count: p ? p.count : -1,
        legacyOk: !!(legacyDec && (legacyDec.b || []).length === 1),
        hashOk: !!p && /#b=/.test(p.url),
        url: p ? p.url : ''
      };
    });
    check('small build uses a compressed share code', small.compressed && small.codeStart === '~', JSON.stringify({ compressed: small.compressed, start: small.codeStart }));
    check('compressed code is shorter than the legacy base64', small.codeLen < small.legacyLen, small.codeLen + ' < ' + small.legacyLen);
    check('compressed code round-trips', small.blocks > 0 && small.blocks === small.count, 'blocks=' + small.blocks + ' count=' + small.count);
    check('legacy base64 share codes still decode', small.legacyOk);
    check('share link carries the code in the hash', small.hashOk && small.url.length > 20);

    const page2 = await browser.newPage();
    await page2.goto(small.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page2.waitForSelector('#viewport canvas, #viewport.engine-error', { timeout: 20000 }).catch(() => {});
    await sleep(1800);
    const loaded = await page2.evaluate(() => ({ blocks: (window.blocks || []).length, hash: location.hash }));
    check('opening the hash restores the build without a server', loaded.blocks === small.blocks && loaded.hash === '', JSON.stringify(loaded));
    await page2.close();

    const guard = await page.evaluate(() => {
      window.quickBuild('tower');
      window.JVDS_SHARE_URL_MAX = 10;
      let result = null;
      try { result = window.shareBuild(); } finally { delete window.JVDS_SHARE_URL_MAX; }
      return result;
    });
    check('size guard falls back to the share code and explains why',
      !!guard && guard.ok === false && guard.fallback === 'code' && /share code/i.test(guard.message || ''),
      JSON.stringify(guard));

    check('zero runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close().catch(() => {});
    await new Promise((r) => server.close(r));
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL BUILDLAB URL SHARE CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
