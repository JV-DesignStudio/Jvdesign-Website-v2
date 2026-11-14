#!/usr/bin/env node
/*
 * tests/buildlab-a11y.js
 * A3027: keyboard and labelling checks for the new BuildLab surfaces.
 *
 * Covers accessible names on the Build Together and QR controls, labelled
 * inputs, Escape closing the QR/radial surfaces, focus entering each surface,
 * and the invite QR.
 *
 * Run: node tests/buildlab-a11y.js
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19427;
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
      await page.waitForFunction(() => typeof window.showQrCode === 'function', {timeout: 20000});
      await page.waitForFunction(() => !!document.querySelector('#viewport canvas'), {timeout: 25000});
      await pause(500);
      await page.evaluate(() => {
        try { closeModal('welcomeModal'); } catch (e) {}
        const w = document.getElementById('welcomeModal');
        if (w) w.classList.remove('open');
        document.body.classList.remove('bl-modal-open');
        window.clearAll(true);
        window.addBlock(0, 0, 0, 1, 1, 1, '#e94560', 'box');
      });

      const names = await page.evaluate(() => {
        const scope = [document.getElementById('right-panel'), document.getElementById('mob-panel-actions')];
        const buttons = [];
        scope.forEach(rootEl => { if (rootEl) rootEl.querySelectorAll('button').forEach(b => buttons.push(b)); });
        const unnamed = buttons.filter(b => {
          const text = (b.textContent || '').trim();
          return !b.getAttribute('aria-label') && !text && !b.getAttribute('title') && !b.getAttribute('aria-labelledby');
        }).map(b => b.outerHTML.slice(0, 70));
        const fields = [];
        scope.forEach(rootEl => { if (rootEl) rootEl.querySelectorAll('input,textarea,select').forEach(f => fields.push(f)); });
        const unlabelled = fields.filter(f => {
          if (f.getAttribute('aria-label') || f.getAttribute('aria-labelledby')) return false;
          if (f.closest('label')) return false;
          const id = f.id;
          return !(id && document.querySelector('label[for="' + id + '"]'));
        }).map(f => f.outerHTML.slice(0, 70));
        const live = {
          p2p: (document.getElementById('p2pStatus') || {}).getAttribute ? document.getElementById('p2pStatus').getAttribute('aria-live') : null,
          qr: document.getElementById('qrFallback') ? document.getElementById('qrFallback').getAttribute('aria-live') : null
        };
        return {buttons: buttons.length, unnamed, fields: fields.length, unlabelled, live};
      });
      check(vp.name + ': every build-panel button has an accessible name', names.unnamed.length === 0, JSON.stringify(names.unnamed.slice(0, 3)));
      check(vp.name + ': every build-panel field is labelled', names.unlabelled.length === 0, JSON.stringify(names.unlabelled.slice(0, 3)));
      check(vp.name + ': the session and QR status lines are live regions', names.live.p2p === 'polite' && names.live.qr === 'polite', JSON.stringify(names.live));

      const qr = await page.evaluate(async () => {
        await window.showShareQR();
        const started = Date.now();
        while (Date.now() - started < 10000 && !window.qrState().last) await new Promise(r => setTimeout(r, 100));
        const modal = document.getElementById('qrModal');
        const focusIn = !!document.activeElement && modal.contains(document.activeElement);
        return {open: window.qrState().open, focusIn, ready: !!(window.qrState().last && window.qrState().last.ready)};
      });
      check(vp.name + ': the QR dialog takes focus', qr.open && qr.ready && qr.focusIn, JSON.stringify(qr));

      const escQr = await page.evaluate(async () => {
        document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
        await new Promise(r => setTimeout(r, 60));
        return window.qrState().open;
      });
      check(vp.name + ': Escape closes the QR dialog', escQr === false, String(escQr));

      const invite = await page.evaluate(async () => {
        const field = document.getElementById('p2pOffer');
        field.value = '~' + 'A'.repeat(420);
        await window.showP2PInviteQR();
        const started = Date.now();
        while (Date.now() - started < 10000 && !window.qrState().last) await new Promise(r => setTimeout(r, 100));
        const title = (document.getElementById('qrTitle') || {}).textContent || '';
        const copyLabel = (document.getElementById('qrCopyBtn') || {}).textContent || '';
        const state = window.qrState().last;
        window.closeQrModal();
        return {ready: !!(state && state.ready), payloadMatches: !!(state && state.payload === field.value), title, copyLabel};
      });
      check(vp.name + ': the host invite has its own QR', invite.ready && invite.payloadMatches && /join/i.test(invite.title), JSON.stringify(invite));
      check(vp.name + ': the invite QR copy button is relabelled', /invite|code/i.test(invite.copyLabel), invite.copyLabel);

      const radial = await page.evaluate(async () => {
        window.selectAllBlocks();
        window.openRadialMenu({clientX: 260, clientY: 240});
        const focused = document.activeElement && document.activeElement.classList.contains('radial-item');
        document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
        await new Promise(r => setTimeout(r, 60));
        return {focused, open: window.radialMenuState().open};
      });
      check(vp.name + ': the radial menu takes focus', radial.focused, String(radial.focused));
      check(vp.name + ': Escape closes the radial menu', radial.open === false, String(radial.open));

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
  console.log('\nALL BUILDLAB A11Y CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
