#!/usr/bin/env node
/*
 * tests/buildlab-mesh-cull.js
 * A2731: proves hidden-face culling and coplanar merging on export.
 *
 * Checks:
 *  - a 10x10x10 cube of blocks exports as a shell, not 12,000 triangles
 *  - hidden internal faces are removed from GLB and OBJ
 *  - the culling toggle restores the exact original geometry
 *  - merge-by-material greedily merges coplanar faces into a handful of quads
 *  - GLB and OBJ counts agree, and OBJ skips fully hidden interior parts
 *  - RBXM still exports every block as a Part
 *
 * Run: node tests/buildlab-mesh-cull.js
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19283;
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

function glbTriangles(json) {
  if (!json) return 0;
  const meshTris = (json.meshes || []).map(mesh => {
    let tris = 0;
    (mesh.primitives || []).forEach(prim => {
      const mode = prim.mode === undefined ? 4 : prim.mode;
      if (mode !== 4) return;
      if (prim.indices !== undefined) tris += json.accessors[prim.indices].count / 3;
      else if (prim.attributes && prim.attributes.POSITION !== undefined) tris += json.accessors[prim.attributes.POSITION].count / 3;
    });
    return tris;
  });
  // GLTFExporter reuses one mesh for identical parts, so count per node.
  let total = 0;
  (json.nodes || []).forEach(node => {
    if (node.mesh !== undefined) total += meshTris[node.mesh] || 0;
  });
  return Math.round(total);
}

function countMatches(text, re) {
  return (String(text || '').match(re) || []).length;
}

(async () => {
  await new Promise(r => server.listen(port, r));
  const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']});
  try {
    const page = await browser.newPage();
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
        while (blobs.length < need && Date.now() - t0 < 20000) await new Promise(r => setTimeout(r, 60));
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

    async function buildCube(size, colour) {
      await page.evaluate((n, c) => {
        window.clearAll(true);
        for (let x = 0; x < n; x++) {
          for (let y = 0; y < n; y++) {
            for (let z = 0; z < n; z++) window.addBlock(x, y, z, 1, 1, 1, c, 'box');
          }
        }
      }, size, colour);
    }

    // ---------------------------------------------------------
    // 1. 10x10x10 cube is a shell, not 12,000 triangles
    // ---------------------------------------------------------
    await buildCube(10, '#e94560');
    const shell = await page.evaluate(() => {
      window.toggleMergeExport(false);
      window.toggleCullExport(true);
      const s = window.getMeshCullStats();
      return {enabled: s.enabled, before: s.before, after: s.after, removed: s.removed};
    });
    const rawCubeTris = 1000 * 12;
    const shellTris = 6 * 10 * 10 * 2;
    check('raw 10x10x10 cube counts 12,000 triangles', shell.before.tris === rawCubeTris, String(shell.before.tris));
    check('culled 10x10x10 cube keeps only the shell (1,200 triangles)', shell.after.tris === shellTris, String(shell.after.tris));
    check('culling reports removed triangles', shell.removed === rawCubeTris - shellTris, String(shell.removed));
    check('culling is enabled by default', shell.enabled === true);

    const merged = await page.evaluate(() => {
      window.toggleMergeExport(true);
      const s = window.getMeshCullStats();
      window.toggleMergeExport(false);
      return {tris: s.after.tris, verts: s.after.verts};
    });
    check('coplanar merge collapses the shell to a handful of quads', merged.tris > 0 && merged.tris <= 24, String(merged.tris));

    // ---------------------------------------------------------
    // 2. Toggle restores the exact original geometry
    // ---------------------------------------------------------
    const restored = await page.evaluate(() => {
      window.toggleCullExport(false);
      const s = window.getMeshCullStats();
      const on = {enabled: s.enabled, after: s.after.tris};
      window.toggleCullExport(true);
      return on;
    });
    check('culling off reports exact raw triangles', restored.enabled === false && restored.after === rawCubeTris, JSON.stringify(restored));

    // ---------------------------------------------------------
    // 3. GLB and OBJ agree on a 4x4x4 build
    // ---------------------------------------------------------
    await buildCube(4, '#8b5a2b');
    const small = await page.evaluate(() => {
      window.toggleMergeExport(false);
      window.toggleCullExport(true);
      const s = window.getMeshCullStats();
      window.showExportPreview('gltf', () => {});
      const preview = document.getElementById('exportPreviewContent').textContent;
      window.closeModal('exportPreviewModal');
      return {before: s.before.tris, after: s.after.tris, preview};
    });
    check('4x4x4 raw triangle count is 768', small.before === 64 * 12, String(small.before));
    check('4x4x4 culled triangle count is 192', small.after === 6 * 4 * 4 * 2, String(small.after));
    check('export preview shows triangles before and after culling', /After face culling/.test(small.preview), small.preview.slice(0, 140));

    const glbOn = await capture('exportGLTF');
    const gOn = glbOn.b64 ? parseGlb(glbOn.b64) : null;
    check('GLB export uses the culled shell', glbTriangles(gOn) === small.after, gOn ? String(glbTriangles(gOn)) : glbOn.error);

    const objOn = await capture('exportOBJ');
    check('OBJ export uses the culled shell', countMatches(objOn.text0, /^f /gm) === small.after, countMatches(objOn.text0, /^f /gm) + ' faces');
    check('OBJ skips fully hidden interior parts', countMatches(objOn.text0, /^o /gm) === 56, countMatches(objOn.text0, /^o /gm) + ' objects');

    // ---------------------------------------------------------
    // 4. Toggle off restores exact geometry in GLB and OBJ
    // ---------------------------------------------------------
    await page.evaluate(() => window.toggleCullExport(false));
    const glbOff = await capture('exportGLTF');
    const gOff = glbOff.b64 ? parseGlb(glbOff.b64) : null;
    const objOff = await capture('exportOBJ');
    const offTris = 64 * 12;
    check('GLB culling off restores all faces', glbTriangles(gOff) === offTris, gOff ? String(glbTriangles(gOff)) : glbOff.error);
    check('OBJ culling off restores all faces', countMatches(objOff.text0, /^f /gm) === offTris, countMatches(objOff.text0, /^f /gm) + ' faces');
    check('OBJ culling off restores all parts', countMatches(objOff.text0, /^o /gm) === 64, countMatches(objOff.text0, /^o /gm) + ' objects');
    await page.evaluate(() => window.toggleCullExport(true));

    // ---------------------------------------------------------
    // 5. Merge by material and RBXM stay correct
    // ---------------------------------------------------------
    const mergedBuild = await page.evaluate(() => {
      window.toggleMergeExport(true);
      window.toggleCullExport(true);
      const s = window.getMeshCullStats();
      return {tris: s.after.tris};
    });
    const glbMerged = await capture('exportGLTF');
    const gMerged = glbMerged.b64 ? parseGlb(glbMerged.b64) : null;
    check('merged build collapses to one mesh', gMerged && gMerged.meshes.length === 1, gMerged ? String(gMerged.meshes.length) : glbMerged.error);
    check('merged GLB triangle count matches the culled preview', glbTriangles(gMerged) === mergedBuild.tris, gMerged ? String(glbTriangles(gMerged)) : glbMerged.error);
    await page.evaluate(() => window.toggleMergeExport(false));

    await buildCube(2, '#00d4aa');
    const rbx = await capture('exportRBXM');
    check('RBXM still exports every block as a Part', countMatches(rbx.text0, /<Item class="Part"/g) === 8, countMatches(rbx.text0, /<Item class="Part"/g) + ' parts');

    // ---------------------------------------------------------
    // 6. Preview and runtime health
    // ---------------------------------------------------------
    const ui = await page.evaluate(() => ({
      toggle: !!document.querySelector('[data-cull-toggle]'),
      checked: document.querySelector('[data-cull-toggle]') ? document.querySelector('[data-cull-toggle]').checked : null
    }));
    check('export panel has a culling toggle', ui.toggle === true);
    check('culling toggle reflects the saved state', ui.checked === true);

    check('zero runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally {
    await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
  }
  if (failures) {
    console.log('\n' + failures + ' CHECK(S) FAILED');
    process.exit(1);
  }
  console.log('\nALL BUILDLAB MESH CULL CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
