const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const PAGE = '/workshops/3d-builder.html?preset=phone-stand';
let failures = 0;

function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

function mimeOf(file) {
  return {
    '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff',
    '.ico': 'image/x-icon', '.zip': 'application/zip'
  }[path.extname(file)] || 'application/octet-stream';
}

function parseStl(text) {
  const tris = [];
  let verts = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('vertex ')) {
      const p = line.split(/\s+/).slice(1).map(Number);
      verts.push(p);
      if (verts.length === 3) {
        tris.push(verts);
        verts = [];
      }
    }
  }
  return tris;
}

function stlEdges(tris) {
  const q = 100000;
  const map = new Map();
  const key = (p) => Math.round(p[0] * q) + ',' + Math.round(p[1] * q) + ',' + Math.round(p[2] * q);
  const edges = new Map();
  let minY = Infinity, maxX = -Infinity, minX = Infinity, maxZ = -Infinity, minZ = Infinity;
  for (const tri of tris) {
    const ids = tri.map((p) => {
      const k = key(p);
      if (!map.has(k)) map.set(k, map.size);
      if (p[1] < minY) minY = p[1];
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[2] < minZ) minZ = p[2];
      if (p[2] > maxZ) maxZ = p[2];
      return map.get(k);
    });
    for (const [a, b] of [[ids[0], ids[1]], [ids[1], ids[2]], [ids[2], ids[0]]]) {
      const k = Math.min(a, b) + ':' + Math.max(a, b);
      edges.set(k, (edges.get(k) || 0) + 1);
    }
  }
  let boundary = 0, nonmanifold = 0;
  for (const count of edges.values()) {
    if (count === 1) boundary++;
    else if (count > 2) nonmanifold++;
  }
  return { boundary, nonmanifold, minY, size: [maxX - minX, 0, maxZ - minZ] };
}

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(root, u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404);
    return res.end('missing ' + u);
  }
  res.writeHead(200, { 'Content-Type': mimeOf(f) });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  server.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('dialog', async (d) => { errors.push('unexpected dialog: ' + d.message()); await d.dismiss(); });
    await page.setRequestInterception(true);
    page.on('request', (r) => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(base + PAGE, { waitUntil: 'load' });
    await page.waitForFunction(() => window.JVExporter && window.JVExporter.currentGroup && window.JVExporter.currentGroup(), { timeout: 30000 });
    await new Promise((r) => setTimeout(r, 500));

    const out = await page.evaluate(() => {
      const m = window.JVExporter.currentModel(false);
      const pc = window.JVExporter.printCheck(m);
      window.JVExporter.openDialog();
      const panel = document.querySelector('#jvPrintPanel');
      const status = document.querySelector('#jvExportStatus');
      const unreal = window.JVExporter.printCheck(window.JVExporter.collect(window.JVExporter.currentGroup(), {
        units: 'mm', profile: 'unreal', name: 'phone-stand-test'
      }));
      const metres = window.JVExporter.printCheck(window.JVExporter.collect(window.JVExporter.currentGroup(), {
        units: 'm', profile: 'generic', name: 'phone-stand-test'
      }));
      return {
        version: window.JVExporter.version,
        parts: window.JVExporter.summary(m).parts,
        partNames: m.parts.map((p) => p.name),
        summary: window.JVExporter.summary(m),
        pc: pc,
        unreal: unreal,
        metres: metres,
        stl: window.JVExporter.stl(m, 'print check test').text,
        panelHidden: panel ? panel.hidden : null,
        panelText: panel ? panel.textContent : '',
        statusText: status ? status.textContent : '',
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });

    check('exporter version is 1.5.0', out.version === '1.5.0', out.version);
    check('printCheck is exposed', !!out.pc && Array.isArray(out.pc.checks), out.pc ? out.pc.checks.length + ' checks' : 'missing');
    check('phone ghost preview is not in the exported model', !out.partNames.includes('phone_ghost_preview'), out.partNames.join(','));
    check('default stand sits on Y=0', out.summary.minYAsBuilt === 0, String(out.summary.minYAsBuilt));
    check('default stand passes the print check', out.pc.ok === true, out.pc.verdict);
    check('shape is watertight', out.pc.watertight === true && out.pc.boundaryEdges === 0 && out.pc.nonManifoldEdges === 0, JSON.stringify({ b: out.pc.boundaryEdges, n: out.pc.nonManifoldEdges }));
    check('no degenerate triangles', out.pc.degenerateTriangles === 0, String(out.pc.degenerateTriangles));
    check('size is in millimetres', Math.abs(out.pc.sizeMm[0] - 100) < 0.1 && Math.abs(out.pc.sizeMm[2] - 80) < 0.1, out.pc.sizeMm.join(' x '));
    check('model fits a common bed', out.pc.checks.find((c) => c.id === 'bed').status === 'pass');
    check('model has a flat base', out.pc.baseAreaMm2 > 0, out.pc.baseAreaMm2 + ' mm2');
    check('engine-converted export is not ready to print', out.unreal.ok === false && out.unreal.checks.some((c) => c.id === 'profile' && c.status === 'fail'), out.unreal.verdict);
    check('metre build is not ready to print', out.metres.ok === false && out.metres.checks.some((c) => c.id === 'units' && c.status === 'fail'), out.metres.verdict);

    const tris = parseStl(out.stl);
    const stl = stlEdges(tris);
    check('STL has the expected triangle count', tris.length === out.summary.triangles, tris.length + ' vs ' + out.summary.triangles);
    check('STL is watertight when parsed independently', stl.boundary === 0 && stl.nonmanifold === 0, JSON.stringify(stl));
    check('STL sits on Y=0', stl.minY === 0, String(stl.minY));
    check('STL footprint matches the model', Math.abs(stl.size[0] - out.summary.size[0]) < 0.01 && Math.abs(stl.size[2] - out.summary.size[2]) < 0.01, stl.size.join(' x '));

    check('print panel is visible for a millimetre builder', out.panelHidden === false);
    check('print panel gives a verdict', /Ready, with notes|Ready to print/.test(out.panelText), out.panelText.slice(0, 80));
    check('print panel lists the watertight check', /Closed, watertight shape/.test(out.panelText));
    check('print panel lists the base check', /Sits flat on the bed/.test(out.panelText));
    check('status separates export from print readiness', /print check: ready/.test(out.statusText), out.statusText);
    check('dialog does not overflow at 1440px', out.overflow <= 2, String(out.overflow));

    await page.select('#jvProfileSelect', 'unreal');
    const profilePanel = await page.$eval('#jvPrintPanel', (el) => el.textContent);
    check('print panel reacts to an engine profile', /Not ready to print/.test(profilePanel) && /converted for Unreal/.test(profilePanel), profilePanel.slice(0, 100));
    await page.select('#jvProfileSelect', 'generic');

    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.goto(base + PAGE, { waitUntil: 'load' });
    await page.waitForFunction(() => window.JVExporter, { timeout: 30000 });
    const mobile = await page.evaluate(() => {
      window.JVExporter.openDialog();
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        panel: !!document.querySelector('#jvPrintPanel') && !document.querySelector('#jvPrintPanel').hidden
      };
    });
    check('print panel appears at 390px', mobile.panel === true);
    check('dialog does not overflow at 390px', mobile.overflow <= 2, String(mobile.overflow));
    check('zero runtime errors', errors.length === 0, errors.join(' | ').slice(0, 400));
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) {
    console.log('\n' + failures + ' CHECK(S) FAILED');
    process.exit(1);
  }
  console.log('\nALL 3D PRINT CHECK TESTS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
