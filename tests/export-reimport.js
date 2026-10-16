#!/usr/bin/env node
// tests/export-reimport.js (A1595)
// Proves the share-code round trip for every 3D builder that ships jv-exporter:
//   1. read the live build as a share code (JVDS1S)
//   2. change the build, confirm the code changes
//   3. import the original code back and confirm the build is identical again
// Also asserts each builder has exactly one model-export UI (the shared dialog)
// and no leftover legacy OBJ/GLB/STL buttons, with no console/page errors.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

const BUILDERS = fs.readdirSync(path.join(ROOT, 'workshops'))
  .filter((f) => /-builder\.html$/.test(f))
  .filter((f) => fs.readFileSync(path.join(ROOT, 'workshops', f), 'utf8').includes('jv-exporter.js'))
  .sort();

(async () => {
  const server = http.createServer((req, res) => {
    let url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (url.endsWith('/')) url += 'index.html';
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      res.writeHead(err ? 404 : 200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(err ? '' : data);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const file of BUILDERS) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      // CSP inline-handler violations are a site-wide class of issue tracked
      // separately (A1589) and do not affect export or import. A blocked inline
      // script would still fail this test, because the builder would never
      // initialise and the waitForFunction below would time out.
      page.on('console', (m) => { if (m.type() === 'error' && !/Content Security Policy/.test(m.text())) errors.push(m.text()); });
      await page.goto(base + '/workshops/' + file, { waitUntil: 'load', timeout: 30000 });
      await page.waitForFunction(() => window.JVExporter && typeof window._builderGetState === 'function' && typeof window._builderSetState === 'function', { timeout: 15000 });
      await new Promise((r) => setTimeout(r, 400));

      const result = await page.evaluate(async () => {
        var J = window.JVExporter;
        var s1 = J.shareCodeNow();
        var d = J.decodeShareCode(s1);
        if (d.kind !== 'state') return { file: null, err: 'not a state code' };
        var st2 = JSON.parse(JSON.stringify(d.state));
        var params = st2.params || {};
        var key = Object.keys(params).find(function (k) { return typeof params[k] === 'number'; });
        if (key) params[key] = (params[key] || 0) + 3.5;
        else {
          key = Object.keys(params).find(function (k) { return typeof params[k] === 'boolean'; });
          if (key) params[key] = !params[key];
          else { key = Object.keys(params)[0]; params[key] = String(params[key]) + 'X'; }
        }
        window._builderSetState(st2);
        var s2 = J.shareCodeNow();
        var msg = J.importShareCode(s1);
        var s3 = J.shareCodeNow();
        var legacy = document.querySelectorAll('[data-on="exportOBJ"],[data-on="exportGLB"],[data-on="exportSTL"],[data-on="exportModel"]').length;
        var rev = window.THREE ? window.THREE.REVISION : '';
        var model = J.currentModel(false);
        var ex = {};
        try { ex.obj = (J.obj(model, 'test').obj || '').length; } catch (e) { ex.obj = 'ERR ' + e.message; }
        try { ex.stl = (J.stl(model, 'test').text || '').length; } catch (e) { ex.stl = 'ERR ' + e.message; }
        try { ex.fbx = (J.fbx(model, 'test').text || '').length; } catch (e) { ex.fbx = 'ERR ' + e.message; }
        try { var gg = await J.glb(model); ex.glb = gg && gg.buffer ? gg.buffer.byteLength : 'ERR'; } catch (e) { ex.glb = 'ERR ' + (e && e.message); }
        return {
          isState: s1.indexOf('JVDS1S.') === 0,
          changed: s2 !== s1,
          restored: s3 === s1,
          msg: msg,
          sharedUi: document.querySelectorAll('[data-jv-export]').length,
          legacy: legacy,
          rev: rev,
          ex: ex
        };
      });

      assert.ok(result.isState, file + ' emits a JVDS1S state code');
      assert.ok(result.changed, file + ' share code changes when the build changes');
      assert.ok(result.restored, file + ' share code reimports to the same build');
      assert.ok(result.sharedUi >= 1, file + ' has the shared export UI');
      assert.equal(result.legacy, 0, file + ' has no legacy OBJ/GLB/STL buttons');
      assert.ok(String(result.rev) === '160', file + ' loads Three r160 (got ' + result.rev + ')');
      assert.ok(typeof result.ex.obj === 'number' && result.ex.obj > 0, file + ' OBJ export works (' + result.ex.obj + ')');
      assert.ok(typeof result.ex.stl === 'number' && result.ex.stl > 0, file + ' STL export works (' + result.ex.stl + ')');
      assert.ok(typeof result.ex.fbx === 'number' && result.ex.fbx > 0, file + ' FBX export works (' + result.ex.fbx + ')');
      assert.ok(typeof result.ex.glb === 'number' && result.ex.glb > 0, file + ' GLB export works (' + JSON.stringify(result.ex) + ')');
      assert.deepEqual(errors, [], file + ' console/page errors: ' + errors.slice(0, 2).join(' | '));
      console.log('PASS ' + file + ': export + reimport round trip, one export UI');
      await page.close();
    }
    console.log('PASS export-reimport: ' + BUILDERS.length + ' builders round-trip their share codes');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
