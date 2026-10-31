#!/usr/bin/env node
/*
 * tests/godot-asset-import.js
 * A1872: the Godot tutorial must offer optional asset tasks and show how the
 * Pixel Studio, SFX Studio, Level Designer, Palette and GDD exports get in.
 * Run: node tests/godot-asset-import.js
 */
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.GODOTASSET_PORT || 8132;
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
  await page.goto(`http://127.0.0.1:${PORT}/workshops/godot_tutorial.html`, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 800));

  const body = await page.evaluate(() => document.body.innerText);
  check('Godot tutorial explains the asset handoff', /Bring your own asset into Godot/i.test(body));
  check('optional tasks cover sprite, sound, level, palette and plan',
    ['Player sprite','Pickup sound','Level','Palette','Enemy plan'].every(s => body.includes(s)), '');
  check('import formats are named', ['PNG','WAV','TileMap JSON','GDScript','SpriteFrames','HEX','PDF'].every(s => body.includes(s)), '');
  const links = await page.evaluate(() => {
    const href = s => !!document.querySelector('a[href="' + s + '"]');
    return {
      pixel: href('../tools/pixel-studio.html'),
      sfx: href('../tools/sound-studio.html'),
      level: href('../tools/level-designer.html'),
      palette: href('../tools/colour-palette.html'),
      gdd: href('../tools/gdd-builder.html'),
      music: href('../tools/music-maker.html')
    };
  });
  check('supporting tool links are present', Object.values(links).every(Boolean), JSON.stringify(links));

  const layouts = [];
  for (const width of [390, 1440]) {
    await page.setViewport({ width, height: 900 });
    await new Promise(r => setTimeout(r, 250));
    layouts.push(await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      section: !!document.body.innerText.match(/Bring your own asset into Godot/i)
    })));
  }
  check('asset handoff section works at 390 and 1440', layouts.every(l => l.scroll && l.section), JSON.stringify(layouts));

  check('no uncaught JS errors', errors.length===0, errors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL GODOT ASSET IMPORT CHECKS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
