#!/usr/bin/env node
/*
 * tests/buildlab-dev-tools.js
 * A2134: verifies the simple dev-tool pass.
 *
 * Covers gizmo snapping + Shift bypass, pivot feedback + export origin,
 * pre-export preflight, accurate OBJ above 150 blocks, project round-trip with
 * imported geometry/groups/manifest, orthographic toggle, ruler, multi-select
 * pivot transform and duplicate array.
 *
 * Run: node tests/buildlab-dev-tools.js
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19289;
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
const near = (a, b, eps = 0.01) => Math.abs(a - b) <= eps;
function parseGlb(b64) {
  const buf = Buffer.from(b64, 'base64');
  let off = 12, json = null;
  while (off < buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    if (type === 0x4E4F534A) json = JSON.parse(buf.toString('utf8', off + 8, off + 8 + len));
    off += 8 + len;
  }
  return json;
}

(async () => {
  await new Promise(r => server.listen(port, r));
  const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']});
  try {
    const page = await browser.newPage();
    page.on('dialog', d => d.accept('TestGroup'));
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewport({width: 1440, height: 900});
    await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) {} });
    await page.goto('http://127.0.0.1:' + port + '/tools/buildlab.html', {waitUntil: 'domcontentloaded', timeout: 30000});
    await page.waitForFunction(() => typeof window.addBlock === 'function', {timeout: 20000});
    await new Promise(r => setTimeout(r, 900));
    await page.evaluate(() => {
      try { closeModal('welcomeModal'); } catch (e) {}
      const w = document.getElementById('welcomeModal');
      if (w) w.classList.remove('open');
      document.body.classList.remove('bl-modal-open');
      const cb = document.getElementById('cookie-banner');
      if (cb) { const b = cb.querySelector('button'); if (b) b.click(); }
      window.clearAll(true);
    });

    async function capture(fnName) {
      return await page.evaluate(async (fn) => {
        const blobs = [];
        const names = [];
        const origCreate = document.createElement.bind(document);
        const origURL = URL.createObjectURL;
        document.createElement = function (tag) {
          const el = origCreate(tag);
          if (String(tag).toLowerCase() === 'a') el.click = function () { names.push(el.download); };
          return el;
        };
        URL.createObjectURL = function (blob) { blobs.push(blob); return 'blob:stub'; };
        try { window[fn](); } catch (e) { return {error: String(e)}; }
        const need = fn === 'exportOBJWithMTL' ? 2 : 1;
        const t0 = Date.now();
        while (blobs.length < need && Date.now() - t0 < 12000) await new Promise(r => setTimeout(r, 60));
        await new Promise(r => setTimeout(r, 120));
        document.createElement = origCreate;
        URL.createObjectURL = origURL;
        const out = {names};
        for (let i = 0; i < blobs.length; i++) {
          if (fn === 'exportGLTF') {
            const buf = await blobs[i].arrayBuffer();
            const u8 = new Uint8Array(buf);
            let bin = '';
            for (let j = 0; j < u8.length; j += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(j, j + 0x8000));
            out.b64 = btoa(bin);
          } else {
            out['text' + i] = await blobs[i].text();
          }
        }
        return out;
      }, fnName);
    }

    // ---------------------------------------------------------
    // 1. Gizmo snapping and Shift bypass
    // ---------------------------------------------------------
    const snap = await page.evaluate(() => {
      window.setGridSize('0.5');
      const snapped = window.gizmoSnapState();
      document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Shift', bubbles: true}));
      const bypass = window.gizmoSnapState();
      document.dispatchEvent(new KeyboardEvent('keyup', {key: 'Shift', bubbles: true}));
      const restored = window.gizmoSnapState();
      window.setGridSize('0');
      const off = window.gizmoSnapState();
      window.setGridSize('1');
      return {snapped, bypass, restored, off};
    });
    check('gizmo translation snaps to the grid', near(snap.snapped.translation, 0.5), JSON.stringify(snap.snapped));
    check('gizmo rotation snaps to 15 degrees', near(snap.snapped.rotation, Math.PI / 12, 0.0001), String(snap.snapped.rotation));
    check('Shift bypasses every gizmo snap', snap.bypass.bypass && snap.bypass.translation === null && snap.bypass.rotation === null, JSON.stringify(snap.bypass));
    check('releasing Shift restores snapping', near(snap.restored.translation, 0.5) && !snap.restored.bypass, JSON.stringify(snap.restored));
    check('grid Off disables translation snap', snap.off.translation === null, JSON.stringify(snap.off));

    // ---------------------------------------------------------
    // 2. Pivot feedback and export origin
    // ---------------------------------------------------------
    const pivot = await page.evaluate(() => {
      window.clearAll(true);
      window.addBlock(3, 0, 2, 1, 1, 1, '#e94560', 'box');
      const before = window.pivotStatus().text;
      const badgeBefore = document.getElementById('pivotStatus').textContent;
      window.centreBuildAtOrigin();
      window.pivotBuildToBase();
      const after = window.pivotStatus();
      return {before, badgeBefore, after, badgeAfter: document.getElementById('pivotStatus').textContent};
    });
    check('pivot status reports an off-origin build', /off by/.test(pivot.before), pivot.before);
    check('pivot status turns green after centring and grounding', pivot.after.centred && pivot.after.grounded && /centred/.test(pivot.badgeAfter), pivot.badgeAfter);

    await page.evaluate(() => {
      window.clearAll(true);
      window.addBlock(3, 0, 2, 1, 1, 1, '#e94560', 'box');
      window.toggleOriginBase(true);
    });
    const glbOrigin = await capture('exportGLTF');
    const go = glbOrigin.b64 ? parseGlb(glbOrigin.b64) : null;
    const originNode = go && go.nodes.find(n => n.mesh !== undefined);
    check('export origin moves the base centre to 0,0,0', !!originNode && near(originNode.matrix[12], 0) && near(originNode.matrix[13], 0.5) && near(originNode.matrix[14], 0), originNode && JSON.stringify(originNode.matrix));
    await page.evaluate(() => window.toggleOriginBase(false));

    // ---------------------------------------------------------
    // 2b. Block-size calibration
    // ---------------------------------------------------------
    const scale = await page.evaluate(() => {
      window.setBlockScale('0.5');
      window.clearAll(true);
      window.addBlock(0, 0, 0, 1, 1, 1, '#e94560', 'box');
      const measure = document.getElementById('vpMeasure').textContent;
      window.clearMeasure();
      window.addMeasurePoint(new THREE.Vector3(0, 0, 0));
      const d = window.addMeasurePoint(new THREE.Vector3(3, 4, 0));
      const hud = document.getElementById('measureHud').textContent;
      return {measure, d, hud};
    });
    check('block size changes the measurement badge', /0\.50×0\.50×0\.50 m/.test(scale.measure), scale.measure);
    check('block size changes ruler metres', near(scale.d, 2.5) && /2\.50 m/.test(scale.hud), JSON.stringify(scale));
    const glbScale = await capture('exportGLTF');
    const gs = glbScale.b64 ? parseGlb(glbScale.b64) : null;
    const scaleNode = gs && gs.nodes.find(n => Array.isArray(n.children));
    check('GLB applies the block-size scale', !!scaleNode && near(scaleNode.matrix[0], 0.5, 0.001), scaleNode && String(scaleNode.matrix[0]));
    const rbxScale = await capture('exportRBXM');
    const rbxSize = (rbxScale.text0 || '').match(/<Vector3 name="Size"><X>([^<]+)<\/X>/) || [];
    check('RBXM applies the block-size scale', near(parseFloat(rbxSize[1]), 0.5 / 0.28, 0.02), 'x=' + rbxSize[1]);
    await page.evaluate(() => window.setBlockScale('1'));

    // ---------------------------------------------------------
    // 3. Preflight
    // ---------------------------------------------------------
    const preflight = await page.evaluate(() => {
      window.clearAll(true);
      const a = window.addBlock(0, 0, 0, 1, 1, 1, '#e94560', 'box'); a.userData.blockName = 'Crate';
      const b = window.addBlock(1, 0, 0, 1, 1, 1, '#e94560', 'box'); b.userData.blockName = 'Crate';
      window.setShape('cone'); window.addBlock(2, 0, 0, 1, 1, 1, '#00d4aa', 'cone');
      for (let i = 0; i < 20; i++) window.addBlock(4 + i, 0, 0, 1, 1, 1, '#5bc0f8', 'box');
      const rows = window.buildPreflight('rbxm');
      window.showExportPreview('rbxm', () => {});
      const text = document.getElementById('exportPreviewContent').textContent;
      const enabled = !document.getElementById('exportPreviewConfirm').disabled;
      window.closeModal('exportPreviewModal');
      return {rows, text, enabled};
    });
    const flat = preflight.rows.map(r => r.text).join(' | ');
    check('preflight flags duplicate part names', /Duplicate part names: Crate/.test(flat), flat);
    check('preflight warns about RBXM shape loss', /RBXM has no Part shape/.test(flat), flat);
    check('preflight warns about separate meshes', /separate (meshes|parts)/.test(flat), flat);
    check('preflight renders inside the export modal', /Preflight/.test(preflight.text) && preflight.enabled, preflight.text.slice(0, 120));

    const geometryChecks = await page.evaluate(() => {
      window.clearAll(true);
      window.addBlock(0, 0, 0, 1, 1, 1, '#e94560', 'box');
      window.addBlock(0.2, 0, 0, 1, 1, 1, '#00d4aa', 'box');
      window.addBlock(3, 0, 0, 0.02, 1, 1, '#5bc0f8', 'box');
      window.addBlock(5.3, 0, 0, 1, 1, 1, '#f5a623', 'box');
      return window.buildPreflight('gltf').map(r => r.text).join(' | ');
    });
    check('preflight flags overlapping parts', /overlap/.test(geometryChecks), geometryChecks);
    check('preflight flags tiny parts', /thinner than 0\.05/.test(geometryChecks), geometryChecks);
    check('preflight flags off-grid parts', /off the 1 m grid/.test(geometryChecks), geometryChecks);

    const zero = await page.evaluate(() => {
      window.blocks.forEach(b => { b.visible = false; b.userData.hidden = true; });
      const rows = window.buildPreflight('gltf');
      window.showExportPreview('gltf', () => {});
      const confirm = document.getElementById('exportPreviewConfirm');
      const result = {error: rows.some(r => r.level === 'error'), disabled: confirm.disabled, label: confirm.textContent};
      window.blocks.forEach(b => { b.visible = true; b.userData.hidden = false; });
      window.closeModal('exportPreviewModal');
      return result;
    });
    check('preflight blocks an empty export', zero.error && zero.disabled && /Fix errors/.test(zero.label), JSON.stringify(zero));

    // ---------------------------------------------------------
    // 4. Accurate OBJ above the old worker threshold
    // ---------------------------------------------------------
    const big = await page.evaluate(() => {
      window.clearAll(true);
      for (let i = 0; i < 151; i++) window.addBlock(i % 40, 0, Math.floor(i / 40), 1, 1, 1, '#e94560', 'box');
      return window.blocks.length;
    });
    const bigObj = await capture('exportOBJ');
    const bigText = bigObj.text0 || '';
    check('151-block build exports all 151 OBJ objects', ((bigText.match(/^o /gm) || []).length) === big, String((bigText.match(/^o /gm) || []).length));
    check('large OBJ is no longer a box approximation', !/box-approx/.test(bigText), bigText.split('\n')[0]);

    // ---------------------------------------------------------
    // 5. Project, save slot, share code and manifest round-trip
    // ---------------------------------------------------------
    const roundTrip = await page.evaluate(() => {
      window.clearAll(true);
      const a = window.addBlock(0, 0, 0, 1, 1, 1, '#e94560', 'box'); a.userData.blockName = 'Base';
      const b = window.addBlock(2, 0, 0, 1, 1, 1, '#00d4aa', 'box'); b.userData.blockName = 'Top';
      window.selectAllBlocks(); window.groupSelectedBlocks();
      const f = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
      const bytes = new Uint8Array(f.buffer);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const uv = new Float32Array([0, 0, 1, 0, 0, 1]);
      const uvBytes = new Uint8Array(uv.buffer);
      let uvBin = '';
      for (let i = 0; i < uvBytes.length; i++) uvBin += String.fromCharCode(uvBytes[i]);
      window.addImportedPartFromData({p: btoa(bin), u: btoa(uvBin), w: 1, h: 1, d: 0.1, colour: '#8b5a2b', metalness: 0.2, roughness: 0.4, opacity: 1, name: 'Tri', hidden: false});
      const manifest = window.buildManifest();
      const project = window.buildProjectData();
      window.clearAll(true);
      window.loadProjectData(project);
      const importedMesh = window.blocks.find(x => x.userData.isImported);
      const after = {
        blocks: window.blocks.length,
        groups: window.groups.length,
        imported: window.blocks.filter(x => x.userData.isImported).length,
        names: window.blocks.map(x => x.userData.blockName),
        uv: !!(importedMesh && importedMesh.geometry.attributes.uv)
      };
      window.saveSlotOpen();
      const s = document.querySelector('#modalSaveSlots .save-slot');
      if (s) s.click();
      window.clearAll(true);
      const slot = document.querySelector('#saveSlots .save-slot.filled');
      if (slot) slot.click();
      const slotAfter = {blocks: window.blocks.length, groups: window.groups.length, imported: window.blocks.filter(x => x.userData.isImported).length};
      const code = window.getShareCode();
      window.clearAll(true);
      const loaded = window.importShareCodeData(window.decodeShareCode(code));
      const shareAfter = {blocks: window.blocks.length, groups: window.groups.length, imported: window.blocks.filter(x => x.userData.isImported).length, code: code.length, loaded};
      return {manifest, after, slotAfter, shareAfter};
    });
    check('project keeps imported geometry', roundTrip.after.imported === 1 && roundTrip.after.blocks === 3, JSON.stringify(roundTrip.after));
    check('project keeps imported UVs', roundTrip.after.uv === true, JSON.stringify(roundTrip.after));
    check('project keeps group membership', roundTrip.after.groups === 1 && roundTrip.after.names.includes('Base'), JSON.stringify(roundTrip.after));
    check('manifest lists parts and triangles', roundTrip.manifest.parts.length === 3 && roundTrip.manifest.counts.triangles === 25, JSON.stringify(roundTrip.manifest.counts));
    check('save slot keeps imported geometry and groups', roundTrip.slotAfter.imported === 1 && roundTrip.slotAfter.groups === 1, JSON.stringify(roundTrip.slotAfter));
    check('share code keeps imported geometry and groups', roundTrip.shareAfter.imported === 1 && roundTrip.shareAfter.groups === 1 && roundTrip.shareAfter.code < 8000, JSON.stringify(roundTrip.shareAfter));

    const collision = await page.evaluate(() => {
      window.clearAll(true);
      window.addBlock(0, 0, 0, 1, 1, 1, '#e94560', 'box');
      window.addBlock(2, 0, 0, 1, 2, 1, '#00d4aa', 'box');
      const text = window.buildCollisionOBJText();
      return {objects: (text.match(/^o /gm) || []).length, faces: (text.match(/^f /gm) || []).length};
    });
    check('collision proxy has one box per part', collision.objects === 2 && collision.faces === 24, JSON.stringify(collision));

    const bundle = await page.evaluate(async () => {
      const pack = await window.buildBundleZip();
      return pack ? pack.files : null;
    });
    check('asset bundle includes manifest and collision proxy', !!bundle && bundle.includes('manifest.json') && bundle.includes('README.txt') && bundle.some(f => /_collision\.obj$/.test(f)), JSON.stringify(bundle));

    const autosave = await page.evaluate(async () => {
      window.clearAll(true);
      window.addBlock(0, 0, 0, 1, 1, 1, '#e94560', 'box');
      window.addBlock(2, 0, 0, 1, 1, 1, '#00d4aa', 'box');
      window.selectAllBlocks();
      window.groupSelectedBlocks();
      const f = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
      const bytes = new Uint8Array(f.buffer);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      window.addImportedPartFromData({p: btoa(bin), w: 1, h: 1, d: 0.1, colour: '#8b5a2b', name: 'AutoShape'});
      await new Promise(r => setTimeout(r, 1000));
      const raw = localStorage.getItem('buildlab_autosave');
      window.clearAll(true);
      if (raw) localStorage.setItem('buildlab_autosave', raw);
      const ok = window.restoreAutosave();
      return {
        ok,
        blocks: window.blocks.length,
        imported: window.blocks.filter(b => b.userData.isImported).length,
        groups: window.groups.length
      };
    });
    check('autosave keeps imported geometry and groups', autosave.ok && autosave.imported === 1 && autosave.groups === 1, JSON.stringify(autosave));

    // ---------------------------------------------------------
    // 6. Orthographic toggle, ruler, multi transform, array
    // ---------------------------------------------------------
    const ortho = await page.evaluate(() => {
      const start = window.camera.isPerspectiveCamera;
      window.toggleOrtho();
      const isOrtho = !!window.camera.isOrthographicCamera;
      const left1 = window.camera.left;
      window.zoomOut();
      const left2 = window.camera.left;
      window.toggleOrtho();
      return {start, isOrtho, left1, left2, back: window.camera.isPerspectiveCamera};
    });
    check('orthographic toggle switches the camera', ortho.start && ortho.isOrtho && ortho.back, JSON.stringify(ortho));
    check('ortho zoom changes the frustum', Math.abs(ortho.left2) > Math.abs(ortho.left1), JSON.stringify(ortho));

    const ruler = await page.evaluate(() => {
      window.clearMeasure();
      window.addMeasurePoint(new THREE.Vector3(0, 0, 0));
      const d = window.addMeasurePoint(new THREE.Vector3(3, 4, 0));
      const hud = document.getElementById('measureHud').textContent;
      window.clearMeasure();
      return {d, hud};
    });
    check('ruler measures 3-4-5 distance in metres', near(ruler.d, 5) && /5.00 m/.test(ruler.hud), JSON.stringify(ruler));

    const multi = await page.evaluate(() => {
      window.clearAll(true);
      const a = window.addBlock(0, 0, 0, 1, 1, 1, '#e94560', 'box');
      const b = window.addBlock(2, 0, 0, 1, 1, 1, '#00d4aa', 'box');
      window.selectAllBlocks();
      window.attachSelectionGizmo();
      const attached = window.transformControls.object === window.multiPivot;
      window.pushHistory('multi-test');
      window.beginMultiTransform();
      window.multiPivot.position.x += 2;
      window.multiPivot.updateMatrixWorld(true);
      window.applyMultiTransform();
      const moved = window.blocks.map(m => { const v = new THREE.Vector3(); m.getWorldPosition(v); return +v.x.toFixed(2); });
      window.endMultiTransform();
      window.undo();
      const undone = window.blocks.map(m => { const v = new THREE.Vector3(); m.getWorldPosition(v); return +v.x.toFixed(2); });
      return {attached, moved, undone};
    });
    check('multi-select attaches the gizmo to a pivot', multi.attached, String(multi.attached));
    check('multi-select moves every selected block together', near(multi.moved[0], 2) && near(multi.moved[1], 4), JSON.stringify(multi.moved));
    check('undo restores a multi-select transform', near(multi.undone[0], 0) && near(multi.undone[1], 2), JSON.stringify(multi.undone));

    const mobileMulti = await page.evaluate(() => {
      window.clearAll(true);
      window.addBlock(0, 0, 0, 1, 1, 1, '#e94560', 'box');
      window.addBlock(2, 0, 0, 1, 1, 1, '#00d4aa', 'box');
      window.selectAllBlocks();
      window.nudgeSelection(1, 0, 0);
      return window.blocks.map(m => +m.position.x.toFixed(2));
    });
    check('mobile multi nudge moves every selected block', JSON.stringify(mobileMulti) === JSON.stringify([1, 3]), JSON.stringify(mobileMulti));

    const array = await page.evaluate(() => {
      window.clearAll(true);
      const base = window.addBlock(0, 0, 0, 1, 1, 1, '#e94560', 'box');
      base.userData.blockName = 'Post';
      window.selectBlock(base);
      document.getElementById('arrayCount').value = '3';
      document.getElementById('arrayStep').value = '1';
      window.setArrayAxis('x');
      window.arraySelected();
      return {
        count: window.blocks.length,
        xs: window.blocks.map(m => { const v = new THREE.Vector3(); m.getWorldPosition(v); return +v.x.toFixed(2); }).sort((a, b) => a - b),
        names: window.blocks.map(m => m.userData.blockName)
      };
    });
    check('array duplicates along the chosen axis', array.count === 4 && JSON.stringify(array.xs) === JSON.stringify([0, 1, 2, 3]), JSON.stringify(array));
    check('array copies keep readable names', array.names.includes('Post 1') && array.names.includes('Post 3'), array.names.join(','));

    const undo = await page.evaluate(() => {
      window.clearAll(true);
      const f = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
      const bytes = new Uint8Array(f.buffer);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const imp = window.addImportedPartFromData({p: btoa(bin), w: 1, h: 1, d: 0.1, colour: '#8b5a2b', name: 'UndoShape'});
      imp.position.set(4, 0.5, 0);
      imp.updateMatrixWorld(true);
      window.pushHistory('test-import-delete');
      window.deleteBlock(imp);
      const deleted = window.blocks.filter(b => b.userData.isImported).length;
      window.undo();
      const restored = window.blocks.filter(b => b.userData.isImported).length;
      const pos = window.blocks.filter(b => b.userData.isImported)[0];
      const restoredPos = pos ? pos.position.toArray().map(v => +v.toFixed(2)) : null;

      window.clearAll(true);
      const base = window.addBlock(0, 0, 0, 1, 1, 1, '#e94560', 'box');
      window.selectBlock(base);
      document.getElementById('arrayCount').value = '2';
      document.getElementById('arrayStep').value = '1';
      window.arraySelected();
      const afterArray = window.blocks.length;
      window.undo();
      const afterUndo = window.blocks.length;
      return {deleted, restored, restoredPos, afterArray, afterUndo};
    });
    check('undo restores a deleted imported mesh and its position', undo.deleted === 0 && undo.restored === 1 && JSON.stringify(undo.restoredPos) === JSON.stringify([4, 0.5, 0]), JSON.stringify(undo));
    check('undo removes an array in one step', undo.afterArray === 3 && undo.afterUndo === 1, JSON.stringify(undo));

    check('zero runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally {
    await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
  }
  if (failures) {
    console.log('\n' + failures + ' CHECK(S) FAILED');
    process.exit(1);
  }
  console.log('\nALL BUILDLAB DEV-TOOL CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
