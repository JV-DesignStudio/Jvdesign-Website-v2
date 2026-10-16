#!/usr/bin/env node
// tests/3d-builder-shell.js (A1549 / A1618)
// The 3D Builder shell hosts presets from one page. Migrated presets mount a
// module inline (assets/js/builders/<id>.js); unmigrated presets fall back to
// their own page in a frame. Deep links work and every old builder URL still
// resolves. Runs at 390 and 1440 with no console/page errors, no odd overflow.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
const PRESETS = ['rocket', 'robot', 'pirate-ship', 'steampunk-airship', 'race-car', 'submarine', 'castle', 'fairy-tale', 'pirate-cannon', 'phone-stand', 'space-station'];
const MODULES = { rocket: 'rocket' };

(async () => {
  for (const id of PRESETS) assert.ok(fs.existsSync(path.join(ROOT, 'workshops', id + '-builder.html')), id + '-builder.html exists');
  assert.ok(fs.existsSync(path.join(ROOT, 'workshops', '3d-builder.html')), 'shell page exists');
  for (const id of Object.values(MODULES)) assert.ok(fs.existsSync(path.join(ROOT, 'assets', 'js', 'builders', id + '.js')), 'builders/' + id + '.js exists');

  const server = http.createServer((req, res) => {
    let u = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (u.endsWith('/')) u += 'index.html';
    const f = path.join(ROOT, u);
    if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(f, (e, d) => { res.writeHead(e ? 404 : 200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' }); res.end(e ? '' : d); });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const w of [390, 1440]) {
      const page = await browser.newPage();
      await page.setViewport({ width: w, height: 900 });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error' && !/Content Security Policy/.test(m.text())) errors.push(m.text()); });

      await page.goto(base + '/workshops/3d-builder.html', { waitUntil: 'load', timeout: 30000 });
      await page.waitForFunction(() => document.querySelectorAll('#bsChips .bs-chip').length === 11, { timeout: 10000 });
      const shell = await page.evaluate(() => ({
        chips: document.querySelectorAll('#bsChips .bs-chip').length,
        options: document.querySelectorAll('#bsSelect option').length,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      }));
      assert.equal(shell.chips, 11, w + ': 11 chips');
      assert.equal(shell.options, 11, w + ': 11 options');
      assert.ok(shell.overflow <= 2, w + ': shell no overflow (' + shell.overflow + ')');

      // Migrated preset mounts a module inline.
      await page.waitForFunction(() => window._builderGetState && document.querySelector('#bsHost .bs-stage'), { timeout: 20000 });
      const inline = await page.evaluate(() => ({
        stage: !!document.querySelector('#bsHost .bs-stage'),
        frame: !!document.querySelector('#bsHost iframe'),
        state: typeof window._builderGetState
      }));
      assert.ok(inline.stage, w + ': rocket mounts inline (.bs-stage)');
      assert.equal(inline.frame, false, w + ': rocket is not framed');
      assert.equal(inline.state, 'function', w + ': rocket exposes _builderGetState');

      // Export + share-code round trip work against the inlined module.
      const rx = await page.evaluate(async () => {
        var J = window.JVExporter;
        var m = J.currentModel(false);
        var out = {};
        try { out.obj = (J.obj(m, 'test').obj || '').length; } catch (e) { out.obj = 'ERR ' + e.message; }
        try { out.stl = (J.stl(m, 'test').text || '').length; } catch (e) { out.stl = 'ERR ' + e.message; }
        try { out.fbx = (J.fbx(m, 'test').text || '').length; } catch (e) { out.fbx = 'ERR ' + e.message; }
        try { var g = await J.glb(m); out.glb = g && g.buffer ? g.buffer.byteLength : 0; } catch (e) { out.glb = 'ERR ' + e.message; }
        var s1 = J.shareCodeNow();
        var st2 = JSON.parse(JSON.stringify(J.decodeShareCode(s1).state));
        var k = Object.keys(st2.params).find(function (n) { return typeof st2.params[n] === 'number'; });
        if (k) st2.params[k] = (st2.params[k] || 0) + 2;
        window._builderSetState(st2);
        var s2 = J.shareCodeNow();
        J.importShareCode(s1);
        out.roundtrip = J.shareCodeNow() === s1 && s2 !== s1;
        return out;
      });
      assert.ok(typeof rx.obj === 'number' && rx.obj > 0, w + ': rocket OBJ export (' + rx.obj + ')');
      assert.ok(typeof rx.stl === 'number' && rx.stl > 0, w + ': rocket STL export (' + rx.stl + ')');
      assert.ok(typeof rx.fbx === 'number' && rx.fbx > 0, w + ': rocket FBX export (' + rx.fbx + ')');
      assert.ok(typeof rx.glb === 'number' && rx.glb > 0, w + ': rocket GLB export (' + rx.glb + ')');
      assert.ok(rx.roundtrip, w + ': rocket share-code round trip in the shell');

      // Switch to an unmigrated preset -> iframe fallback.
      await page.evaluate(() => { Array.prototype.find.call(document.querySelectorAll('.bs-chip'), (b) => b.dataset.id === 'castle').click(); });
      await page.waitForFunction(() => { var f = document.querySelector('#bsHost iframe'); return f && f.getAttribute('src') === 'castle-builder.html'; }, { timeout: 15000 });
      const framed = await page.evaluate(() => ({ frame: !!document.querySelector('#bsHost iframe'), stage: !!document.querySelector('#bsHost .bs-stage') }));
      assert.ok(framed.frame, w + ': castle uses the iframe fallback');
      assert.equal(framed.stage, false, w + ': module stage removed on switch');

      // Switch back to the module preset -> remounts inline, previous teardown gone.
      await page.evaluate(() => { Array.prototype.find.call(document.querySelectorAll('.bs-chip'), (b) => b.dataset.id === 'rocket').click(); });
      await page.waitForFunction(() => window._builderGetState && document.querySelector('#bsHost .bs-stage') && !document.querySelector('#bsHost iframe'), { timeout: 20000 });
      assert.deepEqual(errors, [], w + ': console/page errors: ' + errors.slice(0, 2).join(' | '));
      await page.close();
    }

    // Deep link + old URLs.
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(base + '/workshops/3d-builder.html?preset=submarine', { waitUntil: 'load' });
    await page.waitForFunction(() => { var f = document.querySelector('#bsHost iframe'); return f && f.getAttribute('src') === 'submarine-builder.html'; }, { timeout: 15000 });
    console.log('PASS deep link ?preset=submarine uses the submarine page');
    for (const id of PRESETS) {
      const resp = await page.goto(base + '/workshops/' + id + '-builder.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
      assert.equal(resp.status(), 200, id + '-builder.html resolves');
    }
    console.log('PASS all 11 old builder URLs resolve');
    assert.deepEqual(errs, []);
    await page.close();
    console.log('PASS 3d-builder-shell: module host + iframe fallback + deep link + 11 old URLs, 390/1440 clean');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
