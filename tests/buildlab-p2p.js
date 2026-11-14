#!/usr/bin/env node
/*
 * tests/buildlab-p2p.js
 * A2749: verifies peer-to-peer Build Together sessions.
 *
 * Two real browser pages exchange a manual invite/answer pair, connect over a
 * WebRTC data channel, then sync place, move and delete changes in near real
 * time. Also checks the consent wording and session cleanup.
 *
 * Run: node tests/buildlab-p2p.js
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19425;
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

async function ready(page) {
  await page.setViewport({width: 1280, height: 800});
  await page.evaluateOnNewDocument(() => { try { localStorage.clear(); localStorage.setItem('buildlab_kidmode', '0'); } catch (e) {} });
  await page.goto('http://127.0.0.1:' + port + '/tools/buildlab.html', {waitUntil: 'domcontentloaded', timeout: 30000});
  await page.waitForFunction(() => typeof window.webrtcHost === 'function', {timeout: 20000});
  await page.waitForFunction(() => !!document.querySelector('#viewport canvas'), {timeout: 25000});
  await pause(500);
  await page.evaluate(() => {
    try { closeModal('welcomeModal'); } catch (e) {}
    const w = document.getElementById('welcomeModal');
    if (w) w.classList.remove('open');
    document.body.classList.remove('bl-modal-open');
    window.clearAll(true);
  });
}

async function waitFor(page, fn, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await page.evaluate(fn);
    if (value) return value;
    await pause(150);
  }
  return null;
}

(async () => {
  await new Promise(r => server.listen(port, r));
  const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']});
  const dialogs = [];
  try {
    const host = await browser.newPage();
    const hostErrors = [];
    const joinErrors = [];
    host.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });
    host.on('pageerror', e => { hostErrors.push(e.message); console.log('HOST PAGEERROR:', e.message); });
    await ready(host);
    const join = await browser.newPage();
    join.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });
    join.on('pageerror', e => { joinErrors.push(e.message); console.log('JOIN PAGEERROR:', e.message); });
    await ready(join);

    await host.evaluate(() => {
      window.addBlock(0, 0, 0, 1, 1, 1, '#e94560', 'box');
      window.addBlock(2, 0, 0, 1, 1, 1, '#00d4aa', 'box');
    });
    const offer = await host.evaluate(() => window.webrtcHost());
    check('the host creates an invite code', !!offer && offer.length > 20, String(offer && offer.length));
    check('the consent prompt explains nothing is stored', dialogs.some(m => /server|stored/i.test(m)), dialogs[0] || '');

    const answer = await join.evaluate(code => window.webrtcJoin(code), offer);
    check('the partner creates an answer code', !!answer && answer.length > 20, String(answer && answer.length));
    await host.evaluate(code => window.webrtcAcceptAnswer(code), answer);

    const connected = await waitFor(host, () => window.p2pState().connected, 20000);
    const joinConnected = await waitFor(join, () => window.p2pState().connected, 20000);
    check('both browsers connect over WebRTC', !!connected && !!joinConnected, JSON.stringify({host: connected, join: joinConnected}));
    check('the host role is recorded', (await host.evaluate(() => window.p2pState().role)) === 'host');
    check('the joining role is recorded', (await join.evaluate(() => window.p2pState().role)) === 'join');

    const joinBlocks = await waitFor(join, () => window.blocks.length === 2 ? window.blocks.length : 0, 15000);
    check('the partner receives the initial build', joinBlocks === 2, String(joinBlocks));

    await host.evaluate(() => window.addBlock(4, 0, 0, 1, 1, 1, '#f5a623', 'box'));
    const placed = await waitFor(join, () => window.blocks.length === 3 ? window.blocks.length : 0, 15000);
    check('a placed block syncs to the partner', placed === 3, String(placed));

    await host.evaluate(() => {
      const target = window.blocks[0];
      window.selectAllBlocks();
      target.position.x += 2;
      target.updateMatrixWorld(true);
      window.updateStats();
    });
    const movedX = await waitFor(join, () => {
      const xs = window.blocks.map(b => +b.position.x.toFixed(2)).sort((a, b) => a - b);
      return JSON.stringify(xs) === JSON.stringify([2, 2, 4]) ? xs : 0;
    }, 15000);
    check('a moved block syncs to the partner', JSON.stringify(movedX) === JSON.stringify([2, 2, 4]), JSON.stringify(movedX));

    await join.evaluate(() => {
      const target = window.blocks[0];
      window.pushHistory();
      window.deleteBlock(target);
      window.updateStats();
    });
    const deleted = await waitFor(host, () => window.blocks.length === 2 ? window.blocks.length : 0, 15000);
    if (!deleted) {
      console.log('DEBUG after delete', JSON.stringify({
        join: await join.evaluate(() => ({blocks: window.blocks.length, p2p: window.p2pState()})),
        host: await host.evaluate(() => ({blocks: window.blocks.length, p2p: window.p2pState()}))
      }));
    }
    check('a delete syncs back to the host', deleted === 2, String(deleted));

    await join.evaluate(() => window.webrtcLeave());
    const left = await waitFor(host, () => window.p2pState().connected === false, 15000);
    check('leaving ends the host session cleanly', left === true, JSON.stringify(await host.evaluate(() => window.p2pState())));
    check('leave clears the invite fields', (await join.evaluate(() => window.p2pState().hasOffer)) === false);

    check('host page has no runtime errors', hostErrors.length === 0, hostErrors.slice(0, 3).join(' | '));
    check('partner page has no runtime errors', joinErrors.length === 0, joinErrors.slice(0, 3).join(' | '));
    await host.close().catch(() => {});
    await join.close().catch(() => {});
  } finally {
    await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
  }
  if (failures) {
    console.log('\n' + failures + ' CHECK(S) FAILED');
    process.exit(1);
  }
  console.log('\nALL BUILDLAB P2P CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
