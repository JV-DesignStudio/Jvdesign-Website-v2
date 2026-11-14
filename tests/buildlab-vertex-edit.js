#!/usr/bin/env node
/*
 * tests/buildlab-vertex-edit.js
 * A2742: verifies the opt-in Vertex / Edge edit mode.
 *
 * Covers converting a part into an editable mesh, draggable vertex and edge
 * handles, grid snapping, per-drag undo, save/share round-trip, the Pro-only
 * toggle, and the safe 390px path.
 *
 * Run: node tests/buildlab-vertex-edit.js
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19409;
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

async function ready(page, vp) {
  await page.setViewport({width: vp.w, height: vp.h, isMobile: vp.m, hasTouch: vp.m});
  await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://127.0.0.1:' + port + '/tools/buildlab.html', {waitUntil: 'domcontentloaded', timeout: 30000});
  await page.waitForFunction(() => typeof window.startVertexEdit === 'function', {timeout: 20000});
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
}

(async () => {
  await new Promise(r => server.listen(port, r));
  const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await ready(page, {w: 1440, h: 900, m: false});

    const vertex = await page.evaluate(() => {
      window.addBlock(0, 0, 0, 1, 1, 1, '#e94560', 'box');
      window.selectAllBlocks();
      const mesh = window.startVertexEdit('vertex');
      const state = window.vertexEditState();
      const before = state.handlePositions[0];
      const moved = window.moveEditHandle(0, 0.5, 0.5, 0);
      const after = window.vertexEditState();
      return {
        blocks: window.blocks.length,
        imported: !!mesh.userData.isImported,
        state,
        before,
        after: after.handlePositions[0],
        movedMesh: moved === window.blocks[0],
        imports: window.serializeImportedParts().length
      };
    });
    check('vertex edit turns the part into one editable mesh', vertex.blocks === 1 && vertex.imported, JSON.stringify({blocks: vertex.blocks, imported: vertex.imported}));
    check('vertex edit shows one handle per corner', vertex.state.active && vertex.state.mode === 'vertex' && vertex.state.handles === 8, JSON.stringify(vertex.state));
    check('moving a handle reshapes the mesh', JSON.stringify(vertex.after) !== JSON.stringify(vertex.before), JSON.stringify({before: vertex.before, after: vertex.after}));
    check('handle moves snap to the grid', vertex.after.every(v => Math.abs(v - Math.round(v)) < 1e-6), JSON.stringify(vertex.after));
    check('the edited mesh stays a saveable part', vertex.imports === 1 && vertex.movedMesh, JSON.stringify({imports: vertex.imports, moved: vertex.movedMesh}));

    const undo = await page.evaluate(() => {
      window.undo();
      const one = {blocks: window.blocks.length, edited: window.blocks[0] ? window.blocks[0].userData.isImported : false};
      window.undo();
      const two = {blocks: window.blocks.length, edited: window.blocks[0] ? !!window.blocks[0].userData.isImported : false};
      return {one, two};
    });
    check('undo restores the pre-drag mesh', undo.one.blocks === 1 && undo.one.edited, JSON.stringify(undo.one));
    check('undo again restores the original block', undo.two.blocks === 1 && !undo.two.edited, JSON.stringify(undo.two));

    const roundTrip = await page.evaluate(() => {
      window.selectAllBlocks();
      window.startVertexEdit('vertex');
      window.moveEditHandle(0, 1, 0, 0);
      const project = window.buildProjectData();
      const code = window.getShareCode();
      const editedHandles = window.vertexEditState().handlePositions;
      window.finishVertexEdit();
      window.clearAll(true);
      window.loadProjectData(project);
      const loaded = {imports: window.serializeImportedParts().length, blocks: window.blocks.length};
      window.selectAllBlocks();
      window.startVertexEdit('vertex');
      const loadedHandles = window.vertexEditState().handlePositions;
      const obj = window.buildOBJText();
      return {imports: project.imports.length, codeLen: code.length, loaded, editedHandles, loadedHandles, objVerts: (obj.match(/^v /gm) || []).length};
    });
    check('edited geometry saves and shares', roundTrip.imports === 1 && roundTrip.codeLen > 20, JSON.stringify({imports: roundTrip.imports, codeLen: roundTrip.codeLen}));
    check('edited geometry reloads from a project file', roundTrip.loaded.imports === 1 && roundTrip.loaded.blocks === 1, JSON.stringify(roundTrip.loaded));
    check('reloaded handles keep the edited position', JSON.stringify(roundTrip.loadedHandles[0]) === JSON.stringify(roundTrip.editedHandles[0]), JSON.stringify({edited: roundTrip.editedHandles[0], loaded: roundTrip.loadedHandles[0]}));
    check('edited geometry exports to OBJ', roundTrip.objVerts > 0, String(roundTrip.objVerts));

    const edge = await page.evaluate(() => {
      window.finishVertexEdit();
      window.clearAll(true);
      window.addBlock(0, 0, 0, 1, 1, 1, '#e94560', 'box');
      window.selectAllBlocks();
      window.startEdgeEdit();
      const state = window.vertexEditState();
      const before = window.blocks[0].geometry.attributes.position.array.slice();
      window.moveEditHandle(0, 0, 1, 0);
      const after = window.blocks[0].geometry.attributes.position.array;
      let changed = 0;
      for (let i = 0; i < before.length; i += 3) {
        if (before[i] !== after[i] || before[i + 1] !== after[i + 1] || before[i + 2] !== after[i + 2]) changed++;
      }
      return {state, changed};
    });
    check('edge edit offers edge handles', edge.state.active && edge.state.mode === 'edge' && edge.state.handles > 0, JSON.stringify(edge.state));
    check('edge edit moves both ends of the edge', edge.changed >= 2, String(edge.changed));

    const pro = await page.evaluate(() => {
      const btn = document.querySelector('[data-on="startVertexEdit"]');
      const section = btn ? btn.closest('.panel-section') : null;
      return {present: !!btn, proOnly: !!(section && section.hasAttribute('data-pro-only'))};
    });
    check('the Vertex Edit panel exists', pro.present);
    check('the Vertex Edit panel is hidden in simple mode', pro.proOnly);

    await page.close().catch(() => {});

    const mobile = await browser.newPage();
    const mobileErrors = [];
    mobile.on('pageerror', e => mobileErrors.push(e.message));
    await ready(mobile, {w: 390, h: 844, m: true});
    const safe = await mobile.evaluate(() => {
      window.addBlock(0, 0, 0, 1, 1, 1, '#e94560', 'box');
      window.selectAllBlocks();
      const before = window.blocks.length;
      const mesh = window.startVertexEdit('vertex');
      return {before, after: window.blocks.length, mesh: !!mesh, state: window.vertexEditState()};
    });
    check('mobile: vertex edit degrades safely at 390px', safe.after === 1 && safe.mesh === false && safe.state.active === false, JSON.stringify(safe));
    check('mobile: no runtime errors', mobileErrors.length === 0, mobileErrors.slice(0, 3).join(' | '));
    await mobile.close().catch(() => {});

    check('desktop: no runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally {
    await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
  }
  if (failures) {
    console.log('\n' + failures + ' CHECK(S) FAILED');
    process.exit(1);
  }
  console.log('\nALL BUILDLAB VERTEX EDIT CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
