#!/usr/bin/env node
/*
 * tests/buildlab-texture-cors.js
 * A2751: verifies textures can never taint the export canvas.
 *
 * Covers converting same-origin images to local data URLs, rejecting a
 * cross-origin texture that lacks CORS, refusing to attach it, keeping
 * toDataURL and the GLB exporter unlocked after a texture is painted, and the
 * painted texture still being local.
 *
 * Run: node tests/buildlab-texture-cors.js
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19421;
const altPort = 19422;
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.wasm':'application/wasm','.woff2':'font/woff2'};

const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z0ZkAAAAASUVORK5CYII=', 'base64');

function serve(portNumber, allow, special) {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      if (special && special[url]) { res.writeHead(200, {'Content-Type': 'image/png'}); res.end(special[url]); return; }
      if (!allow(url)) { res.writeHead(403); res.end(); return; }
      const file = path.normalize(path.join(root, url));
      if (!file.startsWith(path.normalize(root))) { res.writeHead(403); res.end('Forbidden'); return; }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'});
        res.end(data);
      });
    });
    srv.listen(portNumber, () => resolve(srv));
  });
}

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
  const main = await serve(port, () => true);
  // A second origin that deliberately sends no CORS headers.
  const alt = await serve(altPort, () => false, {'/tex.png': PNG_1PX});
  const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewport({width: 1440, height: 900});
    await page.evaluateOnNewDocument(() => { try { localStorage.clear(); localStorage.setItem('buildlab_kidmode', '0'); } catch (e) {} });
    await page.goto('http://127.0.0.1:' + port + '/tools/buildlab.html', {waitUntil: 'domcontentloaded', timeout: 30000});
    await page.waitForFunction(() => typeof window.localTextureDataUrl === 'function', {timeout: 20000});
    await page.waitForFunction(() => !!document.querySelector('#viewport canvas'), {timeout: 25000});
    await pause(500);
    await page.evaluate(() => {
      try { closeModal('welcomeModal'); } catch (e) {}
      const w = document.getElementById('welcomeModal');
      if (w) w.classList.remove('open');
      document.body.classList.remove('bl-modal-open');
      window.clearAll(true);
    });

    const local = await page.evaluate(async () => {
      const dataUrl = await window.localTextureDataUrl('/logo.png');
      return {isLocal: window.isLocalTextureUrl(dataUrl), prefix: String(dataUrl).slice(0, 22), length: dataUrl.length};
    });
    check('a same-origin image becomes a local data URL', local.isLocal && /^data:image\//.test(local.prefix), JSON.stringify(local));

    const cross = await page.evaluate(async (alt) => {
      let message = null;
      try {
        await window.localTextureDataUrl('http://127.0.0.1:' + alt + '/tex.png');
      } catch (e) { message = String(e && e.message || e); }
      return {rejected: !!message, message};
    }, altPort);
    check('a cross-origin image without CORS is rejected', cross.rejected, String(cross.message));

    const guarded = await page.evaluate(async (alt) => {
      const f = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
      const u8 = new Uint8Array(f.buffer);
      let bin = '';
      for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
      const mesh = window.addImportedPartFromData({p: btoa(bin), w: 1, h: 1, d: 0.1, colour: '#8b5a2b', name: 'CORS test', tex: 'http://127.0.0.1:' + alt + '/tex.png'});
      const immediate = !!(mesh.material && mesh.material.map);
      await new Promise(r => setTimeout(r, 500));
      const after = !!(mesh.material && mesh.material.map);
      let exportOk = null;
      try { exportOk = window.renderer.domElement.toDataURL('image/png').startsWith('data:image/png'); } catch (e) { exportOk = String(e && e.message || e); }
      return {
        immediate,
        after,
        textureData: mesh.userData.textureData,
        exportOk
      };
    }, altPort);
    check('an external texture is never attached directly', guarded.immediate === false && guarded.after === false, JSON.stringify({immediate: guarded.immediate, after: guarded.after}));
    check('the rejected texture leaves no URL behind', guarded.textureData === null, String(guarded.textureData));
    check('the export canvas stays unlocked after the attempt', guarded.exportOk === true, String(guarded.exportOk));

    const painted = await page.evaluate(async () => {
      window.clearAll(true);
      window.addBlock(0, 0, 0, 1, 1, 1, '#ff0000', 'box');
      window.selectAllBlocks();
      window.startTexturePaint();
      document.getElementById('textureColour').value = '#0000ff';
      window.beginTextureStroke();
      window.texturePaintDab(0.5, 0.5, 18);
      window.texturePaintUp();
      const mesh = window.blocks[0];
      let url = null;
      try { url = window.renderer.domElement.toDataURL('image/png'); } catch (e) { url = 'ERR ' + e.message; }
      return {
        localTexture: window.isLocalTextureUrl(mesh.userData.textureData),
        prefix: String(mesh.userData.textureData || '').slice(0, 22),
        exportUnlocked: url.startsWith('data:image/png'),
        converted: await window.prepareTexturesForExport()
      };
    });
    check('a painted texture is stored as a local data URL', painted.localTexture && /^data:image\//.test(painted.prefix), painted.prefix);
    check('painted textures keep canvas export unlocked', painted.exportUnlocked, String(painted.exportUnlocked));
    check('export finds no non-local textures to convert', painted.converted === 0, String(painted.converted));

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
    check('the textured GLB export completes', !!(gltf && gltf.images && gltf.images.length > 0), gltf ? String(gltf.images.length) : 'no glb');

    check('zero runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await page.close().catch(() => {});
  } finally {
    await browser.close().catch(() => {});
    await new Promise(r => main.close(r));
    await new Promise(r => alt.close(r));
  }
  if (failures) {
    console.log('\n' + failures + ' CHECK(S) FAILED');
    process.exit(1);
  }
  console.log('\nALL BUILDLAB TEXTURE CORS CHECKS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
