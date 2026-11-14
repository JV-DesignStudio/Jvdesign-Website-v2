#!/usr/bin/env node
/*
 * tests/buildlab-qr.js
 * A2750: verifies the local QR handoff.
 *
 * Covers generating a QR code for the compressed share link, the module table
 * being a real QR (finders, dark modules), offline generation, the copy-link
 * fallback for big builds, and the button on desktop and mobile.
 *
 * Run: node tests/buildlab-qr.js
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19423;
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.mjs':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.wasm':'application/wasm','.woff2':'font/woff2'};
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(root, url));
  if (!file.startsWith(path.normalize(root))) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'});
    res.end(data);
  });
});
let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const pause = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await new Promise(r => server.listen(port, r));
  const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']});
  try {
    for (const vp of [{name: 'desktop', w: 1440, h: 900, m: false}, {name: 'phone', w: 390, h: 844, m: true}]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({width: vp.w, height: vp.h, isMobile: vp.m, hasTouch: vp.m});
      await page.evaluateOnNewDocument(() => { try { localStorage.clear(); localStorage.setItem('buildlab_kidmode', '0'); } catch (e) {} });
      await page.goto('http://127.0.0.1:' + port + '/tools/buildlab.html', {waitUntil: 'domcontentloaded', timeout: 30000});
      await page.waitForFunction(() => typeof window.showShareQR === 'function', {timeout: 20000});
      await page.waitForFunction(() => !!document.querySelector('#viewport canvas'), {timeout: 25000});
      await pause(500);
      await page.evaluate(() => {
        try { closeModal('welcomeModal'); } catch (e) {}
        const w = document.getElementById('welcomeModal');
        if (w) w.classList.remove('open');
        document.body.classList.remove('bl-modal-open');
        window.clearAll(true);
        window.addBlock(0, 0, 0, 1, 1, 1, '#e94560', 'box');
        window.addBlock(1, 0, 0, 1, 1, 1, '#00d4aa', 'box');
      });

      const qr = await page.evaluate(async () => {
        await window.showShareQR();
        const started = Date.now();
        while (Date.now() - started < 10000) {
          const state = window.qrState();
          if (!state.last) { await new Promise(r => setTimeout(r, 100)); continue; }
          const holder = document.getElementById('qrHolder');
          const svg = holder.querySelector('svg');
          return {
            state,
            open: state.open,
            svg: !!svg,
            svgSize: svg ? svg.getAttribute('width') : null,
            code: window.getShareCode(),
            shareCode: window.getShareCode()
          };
        }
        return {state: window.qrState(), open: false, svg: false};
      });
      check(vp.name + ': the QR modal opens', qr.open === true, JSON.stringify(qr.open));
      check(vp.name + ': a real QR matrix is generated', !!(qr.state.last && qr.state.last.ready) && qr.state.last.modules >= 21 && qr.state.last.dark > 10, JSON.stringify(qr.state.last && {modules: qr.state.last.modules, dark: qr.state.last.dark}));
      check(vp.name + ': the QR is drawn as an inline SVG', qr.svg === true, String(qr.svgSize));
      check(vp.name + ': the QR carries the compressed share link', !!(qr.state.last && qr.state.last.payload && qr.state.last.payload.indexOf('#b=') > 0), String(qr.state.last && qr.state.last.payload).slice(0, 60));
      check(vp.name + ': the payload matches the copyable share code', !!(qr.state.last && qr.shareCode && qr.state.last.payload.endsWith(qr.shareCode)), 'code ' + (qr.shareCode || '').slice(0, 18));

      const offline = await page.evaluate(async () => {
        try { Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true }); } catch (e) {}
        window.closeQrModal();
        await window.showShareQR();
        const started = Date.now();
        while (Date.now() - started < 10000) {
          const state = window.qrState();
          if (state.last) return state.last;
          await new Promise(r => setTimeout(r, 100));
        }
        return null;
      });
      check(vp.name + ': QR generation works offline', !!(offline && offline.ready && offline.dark > 10), JSON.stringify(offline && {ready: offline.ready, dark: offline.dark}));

      const fallback = await page.evaluate(async () => {
        window.closeQrModal();
        await window.showShareQR(10);
        const state = window.qrState();
        const text = (document.getElementById('qrFallback') || {}).textContent || '';
        const visible = (document.getElementById('qrFallback') || {}).style.display !== 'none';
        return {state: state.last, text, visible, holder: (document.getElementById('qrHolder') || {}).innerHTML};
      });
      check(vp.name + ': an oversized build falls back to the copy link', !!(fallback.state && fallback.state.fallback) && fallback.visible && /copy (link|button)/i.test(fallback.text), JSON.stringify({fallback: fallback.state && fallback.state.fallback, text: fallback.text}));
      check(vp.name + ': the fallback does not draw a broken QR', fallback.holder === '', fallback.holder);

      const ui = await page.evaluate(() => ({
        desktop: !!document.querySelector('#right-panel [data-on="showShareQR"]'),
        mobile: !!document.querySelector('#mob-panel-actions [data-on="showShareQR"]'),
        copy: !!document.querySelector('#qrModal [data-on="copyQrContent"]')
      }));
      check(vp.name + ': the QR button is on the Save panel', ui.desktop);
      check(vp.name + ': the QR button is reachable on mobile', ui.mobile);
      check(vp.name + ': the modal offers a copy button', ui.copy);

      check(vp.name + ': zero runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));
      await page.close().catch(() => {});
    }
  } finally {
    await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
  }
  if (failures) {
    console.log('\n' + failures + ' CHECK(S) FAILED');
    process.exit(1);
  }
  console.log('\nALL BUILDLAB QR CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
