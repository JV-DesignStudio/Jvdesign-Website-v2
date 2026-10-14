// A1478: BuildLab GLB/GLTF import. Drives the real file input with a minimal
// .glb (binary container) and .gltf (JSON + data URI), then checks the model
// lands in the scene as editable, re-exportable parts.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19254;
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(root, url));
  if (!file.startsWith(path.normalize(root))) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});
const listen = () => new Promise((r) => server.listen(port, r));

let failures = 0;
const check = (name, ok, detail = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; };

// A single triangle, as both a GLB binary container and a .gltf JSON with a
// base64 data URI buffer.
const POSITIONS = Buffer.from(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer);
function gltfJson(uri) {
  return {
    asset: { version: '2.0' },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    buffers: uri ? [{ byteLength: 36, uri }] : [{ byteLength: 36 }],
  };
}
function buildGlb() {
  let json = Buffer.from(JSON.stringify(gltfJson(null)), 'utf8');
  while (json.length % 4) json = Buffer.concat([json, Buffer.from(' ')]);
  let bin = POSITIONS;
  while (bin.length % 4) bin = Buffer.concat([bin, Buffer.from([0])]);
  const total = 12 + 8 + json.length + 8 + bin.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546C67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(total, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(json.length, 0); jh.writeUInt32LE(0x4E4F534A, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004E4942, 4);
  return Buffer.concat([header, jh, json, bh, bin]);
}
function buildGltf() {
  const uri = 'data:application/octet-stream;base64,' + POSITIONS.toString('base64');
  return Buffer.from(JSON.stringify(gltfJson(uri)), 'utf8');
}

(async () => {
  await listen();
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') console.log('   [page console.error] ' + m.text()); });
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://127.0.0.1:' + port + '/tools/buildlab.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#viewport canvas, #viewport.engine-error', { timeout: 20000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 700));
    await page.evaluate(() => { try { window.closeModal('welcomeModal'); } catch (e) {} const w = document.getElementById('welcomeModal'); if (w) w.classList.remove('open'); document.body.classList.remove('bl-modal-open'); });

    async function importFile(buf, fileName, mimeType) {
      const b64 = buf.toString('base64');
      return page.evaluate(async (b64, fileName, mimeType) => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const file = new File([bytes], fileName, { type: mimeType });
        const input = document.getElementById('importGLTFInput');
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        const before = window.blocks.length;
        window.handleImportGLTF(input);
        const t0 = Date.now();
        while (Date.now() - t0 < 8000) {
          await new Promise((r) => setTimeout(r, 100));
          if (window.blocks.length > before) break;
        }
        const parts = window.blocks.slice(before).map((b) => ({
          imported: !!b.userData.isImported,
          shape: b.userData.shape,
          verts: b.geometry && b.geometry.attributes.position ? b.geometry.attributes.position.count : 0,
          box: b.userData.w > 0 && b.userData.h > 0 && b.userData.d > 0,
        }));
        return { added: window.blocks.length - before, parts };
      }, b64, fileName, mimeType);
    }

    // 1. GLB binary import
    const glb = await importFile(buildGlb(), 'triangle.glb', 'model/gltf-binary');
    check('GLB import adds a part', glb.added === 1, 'added=' + glb.added);
    check('GLB part is an editable imported block', glb.parts[0] && glb.parts[0].imported && glb.parts[0].shape === 'gltf', JSON.stringify(glb.parts[0]));
    check('GLB part carries geometry + bounds', !!glb.parts[0] && glb.parts[0].verts === 3 && glb.parts[0].box, JSON.stringify(glb.parts[0]));

    // 2. GLTF (JSON text) import, with the model added alongside the GLB part
    const gltf = await importFile(buildGltf(), 'triangle.gltf', 'model/gltf+json');
    check('GLTF (text) import adds a part', gltf.added === 1, 'added=' + gltf.added);

    const total = await page.evaluate(() => window.blocks.length);
    check('imports add to the scene (no destructive clear)', total === 2, 'blocks=' + total);

    // 3. Round-trip: re-export the imported parts as OBJ text and as GLB.
    const objText = await page.evaluate(async () => {
      // Capture the real OBJ download rather than reaching into an internal
      // helper, so this stays valid whatever the export code is called.
      let captured = null;
      const origCreate = URL.createObjectURL;
      const origClick = HTMLAnchorElement.prototype.click;
      URL.createObjectURL = function (blob) { captured = blob; return 'blob:stub'; };
      HTMLAnchorElement.prototype.click = function () {};
      try { window.exportOBJ(); } finally {
        URL.createObjectURL = origCreate;
        HTMLAnchorElement.prototype.click = origClick;
      }
      await new Promise((r) => setTimeout(r, 150));
      return captured ? await captured.text() : '';
    });
    const vLines = (objText.match(/^v /gm) || []).length;
    const fLines = (objText.match(/^f /gm) || []).length;
    check('round-trip OBJ export contains imported geometry', vLines >= 6 && fLines >= 2, 'v=' + vLines + ' f=' + fLines);

    const glbOut = await page.evaluate(async () => {
      const g = new THREE.Group();
      window.blocks.forEach((b) => {
        const m = new THREE.Mesh(b.geometry, b.material);
        m.position.copy(b.position); m.quaternion.copy(b.quaternion); m.scale.copy(b.scale);
        g.add(m);
      });
      const exporter = new GLTFExporter();
      const result = await new Promise((res, rej) => exporter.parse(g, res, rej, { binary: true }));
      return result instanceof ArrayBuffer ? result.byteLength : 0;
    });
    check('round-trip GLB export produces a model', glbOut > 100, 'bytes=' + glbOut);

    check('no page errors during import/export', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures === 0 ? 'ALL BUILDLAB IMPORT CHECKS PASSED' : failures + ' FAILURE(S)');
  process.exit(failures === 0 ? 0 : 1);
})();
