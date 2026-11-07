#!/usr/bin/env node
/*
 * tests/arcade-game-maker-bus.js , A2683
 * UI intents must travel through the ArcadeBus CustomEvent helper: config
 * changes publish gm:config, the applier updates liveConfig and publishes
 * gm:state:config, and pause publishes gm:pause.
 * Run: node tests/arcade-game-maker-bus.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.AGM_BUS_PORT || 0);
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
  await page.setViewport({ width:1280, height:900 });

  async function boot(genre) {
    await sleep(800);
    await page.evaluate((g) => {
      customLevelEntities = null;
      document.getElementById('genreMode').value = g;
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
    await sleep(400);
  }

  try {
    await page.goto(BASE + 'tools/arcade-game-maker.html', { waitUntil:'domcontentloaded' });
    await page.waitForFunction(() => typeof window._busSet === 'function' && typeof window.ArcadeBus === 'object', { timeout:15000 });
    await page.evaluate(() => _initArcadeBus());
    await sleep(100);

    const unit = await page.evaluate(() => {
      const events = [];
      const state = [];
      window.ArcadeBus.on('config', (d) => events.push(d));
      window.ArcadeBus.on('state:config', (d) => state.push(d));
      _busSet('speed', 321);
      return { events, states: state.length, speed: liveConfig.speed, bus: typeof window.ArcadeBus.emit };
    });
    check('ArcadeBus helper is available', unit.bus === 'function');
    check('gm:config intent carries the value', unit.events.length === 1 && unit.events[0].speed === 321, JSON.stringify(unit.events));
    check('applier updates liveConfig', unit.speed === 321, String(unit.speed));
    check('applier publishes gm:state:config back', unit.states >= 1, String(unit.states));

    const sliders = await page.evaluate(() => {
      const before = liveConfig.speed;
      const range = document.getElementById('playerSpeedRange');
      range.value = '333';
      range.dispatchEvent(new Event('input', { bubbles:true }));
      const g = document.getElementById('gravityRange'); g.value = '700';
      g.dispatchEvent(new Event('input', { bubbles:true }));
      const j = document.getElementById('jumpForceRange'); j.value = '500';
      j.dispatchEvent(new Event('input', { bubbles:true }));
      const e = document.getElementById('customEnemyCountRange'); e.value = '7';
      e.dispatchEvent(new Event('input', { bubbles:true }));
      return { before, speed:liveConfig.speed, gravity:liveConfig.gravity, jumpForce:liveConfig.jumpForce, enemies:liveConfig.customEnemyCount };
    });
    check('speed slider publishes through the bus', sliders.speed === 333, JSON.stringify(sliders));
    check('gravity slider publishes through the bus', sliders.gravity === 700, String(sliders.gravity));
    check('jump slider publishes through the bus', sliders.jumpForce === 500, String(sliders.jumpForce));
    check('enemy count slider publishes through the bus', sliders.enemies === 7, String(sliders.enemies));

    const theme = await page.evaluate(() => { _pickTheme('cyber'); return liveConfig.theme; });
    check('theme button publishes through the bus', theme === 'cyber', String(theme));

    await boot('SHOOTER');
    const pause = await page.evaluate(() => {
      let events = 0;
      window.ArcadeBus.on('pause', () => { events++; });
      const before = _gamePaused;
      togglePause();
      const afterFirst = _gamePaused;
      togglePause();
      const afterSecond = _gamePaused;
      return { events, before, afterFirst, afterSecond };
    });
    check('pause publishes gm:pause and toggles the game', pause.events === 2 && pause.before === false && pause.afterFirst === true && pause.afterSecond === false, JSON.stringify(pause));

    check('no page errors during the run', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n' + (failures ? failures + ' check(s) failed' : 'arcade-game-maker bus: all checks passed'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
