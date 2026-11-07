#!/usr/bin/env node
/*
 * tests/arcade-game-maker-circular-bodies.js , A2706
 * Rotating sprites must not carry a rectangular collision box. Asteroids and
 * Racing use circular bodies; Platformer keeps its rectangle.
 * Run: node tests/arcade-game-maker-circular-bodies.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.AGM_BODY_PORT || 0);
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.webp':'image/webp', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.woff':'font/woff', '.ico':'image/x-icon' };

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const server = http.createServer((req, res) => {
    let file = decodeURIComponent(req.url.split('?')[0]);
    if (file.endsWith('/')) file += 'index.html';
    fs.readFile(path.join(ROOT, file), (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const BASE = `http://127.0.0.1:${server.address().port}/`;

  const browser = await puppeteer.launch({ headless:'new', args:['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') jsErrors.push(m.text()); });
  await page.setViewport({ width:1280, height:900 });

  async function boot(genre) {
    jsErrors.length = 0;
    await sleep(800);
    await page.evaluate((g) => {
      customLevelEntities = null;
      const el = document.getElementById('genreMode');
      el.value = g;
      if (typeof onGenreChange === 'function') onGenreChange();
      compileAndBootEngine._lastRun = 0;
      compileAndBootEngine();
      const io = document.getElementById('introOverlay');
      if (io && io.classList.contains('show') && typeof closeIntro === 'function') closeIntro();
    }, genre);
    await page.waitForFunction(() => {
      const g = window._phaserGame;
      return g && g.scene && g.scene.getScenes(true).length > 0;
    }, { timeout:20000 });
    await sleep(600);
    return page.evaluate(() => {
      const sc = window._phaserGame.scene.getScenes(true)[0];
      const obj = sc.car || sc.actor;
      const b = obj && obj.body;
      if (!b) return { ok:false };
      const before = { w:b.width, h:b.height, isCircle:b.isCircle };
      obj.setAngle(45);
      const after = { w:b.width, h:b.height };
      obj.setAngle(0);
      return { ok:true, isCircle:b.isCircle, before, after };
    });
  }

  try {
    await page.goto(BASE + 'tools/arcade-game-maker.html', { waitUntil:'domcontentloaded' });
    await page.waitForFunction(() => typeof window.compileAndBootEngine === 'function', { timeout:15000 });

    const ast = await boot('ASTEROIDS');
    check('ASTEROIDS player body is circular', ast.ok && ast.isCircle === true, JSON.stringify(ast));
    check('ASTEROIDS body bounds stay square and unchanged when rotated', ast.ok && ast.before.w === ast.before.h && ast.before.w === ast.after.w && ast.before.h === ast.after.h, JSON.stringify(ast));

    const race = await boot('RACING');
    check('RACING car body is circular', race.ok && race.isCircle === true, JSON.stringify(race));
    check('RACING body bounds stay square and unchanged when rotated', race.ok && race.before.w === race.before.h && race.before.w === race.after.w && race.before.h === race.after.h, JSON.stringify(race));

    const plat = await boot('PLATFORMER');
    check('PLATFORMER keeps a rectangular body', plat.ok && plat.isCircle === false, JSON.stringify(plat));

    check('no page errors during the run', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n' + (failures ? failures + ' check(s) failed' : 'arcade-game-maker circular bodies: all checks passed'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
