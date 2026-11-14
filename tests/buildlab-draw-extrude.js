#!/usr/bin/env node
/*
 * tests/buildlab-draw-extrude.js
 * A2734: verifies the freehand draw-to-extrude tool.
 *
 * Covers turning an outline into a solid extruded mesh at a chosen depth,
 * correct size and floor placement, undo, the shape surviving as a saveable
 * imported part, touch drawing at 390px, and the Draw control at 1440px.
 *
 * Run: node tests/buildlab-draw-extrude.js
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19405;
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'};
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
    for (const vp of [{name: 'desktop', w: 1440, h: 900, m: false}, {name: 'mobile', w: 390, h: 844, m: true}]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({width: vp.w, height: vp.h, isMobile: vp.m, hasTouch: vp.m});
      await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) {} });
      await page.goto('http://127.0.0.1:' + port + '/tools/buildlab.html', {waitUntil: 'domcontentloaded', timeout: 30000});
      await page.waitForFunction(() => typeof window.extrudeFromOutline === 'function', {timeout: 20000});
      await pause(900);
      await page.evaluate(() => {
        try { closeModal('welcomeModal'); } catch (e) {}
        const w = document.getElementById('welcomeModal');
        if (w) w.classList.remove('open');
        document.body.classList.remove('bl-modal-open');
        const cb = document.getElementById('cookie-banner');
        if (cb) { const b = cb.querySelector('button'); if (b) b.click(); }
        window.clearAll(true);
      });

      const drawn = await page.evaluate(() => {
        document.getElementById('drawDepth').value = '2';
        const mesh = window.extrudeFromOutline([
          {x: 0, z: 0}, {x: 2, z: 0}, {x: 2, z: -2}, {x: 0, z: -2}
        ]);
        const box = new THREE.Box3().setFromObject(mesh);
        const size = box.getSize(new THREE.Vector3());
        return {
          exists: !!mesh,
          blocks: window.blocks.length,
          imported: !!mesh.userData.isImported,
          tris: mesh.geometry.index ? mesh.geometry.index.count / 3 : mesh.geometry.attributes.position.count / 3,
          size: [size.x, size.y, size.z].map(v => +v.toFixed(2)),
          minY: +box.min.y.toFixed(2),
          maxY: +box.max.y.toFixed(2)
        };
      });
      check(vp.name + ': an outline becomes one solid extrusion', drawn.exists && drawn.blocks === 1, String(drawn.blocks));
      check(vp.name + ': the extrusion is a saveable imported mesh', drawn.imported);
      check(vp.name + ': the drawn outline keeps its footprint', JSON.stringify(drawn.size) === JSON.stringify([2, 2, 2]), JSON.stringify(drawn.size));
      check(vp.name + ': the extrusion uses the chosen depth', drawn.minY === 0 && drawn.maxY === 2, JSON.stringify([drawn.minY, drawn.maxY]));
      check(vp.name + ': the extrusion has real volume triangles', drawn.tris >= 12, String(drawn.tris));

      const undo = await page.evaluate(() => {
        window.undo();
        return {blocks: window.blocks.length, imports: window.serializeImportedParts().length};
      });
      check(vp.name + ': undo removes the drawn shape in one step', undo.blocks === 0 && undo.imports === 0, JSON.stringify(undo));

      const tool = await page.evaluate(() => {
        window.setTool('draw');
        return {
          active: !!document.querySelector('.tool-btn[data-tool="draw"].active'),
          desktop: !!document.querySelector('.tool-btn[data-tool="draw"]'),
          mobile: !!document.querySelector('#mob-panel-actions [data-on-arg="draw"]'),
          depth: !!document.getElementById('drawDepth'),
          hint: (document.getElementById('vpHint') || {}).textContent || ''
        };
      });
      check(vp.name + ': the Draw tool can be selected', tool.active && /sketch a loop/i.test(tool.hint), tool.hint);
      check(vp.name + ': the Draw control is on the desktop toolbar', tool.desktop);
      check(vp.name + ': the Draw control is reachable on mobile', tool.mobile);
      check(vp.name + ': the draw depth control is present', tool.depth);

      if (vp.m) {
        const touch = await page.evaluate(() => {
          window.clearAll(true);
          document.getElementById('drawDepth').value = '1';
          window.setTool('draw');
          const canvas = document.querySelector('#viewport canvas');
          const r = canvas.getBoundingClientRect();
          const fire = (type, x, y) => {
            const t = new Touch({identifier: 1, target: canvas, clientX: x, clientY: y});
            canvas.dispatchEvent(new TouchEvent(type, {
              touches: type === 'touchend' ? [] : [t],
              targetTouches: type === 'touchend' ? [] : [t],
              changedTouches: [t],
              bubbles: true,
              cancelable: true
            }));
          };
          const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          fire('touchstart', cx, cy);
          fire('touchmove', cx + 70, cy);
          fire('touchmove', cx + 70, cy + 70);
          fire('touchmove', cx, cy + 70);
          fire('touchend', cx, cy + 70);
          return {count: window.blocks.length, imported: window.blocks.some(b => b.userData.isImported)};
        });
        check('mobile: a one-finger touch stroke draws a shape', touch.count === 1 && touch.imported, JSON.stringify(touch));
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
  console.log('\nALL BUILDLAB DRAW-EXTRUDE CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
