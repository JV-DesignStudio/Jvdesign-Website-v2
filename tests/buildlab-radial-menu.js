#!/usr/bin/env node
/*
 * tests/buildlab-radial-menu.js
 * A2747: verifies the touch quick-actions radial menu.
 *
 * Covers the dedicated button, the five actions, closing after a choice,
 * long-press opening on a part at 390px and 768px, and the touch help hint.
 *
 * Run: node tests/buildlab-radial-menu.js
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19419;
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.wasm':'application/wasm','.woff2':'font/woff2'};
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

async function load(page, vp) {
  await page.setViewport({width: vp.w, height: vp.h, isMobile: vp.m, hasTouch: vp.m});
  await page.evaluateOnNewDocument(() => { try { localStorage.clear(); localStorage.setItem('buildlab_kidmode', '0'); } catch (e) {} });
  await page.goto('http://127.0.0.1:' + port + '/tools/buildlab.html', {waitUntil: 'domcontentloaded', timeout: 30000});
  await page.waitForFunction(() => typeof window.openRadialMenu === 'function', {timeout: 20000});
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

(async () => {
  await new Promise(r => server.listen(port, r));
  const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']});
  try {
    for (const vp of [{name: 'desktop', w: 1440, h: 900, m: false}, {name: 'tablet', w: 768, h: 1024, m: true}, {name: 'phone', w: 390, h: 844, m: true}]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await load(page, vp);

      const open = await page.evaluate(() => {
        window.addBlock(0, 0, 0, 1, 1, 1, '#e94560', 'box');
        window.selectAllBlocks();
        window.openRadialMenu({ clientX: Math.min(300, window.innerWidth / 2), clientY: 300 });
        return {
          state: window.radialMenuState(),
          button: !!document.getElementById('radialQuickBtn'),
          help: (document.getElementById('cameraHelp') || {}).textContent || '',
          visible: document.getElementById('radialMenu').style.display
        };
      });
      check(vp.name + ': the quick-actions button exists', open.button);
      check(vp.name + ': the radial menu opens with five actions', open.visible === 'block' && JSON.stringify(open.state.actions) === JSON.stringify(['move', 'scale', 'rotate', 'paint', 'delete']), JSON.stringify(open.state));
      check(vp.name + ': the touch help mentions long-press', /Long-press/i.test(open.help), open.help.slice(-40));

      const scale = await page.evaluate(() => {
        window.radialAction('scale');
        return {
          closed: !window.radialMenuState().open,
          resizeActive: !!document.querySelector('.tool-btn[data-tool="resize"].active')
        };
      });
      check(vp.name + ': Scale closes the menu and activates resize', scale.closed && scale.resizeActive, JSON.stringify(scale));

      const actions = await page.evaluate(() => {
        window.selectAllBlocks();
        const before = window.blocks[0].quaternion.y;
        window.openRadialMenu({ clientX: 300, clientY: 280 });
        window.radialAction('rotate');
        const rotated = Math.abs(window.blocks[0].quaternion.y - before) > 0.1;
        window.selectAllBlocks();
        window.openRadialMenu({ clientX: 300, clientY: 280 });
        window.radialAction('paint');
        const paintActive = !!document.querySelector('.tool-btn[data-tool="paint"].active');
        window.selectAllBlocks();
        window.openRadialMenu({ clientX: 300, clientY: 280 });
        window.radialAction('delete');
        return { rotated, paintActive, blocks: window.blocks.length, closed: !window.radialMenuState().open };
      });
      check(vp.name + ': Turn rotates the selected part', actions.rotated, String(actions.rotated));
      check(vp.name + ': Paint activates the paint tool', actions.paintActive);
      check(vp.name + ': Delete removes the selected part and closes', actions.blocks === 0 && actions.closed, JSON.stringify({blocks: actions.blocks, closed: actions.closed}));

      if (vp.m) {
        const longPress = await page.evaluate(async () => {
          window.clearAll(true);
          window.addBlock(0, 0, 0, 1, 1, 1, '#00d4aa', 'box');
          window.deselectBlock();
          const canvas = document.querySelector('#viewport canvas');
          const rect = canvas.getBoundingClientRect();
          const v = new THREE.Vector3(0, 0.5, 0).project(window.camera);
          const x = rect.left + (v.x * 0.5 + 0.5) * rect.width;
          const y = rect.top + (-v.y * 0.5 + 0.5) * rect.height;
          const fire = (type, x, y) => {
            const t = new Touch({identifier: 2, target: canvas, clientX: x, clientY: y});
            canvas.dispatchEvent(new TouchEvent(type, {
              touches: type === 'touchend' ? [] : [t],
              targetTouches: type === 'touchend' ? [] : [t],
              changedTouches: [t],
              bubbles: true,
              cancelable: true
            }));
          };
          fire('touchstart', x, y);
          await new Promise(r => setTimeout(r, 700));
          const opened = window.radialMenuState();
          fire('touchend', x, y);
          const closedByTouchEnd = window.radialMenuState().open;
          const targetSelected = !!window.radialMenuState().target;
          window.closeRadialMenu();
          return { opened, closedByTouchEnd, targetSelected, blocks: window.blocks.length };
        });
        check(vp.name + ': long-press opens the menu on a part', longPress.opened.open && longPress.opened.actions.length === 5, JSON.stringify(longPress.opened));
        check(vp.name + ': long-press selects the part under the finger', longPress.targetSelected && longPress.blocks === 1, JSON.stringify({target: longPress.targetSelected, blocks: longPress.blocks}));
        check(vp.name + ': the menu stays open until an action is picked', longPress.closedByTouchEnd === true, String(longPress.closedByTouchEnd));
      }

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
  console.log('\nALL BUILDLAB RADIAL MENU CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
