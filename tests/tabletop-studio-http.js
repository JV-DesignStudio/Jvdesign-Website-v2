const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19312;
const mime = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(root, url));
  if (!file.startsWith(path.normalize(root))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

function listen() {
  return new Promise(resolve => server.listen(port, resolve));
}

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  await listen();
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|favicon|net::ERR_/.test(text)) return;
    errors.push('console: ' + text);
  });

  await page.setViewport({ width: 1280, height: 900 });
  await page.goto('http://127.0.0.1:' + port + '/tools/tabletop-studio.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.evaluate(() => {
    try {
      localStorage.removeItem('jvds-tabletop-v1');
      localStorage.setItem('jvds-cookie-consent', 'declined');
    } catch (err) {}
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#ttTerrain .tt-swatch', { timeout: 10000 });
  await wait(300);

  const initial = await page.evaluate(() => ({
    title: document.title,
    skipLinks: document.querySelectorAll('.skip-link').length,
    main: !!document.getElementById('main-content'),
    canvas: !!document.getElementById('ttBoard'),
    tokensLayer: !!document.getElementById('ttTokens'),
    swatches: document.querySelectorAll('#ttTerrain .tt-swatch').length,
    pieces: document.querySelectorAll('#ttPieces [data-piece]').length,
    dice: document.querySelectorAll('#ttDiceTypes .tt-die-chip').length,
    modes: document.querySelectorAll('.tt-mode-btn').length,
    templates: document.querySelectorAll('#ttEmpty [data-template]').length,
    emptyVisible: !document.getElementById('ttEmpty').hidden,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    cleanText: !/[âÃï�]/.test(document.body.innerText)
  }));

  check('title loads', /Tabletop Studio/.test(initial.title), initial.title);
  check('single skip link', initial.skipLinks === 1, String(initial.skipLinks));
  check('main target exists', initial.main);
  check('board canvas exists', initial.canvas);
  check('token layer exists', initial.tokensLayer);
  check('terrain swatches present (9 + erase)', initial.swatches === 10, String(initial.swatches));
  check('pieces present', initial.pieces === 10, String(initial.pieces));
  check('dice d4-d20 present', initial.dice === 6, String(initial.dice));
  check('build/play toggle present', initial.modes === 2, String(initial.modes));
  check('four starter boards offered', initial.templates === 4, String(initial.templates));
  check('empty state shows on a new board', initial.emptyVisible);
  check('no visible mojibake', initial.cleanText);
  check('no horizontal overflow at 1280px', initial.scrollWidth <= initial.clientWidth + 2, initial.scrollWidth + '/' + initial.clientWidth);

  await page.click('[data-template="dungeon"]');
  await wait(300);
  const dungeon = await page.evaluate(() => ({
    tokens: document.querySelectorAll('#ttTokens .tt-token').length,
    emptyHidden: document.getElementById('ttEmpty').hidden
  }));
  check('dungeon starter paints and places pieces', dungeon.tokens > 0 && dungeon.emptyHidden, JSON.stringify(dungeon));

  await page.click('#ttClear');
  await wait(120);
  await page.click('#ttClear');
  await wait(300);
  const clearedStarter = await page.evaluate(() => !document.getElementById('ttEmpty').hidden);
  check('clearing a starter brings the choices back', clearedStarter);

  await page.click('#ttStartBlank');
  await wait(200);
  const blank = await page.evaluate(() => ({
    emptyHidden: document.getElementById('ttEmpty').hidden,
    stepsVisible: !document.getElementById('ttSteps').hidden
  }));
  check('start blank hides the empty state', blank.emptyHidden);
  check('first steps appear after starting', blank.stepsVisible);

  await page.click('#ttHelpBtn');
  await wait(200);
  const helpOpen = await page.evaluate(() => !document.getElementById('ttHelp').hidden);
  check('help dialog opens', helpOpen);
  await page.click('#ttHelpClose');
  await wait(150);
  const helpClosed = await page.evaluate(() => document.getElementById('ttHelp').hidden);
  check('help dialog closes', helpClosed);

  const beforePaint = await page.evaluate(() => document.getElementById('ttBoard').toDataURL().length);
  const box = await page.$eval('#ttBoard', el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await page.click('[data-terrain="water"]');
  await page.mouse.move(box.x + box.w * 0.3, box.y + box.h * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.w * 0.55, box.y + box.h * 0.55, { steps: 8 });
  await page.mouse.up();
  await wait(200);
  const afterPaint = await page.evaluate(() => document.getElementById('ttBoard').toDataURL().length);
  check('painting a tile changes the canvas', afterPaint !== beforePaint, beforePaint + ' -> ' + afterPaint);
  const paintStep = await page.evaluate(() => document.querySelector('[data-step="paint"]').classList.contains('is-done'));
  check('painting ticks the first step', paintStep);

  await page.click('[data-piece="meeple"]');
  await wait(150);
  const afterPiece = await page.evaluate(() => document.querySelectorAll('#ttTokens .tt-token').length);
  check('tapping a piece adds a token', afterPiece === 1, String(afterPiece));
  const pieceStep = await page.evaluate(() => document.querySelector('[data-step="piece"]').classList.contains('is-done'));
  check('adding a piece ticks the second step', pieceStep);

  const tokenBox = await page.$eval('#ttTokens .tt-token', el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, left: el.style.left };
  });
  await page.mouse.move(tokenBox.x + tokenBox.w / 2, tokenBox.y + tokenBox.h / 2);
  await page.mouse.down();
  await page.mouse.move(tokenBox.x + tokenBox.w / 2 + 70, tokenBox.y + tokenBox.h / 2 + 40, { steps: 8 });
  await page.mouse.up();
  await wait(200);
  const moved = await page.evaluate(() => {
    const el = document.querySelector('#ttTokens .tt-token');
    return { left: el.style.left, top: el.style.top };
  });
  check('dragging a token moves it', moved.left !== tokenBox.left, tokenBox.left + ' -> ' + moved.left);

  await page.click('.tt-mode-btn[data-mode="play"]');
  await wait(150);
  const playPressed = await page.evaluate(() => document.querySelector('.tt-mode-btn[data-mode="play"]').getAttribute('aria-pressed'));
  check('play mode activates', playPressed === 'true', playPressed);

  await page.click('#ttDrawCard');
  await wait(200);
  const cards = await page.evaluate(() => document.querySelectorAll('#ttTokens .tt-token--card').length);
  check('drawing a card adds a card token', cards === 1, String(cards));

  const cardBox = await page.$eval('#ttTokens .tt-token--card', el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await page.mouse.click(cardBox.x + cardBox.w / 2, cardBox.y + cardBox.h / 2);
  await wait(200);
  const flipped = await page.evaluate(() => document.querySelector('#ttTokens .tt-token--card').classList.contains('is-down'));
  check('tapping a card in play mode flips it', flipped);

  await page.click('[data-sides="20"]');
  await page.click('#ttRoll');
  await wait(1300);
  const rolled = await page.evaluate(() => document.getElementById('ttDiceResult').textContent);
  check('d20 roll reports a result', /You rolled \d+/.test(rolled), rolled);
  const history = await page.evaluate(() => document.querySelectorAll('#ttDiceHistory span').length);
  check('dice history records the roll', history >= 1, String(history));
  const barResult = await page.evaluate(() => document.getElementById('ttBarResult').textContent);
  check('roll result shows beside the board', /You rolled \d+|Total \d+/.test(barResult), barResult);
  const stepsDone = await page.evaluate(() => document.getElementById('ttSteps').hidden);
  check('rolling finishes and hides the first steps', stepsDone);

  await page.click('#ttSave');
  await wait(200);
  const saved = await page.evaluate(() => {
    const raw = localStorage.getItem('jvds-tabletop-v1');
    if (!raw) return null;
    const data = JSON.parse(raw);
    return { tokens: data.tokens.length, tiles: data.tiles.filter(Boolean).length };
  });
  check('save writes the board to localStorage', !!saved && saved.tokens === 2, saved ? JSON.stringify(saved) : 'no save');

  await page.goto('http://127.0.0.1:' + port + '/tools/tabletop-studio.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#ttTerrain .tt-swatch', { timeout: 10000 });
  await wait(400);
  const restored = await page.evaluate(() => ({
    tokens: document.querySelectorAll('#ttTokens .tt-token').length,
    savedLabel: document.getElementById('ttSaved').textContent,
    emptyHidden: document.getElementById('ttEmpty').hidden
  }));
  check('saved board reloads', restored.tokens === 2, JSON.stringify(restored));
  check('reload hides the empty state', restored.emptyHidden);

  await page.click('#ttClear');
  await page.click('#ttClear');
  await wait(250);
  const cleared = await page.evaluate(() => ({
    tokens: document.querySelectorAll('#ttTokens .tt-token').length,
    canvas: document.getElementById('ttBoard').toDataURL().length,
    emptyVisible: !document.getElementById('ttEmpty').hidden
  }));
  check('clear board removes tokens', cleared.tokens === 0, String(cleared.tokens));
  check('clear board restores the empty state', cleared.emptyVisible);

  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://127.0.0.1:' + port + '/tools/tabletop-studio.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#ttTerrain .tt-swatch', { timeout: 10000 });
  await wait(300);
  const mobile = await page.evaluate(() => {
    const canvas = document.getElementById('ttBoard');
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      canvasWidth: canvas.clientWidth,
      toolboxVisible: getComputedStyle(document.getElementById('ttSidebarOpen')).display !== 'none'
    };
  });
  check('no horizontal overflow at 390px', mobile.scrollWidth <= mobile.clientWidth + 2, mobile.scrollWidth + '/' + mobile.clientWidth);
  check('board fits the phone width', mobile.canvasWidth <= mobile.clientWidth, mobile.canvasWidth + '/' + mobile.clientWidth);
  check('toolbox button shows on mobile', mobile.toolboxVisible);

  await page.click('#ttPiecesOpen');
  await wait(400);
  const drawer = await page.evaluate(() => ({
    open: document.getElementById('ttSidebar').classList.contains('open'),
    expanded: document.getElementById('ttSidebarOpen').getAttribute('aria-expanded'),
    pieceVisible: !!document.getElementById('ttPieces').querySelector('[data-piece]')
  }));
  check('pieces button opens the toolbox on mobile', drawer.open && drawer.expanded === 'true' && drawer.pieceVisible, JSON.stringify(drawer));

  check('zero runtime errors', errors.length === 0, errors.join(' | '));

  await browser.close();
  server.close();
  if (failures) {
    console.log('\n' + failures + ' FAILURE(S)');
    process.exit(1);
  }
  console.log('\nALL TABLETOP STUDIO CHECKS PASSED');
})().catch(err => {
  console.error(err);
  server.close();
  process.exit(1);
});
