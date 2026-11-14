#!/usr/bin/env node
/*
 * tests/buildlab-texture-paint.js
 * A2743: verifies the 3D texture paint mode.
 *
 * Covers preparing a part with a local canvas texture, painting a dab, undo,
 * save/share round-trip of the texture data URL, GLB embedding, the panel and
 * the touch-safe path at 390px.
 *
 * Run: node tests/buildlab-texture-paint.js
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19411;
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
    for (const vp of [{name: 'desktop', w: 1440, h: 900, m: false}, {name: 'mobile', w: 390, h: 844, m: true}]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({width: vp.w, height: vp.h, isMobile: vp.m, hasTouch: vp.m});
      await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) {} });
      await page.goto('http://127.0.0.1:' + port + '/tools/buildlab.html', {waitUntil: 'domcontentloaded', timeout: 30000});
      await page.waitForFunction(() => typeof window.startTexturePaint === 'function', {timeout: 20000});
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

      const start = await page.evaluate(() => {
        window.addBlock(0, 0, 0, 1, 1, 1, '#ff0000', 'box');
        window.selectAllBlocks();
        const mesh = window.startTexturePaint();
        return {
          blocks: window.blocks.length,
          imported: !!mesh.userData.isImported,
          state: window.texturePaintState(),
          tex: mesh.userData.textureData,
          basePixel: window.texturePaintPixel(128, 256)
        };
      });
      check(vp.name + ': texture paint prepares one part', start.blocks === 1 && start.imported, JSON.stringify({blocks: start.blocks, imported: start.imported}));
      check(vp.name + ': the part gets a local texture with UVs', start.state.active && start.state.hasMap && start.state.uv && start.state.canvas, JSON.stringify(start.state));
      check(vp.name + ': the canvas starts with the part colour', JSON.stringify(start.basePixel) === JSON.stringify([255, 0, 0, 255]), JSON.stringify(start.basePixel));

      const paint = await page.evaluate((initialTex) => {
        document.getElementById('textureColour').value = '#0000ff';
        document.getElementById('textureBrush').value = '20';
        window.beginTextureStroke();
        window.texturePaintDab(0.25, 0.5, 20);
        window.texturePaintUp();
        const painted = window.texturePaintPixel(128, 256);
        const paintedData = window.blocks[0].userData.textureData;
        const project = window.buildProjectData();
        const code = window.getShareCode();
        window.undo();
        return {
          painted,
          changed: paintedData !== initialTex && paintedData.length > 100,
          projectImports: project.imports.length,
          projectTex: !!(project.imports[0] && project.imports[0].tex),
          codeLen: code.length,
          undoData: window.blocks[0].userData.textureData,
          initialState: initialTex
        };
      }, start.tex);
      check(vp.name + ': painting changes the texture pixels', paint.painted[2] > 200 && paint.painted[0] < 60, JSON.stringify(paint.painted));
      check(vp.name + ': the stroke stores a texture data URL', paint.changed, paint.changed ? 'data url' : 'missing');
      check(vp.name + ': the texture saves and shares', paint.projectImports === 1 && paint.projectTex && paint.codeLen > 100, JSON.stringify({imports: paint.projectImports, tex: paint.projectTex, code: paint.codeLen}));
      check(vp.name + ': undo restores the pre-stroke texture', paint.undoData === paint.initialState, (paint.undoData || '').slice(0, 24));

      const roundTrip = await page.evaluate(() => {
        window.clearAll(true);
        window.addBlock(0, 0, 0, 1, 1, 1, '#ff0000', 'box');
        window.selectAllBlocks();
        window.startTexturePaint();
        document.getElementById('textureColour').value = '#00ff00';
        window.beginTextureStroke();
        window.texturePaintDab(0.5, 0.5, 24);
        window.texturePaintUp();
        const project = window.buildProjectData();
        const code = window.getShareCode();
        window.clearAll(true);
        window.loadProjectData(project);
        const byProject = {
          blocks: window.blocks.length,
          imports: window.serializeImportedParts().length,
          tex: !!(window.blocks[0] && window.blocks[0].userData.textureData),
          uv: !!(window.blocks[0] && window.blocks[0].geometry.attributes.uv)
        };
        window.clearAll(true);
        window.importShareCodeData(window.decodeShareCode(code));
        const byShare = {
          blocks: window.blocks.length,
          imports: window.serializeImportedParts().length,
          tex: !!(window.blocks[0] && window.blocks[0].userData.textureData)
        };
        return { codeLen: code.length, byProject, byShare };
      });
      check(vp.name + ': a saved texture reloads with the part', roundTrip.byProject.blocks === 1 && roundTrip.byProject.imports === 1 && roundTrip.byProject.tex && roundTrip.byProject.uv, JSON.stringify(roundTrip.byProject));
      check(vp.name + ': a shared texture reloads with the part', roundTrip.codeLen > 100 && roundTrip.byShare.blocks === 1 && roundTrip.byShare.imports === 1 && roundTrip.byShare.tex, JSON.stringify({codeLen: roundTrip.codeLen, byShare: roundTrip.byShare}));

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
      const hasTexture = !!(gltf && Array.isArray(gltf.images) && gltf.images.length > 0 && Array.isArray(gltf.textures) && gltf.textures.length > 0);
      const hasBaseColor = !!(gltf && Array.isArray(gltf.materials) && gltf.materials.some(m => m.pbrMetallicRoughness && m.pbrMetallicRoughness.baseColorTexture));
      check(vp.name + ': GLB embeds the painted texture', hasTexture, gltf ? 'images ' + (gltf.images || []).length : 'no glb');
      check(vp.name + ': GLB material uses the texture', hasBaseColor, gltf ? 'materials ' + (gltf.materials || []).length : 'no glb');

      const ui = await page.evaluate(() => ({
        desktop: !!document.querySelector('#right-panel [data-on="startTexturePaint"]'),
        mobile: !!document.querySelector('#mob-panel-actions [data-on="startTexturePaint"]'),
        brush: !!document.getElementById('textureBrush'),
        colour: !!document.getElementById('textureColour'),
        proOnly: (() => {
          const btn = document.querySelector('#right-panel [data-on="startTexturePaint"]');
          const sec = btn ? btn.closest('.panel-section') : null;
          return !!(sec && sec.hasAttribute('data-pro-only'));
        })()
      }));
      check(vp.name + ': texture paint has a brush and colour control', ui.desktop && ui.brush && ui.colour);
      check(vp.name + ': texture paint is reachable on mobile', ui.mobile);
      check(vp.name + ': texture paint is pro-only', ui.proOnly);

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
  console.log('\nALL BUILDLAB TEXTURE PAINT CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
