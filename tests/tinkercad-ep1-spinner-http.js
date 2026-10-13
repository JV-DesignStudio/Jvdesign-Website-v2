#!/usr/bin/env node
// tests/tinkercad-ep1-spinner-http.js (A1481): the Tinkercad 3D preview must load
// and upgrade under the site CSP. Guards the model-viewer self-host: if the script
// is missing from /assets/vendor or blocked by script-src, the custom element never
// defines and the viewer stays empty.
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const port = 8991;
const pagePath = '/workshops/tinkercad-ep1-spinner.html';

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function safePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.resolve(root, clean);
  return file.startsWith(root) ? file : null;
}

function createServer() {
  return http.createServer((req, res) => {
    const file = safePath(req.url || '/');
    if (!file) { res.writeHead(403); res.end('Forbidden'); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
}

(async () => {
  const server = createServer();
  await new Promise((r) => server.listen(port, r));
  const browser = await puppeteer.launch({
    headless: true,
    protocolTimeout: 30000,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const failures = [];

  try {
    const page = await browser.newPage();
    const cspErrors = [];
    const otherErrors = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (/Content Security Policy|Refused to (load|execute|connect|apply)/i.test(text)) cspErrors.push(text);
      else if (msg.type() === 'error' && !/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|WebGL context could not be created|Error creating WebGL context|reading 'xr'|getFieldOfView/i.test(text)) otherErrors.push(text);
    });
    page.on('pageerror', (err) => otherErrors.push(err.message));

    await page.setViewport({ width: 1024, height: 900, deviceScaleFactor: 1 });
    await page.goto(`http://127.0.0.1:${port}${pagePath}`, { waitUntil: 'domcontentloaded', timeout: 20000 });

    // model-viewer is ~935 KB; give it time to define, fetch the glb and render.
    let ready = false;
    for (let i = 0; i < 40 && !ready; i++) {
      ready = await page.evaluate(() => {
        const el = document.querySelector('model-viewer');
        return Boolean(el && el.shadowRoot && el.shadowRoot.querySelector('canvas'));
      }).catch(() => false);
      if (!ready) await sleep(500);
    }

    const info = await page.evaluate(() => {
      const el = document.querySelector('model-viewer');
      return {
        defined: Boolean(customElements.get('model-viewer')),
        hasEl: Boolean(el),
        hasShadow: Boolean(el && el.shadowRoot),
        hasCanvas: Boolean(el && el.shadowRoot && el.shadowRoot.querySelector('canvas')),
        src: el ? el.getAttribute('src') : null
      };
    });

    console.log('  model-viewer:', JSON.stringify(info));
    if (!info.defined) failures.push('model-viewer custom element never defined (script blocked or missing)');
    if (!info.hasEl) failures.push('no <model-viewer> element on the page');
    if (!info.hasCanvas) failures.push('model-viewer did not render a canvas');
    if (cspErrors.length) failures.push('CSP violations: ' + cspErrors.join(' | '));
    if (otherErrors.length) failures.push('page errors: ' + otherErrors.join(' | '));
  } catch (e) {
    failures.push('exception: ' + e.message);
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length) {
    failures.forEach((f) => console.log('  [FAIL] ' + f));
    console.log('\nTINKERCAD 3D PREVIEW HTTP CHECKS FAILED');
    process.exit(1);
  }
  console.log('  [PASS] model-viewer defined and rendered with no CSP violations');
  console.log('\nTINKERCAD 3D PREVIEW HTTP CHECKS PASSED');
})();
