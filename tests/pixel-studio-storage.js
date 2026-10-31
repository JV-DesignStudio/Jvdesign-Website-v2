#!/usr/bin/env node
/*
 * tests/pixel-studio-storage.js
 * A2018: storage is warned about before it fills, failures are visible, a backup
 * is one tap away, and a backup restores in a fresh browser profile.
 * Run: node tests/pixel-studio-storage.js
 */
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PSSTORAGE_PORT || 8130;
const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.json':'application/json','.webmanifest':'application/manifest+json'};

let failures = 0;
const check = (name, ok, detail) => { console.log((ok?'PASS ':'FAIL ')+name+(detail?' ['+detail+']':'')); if(!ok) failures++; };

(async () => {
  const server = http.createServer((req, res) => {
    let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!path.extname(p)) p = path.join(p, 'index.html');
    fs.readFile(p, (e, d) => {
      if (e) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, {'Content-Type': MIME[path.extname(p)] || 'application/octet-stream'});
      res.end(d);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto(`http://127.0.0.1:${PORT}/tools/pixel-studio.html`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.evaluate(() => { try { localStorage.clear(); localStorage.setItem('jvds_pixel_seen','1'); } catch(e){} });
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 800));

  // 1. A save near the limit warns before the box is full.
  const warn = await page.evaluate(() => {
    const orig = storageUsedKB;
    storageUsedKB = () => 2600;
    const ok = saveProject();
    const out = { ok, saved: window._projectSaved, toast: (document.getElementById('toast')||{}).textContent || '' };
    storageUsedKB = orig;
    return out;
  });
  check('save at 2.6MB warns before storage is full', warn.ok===true && warn.saved===true && /tight|backup|storage/i.test(warn.toast), JSON.stringify(warn));

  // 2. A backup is visible on desktop and mobile.
  const backup = await page.evaluate(() => {
    const keep = document.querySelector('#left-sticky [data-on="exportProjectFile"]');
    const mobile = document.querySelector('#bb3 [data-on="exportProjectFile"]');
    return { keep: !!keep, mobile: !!mobile, label: keep ? keep.textContent.trim() : '' };
  });
  check('visible Backup .json button on desktop and mobile', backup.keep && backup.mobile && /Backup/i.test(backup.label), JSON.stringify(backup));

  // 3. A quota failure is visible, not silent, and offers the backup.
  const fail = await page.evaluate(() => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function(){ throw new DOMException('full', 'QuotaExceededError'); };
    let called = false;
    const origExport = exportProjectFile;
    exportProjectFile = function(){ called = true; };
    const ok = saveProject();
    const out = { ok, saved: window._projectSaved, toast: (document.getElementById('toast')||{}).textContent || '', called };
    Storage.prototype.setItem = real;
    exportProjectFile = origExport;
    return out;
  });
  check('quota failure is visible and offers a backup', fail.ok===false && fail.saved===false && /storage|backup|export/i.test(fail.toast) && fail.called, JSON.stringify(fail));

  // 4. A backup restores in a fresh browser profile.
  const project = await page.evaluate(() => {
    setCanvasSize(8,8,false);
    frames=[[new ImageData(8,8)]]; frameMeta=[{clip:'idle',hold:1}]; currentFrame=0; currentLayer=0;
    paintPx(getID(),3,4,'#ff0000',false);
    return serializeProject();
  });
  const ctx = browser.createBrowserContext ? await browser.createBrowserContext() : await browser.createIncognitoBrowserContext();
  const fresh = await ctx.newPage();
  await fresh.goto(`http://127.0.0.1:${PORT}/tools/pixel-studio.html`, { waitUntil: 'networkidle2', timeout: 30000 });
  await fresh.evaluate(() => { try { localStorage.clear(); } catch(e){} });
  await fresh.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 600));
  const restored = await fresh.evaluate(proj => {
    applyProject(JSON.parse(proj));
    const d=frames[0][0].data, i=(4*8+3)*4;
    return { w:cW, h:cH, r:d[i], a:d[i+3], frames:frames.length, clip:frameMeta[0].clip };
  }, project);
  check('fresh profile restores the backup', restored.w===8 && restored.h===8 && restored.r===255 && restored.a===255 && restored.frames===1 && restored.clip==='idle', JSON.stringify(restored));
  await ctx.close();

  check('no uncaught JS errors', errors.length===0, errors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL PIXEL STUDIO STORAGE CHECKS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
