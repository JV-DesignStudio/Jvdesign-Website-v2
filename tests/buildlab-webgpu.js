#!/usr/bin/env node
/*
 * tests/buildlab-webgpu.js
 * A2745: verifies the feature-detected WebGPU renderer path.
 *
 * Covers the default fast WebGL boot, the capability note, the baked WebGPU
 * renderer path (loads and renders the same scene), and automatic fallback when
 * WebGPU is missing.
 *
 * Run: node tests/buildlab-webgpu.js
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19415;
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.wasm':'application/wasm','.woff2':'font/woff2'};
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

async function open(page, query, blockGpu) {
  if (blockGpu) {
    await page.evaluateOnNewDocument(() => {
      try { Object.defineProperty(navigator, 'gpu', { get: () => undefined, configurable: true }); } catch (e) {}
    });
  }
  await page.setViewport({width: 1440, height: 900});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:' + port + '/tools/buildlab.html' + query, {waitUntil: 'domcontentloaded', timeout: 30000});
  await page.waitForFunction(() => typeof window.rendererCapability === 'function', {timeout: 20000});
  await page.waitForFunction(() => !!document.querySelector('#viewport canvas'), {timeout: 25000});
  await pause(400);
  await page.evaluate(() => {
    try { closeModal('welcomeModal'); } catch (e) {}
    const w = document.getElementById('welcomeModal');
    if (w) w.classList.remove('open');
    document.body.classList.remove('bl-modal-open');
    window.clearAll(true);
  });
  return errors;
}

(async () => {
  await new Promise(r => server.listen(port, r));
  const browser = await puppeteer.launch({headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']});
  try {
    const page = await browser.newPage();
    const errors = await open(page, '', false);
    const def = await page.evaluate(() => {
      window.addBlock(0, 0, 0, 1, 1, 1, '#e94560', 'box');
      window.addBlock(2, 0, 0, 1, 1, 1, '#00d4aa', 'box');
      window.renderer.render(window.scene, window.camera);
      return {
        cap: window.rendererCapability(),
        badge: (document.getElementById('rendererBadge') || {}).textContent,
        title: (document.getElementById('rendererBadge') || {}).title,
        blocks: window.blocks.length,
        calls: window.renderer.info.render.calls,
        canvas: !!document.querySelector('#viewport canvas')
      };
    });
    check('default load uses the fast WebGL path', def.cap.kind === 'webgl', JSON.stringify(def.cap));
    check('the capability note names WebGPU readiness', /WebGPU/i.test(def.title), def.title);
    check('the default renderer badge reads WebGL', def.badge === 'WebGL', def.badge);
    check('the default scene renders', def.canvas && def.blocks === 2 && def.calls > 0, JSON.stringify({blocks: def.blocks, calls: def.calls}));
    check('default load has no runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await page.close().catch(() => {});

    const gpuPage = await browser.newPage();
    const gpuErrors = await open(gpuPage, '?webgpu=1', false);
    const gpu = await gpuPage.evaluate(() => {
      window.addBlock(0, 0, 0, 1, 1, 1, '#e94560', 'box');
      window.addBlock(2, 0, 0, 1, 1, 1, '#00d4aa', 'box');
      window.selectAllBlocks();
      const before = window.blocks.length;
      window.renderer.render(window.scene, window.camera);
      return {
        cap: window.rendererCapability(),
        badge: (document.getElementById('rendererBadge') || {}).textContent,
        blocks: window.blocks.length,
        selected: window.selectedBlocks.length,
        canvas: !!document.querySelector('#viewport canvas'),
        sameScene: window.blocks.every(b => b.geometry && b.material)
      };
    });
    check('the WebGPU path loads when requested', gpu.cap.kind === 'webgpu' && gpu.cap.capability.supported, JSON.stringify(gpu.cap));
    check('the WebGPU badge updates', gpu.badge === 'WebGPU', gpu.badge);
    check('the same scene loads and renders on WebGPU', gpu.canvas && gpu.blocks === 2 && gpu.sameScene && gpu.selected === 2, JSON.stringify(gpu));
    check('the WebGPU path has no runtime errors', gpuErrors.length === 0, gpuErrors.slice(0, 3).join(' | '));
    await gpuPage.close().catch(() => {});

    const fallbackPage = await browser.newPage();
    const fbErrors = await open(fallbackPage, '?webgpu=1', true);
    const fallback = await fallbackPage.evaluate(() => {
      window.addBlock(0, 0, 0, 1, 1, 1, '#e94560', 'box');
      window.renderer.render(window.scene, window.camera);
      return {
        cap: window.rendererCapability(),
        badge: (document.getElementById('rendererBadge') || {}).textContent,
        blocks: window.blocks.length,
        calls: window.renderer.info.render.calls,
        canvas: !!document.querySelector('#viewport canvas')
      };
    });
    check('a missing WebGPU falls back to WebGL', fallback.cap.kind === 'webgl', JSON.stringify(fallback.cap));
    check('the fallback scene still renders', fallback.canvas && fallback.blocks === 1 && fallback.calls > 0, JSON.stringify({blocks: fallback.blocks, calls: fallback.calls}));
    check('the fallback badge reads WebGL', fallback.badge === 'WebGL', fallback.badge);
    check('the fallback path has no runtime errors', fbErrors.length === 0, fbErrors.slice(0, 3).join(' | '));
    await fallbackPage.close().catch(() => {});
  } finally {
    await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
  }
  if (failures) {
    console.log('\n' + failures + ' CHECK(S) FAILED');
    process.exit(1);
  }
  console.log('\nALL BUILDLAB WEBGPU CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
