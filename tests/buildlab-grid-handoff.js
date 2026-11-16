const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19292;
const mime = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff'
};
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(root, url));
  if (!file.startsWith(path.normalize(root))) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
  if (!ok) failures++;
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  await new Promise((resolve) => server.listen(port, resolve));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  const errors = [];
  try {
    const lab = await browser.newPage();
    lab.on('pageerror', (e) => errors.push('buildlab pageerror: ' + e.message));
    await lab.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await lab.goto('http://127.0.0.1:' + port + '/tools/buildlab.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await lab.waitForSelector('#viewport canvas, #viewport.engine-error', { timeout: 20000 }).catch(() => {});
    await wait(900);
    await lab.evaluate(() => { try { window.closeModal('welcomeModal'); } catch (e) {} const w = document.getElementById('welcomeModal'); if (w) w.classList.remove('open'); document.body.classList.remove('bl-modal-open'); });
    await lab.waitForFunction(() => window.JVDSBuildLabGrid && typeof window.quickBuild === 'function', { timeout: 30000 });
    await lab.evaluate(() => window.quickBuild('dinosaur'));
    await wait(500);
    const exported = await lab.evaluate(() => {
      const grid = window.JVDSBuildLabGrid.export();
      return { grid, saved: !!localStorage.getItem('jvds_buildlab_grid'), button: !!document.querySelector('[data-on="exportBuildLabGrid"]') };
    });
    const grid = exported.grid;
    const filled = Array.isArray(grid.cells) ? grid.cells.filter(Boolean).length : 0;
    check('BuildLab has an Export grid action', exported.button && exported.saved);
    check('BuildLab projects a top-down grid', grid.app === 'jvds-buildlab-grid' && grid.cols > 1 && grid.rows > 1 && grid.cells.length === grid.cols * grid.rows, JSON.stringify({ cols: grid.cols, rows: grid.rows, cells: grid.cells.length }));
    check('BuildLab grid keeps the built blocks', filled > 0, String(filled));
    const overflowLab = await lab.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    check('BuildLab has no horizontal overflow at 390', !overflowLab);
    await lab.close();

    const level = await browser.newPage();
    level.on('pageerror', (e) => errors.push('level pageerror: ' + e.message));
    await level.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await level.goto('http://127.0.0.1:' + port + '/tools/level-designer.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await level.waitForFunction(() => typeof canvas !== 'undefined' && !!canvas && Array.isArray(layers) && layers.length === 4 && typeof importBuildLabGridText === 'function' && !!document.querySelector('[data-on="openBuildLabGrid"]'), { timeout: 25000 });
    const expectedTerrain = grid.cells.map(c => c ? 1 : 0).join(',');
    const firstFilled = grid.cells.findIndex(Boolean);
    const lastFilled = grid.cells.length - 1 - [...grid.cells].reverse().findIndex(Boolean);
    const imported = await level.evaluate((json) => {
      const res = importBuildLabGridText(json);
      return {
        res,
        w: gridW,
        h: gridH,
        terrain: Array.from(layers[0].data).join(','),
        spawn: Array.from(layers[1].data).indexOf(21),
        goal: Array.from(layers[1].data).indexOf(22),
        button: !!document.querySelector('[data-on="openBuildLabGrid"]')
      };
    }, JSON.stringify(grid));
    check('World Builder has a BuildLab grid action', imported.button);
    check('World Builder matches the BuildLab layout', imported.w === grid.cols && imported.h === grid.rows && imported.terrain === expectedTerrain, JSON.stringify({ w: imported.w, h: imported.h }));
    check('World Builder adds a spawn and a goal', imported.spawn === firstFilled && imported.goal === lastFilled, JSON.stringify({ spawn: imported.spawn, goal: imported.goal, firstFilled, lastFilled }));

    const play = await level.evaluate(() => {
      openPlayMode();
      return { open: document.getElementById('play-overlay').classList.contains('show'), canvas: !!document.getElementById('play-canvas') };
    });
    check('imported grid opens in Play mode', play.open && play.canvas);
    await level.evaluate(() => { if (typeof closePlayMode === 'function') closePlayMode(); });

    await level.setViewport({ width: 1440, height: 900 });
    await wait(200);
    const wide = await level.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      button: !!document.querySelector('[data-on="openBuildLabGrid"]')
    }));
    check('World Builder keeps the action at 1440', wide.button);
    check('World Builder has no horizontal overflow at 1440', !wide.overflow);
    await level.close();

    check('zero runtime errors', errors.length === 0, errors.join(' | '));
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nBUILDLAB GRID HANDOFF CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
