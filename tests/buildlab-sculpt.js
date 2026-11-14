#!/usr/bin/env node
/*
 * tests/buildlab-sculpt.js
 * A2733: verifies the Sculpt / Smooth action.
 *
 * Covers turning a block cluster into one welded, subdivided and smoothed mesh,
 * the Smooth strength control, keeping the result as a saveable imported part,
 * undo restoring the original blocks, and the control existing on desktop and
 * mobile at 390px and 1440px.
 *
 * Run: node tests/buildlab-sculpt.js
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19403;
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

async function buildCluster(page) {
  return page.evaluate(() => {
    window.clearAll(true);
    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < 2; y++) {
        for (let z = 0; z < 2; z++) {
          window.addBlock(x, y, z, 1, 1, 1, '#8b5a2b', 'box');
        }
      }
    }
    window.selectAllBlocks();
  });
}

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
      await page.waitForFunction(() => typeof window.addBlock === 'function', {timeout: 20000});
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

      await buildCluster(page);
      const sculpt = await page.evaluate(() => {
        const before = window.blocks.length;
        const mesh = window.sculptSelected();
        const box = new THREE.Box3().setFromObject(mesh);
        const size = box.getSize(new THREE.Vector3());
        return {
          before,
          after: window.blocks.length,
          imported: !!mesh.userData.isImported,
          name: mesh.userData.blockName,
          tris: mesh.geometry.index ? mesh.geometry.index.count / 3 : mesh.geometry.attributes.position.count / 3,
          verts: mesh.geometry.attributes.position.count,
          size: [size.x, size.y, size.z].map(v => +v.toFixed(2)),
          minY: +box.min.y.toFixed(2),
          imports: window.serializeImportedParts().length
        };
      });
      check(vp.name + ': sculpt replaces the block cluster with one mesh', sculpt.before === 8 && sculpt.after === 1, sculpt.before + ' -> ' + sculpt.after);
      check(vp.name + ': the sculpted result is a saveable imported mesh', sculpt.imported && sculpt.imports === 1, JSON.stringify({imported: sculpt.imported, imports: sculpt.imports}));
      check(vp.name + ': subdivision adds triangles, not block faces', sculpt.tris > 96, String(sculpt.tris));
      check(vp.name + ': welding keeps the mesh light', sculpt.verts < sculpt.tris, sculpt.verts + ' verts / ' + sculpt.tris + ' tris');
      check(vp.name + ': the smoothed mesh keeps the original footprint', sculpt.size.every(v => v >= 1.8 && v <= 2.05), JSON.stringify(sculpt.size));
      check(vp.name + ': the mesh still sits on the floor', sculpt.minY === 0, String(sculpt.minY));

      const strength = await page.evaluate(() => {
        window.undo();
        window.selectAllBlocks();
        const el = document.getElementById('sculptStrength');
        const exists = !!el && el.min === '0' && el.max === '100';
        el.value = '0';
        const soft = window.sculptSelected();
        const softBox = new THREE.Box3().setFromObject(soft);
        window.undo();
        window.selectAllBlocks();
        el.value = '100';
        const heavy = window.sculptSelected();
        const heavyBox = new THREE.Box3().setFromObject(heavy);
        return {
          exists,
          softHeight: +softBox.getSize(new THREE.Vector3()).y.toFixed(2),
          heavyHeight: +heavyBox.getSize(new THREE.Vector3()).y.toFixed(2)
        };
      });
      check(vp.name + ': the Smooth strength slider exists', strength.exists);
      check(vp.name + ': the strength slider changes the smoothing', strength.heavyHeight < strength.softHeight, JSON.stringify(strength));

      const undo = await page.evaluate(() => {
        window.undo();
        return {blocks: window.blocks.length, imported: window.serializeImportedParts().length};
      });
      check(vp.name + ': undo restores the original blocks', undo.blocks === 8 && undo.imported === 0, JSON.stringify(undo));

      const ui = await page.evaluate(() => ({
        desktop: !!document.querySelector('#right-panel [data-on="sculptSelected"]'),
        mobile: !!document.querySelector('#mob-panel-actions [data-on="sculptSelected"]'),
        callable: typeof window.sculptSelected === 'function'
      }));
      check(vp.name + ': the Sculpt control is on the builder panel', ui.desktop);
      check(vp.name + ': the Sculpt control is reachable on mobile', ui.mobile);
      check(vp.name + ': sculptSelected stays callable from the page', ui.callable);

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
  console.log('\nALL BUILDLAB SCULPT CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
