#!/usr/bin/env node
/*
 * tests/pixel-studio-engine-pack.js
 * A1591: the Pixel Studio "Engine Pack" ZIP must ship native outputs for Phaser,
 * TexturePacker, Defold, Godot and GameMaker, each documented in the README.
 * Exercises the pure file builder _enginePackFiles() directly.
 * Run: node tests/pixel-studio-engine-pack.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PSEP_PORT || 8997;
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
  await page.waitForFunction(() => typeof _enginePackFiles === 'function', { timeout: 20000 });

  const files = await page.evaluate(() => _enginePackFiles({
    sheetW: 64, sheetH: 64, cW: 16, cH: 16, sc: 2, fps: 8, count: 3,
    positions: [{ x: 0, y: 0 }, { x: 32, y: 0 }, { x: 0, y: 32 }], name: 'Test Hero'
  }));

  const has = k => Object.prototype.hasOwnProperty.call(files, k);
  check('pack includes Phaser atlas', has('phaser/spritesheet.json'));
  check('pack includes TexturePacker plist', has('texturepacker/spritesheet.plist'));
  check('pack includes Defold atlas + sprite', has('defold/spritesheet.atlas') && has('defold/spritesheet.sprite'));
  check('pack includes Godot SpriteFrames', has('godot/SpriteFrames.tres'));
  check('pack includes GameMaker sprite (.yy)', has('gameMaker/spr_test_hero.yy'));
  check('pack includes README', has('README.txt'));

  try {
    const ph = JSON.parse(files['phaser/spritesheet.json']);
    check('Phaser atlas has 3 frames', Object.keys(ph.frames).length === 3 && !!ph.meta);
  } catch (e) { check('Phaser atlas is valid JSON', false, e.message); }

  const pl = files['texturepacker/spritesheet.plist'] || '';
  check('plist is format 3 XML with frames', pl.includes('<integer>3</integer>') && pl.includes('frame_2') && pl.includes('spritesheet.png'));

  const at = files['defold/spritesheet.atlas'] || '', sp = files['defold/spritesheet.sprite'] || '';
  check('Defold atlas lists sheet images', at.includes('images {') && at.includes('width: 32'));
  check('Defold sprite has a default animation', sp.includes('default_animation') && sp.includes('fps: 8'));

  check('Godot tres references AtlasTexture', /SpriteFrames/.test(files['godot/SpriteFrames.tres'] || '') && /AtlasTexture_2/.test(files['godot/SpriteFrames.tres'] || ''));

  try {
    const yy = JSON.parse(files['gameMaker/spr_test_hero.yy']);
    check('GameMaker .yy is a GMSprite with 3 frames', yy.resourceType === 'GMSprite' && yy.sequence.length === 3 && yy.width === 32 && yy.height === 32);
  } catch (e) { check('GameMaker .yy is valid JSON', false, e.message); }

  const rm = files['README.txt'] || '';
  check('README documents every target', ['Phaser','TexturePacker','Defold','Godot','GameMaker'].every(w => rm.includes(w)));

  check('no uncaught JS errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  // 390px smoke: the Engine Pack button is present and there is no horizontal scroll.
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await new Promise(r => setTimeout(r, 300));
  const m = await page.evaluate(() => ({
    btn: !!document.querySelector('[data-on="exportEnginePack"]'),
    noScroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
  }));
  check('390px: Engine Pack button present', m.btn === true);
  check('390px: no horizontal scroll', m.noScroll === true);

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL PIXEL STUDIO ENGINE PACK CHECKS PASSED');
})().catch(e => { console.error(e); process.exit(1); });
