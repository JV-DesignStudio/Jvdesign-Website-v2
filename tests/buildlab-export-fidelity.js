#!/usr/bin/env node
/*
 * tests/buildlab-export-fidelity.js
 * A2130: proves the game-asset export fixes.
 *
 * Builds a grouped, moved crate and checks:
 *  - GLB/RBXM keep the group offset (world transforms)
 *  - GLB nodes and meshes keep part names
 *  - hidden blocks are left out of every format
 *  - RBXM uses the same Roblox stud scale as the Roblox GLB profile
 *  - gizmo rotate/scale survive export and save slots
 *  - merge-by-material produces fewer meshes
 *  - numeric W/H/D and rotation input works
 *  - centre X/Z and base to 0 move the pivot to the base centre
 *  - share codes and save slots keep world transforms
 *  - the preview reports visible parts, triangles and hidden blocks
 *
 * Run: node tests/buildlab-export-fidelity.js
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19282;
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server = http.createServer((req,res)=>{
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
  let off = 12;
  let json = null;
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
    page.on('dialog', d => d.accept('Crate_Group'));
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
        await new Promise(r => setTimeout(r, 150));
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
    // 1. Grouped, moved crate: world transforms and names in GLB
    // ---------------------------------------------------------
    const built = await page.evaluate(() => {
      window.clearAll(true);
      window.setEngineContext('unity');
      const body = window.addBlock(0, 0, 0, 2, 2, 2, '#8b5a2b', 'box');
      body.userData.blockName = 'Crate_Body';
      const lid = window.addBlock(0, 2, 0, 2.2, 0.2, 2.2, '#6b4423', 'box');
      lid.userData.blockName = 'Crate_Lid';
      window.selectAllBlocks();
      window.groupSelectedBlocks();
      window.moveGroup(0, 3, 0, 0);
      return {
        world: window.blocks.map(b => { const v = new THREE.Vector3(); b.getWorldPosition(v); return v.toArray(); }),
        stats: document.getElementById('polyStats').textContent,
        measure: document.getElementById('vpMeasure').textContent
      };
    });
    check('crate parts sit at x=3 after the group move', near(built.world[0][0], 3) && near(built.world[1][0], 3), JSON.stringify(built.world));
    check('stats show triangles and vertices', /triangles/.test(built.stats) && /vertices/.test(built.stats), built.stats);
    check('measurement badge names metres', /\bm\b/.test(built.measure), built.measure);

    const glb1 = await capture('exportGLTF');
    const g1 = glb1.b64 ? parseGlb(glb1.b64) : null;
    const byName = (g, n) => (g.nodes || []).find(x => x.name === n);
    const nodeBody = g1 && byName(g1, 'Crate_Body');
    const nodeLid = g1 && byName(g1, 'Crate_Lid');
    check('GLB nodes keep part names', !!nodeBody && !!nodeLid, (g1 && g1.nodes.map(n => n.name).join(',')) || glb1.error);
    check('GLB keeps the grouped world offset', !!nodeBody && near(nodeBody.matrix[12], 3) && near(nodeLid.matrix[12], 3),
      nodeBody && nodeLid ? 'body x=' + nodeBody.matrix[12] + ' lid x=' + nodeLid.matrix[12] : 'missing');
    check('every GLB mesh node keeps a part name', g1 && g1.nodes.filter(n => n.mesh !== undefined).every(n => !!n.name),
      g1 && JSON.stringify(g1.nodes.map(n => n.name)));

    // Share code + save slot must keep the world offset too.
    const share = await page.evaluate(() => {
      const code = window.getShareCode();
      const before = window.blocks.map(b => { const v = new THREE.Vector3(); b.getWorldPosition(v); return +v.x.toFixed(2); });
      window.clearAll(true);
      window.importShareCodeData(window.decodeShareCode(code));
      const after = window.blocks.map(b => { const v = new THREE.Vector3(); b.getWorldPosition(v); return +v.x.toFixed(2); });
      return {before, after, names: window.blocks.map(b => b.userData.blockName)};
    });
    check('share code keeps the grouped world offset', JSON.stringify(share.before) === JSON.stringify(share.after), JSON.stringify(share));

    const saved = await page.evaluate(() => {
      const before = window.blocks.map(b => { const v = new THREE.Vector3(); b.getWorldPosition(v); return v.toArray(); });
      window.saveSlotOpen();
      const s = document.querySelector('#modalSaveSlots .save-slot');
      if (s) s.click();
      window.clearAll(true);
      const slot = document.querySelector('#saveSlots .save-slot.filled');
      if (slot) slot.click();
      const after = window.blocks.map(b => { const v = new THREE.Vector3(); b.getWorldPosition(v); return v.toArray(); });
      return {before, after, names: window.blocks.map(b => b.userData.blockName), found: !!slot};
    });
    check('save slot keeps the grouped world offset', saved.found && near(saved.before[0][0], saved.after[0][0]) && near(saved.after[0][0], 3), JSON.stringify(saved));
    check('save slot keeps part names', saved.names.includes('Crate_Body') && saved.names.includes('Crate_Lid'), saved.names.join(','));

    // ---------------------------------------------------------
    // 2. Hidden blocks and preview counts
    // ---------------------------------------------------------
    const hidden = await page.evaluate(() => {
      // Save slots flatten groups, so regroup the loaded crate before checking
      // the "groups are flattened" preview line.
      window.selectAllBlocks();
      window.groupSelectedBlocks();
      const lid = window.blocks.find(b => b.userData.blockName === 'Crate_Lid');
      window.toggleBlockVisibility(lid.userData.blockId);
      window.showExportPreview('objmtl', () => {});
      const text = document.getElementById('exportPreviewContent').textContent;
      window.closeModal('exportPreviewModal');
      return {text, count: window.collectExportParts().length};
    });
    check('hidden block excluded from the part collector', hidden.count === 1, String(hidden.count));
    check('preview reports hidden blocks', /1 hidden block/.test(hidden.text), hidden.text);
    check('preview reports flattened groups for OBJ+MTL', /flattened on export/.test(hidden.text), hidden.text);

    const hObj = await capture('exportOBJ');
    const hMtl = await capture('exportOBJWithMTL');
    const hRbx = await capture('exportRBXM');
    const hGlb = await capture('exportGLTF');
    const hg = hGlb.b64 ? parseGlb(hGlb.b64) : null;
    check('hidden excluded from OBJ', ((hObj.text0 || '').match(/^o /gm) || []).length === 1, ((hObj.text0 || '').match(/^o /gm) || []).length + ' objects');
    check('hidden excluded from OBJ+MTL', ((hMtl.text0 || '').match(/^f /gm) || []).length === 12, ((hMtl.text0 || '').match(/^f /gm) || []).length + ' faces');
    check('hidden excluded from RBXM', ((hRbx.text0 || '').match(/<Item class="Part"/g) || []).length === 1, ((hRbx.text0 || '').match(/<Item class="Part"/g) || []).length + ' parts');
    check('hidden excluded from GLB', hg && hg.meshes.length === 1, hg ? String(hg.meshes.length) : hGlb.error);

    // ---------------------------------------------------------
    // 3. RBXM world position + Roblox stud scale
    // ---------------------------------------------------------
    const rbx = hRbx.text0 || '';
    const rbxBodyName = /<string name="Name">Crate_Body<\/string>/.test(rbx);
    const rbxX = (rbx.match(/<string name="Name">Crate_Body<\/string>\s*<CoordinateFrame name="CFrame">\s*<X>([^<]+)<\/X>/) || [])[1];
    const rbxSize = (rbx.match(/<string name="Name">Crate_Body<\/string>[\s\S]*?<Vector3 name="Size"><X>([^<]+)<\/X>/) || [])[1];
    check('RBXM keeps the part name', rbxBodyName, rbxBodyName ? 'yes' : 'missing');
    check('RBXM position uses the grouped world offset and stud scale', near(parseFloat(rbxX), 3 * (1 / 0.28), 0.02), 'x=' + rbxX);
    check('RBXM size uses the stud scale', near(parseFloat(rbxSize), 2 * (1 / 0.28), 0.02), 'x=' + rbxSize);

    // ---------------------------------------------------------
    // 4. Roblox GLB and RBXM agree on scale
    // ---------------------------------------------------------
    const roblox = await page.evaluate(() => {
      window.clearAll(true);
      window.setEngineContext('roblox');
      window.addBlock(0, 0, 0, 1, 1, 1, '#e94560', 'box');
      return window.currentExportProfile();
    });
    const glbR = await capture('exportGLTF');
    const gr = glbR.b64 ? parseGlb(glbR.b64) : null;
    const rootNode = gr && (gr.nodes || []).find(n => Array.isArray(n.children));
    const rootScale = rootNode ? rootNode.matrix[0] : null;
    const rbxR = await capture('exportRBXM');
    const rbxRSX = (rbxR.text0 || '').match(/<Vector3 name="Size"><X>([^<]+)<\/X>/) || [];
    check('Roblox GLB root carries 3.571 stud scaling', near(rootScale, 1 / 0.28, 0.001), 'scale=' + rootScale);
    check('Roblox RBXM size matches the GLB stud scale', near(parseFloat(rbxRSX[1]), 1 / 0.28, 0.02), 'x=' + rbxRSX[1]);
    await page.evaluate(() => window.setEngineContext('unity'));

    // ---------------------------------------------------------
    // 5. Gizmo rotate/scale is baked into data and exports
    // ---------------------------------------------------------
    const gizmo = await page.evaluate(() => {
      window.clearAll(true);
      const m = window.addBlock(0, 0, 0, 2, 2, 2, '#e94560', 'box');
      window.selectBlock(m);
      // Simulate the live mesh changes the rotate/scale gizmo makes.
      m.rotation.y = Math.PI / 2;
      m.scale.set(2, 1, 1);
      window.bakeGizmoTransform();
      window.saveSlotOpen();
      const s = document.querySelector('#modalSaveSlots .save-slot');
      if (s) s.click();
      const slot = JSON.parse(localStorage.getItem('jvds_builder_saves') || '[]')[0];
      return {
        w: m.userData.w, rot: m.userData.rot,
        saved: slot && slot.blocks && slot.blocks[0]
      };
    });
    check('gizmo scale is baked into block width', near(gizmo.w, 4), 'w=' + gizmo.w);
    check('gizmo rotation is baked into block rotation', near(gizmo.rot, 90), 'rot=' + gizmo.rot);
    check('save slot stores the baked size and rotation', near(gizmo.saved.w, 4) && near(gizmo.saved.rot, 90), JSON.stringify(gizmo.saved));
    const gRbx = await capture('exportRBXM');
    const gRbxSize = (gRbx.text0 || '').match(/<Vector3 name="Size"><X>([^<]+)<\/X>/) || [];
    const gRbxR02 = (gRbx.text0 || '').match(/<R02>([^<]+)<\/R02>/) || [];
    check('RBXM exports the baked gizmo size', near(parseFloat(gRbxSize[1]), 4 * (1 / 0.28), 0.02), 'x=' + gRbxSize[1]);
    check('RBXM exports the baked gizmo rotation', near(parseFloat(gRbxR02[1]), 1, 0.001), 'R02=' + gRbxR02[1]);

    // ---------------------------------------------------------
    // 6. Merge by material
    // ---------------------------------------------------------
    const merged = await page.evaluate(() => {
      window.clearAll(true);
      window.toggleMergeExport(true);
      window.addBlock(0, 0, 0, 1, 1, 1, '#e94560', 'box');
      window.addBlock(2, 0, 0, 1, 1, 1, '#e94560', 'box');
      window.addBlock(4, 0, 0, 1, 1, 1, '#5bc0f8', 'box');
      return {on: true};
    });
    const glbM = await capture('exportGLTF');
    const gm = glbM.b64 ? parseGlb(glbM.b64) : null;
    const mtlM = await capture('exportOBJWithMTL');
    check('merge-by-material gives two GLB meshes', gm && gm.meshes.length === 2, gm ? String(gm.meshes.length) : glbM.error);
    check('merged GLB nodes are named', gm && gm.nodes.filter(n => n.mesh !== undefined).every(n => /^Merged_/.test(n.name || '')), gm && JSON.stringify(gm.nodes.map(n => n.name)));
    check('merged OBJ+MTL has two objects and two materials', ((mtlM.text0 || '').match(/^o /gm) || []).length === 2 && ((mtlM.text0 || '').match(/^usemtl /gm) || []).length === 2, JSON.stringify({o:((mtlM.text0||'').match(/^o /gm)||[]).length, u:((mtlM.text0||'').match(/^usemtl /gm)||[]).length}));
    await page.evaluate(() => window.toggleMergeExport(false));

    // ---------------------------------------------------------
    // 7. Numeric input, pivot actions
    // ---------------------------------------------------------
    const numeric = await page.evaluate(() => {
      window.clearAll(true);
      const m = window.addBlock(3, 0, 2, 1, 1, 1, '#e94560', 'box');
      window.selectBlock(m);
      window.updateProp('w', '3.7');
      window.updateProp('rot', '37');
      const wVal = document.getElementById('propWNum').value;
      const rotVal = document.getElementById('propRotNum').value;
      window.centreBuildAtOrigin();
      window.pivotBuildToBase();
      const box = new THREE.Box3();
      window.blocks.forEach(b => box.expandByObject(b));
      return {w: m.userData.w, rot: m.userData.rot, wVal, rotVal, min: box.min.toArray(), max: box.max.toArray()};
    });
    check('numeric width accepts 3.7', near(numeric.w, 3.7) && numeric.wVal === '3.7', JSON.stringify(numeric));
    check('numeric rotation accepts 37 degrees', near(numeric.rot, 37) && numeric.rotVal === '37', JSON.stringify(numeric));
    check('centre X/Z puts the footprint on the origin', near((numeric.min[0] + numeric.max[0]) / 2, 0) && near((numeric.min[2] + numeric.max[2]) / 2, 0), JSON.stringify(numeric));
    check('base to 0 grounds the build', near(numeric.min[1], 0), JSON.stringify(numeric.min));

    check('zero runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally {
    await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
  }
  if (failures) {
    console.log('\n' + failures + ' CHECK(S) FAILED');
    process.exit(1);
  }
  console.log('\nALL BUILDLAB EXPORT FIDELITY CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
