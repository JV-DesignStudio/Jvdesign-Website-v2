#!/usr/bin/env node
/*
 * tests/pixel-studio-canvas-cap.js
 * A1613: Pixel Studio must create, paint and export at least a 256x256 canvas
 * (previously capped at 128).
 * Run: node tests/pixel-studio-canvas-cap.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PSCC_PORT || 9007;
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
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + 'tools/pixel-studio.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { try { return typeof setCanvasSize === 'function' && Array.isArray(frames) && frames.length > 0 && typeof mainCanvas !== 'undefined' && !!mainCanvas; } catch(e){ return false; } }, { timeout: 20000 });

  const r = await page.evaluate(async () => {
    const out = {};
    out.preset256 = PRESETS.some(p => p.w === 256 && p.h === 256);
    out.custMax = document.getElementById('custW').getAttribute('max');
    setCanvasSize(256, 256, false);
    out.cW = cW; out.cH = cH; out.comp = compCanvas.width;
    // paint a pixel and confirm it sticks
    frames[0][0].data[0] = 255; frames[0][0].data[3] = 255;
    out.painted = frames[0][0].data[0] === 255;
    // exports must not throw at 256
    HTMLAnchorElement.prototype.click = function(){};
    const errs = [];
    try { exportSheet(); } catch(e){ errs.push('sheet:'+e.message); }
    try { await exportEnginePack(); } catch(e){ errs.push('pack:'+e.message); }
    try { const f = _enginePackFiles({ sheetW:256, sheetH:256, cW:256, cH:256, sc:1, fps:8, count:1, positions:[{x:0,y:0}], name:'sprite' }); out.pack256 = !!f['phaser/spritesheet.json']; } catch(e){ errs.push('files:'+e.message); }
    out.exportErrs = errs;
    return out;
  });

  check('256 preset offered', r.preset256 === true);
  check('custom size input allows 256', r.custMax === '256', 'max=' + r.custMax);
  check('canvas resizes to 256x256', r.cW === 256 && r.cH === 256, 'cW=' + r.cW + ' cH=' + r.cH);
  check('render buffer follows (compCanvas 256)', r.comp === 256);
  check('painting to a 256 canvas works', r.painted === true);
  check('spritesheet + engine pack export at 256 without error', r.exportErrs.length === 0, r.exportErrs.join(' | '));
  check('engine pack builds at 256', r.pack256 === true);
  check('no uncaught JS errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const m = await page.evaluate(() => { setCanvasSize(256, 256, false); return { cW: cW, noScroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 }; });
  check('390px: 256 canvas still sets', m.cW === 256, 'cW=' + m.cW);
  check('390px: no horizontal scroll', m.noScroll === true);

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL PIXEL STUDIO CANVAS CAP CHECKS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
