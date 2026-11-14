// A3001: engine export options. Proves trim shrinks the packed sheet, padding
// grows it predictably, and the atlas carries the chosen pivot and trim offsets.
// Run: node tests/pixel-studio-export-options.js
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = Number(process.env.JVDS_EXPORT_OPT_PORT || 19302);
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(root, url));
  if (!file.startsWith(path.normalize(root))) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});
const listen = () => new Promise((resolve) => server.listen(port, resolve));

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

function makePage(browser, errors) {
  return browser.newPage().then(async (page) => {
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') {
        const t = m.text();
        if (!/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|net::ERR|ServiceWorker|sw\.js|is\.gd|The operation was aborted/i.test(t)) errors.push('console: ' + t);
      }
    });
    return page;
  });
}

(async () => {
  await listen();
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  // ---- 390 -------------------------------------------------------------
  {
    const errors = [];
    const page = await makePage(browser, errors);
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(`http://127.0.0.1:${port}/tools/pixel-studio.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction('(typeof frames!=="undefined") && frames.length>0 && typeof buildSheet==="function"', { timeout: 20000 });

    const out = await page.evaluate(() => {
      function frame() {
        const d = new Uint8ClampedArray(16 * 16 * 4);
        for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) {
          const i = (y * 16 + x) * 4; d[i] = 255; d[i + 1] = 80; d[i + 2] = 120; d[i + 3] = 255;
        }
        return d;
      }
      applyProject({ v: 3, cW: 16, cH: 16, fps: 8, layers: [{ name: 'Layer 1', visible: true }], frames: [[frame()], [frame()]] });
      const untrimmed = buildSheet({ trim: false, pad: 0 });
      const pad0 = buildSheet({ trim: false, pad: 0 });
      const pad2 = buildSheet({ trim: false, pad: 2 });
      exportTrim = true; exportPad = 0;
      const trimmed = buildSheet();
      setExportPivot(0);
      const atlasTop = buildAtlas().atlas;
      setExportPivot(7);
      const atlasBottom = buildAtlas().atlas;
      exportTrim = false; exportPad = 1; setExportPivot(4);
      return {
        untrimmedW: untrimmed.canvas.width,
        trimmedW: trimmed.canvas.width,
        trimmedFlag: trimmed.trim,
        trimmedFrame: trimmed.positions[0].trimmed,
        sourceOffset: trimmed.positions[0].offsetX,
        atlasTrim: atlasTop.frames.frame_0.trimmed,
        atlasFrame: atlasTop.frames.frame_0.frame,
        atlasSource: atlasTop.frames.frame_0.sourceSize,
        atlasSpriteSource: atlasTop.frames.frame_0.spriteSourceSize,
        pivotTop: atlasTop.frames.frame_0.pivot,
        pivotBottom: atlasBottom.frames.frame_0.pivot,
        pad0W: pad0.canvas.width,
        pad1W: buildSheet({ trim: false, pad: 1 }).canvas.width,
        pad2W: pad2.canvas.width,
        engineW: buildSheet({ trim: false, pad: 1 }).canvas.width,
        defaults: { trim: exportTrim, pad: exportPad, pivot: exportPivot }
      };
    });

    check('390: trim makes the packed sheet narrower', out.trimmedW < out.untrimmedW && out.trimmedW === 8, `${out.untrimmedW} -> ${out.trimmedW}`);
    check('390: trim marks the frame and keeps the offset', out.trimmedFlag && out.trimmedFrame && out.sourceOffset === 2, JSON.stringify({ trim: out.trimmedFlag, offset: out.sourceOffset }));
    check('390: atlas records the trim and source size', out.atlasTrim === true && out.atlasSource.w === 16 && out.atlasSpriteSource.x === 2 && out.atlasFrame.w === 4, JSON.stringify({ source: out.atlasSource, sprite: out.atlasSpriteSource, frame: out.atlasFrame }));
    check('390: padding grows every cell predictably', out.pad2W === out.pad0W + 8, `${out.pad0W} -> ${out.pad2W}`);
    check('390: per-frame pivots are written', out.pivotTop.x === 0 && out.pivotTop.y === 0 && out.pivotBottom.x === 0.5 && out.pivotBottom.y === 1, JSON.stringify({ top: out.pivotTop, bottom: out.pivotBottom }));
    check('390: engine pack keeps the untrimmed fixed grid', out.engineW === out.pad1W && out.engineW === 36, `${out.engineW}/${out.pad1W}`);
    check('390: defaults stay trim off, pad 1, centre pivot', out.defaults.trim === false && out.defaults.pad === 1 && out.defaults.pivot === 4, JSON.stringify(out.defaults));

    const scroll = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
    check('390 no overflow', scroll.s <= scroll.c + 2, `${scroll.s}/${scroll.c}`);
    check('zero runtime errors at 390', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // ---- 1440 ------------------------------------------------------------
  {
    const errors = [];
    const page = await makePage(browser, errors);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`http://127.0.0.1:${port}/tools/pixel-studio.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction('(typeof frames!=="undefined") && frames.length>0 && typeof buildSheet==="function"', { timeout: 20000 });
    const out = await page.evaluate(() => {
      const d = new Uint8ClampedArray(32 * 32 * 4);
      const i = (4 * 32 + 4) * 4; d[i] = 255; d[i + 3] = 255;
      applyProject({ v: 3, cW: 32, cH: 32, fps: 8, layers: [{ name: 'Layer 1', visible: true }], frames: [[d]] });
      exportTrim = true; exportPad = 0;
      const s = buildSheet();
      exportTrim = false; exportPad = 1;
      return { w: s.canvas.width, h: s.canvas.height, trimmed: s.positions[0].trimmed };
    });
    check('1440: a single trimmed pixel packs to 1x1', out.w === 1 && out.h === 1 && out.trimmed, JSON.stringify(out));
    const scroll = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
    check('1440 no overflow', scroll.s <= scroll.c + 2, `${scroll.s}/${scroll.c}`);
    check('zero runtime errors at 1440', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  await browser.close();
  server.close();
  if (failures) { console.log(`\n${failures} FAILURE(S)`); process.exit(1); }
  console.log('\nALL PIXEL STUDIO EXPORT OPTION CHECKS PASSED');
})().catch((e) => { console.error(e); try { server.close(); } catch (x) {} process.exit(1); });
