#!/usr/bin/env node
/*
 * tests/jvds-manifest.js
 * A1614: one documented save namespace + a manifest export/import that any tool
 * can read. Checks the shared module on three adopting tools (Backup & Restore,
 * Pixel Studio, Arcade Game Maker) and proves a save -> collect -> clear ->
 * apply round trip restores jvds_*, jv_* and qb-* keys.
 * Run: node tests/jvds-manifest.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.JM_PORT || 9009;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.mjs':'text/javascript' };

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }

(async () => {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0]);
    let file = p; if (file.endsWith('/')) file += 'index.html';
    fs.readFile(path.join(ROOT, file), (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  // ── Backup & Restore: module + round trip ──────────────────────────────────
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + 'tools/backup-restore.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.JVDSManifest, { timeout: 20000 });

  const r = await page.evaluate(() => {
    const M = window.JVDSManifest;
    const api = ['isKey','collect','make','download','apply','readFile','openManifest'].every(k => typeof M[k] === 'function');
    const ns = M.isKey('jvds_pixel') && M.isKey('jv_arcade_slot_0') && M.isKey('qb-data-v1') && !M.isKey('random_key');
    // seed three families plus one outsider
    localStorage.setItem('jvds_pixel', '{"cW":32}');
    localStorage.setItem('jv_arcade_slot_0', '{"title":"Game"}');
    localStorage.setItem('qb-data-v1', '[{"t":"quest"}]');
    localStorage.setItem('random_key', 'nope');
    const collected = M.collect();
    const manifest = M.make();
    // clear the three, then apply the manifest back
    ['jvds_pixel','jv_arcade_slot_0','qb-data-v1'].forEach(k => localStorage.removeItem(k));
    const cleared = !localStorage.getItem('jvds_pixel') && !localStorage.getItem('jv_arcade_slot_0') && !localStorage.getItem('qb-data-v1');
    const n = M.apply(manifest);
    return {
      api, ns,
      collectedHas: !!(collected['jvds_pixel'] && collected['jv_arcade_slot_0'] && collected['qb-data-v1']),
      excluded: !('random_key' in collected),
      manifestApp: manifest.app === 'jvds-manifest' && !!manifest.keys && !!manifest.keys['jv_arcade_slot_0'],
      cleared, applied: n >= 3,
      restored: localStorage.getItem('jvds_pixel') === '{"cW":32}' && localStorage.getItem('jv_arcade_slot_0') === '{"title":"Game"}' && localStorage.getItem('qb-data-v1') === '[{"t":"quest"}]',
      hasBtnExport: !!document.getElementById('btnManifest'),
      hasBtnOpen: !!document.getElementById('btnOpenManifest')
    };
  });
  check('JVDSManifest API present', r.api === true);
  check('namespace covers jvds_/jv_/qb- and excludes others', r.ns === true);
  check('collect gathers all three key families', r.collectedHas === true);
  check('collect excludes non-JVDS keys', r.excluded === true);
  check('make() returns a jvds-manifest with keys', r.manifestApp === true);
  check('apply() restores the cleared keys exactly', r.cleared === true && r.applied === true && r.restored === true);
  check('Backup & Restore has Export + Import manifest buttons', r.hasBtnExport && r.hasBtnOpen);
  check('Backup & Restore: no JS errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const m = await page.evaluate(() => ({ noScroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 }));
  check('390px: Backup & Restore no horizontal scroll', m.noScroll === true);

  // ── Adopting tools expose the module + Open manifest button ────────────────
  for (const [file, label] of [['tools/pixel-studio.html','Pixel Studio'], ['tools/arcade-game-maker.html','Arcade Game Maker']]) {
    const p2 = await browser.newPage();
    await p2.setViewport({ width: 1440, height: 900 });
    await p2.goto(BASE + file, { waitUntil: 'domcontentloaded' });
    const ok = await p2.waitForFunction(() => !!window.JVDSManifest, { timeout: 20000 }).then(() => true).catch(() => false);
    const btn = await p2.evaluate(() => !!document.querySelector('[data-on="openManifest"]'));
    check(`${label}: loads the manifest module`, ok === true);
    check(`${label}: has an Open manifest button`, btn === true);
    await p2.close();
  }

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL JVDS MANIFEST CHECKS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
