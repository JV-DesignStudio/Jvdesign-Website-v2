#!/usr/bin/env node
/*
 * tests/arcade-game-maker-path-worker.js
 * A2682: A* pathfinding runs in a Blob Web Worker, a batch of 150 agents is
 * returned inside the budget, the main-thread fallback still works when a
 * Worker cannot start, and the exported game carries the same helper.
 * Run: node tests/arcade-game-maker-path-worker.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.AGM_PATH_PORT || 0);
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.webp':'image/webp', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.woff':'font/woff', '.ico':'image/x-icon' };

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function makeGridScript() {
  return {
    cols: 24, rows: 18,
    blocked: (() => {
      const blocked = new Uint8Array(24 * 18);
      for (let y = 0; y < 18; y++) blocked[y * 24 + 11] = 1;
      blocked[9 * 24 + 11] = 0;
      blocked[10 * 24 + 11] = 0;
      return Array.from(blocked);
    })()
  };
}

(async () => {
  const server = http.createServer((req, res) => {
    let file = decodeURIComponent(req.url.split('?')[0]);
    if (file === '/__exported_game.html') {
      res.writeHead(200, { 'Content-Type':'text/html;charset=utf-8' });
      return res.end(exportedHtml);
    }
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
  let exportedHtml = '';

  try {
    await page.goto(BASE + 'tools/arcade-game-maker.html', { waitUntil:'domcontentloaded' });
    await page.waitForSelector('#runGameBtn', { timeout:15000 });
    await page.waitForFunction(() => typeof window.ArcadePaths === 'function' || (window.ArcadePaths && typeof window.ArcadePaths.findBatch === 'function'), { timeout:15000 });

    const grid = makeGridScript();
    const batch = await page.evaluate(async (gridData) => {
      const requests = [];
      for (let i = 0; i < 150; i++) {
        const sx = i % 10, sy = i % 16;
        requests.push({ sx, sy, gx: 21, gy: 4 });
      }
      const t0 = performance.now();
      const paths = await ArcadePaths.findBatch(gridData, requests);
      return {
        ms: performance.now() - t0,
        count: paths.length,
        found: paths.filter(Boolean).length,
        first: paths[0] ? paths[0].length : 0,
        last: paths[149] ? paths[149].length : 0
      };
    }, grid);
    check('worker resolves a 150-agent batch', batch.count === 150 && batch.found === 150, JSON.stringify(batch));
    check('paths are non-trivial', batch.first > 1 && batch.last > 1, JSON.stringify({ first: batch.first, last: batch.last }));
    check('150-agent batch stays inside the budget', batch.ms < 1500, batch.ms.toFixed(0) + 'ms');

    // Fallback: remove Worker and the cached worker, then ask again.
    const fallback = await page.evaluate(async (gridData) => {
      const Orig = window.Worker;
      try {
        window.Worker = undefined;
        _pathWorker = null;
        const requests = [{ sx:0, sy:0, gx:21, gy:4 }, { sx:2, sy:2, gx:21, gy:4 }];
        const paths = await ArcadePaths.findBatch(gridData, requests);
        return { ok: Array.isArray(paths) && paths.length === 2 && !!paths[0] && !!paths[1], paths: paths.map(p => p ? p.length : 0) };
      } finally {
        window.Worker = Orig;
        _pathWorker = null;
      }
    }, grid);
    check('main-thread fallback works without Worker', fallback.ok === true, JSON.stringify(fallback));

    // The roguelike scene builds a grid and requests paths while playing.
    await page.evaluate(() => {
      document.getElementById('genreMode').value = 'ROGUELIKE';
      if (typeof onGenreChange === 'function') onGenreChange();
    });
    await sleep(800);
    await page.evaluate(() => compileAndBootEngine());
    await page.waitForFunction(() => {
      const io = document.getElementById('introOverlay');
      return !!(io && io.classList.contains('show'));
    }, { timeout:15000 });
    await page.evaluate(() => closeIntro());
    await page.waitForFunction(() => {
      const g = window._phaserGame;
      const sc = g && g.scene && g.scene.getScenes(true)[0];
      return !!(sc && sc.sys && sc.sys.isActive());
    }, { timeout:20000 });
    await sleep(1200);
    const scene = await page.evaluate(() => {
      const sc = window._phaserGame.scene.getScenes(true)[0];
      const enemies = [...sc.enemies.getChildren(), ...sc._ghosts.getChildren()].filter(e => e.active);
      return {
        grid: !!sc._pathGrid && sc._pathGrid.cols > 0,
        enemies: enemies.length,
        routed: enemies.filter(e => Array.isArray(e._astarPath)).length
      };
    });
    check('roguelike builds a path grid', scene.grid === true, JSON.stringify(scene));
    check('roguelike routes at least one chaser', scene.routed > 0, JSON.stringify(scene));

    // The exported runtime carries the path helper too.
    exportedHtml = await page.evaluate(async () => {
      _engineData = { title:'Path Export', genre:'ROGUELIKE', speed:200, gravity:600, jump:450, map:null };
      const b = await _buildExportHtml();
      return b ? b.html : '';
    });
    check('export builder produced the game', exportedHtml.length > 1000, exportedHtml.length + ' bytes');
    const player = await browser.newPage();
    await player.goto(BASE + '__exported_game.html', { waitUntil:'domcontentloaded' });
    await player.waitForFunction(() => window.__exportMode === true, { timeout:20000 });
    const exportPaths = await player.evaluate(async () => {
      if (!window.ArcadePaths || typeof ArcadePaths.findBatch !== 'function') return { ok:false };
      const g = { cols:6, rows:6, blocked:[0,0,0,0,0,0, 0,1,1,1,1,0, 0,0,0,0,0,0, 0,0,1,1,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0] };
      const paths = await ArcadePaths.findBatch(g, [{ sx:0, sy:0, gx:5, gy:5 }]);
      return { ok: !!(paths && paths[0] && paths[0].length > 1) };
    });
    check('exported game carries findBatch', exportPaths.ok === true, JSON.stringify(exportPaths));
    await player.close();

    check('no page errors during the run', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n' + (failures ? failures + ' check(s) failed' : 'arcade-game-maker path worker: all checks passed'));
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
