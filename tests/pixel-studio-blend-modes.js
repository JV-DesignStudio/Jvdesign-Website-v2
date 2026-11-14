// A3003: layer blend modes and simple groups. Proves multiply/screen composite
// correctly, old projects load as normal, and groups collapse and expand.
// Run: node tests/pixel-studio-blend-modes.js
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = Number(process.env.JVDS_BLEND_PORT || 19305);
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
    await page.waitForFunction('(typeof frames!=="undefined") && frames.length>0 && typeof setLayerBlend==="function"', { timeout: 20000 });

    const out = await page.evaluate(() => {
      const red = new Uint8ClampedArray(8 * 8 * 4);
      for (let i = 0; i < red.length; i += 4) { red[i] = 255; red[i + 3] = 255; }
      const blue = new Uint8ClampedArray(8 * 8 * 4);
      for (let i = 0; i < blue.length; i += 4) { blue[i + 2] = 255; blue[i + 3] = 255; }
      function read() {
        const c = flattenFrame(0); const d = c.getContext('2d').getImageData(0, 0, 1, 1).data;
        return [d[0], d[1], d[2], d[3]];
      }
      applyProject({ v: 3, cW: 8, cH: 8, fps: 8, layers: [{ name: 'Base', visible: true }, { name: 'Light', visible: true }], frames: [[red, blue]] });
      currentLayer = 1;
      setLayerBlend('multiply');
      const multiply = read();
      setLayerBlend('screen');
      const screen = read();
      setLayerBlend('normal');
      const normal = read();
      layers[0].group = 'Body'; layers[1].group = 'Body';
      renderLayerList();
      const header = document.querySelector('#layerList .layer-group');
      toggleLayerGroup('Body');
      const collapsed = document.querySelectorAll('#layerList .layer-item').length;
      toggleLayerGroup('Body');
      const expanded = document.querySelectorAll('#layerList .layer-item').length;
      setLayerBlend('overlay');
      const saved = serializeProject();
      applyProject(JSON.parse(saved));
      const reopened = { blend: layers[1].blend, group: layers[1].group };
      const old = JSON.parse(saved); delete old.layers[0].blend; delete old.layers[0].group; old.layers[1].blend = undefined; old.layers[1].group = undefined;
      applyProject(old);
      const oldBlend = layers[0].blend || 'missing';
      return { multiply, screen, normal, header: !!header, collapsed, expanded, reopened, oldBlend };
    });

    check('390: multiply darkens the composite', out.multiply[0] === 0 && out.multiply[1] === 0 && out.multiply[2] === 0, JSON.stringify(out.multiply));
    check('390: screen lightens the composite', out.screen[0] === 255 && out.screen[2] === 255, JSON.stringify(out.screen));
    check('390: normal keeps the top colour', out.normal[2] === 255 && out.normal[0] === 0, JSON.stringify(out.normal));
    check('390: a group header collapses and expands its layers', out.header && out.collapsed === 0 && out.expanded === 2, `${out.collapsed}/${out.expanded}`);
    check('390: blend and group survive save/reopen', out.reopened.blend === 'overlay' && out.reopened.group === 'Body', JSON.stringify(out.reopened));
    check('390: old projects load as normal', out.oldBlend === 'normal', out.oldBlend);

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
    await page.waitForFunction('(typeof frames!=="undefined") && frames.length>0 && typeof setLayerBlend==="function"', { timeout: 20000 });
    const out = await page.evaluate(() => {
      applyProject({ v: 3, cW: 8, cH: 8, fps: 8, layers: [{ name: 'A', visible: true }, { name: 'B', visible: true }], frames: [[new Uint8ClampedArray(8 * 8 * 4), new Uint8ClampedArray(8 * 8 * 4)]] });
      currentLayer = 0; setLayerBlend('multiply');
      renderLayerList();
      return { blend: layers[0].blend, select: (document.getElementById('layerBlend') || {}).value, groups: !!document.querySelector('#layerList .layer-group') };
    });
    check('1440: blend select reflects the layer', out.blend === 'multiply' && out.select === 'multiply', JSON.stringify(out));
    const scroll = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
    check('1440 no overflow', scroll.s <= scroll.c + 2, `${scroll.s}/${scroll.c}`);
    check('zero runtime errors at 1440', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  await browser.close();
  server.close();
  if (failures) { console.log(`\n${failures} FAILURE(S)`); process.exit(1); }
  console.log('\nALL PIXEL STUDIO BLEND/GROUP CHECKS PASSED');
})().catch((e) => { console.error(e); try { server.close(); } catch (x) {} process.exit(1); });
