// A2530: Cozy Cafe Match exposes an ARIA grid and keyboard controls, and the
// touch drag path still works at phone and tablet sizes.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19315;
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
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
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

const html = fs.readFileSync(path.join(root, 'games', 'cozy-cafe-match-game.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style-game-cozy-cafe-match-game.css'), 'utf8');
check('board is an ARIA grid with a keyboard stop', /role="grid"[^>]*tabindex="0"/.test(html) || /tabindex="0"[^>]*role="grid"/.test(html));
check('board publishes its row and column count', /aria-rowcount="8"/.test(html) && /aria-colcount="8"/.test(html));
check('tiles get gridcell roles in code', /setAttribute\('role', 'gridcell'\)/.test(html));
check('board suppresses touch panning', /\.board\s*\{[^}]*touch-action:\s*none/.test(css));

(async () => {
  await new Promise((resolve) => server.listen(port, resolve));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  const viewports = [
    { name: '390px phone', width: 390, height: 844, isMobile: true, hasTouch: true },
    { name: '768px tablet', width: 768, height: 1024, isMobile: true, hasTouch: true }
  ];

  for (const vp of viewports) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const text = m.text();
      if (/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|ERR_ABORTED|ERR_FILE_NOT_FOUND|favicon|googletagmanager|google-analytics|AudioContext|autoplay|navigator\.vibrate|Blocked call to navigator\.vibrate/i.test(text)) return;
      errors.push('console: ' + text);
    });

    await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: 2 });
    await page.goto('http://127.0.0.1:' + port + '/games/cozy-cafe-match-game.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#board .tile', { timeout: 15000 });
    await new Promise((resolve) => setTimeout(resolve, 300));

    const attrs = await page.evaluate(() => {
      const board = document.getElementById('board');
      const tiles = [...board.querySelectorAll('.tile')];
      const first = tiles[0];
      return {
        role: board.getAttribute('role'),
        tabindex: board.getAttribute('tabindex'),
        rows: board.getAttribute('aria-rowcount'),
        cols: board.getAttribute('aria-colcount'),
        count: tiles.length,
        firstRole: first.getAttribute('role'),
        firstLabel: first.getAttribute('aria-label'),
        firstRow: first.getAttribute('aria-rowindex'),
        firstCol: first.getAttribute('aria-colindex'),
        touchAction: getComputedStyle(board).touchAction
      };
    });
    check(vp.name + ': board is a grid with 64 gridcells', attrs.role === 'grid' && attrs.count === 64, attrs.count + ' tiles');
    check(vp.name + ': board is keyboard focusable', attrs.tabindex === '0');
    check(vp.name + ': board reports 8 by 8', attrs.rows === '8' && attrs.cols === '8');
    check(vp.name + ': first tile is labelled for a screen reader', attrs.firstRole === 'gridcell' && /row 1, column 1/.test(attrs.firstLabel || ''), attrs.firstLabel);
    check(vp.name + ': tiles carry row and column indexes', attrs.firstRow === '1' && attrs.firstCol === '1');
    check(vp.name + ': board blocks browser panning during a drag', attrs.touchAction === 'none', attrs.touchAction);

    // Keyboard first, before any drag can set the game busy.
    await page.focus('#board');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    const cursor = await page.evaluate(() => {
      const board = document.getElementById('board');
      const active = board.getAttribute('aria-activedescendant');
      const el = active ? document.getElementById(active) : null;
      return { active, hasCursor: !!(el && el.classList.contains('kb-cursor')) };
    });
    check(vp.name + ': arrow keys move the board cursor', cursor.active === 'tile-3-4' && cursor.hasCursor, JSON.stringify(cursor));

    await page.keyboard.press('Enter');
    const selected = await page.evaluate(() => document.getElementById('tile-3-4').getAttribute('aria-selected'));
    check(vp.name + ': Enter selects the focused tile', selected === 'true', String(selected));

    // Clear the selection again so the drag starts clean.
    await page.keyboard.press('Enter');

    // Touch drag across one neighbouring tile.
    await page.evaluate(() => {
      const tile = document.getElementById('tile-0-0');
      const board = document.getElementById('board');
      const r = tile.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const base = { bubbles: true, cancelable: true, composed: true, pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1 };
      tile.dispatchEvent(new PointerEvent('pointerdown', { ...base, clientX: x, clientY: y }));
      board.dispatchEvent(new PointerEvent('pointermove', { ...base, clientX: x + 40, clientY: y }));
      board.dispatchEvent(new PointerEvent('pointerup', { ...base, clientX: x + 40, clientY: y }));
    });
    await new Promise((resolve) => setTimeout(resolve, 900));
    const afterDrag = await page.evaluate(() => document.querySelectorAll('#board .tile').length);
    check(vp.name + ': touch drag leaves the board intact', afterDrag === 64, afterDrag + ' tiles');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(vp.name + ': no horizontal scroll', overflow <= 2, String(overflow));
    check(vp.name + ': no runtime errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL COZY CAFE MATCH CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
