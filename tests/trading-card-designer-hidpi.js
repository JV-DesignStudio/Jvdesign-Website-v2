#!/usr/bin/env node
// A674: trading-card-designer preview must be HiDPI-sharp and stay undistorted.
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '..');

(async () => {
  const server = http.createServer((req, res) => {
    const p = path.resolve(ROOT, '.' + decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(p, (e, b) => { res.writeHead(e ? 404 : 200); res.end(e ? '' : b); });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  let failures = 0;
  const check = (n, c, d) => { console.log(`${c ? '✓' : '✗'} ${n}${d ? ' - ' + d : ''}`); if (!c) failures++; };
  try {
    for (const [w, dpr] of [[1440, 2], [390, 2], [1440, 1]]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => { const m = String(e.message || e); if (/ServiceWorker|MIME type/i.test(m)) return; errors.push(m); });
      await page.setViewport({ width: w, height: 900, deviceScaleFactor: dpr });
      await page.setRequestInterception(true);
      page.on('request', r => {
        const u = r.url();
        if (u.startsWith('http://127.0.0.1:') || u.startsWith('data:') || u === 'about:blank') r.continue();
        else r.abort();
      });
      await page.goto('http://127.0.0.1:' + server.address().port + '/tools/trading-card-designer.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('#card-canvas', { timeout: 10000 });
      const m = await page.evaluate(() => {
        const c = document.getElementById('card-canvas');
        try { if (typeof render === 'function') render(); } catch (e) {}
        let alpha = 0;
        try { alpha = c.getContext('2d').getImageData(Math.round(c.width / 2), Math.round(c.height / 2), 1, 1).data[3]; } catch (e) {}
        return {
          cw: c.width, ch: c.height, dispW: c.clientWidth, dispH: c.clientHeight,
          alpha,
          sw: document.documentElement.scrollWidth, cwid: document.documentElement.clientWidth
        };
      });
      const tag = `${w}@${dpr}x`;
      check(`${tag}: backing store scaled by DPR (${m.cw}x${m.ch})`, m.cw === 400 * dpr && m.ch === 560 * dpr);
      check(`${tag}: sharp (backing >= display width)`, m.cw >= m.dispW, `${m.cw} >= ${m.dispW}`);
      check(`${tag}: card aspect preserved`, Math.abs(m.dispW / m.dispH - 400 / 560) < 0.06, (m.dispW / m.dispH).toFixed(3));
      check(`${tag}: preview rendered (non-blank)`, m.alpha > 0, 'alpha=' + m.alpha);
      check(`${tag}: no horizontal overflow`, m.sw <= m.cwid + 1, `scroll=${m.sw}/${m.cwid}`);
      check(`${tag}: no uncaught JS errors`, errors.length === 0, errors[0] || '');
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n✗ trading-card HiDPI: ${failures} check(s) failed` : '\n✓ trading-card HiDPI: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('✗ trading-card HiDPI: ' + e.message); process.exit(1); });
