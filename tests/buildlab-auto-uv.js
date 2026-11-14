#!/usr/bin/env node
/*
 * tests/buildlab-auto-uv.js
 * A2744: verifies automatic UVs for textured export.
 *
 * Covers generating UVs for a part with none, keeping existing UVs untouched on
 * non-textured parts, the UVs surviving save/share, and the GLB carrying both
 * TEXCOORD_0 and an embedded texture image so viewers show the painted colour.
 *
 * Run: node tests/buildlab-auto-uv.js
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19413;
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
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewport({width: 1440, height: 900});
    await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) {} });
    await page.goto('http://127.0.0.1:' + port + '/tools/buildlab.html', {waitUntil: 'domcontentloaded', timeout: 30000});
    await page.waitForFunction(() => typeof window.ensureMeshUVs === 'function', {timeout: 20000});
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

    const plain = await page.evaluate(() => {
      const box = window.addBlock(0, 0, 0, 1, 1, 1, '#e94560', 'box');
      box.updateMatrixWorld(true);
      const before = Array.from(box.geometry.attributes.uv.array).slice(0, 24);
      const changed = window.ensureMeshUVs(box);
      const after = Array.from(box.geometry.attributes.uv.array).slice(0, 24);
      return {changed, same: JSON.stringify(before) === JSON.stringify(after), count: box.geometry.attributes.uv.count};
    });
    check('a part with UVs is left alone', plain.changed === false && plain.same, JSON.stringify(plain));

    const wedge = await page.evaluate(() => {
      window.clearAll(true);
      const mesh = window.addBlock(0, 0, 0, 1, 1, 1, '#3366cc', 'wedge');
      const hadUV = !!mesh.geometry.attributes.uv;
      window.selectAllBlocks();
      window.startTexturePaint();
      const geo = window.blocks[0].geometry;
      const uv = geo.attributes.uv;
      let min = Infinity, max = -Infinity, nonZero = false;
      for (let i = 0; i < uv.count; i++) {
        const u = uv.getX(i), v = uv.getY(i);
        min = Math.min(min, u, v);
        max = Math.max(max, u, v);
        if (u !== 0 || v !== 0) nonZero = true;
      }
      return {hadUV, hasUV: !!uv, count: uv ? uv.count : 0, min: +min.toFixed(3), max: +max.toFixed(3), nonZero};
    });
    check('a wedge starts without UVs', wedge.hadUV === false);
    check('textured export generates UVs automatically', wedge.hasUV && wedge.count > 0 && wedge.nonZero, JSON.stringify(wedge));
    check('generated UVs stay inside 0..1', wedge.min >= 0 && wedge.max <= 1, JSON.stringify([wedge.min, wedge.max]));

    const roundTrip = await page.evaluate(() => {
      document.getElementById('textureColour').value = '#ffaa00';
      window.beginTextureStroke();
      window.texturePaintDab(0.4, 0.6, 18);
      window.texturePaintUp();
      const project = window.buildProjectData();
      const code = window.getShareCode();
      const imports = project.imports;
      window.clearAll(true);
      window.loadProjectData(project);
      const uv = window.blocks[0] && window.blocks[0].geometry.attributes.uv;
      return {
        projectUV: !!(imports[0] && imports[0].u),
        loadedUV: !!uv,
        loadedCount: uv ? uv.count : 0,
        codeLen: code.length
      };
    });
    check('generated UVs are saved in the project', roundTrip.projectUV, String(roundTrip.projectUV));
    check('generated UVs reload with the part', roundTrip.loadedUV && roundTrip.loadedCount > 0, JSON.stringify(roundTrip));

    const glb = await page.evaluate(async () => {
      const blobs = [];
      const origCreate = document.createElement.bind(document);
      const origURL = URL.createObjectURL;
      document.createElement = function (tag) {
        const el = origCreate(tag);
        if (String(tag).toLowerCase() === 'a') el.click = function () {};
        return el;
      };
      URL.createObjectURL = function (blob) { blobs.push(blob); return 'blob:stub'; };
      window.exportGLTF();
      const t0 = Date.now();
      while (!blobs.length && Date.now() - t0 < 12000) await new Promise(r => setTimeout(r, 60));
      let b64 = null;
      if (blobs[0]) {
        const buf = await blobs[0].arrayBuffer();
        const u8 = new Uint8Array(buf);
        let bin = '';
        for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        b64 = btoa(bin);
      }
      document.createElement = origCreate;
      URL.createObjectURL = origURL;
      return b64;
    });
    const gltf = glb ? parseGlb(glb) : null;
    const prims = gltf && gltf.meshes ? gltf.meshes.flatMap(m => m.primitives || []) : [];
    const hasTexcoord = prims.some(p => p.attributes && p.attributes.TEXCOORD_0 !== undefined);
    const hasImage = !!(gltf && Array.isArray(gltf.images) && gltf.images.length > 0);
    const hasTextureMaterial = !!(gltf && Array.isArray(gltf.materials) && gltf.materials.some(m => m.pbrMetallicRoughness && m.pbrMetallicRoughness.baseColorTexture));
    check('the GLB carries TEXCOORD_0', hasTexcoord, String(hasTexcoord));
    check('the GLB carries the texture image', hasImage, gltf ? String((gltf.images || []).length) : 'no glb');
    check('the GLB material points at the texture', hasTextureMaterial, gltf ? String((gltf.materials || []).length) : 'no glb');

    check('zero runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await page.close().catch(() => {});
  } finally {
    await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
  }
  if (failures) {
    console.log('\n' + failures + ' CHECK(S) FAILED');
    process.exit(1);
  }
  console.log('\nALL BUILDLAB AUTO UV CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
