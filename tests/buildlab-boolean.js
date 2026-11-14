#!/usr/bin/env node
/*
 * tests/buildlab-boolean.js
 * A2741: verifies boolean union, subtract and intersect.
 *
 * Covers combining two selected parts into one imported mesh, the expected
 * bounds for each operation, valid exportable geometry, undo restoring both
 * source parts, save/share/export round-trip, and controls at 1440px and 390px.
 *
 * Run: node tests/buildlab-boolean.js
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19407;
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

async function twoBoxes(page) {
  return page.evaluate(() => {
    window.clearAll(true);
    window.addBlock(0, 0, 0, 1, 1, 1, '#e94560', 'box');
    window.addBlock(0.5, 0, 0, 1, 1, 1, '#00d4aa', 'box');
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
      await page.waitForFunction(() => typeof window.booleanUnion === 'function', {timeout: 20000});
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

      await twoBoxes(page);
      const union = await page.evaluate(() => {
        const mesh = window.booleanUnion();
        const box = new THREE.Box3().setFromObject(mesh);
        const size = box.getSize(new THREE.Vector3());
        const pos = mesh.geometry.attributes.position;
        let finite = pos.count > 0;
        for (let i = 0; i < pos.count * 3; i++) if (!Number.isFinite(pos.array[i])) finite = false;
        return {
          count: window.blocks.length,
          imported: !!mesh.userData.isImported,
          tris: pos.count / 3,
          size: [size.x, size.y, size.z].map(v => +v.toFixed(2)),
          finite,
          imports: window.serializeImportedParts().length
        };
      });
      check(vp.name + ': union turns two parts into one', union.count === 1, String(union.count));
      check(vp.name + ': the union is a saveable imported mesh', union.imported && union.imports === 1, JSON.stringify({imported: union.imported, imports: union.imports}));
      check(vp.name + ': the union keeps both footprints', JSON.stringify(union.size) === JSON.stringify([1.5, 1, 1]), JSON.stringify(union.size));
      check(vp.name + ': union geometry is finite', union.finite && union.tris >= 12, union.tris + ' tris');

      const undoUnion = await page.evaluate(() => { window.undo(); return window.blocks.length; });
      check(vp.name + ': undo restores both source parts', undoUnion === 2, String(undoUnion));

      await twoBoxes(page);
      const subtract = await page.evaluate(() => {
        const mesh = window.booleanSubtract();
        const box = new THREE.Box3().setFromObject(mesh);
        const size = box.getSize(new THREE.Vector3());
        return {count: window.blocks.length, size: [size.x, size.y, size.z].map(v => +v.toFixed(2)), tris: mesh.geometry.attributes.position.count / 3};
      });
      check(vp.name + ': subtract cuts the second part out of the first', subtract.count === 1 && JSON.stringify(subtract.size) === JSON.stringify([0.5, 1, 1]), JSON.stringify(subtract));
      check(vp.name + ': the cut geometry is non-empty', subtract.tris >= 12, String(subtract.tris));

      await twoBoxes(page);
      const intersect = await page.evaluate(() => {
        const mesh = window.booleanIntersect();
        const box = new THREE.Box3().setFromObject(mesh);
        const size = box.getSize(new THREE.Vector3());
        return {count: window.blocks.length, size: [size.x, size.y, size.z].map(v => +v.toFixed(2)), tris: mesh.geometry.attributes.position.count / 3};
      });
      check(vp.name + ': intersect keeps only the overlap', intersect.count === 1 && JSON.stringify(intersect.size) === JSON.stringify([0.5, 1, 1]), JSON.stringify(intersect));

      const exported = await page.evaluate(() => {
        const obj = window.buildOBJText();
        const project = window.buildProjectData();
        const code = window.getShareCode();
        return {
          objObjects: (obj.match(/^o /gm) || []).length,
          objVerts: (obj.match(/^v /gm) || []).length,
          imports: project.imports.length,
          codeLen: code.length
        };
      });
      check(vp.name + ': combined parts export to OBJ', exported.objObjects >= 1 && exported.objVerts > 0, JSON.stringify(exported));
      check(vp.name + ': combined parts save and share', exported.imports === 1 && exported.codeLen > 20, JSON.stringify(exported));

      const ui = await page.evaluate(() => ({
        desktop: !!document.querySelector('#right-panel [data-on="booleanUnion"]'),
        subtract: !!document.querySelector('#right-panel [data-on="booleanSubtract"]'),
        intersect: !!document.querySelector('#right-panel [data-on="booleanIntersect"]'),
        mobile: !!document.querySelector('#mob-panel-actions [data-on="booleanUnion"]')
      }));
      check(vp.name + ': Union, Subtract and Intersect are on the panel', ui.desktop && ui.subtract && ui.intersect);
      check(vp.name + ': combine is reachable on mobile', ui.mobile);

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
  console.log('\nALL BUILDLAB BOOLEAN CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
