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
  page.on('dialog', dialog => { dialog.accept().catch(() => {}); });
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
      localStorage.removeItem('jvds-tabletop-v2');
      localStorage.setItem('jvds-cookie-consent', 'declined');
      var settings = {};
      try { settings = JSON.parse(localStorage.getItem('jvds_studio_settings') || '{}') || {}; } catch (err) {}
      settings.seenWalkthrough = true;
      localStorage.setItem('jvds_studio_settings', JSON.stringify(settings));
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
    tools: document.querySelectorAll('[data-tool]').length,
    dice: document.querySelectorAll('#ttDiceTypes .tt-die-chip').length,
    modes: document.querySelectorAll('.tt-mode-btn').length,
    templates: document.querySelectorAll('#ttEmpty [data-template]').length,
    pieceImgs: document.querySelectorAll('#ttPieces img').length,
    libraryRows: document.querySelectorAll('#ttLib .tt-lib-row').length,
    zoom: !!document.getElementById('ttZoomIn'),
    sheet: !!document.getElementById('ttExportSheet'),
    cardMaker: !!document.getElementById('ttCardAdd'),
    print: !!document.getElementById('ttPrint'),
    loadFile: !!document.getElementById('ttLoadFile'),
    emptyVisible: !document.getElementById('ttEmpty').hidden,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    cleanText: !/[ǽǟ�]/.test(document.body.innerText)
  }));

  check('title loads', /Tabletop Studio/.test(initial.title), initial.title);
  check('single skip link', initial.skipLinks === 1, String(initial.skipLinks));
  check('main target exists', initial.main);
  check('board canvas exists', initial.canvas);
  check('token layer exists', initial.tokensLayer);
  check('terrain swatches present (9 + erase)', initial.swatches === 14, String(initial.swatches));
  check('characters, players and props present', initial.pieces === 26, String(initial.pieces));
  check('paint and fill tools present', initial.tools === 3, String(initial.tools));
  check('dice d4-d20 present', initial.dice === 6, String(initial.dice));
  check('build/play toggle present', initial.modes === 2, String(initial.modes));
  check('four starter boards offered', initial.templates === 4, String(initial.templates));
  check('character sprites are pieces', initial.pieceImgs === 6, String(initial.pieceImgs));
  check('saved-board library starts with one board', initial.libraryRows === 1, String(initial.libraryRows));
  check('zoom control present', initial.zoom);
  check('play-sheet export present', initial.sheet);
  check('card maker present', initial.cardMaker);
  check('print action present', initial.print);
  check('board file import present', initial.loadFile);
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
  const deckAfterClear = await page.evaluate(() => document.getElementById('ttDeckLeft').textContent);
  check('clearing resets the deck label', /^52 cards left/.test(deckAfterClear), deckAfterClear);

  await page.evaluate(() => { document.getElementById('ttStartBlank').click(); });
  await wait(300);
  const blank = await page.evaluate(() => ({
    emptyHidden: document.getElementById('ttEmpty').hidden,
    stepsVisible: !document.getElementById('ttSteps').hidden
  }));
  check('start blank hides the empty state', blank.emptyHidden);
  check('first steps appear after starting', blank.stepsVisible);

  await page.evaluate(() => { document.querySelector('[data-tool="fill"]').click(); });
  await page.evaluate(() => { document.querySelector('[data-terrain="sand"]').click(); });
  const fillBox = await page.$eval('#ttBoard', el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await page.evaluate(() => {
    const canvas = document.getElementById('ttBoard');
    const r = canvas.getBoundingClientRect();
    const x = r.left + r.width * 0.5;
    const y = r.top + r.height * 0.5;
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, isPrimary: true, button: 0, buttons: 1 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y, isPrimary: true, button: 0, buttons: 0 }));
  });
  await wait(1900);
  const filled = await page.evaluate(() => {
    const raw = localStorage.getItem('jvds-tabletop-v1');
    if (!raw) return null;
    const data = JSON.parse(raw);
    return { painted: data.tiles.filter(Boolean).length, total: data.tiles.length };
  });
  check('fill floods the blank board and autosaves', filled && filled.painted === filled.total, filled ? JSON.stringify(filled) : 'no autosave');

  await page.evaluate(() => { document.querySelector('#ttShape').closest('details').open = true; });
  await page.select('#ttShape', 'hex');
  await page.evaluate(() => { document.querySelector('[data-tool="brush"]').click(); });
  await page.evaluate(() => { document.querySelector('[data-brush="3"]').click(); });
  await page.evaluate(() => { document.querySelector('[data-terrain="water"]').click(); });
  await page.evaluate(() => {
    const canvas = document.getElementById('ttBoard');
    const r = canvas.getBoundingClientRect();
    const x = r.left + r.width * 0.5;
    const y = r.top + r.height * 0.5;
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, isPrimary: true, button: 0, buttons: 1 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y, isPrimary: true, button: 0, buttons: 0 }));
  });
  await wait(1900);
  const hexFilled = await page.evaluate(() => {
    const raw = localStorage.getItem('jvds-tabletop-v1');
    if (!raw) return 0;
    return JSON.parse(raw).tiles.filter(t => t === 'water').length;
  });
  check('hex big brush paints the neighbours', hexFilled === 7, String(hexFilled));

  await page.select('#ttShape', 'square');
  await page.click('[data-brush="1"]');
  await page.click('[data-terrain="water"]');
  await page.click('#ttClearTiles');
  await wait(200);

  await page.evaluate(() => { document.getElementById('ttHelpBtn').click(); });
  await wait(300);
  const helpOpen = await page.evaluate(() => !document.getElementById('ttHelp').hidden);
  check('help dialog opens', helpOpen);
  await page.evaluate(() => { var btn = document.getElementById('ttHelpClose'); if (btn) btn.click(); });
  await wait(150);
  const helpClosed = await page.evaluate(() => document.getElementById('ttHelp').hidden);
  check('help dialog closes', helpClosed);

  const beforePaint = await page.evaluate(() => document.getElementById('ttBoard').toDataURL().length);
  await page.evaluate(() => { document.querySelector('[data-terrain="water"]').click(); });
  await page.evaluate(() => {
    const canvas = document.getElementById('ttBoard');
    const r = canvas.getBoundingClientRect();
    const x1 = r.left + r.width * 0.3, y1 = r.top + r.height * 0.4;
    const x2 = r.left + r.width * 0.55, y2 = r.top + r.height * 0.55;
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x1, clientY: y1, isPrimary: true, button: 0, buttons: 1 }));
    canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x2, clientY: y2, isPrimary: true, button: 0, buttons: 1 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x2, clientY: y2, isPrimary: true, button: 0, buttons: 0 }));
  });
  await wait(200);
  const afterPaint = await page.evaluate(() => document.getElementById('ttBoard').toDataURL().length);
  check('painting a tile changes the canvas', afterPaint !== beforePaint, beforePaint + ' -> ' + afterPaint);
  const paintStep = await page.evaluate(() => document.querySelector('[data-step="paint"]').classList.contains('is-done'));
  check('painting ticks the first step', paintStep);

  await page.evaluate(() => { document.querySelector('[data-piece="meeple"]').click(); });
  await wait(150);
  const afterPiece = await page.evaluate(() => document.querySelectorAll('#ttTokens .tt-token').length);
  check('tapping a piece adds a token', afterPiece === 1, String(afterPiece));
  const pieceStep = await page.evaluate(() => document.querySelector('[data-step="piece"]').classList.contains('is-done'));
  check('adding a piece ticks the second step', pieceStep);

  const tokenBox = await page.$eval('#ttTokens .tt-token', el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, left: el.style.left };
  });
  await page.evaluate(() => {
    const el = document.querySelector('#ttTokens .tt-token');
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: cx, clientY: cy, isPrimary: true, button: 0, buttons: 1 }));
    document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: cx + 70, clientY: cy + 40, isPrimary: true, button: 0, buttons: 1 }));
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: cx + 70, clientY: cy + 40, isPrimary: true, button: 0, buttons: 0 }));
  });
  await wait(200);
  const moved = await page.evaluate(() => {
    const el = document.querySelector('#ttTokens .tt-token');
    return { left: el.style.left, top: el.style.top };
  });
  check('dragging a token moves it', moved.left !== tokenBox.left, tokenBox.left + ' -> ' + moved.left);

  await page.evaluate(() => { document.getElementById('ttUndo').click(); });
  await wait(200);
  const afterUndo = await page.evaluate(() => {
    const el = document.querySelector('#ttTokens .tt-token');
    return el ? el.style.left : null;
  });
  check('undo restores a moved piece instead of deleting it', afterUndo === tokenBox.left, afterUndo + ' vs ' + tokenBox.left);

  await page.evaluate(() => { document.getElementById('ttRedo').click(); });
  await wait(200);
  const afterRedo = await page.evaluate(() => {
    const el = document.querySelector('#ttTokens .tt-token');
    return el ? el.style.left : null;
  });
  check('redo puts the moved piece back', afterRedo === moved.left, afterRedo + ' vs ' + moved.left);

  await page.evaluate(() => { document.getElementById('ttUndo').click(); });
  await wait(150);

  await page.evaluate(() => { document.querySelector('.tt-mode-btn[data-mode="play"]').click(); });
  await wait(150);
  const playPressed = await page.evaluate(() => document.querySelector('.tt-mode-btn[data-mode="play"]').getAttribute('aria-pressed'));
  check('play mode activates', playPressed === 'true', playPressed);

  await page.evaluate(() => { document.getElementById('ttDrawCard').click(); });
  await wait(200);
  const cards = await page.evaluate(() => document.querySelectorAll('#ttTokens .tt-token--card').length);
  check('drawing a card adds a card token', cards === 1, String(cards));

  const cardBox = await page.$eval('#ttTokens .tt-token--card', el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await page.evaluate(() => {
    const el = document.querySelector('#ttTokens .tt-token--card');
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: cx, clientY: cy, isPrimary: true, button: 0, buttons: 1 }));
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: cx, clientY: cy, isPrimary: true, button: 0, buttons: 0 }));
  });
  await wait(200);
  const flipped = await page.evaluate(() => document.querySelector('#ttTokens .tt-token--card').classList.contains('is-down'));
  check('tapping a card in play mode flips it', flipped);

  await page.evaluate(() => {
    const add = document.getElementById('ttCardAdd');
    add.closest('details').open = true;
    const set = (id, value) => {
      const el = document.getElementById(id);
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set('ttCardName', 'Moon Beam');
    set('ttCardText', 'Move two spaces');
    set('ttCardIcon', '🌙');
  });
  await page.evaluate(() => { document.getElementById('ttCardAdd').click(); });
  await wait(200);
  const cardRows = await page.evaluate(() => document.querySelectorAll('#ttCardList .tt-card-row').length);
  check('custom card appears in the deck list', cardRows === 1, String(cardRows));

  await page.evaluate(() => { document.getElementById('ttDrawCard').click(); });
  await wait(250);
  const customCard = await page.evaluate(() => {
    const el = document.querySelector('#ttTokens .tt-token--custom');
    return el ? { label: el.getAttribute('aria-label'), text: el.textContent } : null;
  });
  check('custom card draws onto the board', !!customCard && /Moon Beam/.test(customCard.label || ''), JSON.stringify(customCard));

  await page.evaluate(() => { document.querySelector('[data-piece="counter"]').click(); });
  await wait(200);
  const counter = await page.evaluate(() => {
    const el = document.querySelector('#ttTokens .tt-token--counter');
    return el ? { text: el.textContent, buttons: !document.getElementById('ttValueUp').hidden } : null;
  });
  check('counter piece starts at 1 with value buttons', !!counter && counter.text === '1' && counter.buttons, JSON.stringify(counter));
  await page.evaluate(() => { document.getElementById('ttValueUp').click(); });
  await wait(150);
  const counterValue = await page.evaluate(() => {
    const el = document.querySelector('#ttTokens .tt-token--counter');
    return el ? el.textContent : null;
  });
  check('counter raises its number', counterValue === '2', String(counterValue));
  await page.evaluate(() => { document.querySelector('[data-piece-act="remove"]').click(); });
  await wait(150);

  await page.evaluate(() => { document.getElementById('ttTurnUp').closest('details').open = true; });
  await page.evaluate(() => { document.getElementById('ttTurnUp').click(); });
  await wait(150);
  const turnNow = await page.evaluate(() => document.getElementById('ttTurn').textContent);
  check('turn counter advances', turnNow === '2', String(turnNow));

  await page.evaluate(() => { document.getElementById('ttZoomIn').click(); });
  await wait(150);
  const zoomed = await page.evaluate(() => document.getElementById('ttScale').style.width);
  check('zoom widens the board', zoomed === '125%', zoomed);
  await page.evaluate(() => { document.getElementById('ttZoomFit').click(); });
  await wait(150);

  await page.evaluate(() => { document.querySelector('[data-sides="20"]').click(); });
  await page.evaluate(() => { document.getElementById('ttRoll').click(); });
  await wait(200);
  const overlayUp = await page.evaluate(() => !!document.querySelector('.tt-roll-overlay'));
  check('dice roll animates across the screen', overlayUp);
  await wait(1600);
  const overlayGone = await page.evaluate(() => !document.querySelector('.tt-roll-overlay'));
  check('roll animation clears itself', overlayGone);
  const rolled = await page.evaluate(() => document.getElementById('ttDiceResult').textContent);
  check('d20 roll reports a result', /You rolled \d+/.test(rolled), rolled);
  const history = await page.evaluate(() => document.querySelectorAll('#ttDiceHistory span').length);
  check('dice history records the roll', history >= 1, String(history));
  const barResult = await page.evaluate(() => document.getElementById('ttBarResult').textContent);
  check('roll result shows beside the board', /You rolled \d+|Total \d+/.test(barResult), barResult);
  const stepsDone = await page.evaluate(() => document.getElementById('ttSteps').hidden);
  check('rolling finishes and hides the first steps', stepsDone);

  await page.evaluate(() => {
    const el = document.getElementById('ttBoardName');
    el.value = 'Test board';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.evaluate(() => { document.getElementById('ttSave').click(); });
  await wait(200);
  const saved = await page.evaluate(() => {
    const raw = localStorage.getItem('jvds-tabletop-v1');
    if (!raw) return null;
    const data = JSON.parse(raw);
    return { tokens: data.tokens.length, tiles: data.tiles.filter(Boolean).length, name: data.name };
  });
  check('save writes the board to localStorage', !!saved && saved.tokens === 3, saved ? JSON.stringify(saved) : 'no save');
  check('save stores the board name', !!saved && saved.name === 'Test board', saved && saved.name);

  await page.goto('http://127.0.0.1:' + port + '/tools/tabletop-studio.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#ttTerrain .tt-swatch', { timeout: 10000 });
  await wait(400);
  const restored = await page.evaluate(() => ({
    tokens: document.querySelectorAll('#ttTokens .tt-token').length,
    savedLabel: document.getElementById('ttSaved').textContent,
    emptyHidden: document.getElementById('ttEmpty').hidden
  }));
  check('saved board reloads', restored.tokens === 3, JSON.stringify(restored));
  check('reload hides the empty state', restored.emptyHidden);
  const restoredName = await page.evaluate(() => document.getElementById('ttBoardName').value);
  check('board name reloads', restoredName === 'Test board', restoredName);

  const importPath = path.join(require('os').tmpdir(), 'jvds-tabletop-import.json');
  fs.writeFileSync(importPath, JSON.stringify({
    v: 1,
    name: 'Imported test',
    cols: 4,
    rows: 3,
    shape: 'square',
    tiles: ['grass', 'water', null, 'sand', 'path', null, null, 'stone', 'lava', 'snow', 'wall', 'forest'],
    tokens: [{ id: 1, type: 'piece', kind: 'meeple-2', x: 80, y: 60, rot: 0, scale: 1 }],
    deck: [],
    nextId: 2
  }));
  await (await page.$('#ttLoadFile')).uploadFile(importPath);
  await wait(500);
  const imported = await page.evaluate(() => ({
    name: document.getElementById('ttBoardName').value,
    tokens: document.querySelectorAll('#ttTokens .tt-token').length,
    width: document.getElementById('ttBoard').width
  }));
  check('importing a board file loads its board', imported.tokens === 1 && imported.width === 320, JSON.stringify(imported));
  check('importing a board file loads its name', imported.name === 'Imported test', imported.name);
  fs.unlinkSync(importPath);

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

  await page.evaluate(() => { document.getElementById('ttLib').closest('details').open = true; });
  await wait(150);
  await page.evaluate(() => { document.getElementById('ttNewBoard').click(); });
  await wait(400);
  const twoBoards = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('#ttLib .tt-lib-row'));
    const other = rows.find(row => !row.classList.contains('is-active'));
    return {
      rows: rows.length,
      active: document.querySelector('#ttLib .tt-lib-row.is-active .tt-lib-name')?.textContent || '',
      otherName: other ? other.querySelector('.tt-lib-name').textContent : ''
    };
  });
  check('new board adds a second board to the library', twoBoards.rows === 2 && twoBoards.active === 'New board', JSON.stringify(twoBoards));
  await page.evaluate((name) => {
    const rows = Array.from(document.querySelectorAll('#ttLib .tt-lib-row'));
    const target = rows.find(row => (row.querySelector('.tt-lib-name') || {}).textContent === name);
    if (target) target.querySelector('.tt-lib-open').click();
  }, twoBoards.otherName);
  await wait(500);
  const reopened = await page.evaluate(() => ({
    name: document.getElementById('ttBoardName').value,
    rows: document.querySelectorAll('#ttLib .tt-lib-row').length,
    undoDisabled: document.getElementById('ttUndo').disabled,
    redoDisabled: document.getElementById('ttRedo').disabled
  }));
  check('opening another board restores its name', reopened.name === twoBoards.otherName, JSON.stringify(reopened));
  check('switching boards clears undo and redo history', reopened.undoDisabled && reopened.redoDisabled, JSON.stringify(reopened));

  await page.evaluate(() => {
    window.__svgBlobs = [];
    const original = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function (blob) {
      window.__svgBlobs.push(blob);
      return original(blob);
    };
  });
  await page.evaluate(() => {
    document.getElementById('ttExportSvg').closest('details').open = true;
    document.getElementById('ttSize').closest('details').open = true;
  });
  await page.select('#ttSize', '12x9');
  await wait(300);
  await page.evaluate(() => { document.querySelector('[data-template="dungeon"]').click(); });
  await wait(400);
  await page.evaluate(() => { document.getElementById('ttExportSvg').click(); });
  await wait(250);
  const boardSvg = await page.evaluate(async () => {
    const blobs = window.__svgBlobs;
    return blobs.length ? await blobs[blobs.length - 1].text() : '';
  });
  check('square board SVG has a mm viewBox', /<svg[^>]+viewBox="0 0 960 720"/.test(boardSvg) && /width="240mm"/.test(boardSvg), boardSvg.slice(0, 140));
  check('square board SVG exports separate tiles', (boardSvg.match(/class="tile"/g) || []).length > 20, String((boardSvg.match(/class="tile"/g) || []).length));
  check('board SVG includes pieces as separate shapes', /id="pieces"/.test(boardSvg) && /data-piece="/.test(boardSvg));

  await page.evaluate(() => { document.getElementById('ttShape').closest('details').open = true; });
  await page.select('#ttShape', 'hex');
  await wait(400);
  await page.evaluate(() => { document.getElementById('ttExportSvg').click(); });
  await wait(250);
  const hexSvg = await page.evaluate(async () => {
    const blobs = window.__svgBlobs;
    return blobs.length ? await blobs[blobs.length - 1].text() : '';
  });
  check('hex board SVG exports hexagon polygons', /<polygon class="tile"/.test(hexSvg) && /data-terrain="/.test(hexSvg), hexSvg.slice(0, 160));

  await page.evaluate(() => { document.getElementById('ttExportPiecesSvg').click(); });
  await wait(250);
  const piecesSvg = await page.evaluate(async () => {
    const blobs = window.__svgBlobs;
    return blobs.length ? await blobs[blobs.length - 1].text() : '';
  });
  check('piece sheet SVG lists every piece', (piecesSvg.match(/data-piece="/g) || []).length === 26, String((piecesSvg.match(/data-piece="/g) || []).length));
  check('piece sheet SVG names the characters', /Stardust/.test(piecesSvg) && /Barnaby/.test(piecesSvg));
  check('World Builder 3D link present', /href="\/workshops\/world-builder-3d.html"/.test(await page.content()));
  await page.select('#ttShape', 'square');

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

  const devices = [
    { label: '320 phone', width: 320, height: 568, mobile: true, touch: true, drawer: true },
    { label: '360 phone', width: 360, height: 640, mobile: true, touch: true, drawer: true },
    { label: '412 Android', width: 412, height: 915, mobile: true, touch: true, drawer: true },
    { label: '768 tablet', width: 768, height: 1024, mobile: true, touch: true, drawer: true },
    { label: '1024 Chromebook', width: 1024, height: 600, mobile: false, touch: false, drawer: false },
    { label: '1366 Chromebook', width: 1366, height: 768, mobile: false, touch: false, drawer: false }
  ];
  for (const d of devices) {
    await page.setViewport({ width: d.width, height: d.height, isMobile: d.mobile, hasTouch: d.touch });
    await page.goto('http://127.0.0.1:' + port + '/tools/tabletop-studio.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#ttTerrain .tt-swatch', { timeout: 10000 });
    await wait(200);
    const m = await page.evaluate(() => {
      const stage = document.getElementById('ttStage');
      const canvas = document.getElementById('ttBoard');
      const zoom = document.getElementById('ttZoomIn').getBoundingClientRect();
      const drawer = document.getElementById('ttSidebarOpen');
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        stageScroll: stage.scrollWidth,
        stageClient: stage.clientWidth,
        canvasWidth: canvas.clientWidth,
        zoomW: Math.round(zoom.width),
        zoomH: Math.round(zoom.height),
        drawerShown: getComputedStyle(drawer).display !== 'none'
      };
    });
    check('no horizontal overflow at ' + d.label, m.scrollWidth <= m.clientWidth + 2, m.scrollWidth + '/' + m.clientWidth);
    check('board fits ' + d.label, m.canvasWidth <= m.stageClient + 1 && m.stageScroll <= m.stageClient + 1, JSON.stringify(m));
    check('zoom target is touch sized at ' + d.label, m.zoomW >= 40 && m.zoomH >= 40, m.zoomW + 'x' + m.zoomH);
    check('toolbox mode correct at ' + d.label, m.drawerShown === d.drawer, String(m.drawerShown));
    if (d.drawer) {
      await page.click('#ttSidebarOpen');
      await wait(300);
      const open = await page.evaluate(() => ({
        open: document.getElementById('ttSidebar').classList.contains('open'),
        expanded: document.getElementById('ttSidebarOpen').getAttribute('aria-expanded')
      }));
      check('toolbox drawer opens at ' + d.label, open.open && open.expanded === 'true', JSON.stringify(open));
      await page.click('#ttSidebarClose');
      await wait(200);
    }
  }

  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setViewport({ width: 1024, height: 600 });
  await page.goto('http://127.0.0.1:' + port + '/tools/tabletop-studio.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#ttQuickRoll', { timeout: 10000 });
  await page.click('#ttQuickRoll');
  await wait(500);
  const reduced = await page.evaluate(() => ({
    overlay: !!document.querySelector('.tt-roll-overlay'),
    result: document.getElementById('ttDiceResult').textContent
  }));
  check('reduced motion skips the big roll animation', !reduced.overlay && /You rolled \d+/.test(reduced.result), JSON.stringify(reduced));
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://127.0.0.1:' + port + '/tools/tabletop-studio.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#ttTerrain .tt-swatch', { timeout: 10000 });
  await wait(250);
  await page.click('#ttSidebarOpen');
  await wait(300);
  await page.click('.tt-starters [data-template="dungeon"]');
  await wait(400);
  await page.click('[data-terrain="lava"]');
  await page.click('#ttSidebarClose');
  await wait(300);
  const touchRect = await page.$eval('#ttBoard', el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, scrollY: window.scrollY };
  });
  const beforeTouch = await page.evaluate(() => ({
    canvas: document.getElementById('ttBoard').toDataURL().length,
    scrollY: window.scrollY
  }));
  const cdp = await page.target().createCDPSession();
  const ty = touchRect.y + touchRect.h * 0.5;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchRect.x + touchRect.w * 0.25, y: ty, id: 0 }] });
  for (let i = 1; i <= 6; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchRect.x + touchRect.w * (0.25 + i * 0.06), y: ty, id: 0 }] });
    await wait(35);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await wait(250);
  const afterTouch = await page.evaluate(() => ({
    canvas: document.getElementById('ttBoard').toDataURL().length,
    scrollY: window.scrollY
  }));
  check('touch painting changes the board without scrolling the page', afterTouch.canvas !== beforeTouch.canvas && afterTouch.scrollY === beforeTouch.scrollY, JSON.stringify({ beforeTouch, afterTouch }));

  await page.evaluate((r, ty) => {
    const stage = document.getElementById('ttStage');
    const x0 = r.x + r.w * 0.4, x1 = r.x + r.w * 0.6;
    stage.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x0, clientY: ty, pointerId: 10, isPrimary: true, button: 0, buttons: 1, pointerType: 'touch' }));
    stage.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x1, clientY: ty, pointerId: 11, isPrimary: false, button: 0, buttons: 1, pointerType: 'touch' }));
    for (let i = 1; i <= 8; i++) {
      stage.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x0 - i * (r.w * 0.02), clientY: ty, pointerId: 10, isPrimary: true, button: 0, buttons: 1, pointerType: 'touch' }));
      stage.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x1 + i * (r.w * 0.02), clientY: ty, pointerId: 11, isPrimary: false, button: 0, buttons: 1, pointerType: 'touch' }));
    }
    stage.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x0 - 8 * (r.w * 0.02), clientY: ty, pointerId: 10, isPrimary: true, button: 0, buttons: 0, pointerType: 'touch' }));
    stage.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x1 + 8 * (r.w * 0.02), clientY: ty, pointerId: 11, isPrimary: false, button: 0, buttons: 0, pointerType: 'touch' }));
  }, touchRect, ty);
  await wait(250);
  const pinch = await page.evaluate(() => ({
    width: document.getElementById('ttScale').style.width,
    doc: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth
  }));
  check('two-finger pinch zooms without page overflow', pinch.width !== '100%' && pinch.doc <= pinch.client + 2, JSON.stringify(pinch));
  await page.click('#ttZoomFit');
  await wait(150);

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
