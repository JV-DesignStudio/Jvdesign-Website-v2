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
    cleanText: !/[ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â½ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â½]/.test(document.body.innerText)
  }));

  check('title loads', /Tabletop Studio/.test(initial.title), initial.title);
  check('single skip link', initial.skipLinks === 1, String(initial.skipLinks));
  check('main target exists', initial.main);
  check('board canvas exists', initial.canvas);
  check('token layer exists', initial.tokensLayer);
  check('terrain swatches present (9 + erase)', initial.swatches === 14, String(initial.swatches));
  check('characters, players and props present', initial.pieces === 26, String(initial.pieces));
  check('paint, fill, pick and tile tools present', initial.tools === 4, String(initial.tools));
  check('dice d4-d20 present', initial.dice === 6, String(initial.dice));
  check('build/play toggle present', initial.modes === 2, String(initial.modes));
  check('ten starter boards offered', initial.templates === 10, String(initial.templates));
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

  await page.evaluate(() => { document.getElementById('ttSize').closest('details').open = true; });
  await page.evaluate(() => {
    document.getElementById('ttCols').value = '10';
    document.getElementById('ttRows').value = '10';
    document.getElementById('ttSizeApply').click();
  });
  await wait(300);
  const customSize = await page.evaluate(() => ({
    w: document.getElementById('ttBoard').width,
    h: document.getElementById('ttBoard').height,
    cols: document.getElementById('ttCols').value,
    rows: document.getElementById('ttRows').value
  }));
  check('custom 10 x 10 board size applies', customSize.w === 800 && customSize.h === 800 && customSize.cols === '10', JSON.stringify(customSize));
  await page.select('#ttSize', '12x9');
  await wait(300);
  const presetSize = await page.evaluate(() => ({
    w: document.getElementById('ttBoard').width,
    h: document.getElementById('ttBoard').height
  }));
  check('classic size preset applies', presetSize.w === 960 && presetSize.h === 720, JSON.stringify(presetSize));

  const canvasBox = await page.$eval('#ttBoard', el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await page.mouse.click(canvasBox.x + 20, canvasBox.y + 20, { button: 'right' });
  await wait(250);
  const tilePanelOpen = await page.evaluate(() => !document.getElementById('ttTilePanel').hidden);
  await page.evaluate(() => {
    document.getElementById('ttTileNumber').value = '34';
    document.getElementById('ttTileLabel').value = 'Ladder';
    document.getElementById('ttTileIcon').value = 'Ã°Å¸ÂªÂ ';
    document.getElementById('ttTileEffect').value = 'forward';
    document.getElementById('ttTileEffectValue').value = '4';
    document.getElementById('ttTileOwner').value = '2';
    document.getElementById('ttTileSave').click();
  });
  await wait(200);
  await page.evaluate(() => { document.getElementById('ttSave').click(); });
  await wait(300);
  const tileSaved = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('jvds-tabletop-v1') || '{}');
    return (data.meta || [])[0];
  });
  check('tile settings panel opens on right click', tilePanelOpen);
  check('tile number, label, icon and effect save', !!tileSaved && tileSaved.n === 34 && tileSaved.label === 'Ladder' && tileSaved.owner === 2 && tileSaved.effect && tileSaved.effect.value === 4, JSON.stringify(tileSaved));

  await page.evaluate(() => { document.querySelector('[data-template="snakes"]').click(); });
  await wait(500);
  await page.evaluate(() => { document.getElementById('ttSave').click(); });
  await wait(350);
  const snakes = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('jvds-tabletop-v1') || '{}');
    return {
      cols: data.cols,
      rows: data.rows,
      path: (data.path || []).length,
      links: (data.links || []).length,
      pawns: (data.tokens || []).filter(t => t.pawn).length,
      first: (data.meta || [])[0] && data.meta[0].n,
      last: (data.meta || []).reduce((max, m) => Math.max(max, (m && m.n) || 0), 0),
      canvas: document.getElementById('ttBoard').width
    };
  });
  check('snakes starter builds a 10 x 10 numbered track', snakes.cols === 10 && snakes.rows === 10 && snakes.path === 100 && snakes.canvas === 800, JSON.stringify(snakes));
  check('snakes starter adds links and four pawns', snakes.links === 15 && snakes.pawns === 4 && snakes.first === 1 && snakes.last === 100, JSON.stringify(snakes));
  const snakeTeach = await page.evaluate(() => ({
    step: document.querySelector('[data-step="roll"] .tt-step-text').textContent,
    coach: document.getElementById('ttBarHint').textContent
  }));
  check('snakes starter teaches its own steps', /Roll and climb/.test(snakeTeach.step) && /ladder/i.test(snakeTeach.coach), JSON.stringify(snakeTeach));

  await page.evaluate(() => { document.getElementById('ttBoardListBtn').click(); });
  await wait(300);
  const boardList = await page.evaluate(() => {
    const rows = document.querySelectorAll('#ttBoardListBody tr');
    return {
      open: !document.getElementById('ttBoardList').hidden,
      rows: rows.length,
      first: rows[0] ? Array.from(rows[0].cells).map(c => c.textContent) : []
    };
  });
  check('board list reads every stop in order', boardList.open && boardList.rows === 100 && boardList.first[0] === '1', JSON.stringify({ rows: boardList.rows, first: boardList.first }));
  await page.evaluate(() => { document.getElementById('ttBoardListClose').click(); });
  await wait(200);

  await page.evaluate(() => {
    const patterns = document.getElementById('ttPatterns');
    if (!patterns.checked) patterns.click();
    const contrast = document.getElementById('ttHighContrast');
    if (!contrast.checked) contrast.click();
    document.getElementById('ttSave').click();
  });
  await wait(300);
  const a11ySettings = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('jvds-tabletop-v1') || '{}');
    return data.settings || {};
  });
  check('pattern and contrast settings save', a11ySettings.patterns === true && a11ySettings.highContrastLabels === true, JSON.stringify(a11ySettings));
  await page.evaluate(() => {
    const patterns = document.getElementById('ttPatterns');
    if (patterns.checked) patterns.click();
    const contrast = document.getElementById('ttHighContrast');
    if (contrast.checked) contrast.click();
  });
  await wait(200);

  await page.evaluate(() => {
    window.__origRandom = Math.random;
    Math.random = () => 0.99;
  });
  await page.evaluate(() => { document.querySelector('.tt-mode-btn[data-mode="play"]').click(); });
  await wait(350);
  await page.evaluate(() => { document.getElementById('ttQuickRoll').click(); });
  await wait(3200);
  const afterRoll = await page.evaluate(() => ({
    turn: document.getElementById('ttTurn').textContent,
    result: document.getElementById('ttDiceResult').textContent,
    winner: !document.getElementById('ttWin').hidden
  }));
  check('play roll moves the current pawn and passes the turn', afterRoll.turn === '2' && /You rolled 6/.test(afterRoll.result) && !afterRoll.winner, JSON.stringify(afterRoll));
  await page.evaluate(() => { Math.random = window.__origRandom; });

  await page.evaluate(() => { document.getElementById('ttPathClear').click(); });
  await page.evaluate(() => {
    document.getElementById('ttCols').value = '2';
    document.getElementById('ttRows').value = '2';
    document.getElementById('ttSizeApply').click();
  });
  await wait(300);
  await page.evaluate(() => { document.querySelector('.tt-mode-btn[data-mode="build"]').click(); });
  await page.evaluate(() => { document.getElementById('ttPathDraw').click(); });
  const tinyBox = await page.$eval('#ttBoard', el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await page.mouse.click(tinyBox.x + tinyBox.w * 0.25, tinyBox.y + tinyBox.h * 0.25);
  await page.mouse.click(tinyBox.x + tinyBox.w * 0.75, tinyBox.y + tinyBox.h * 0.25);
  await wait(200);
  await page.evaluate(() => { document.getElementById('ttPathNumber').click(); });
  await page.evaluate(() => { document.getElementById('ttSetupPawns').click(); });
  await wait(250);
  await page.evaluate(() => { document.getElementById('ttSave').click(); });
  await wait(300);
  const tiny = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('jvds-tabletop-v1') || '{}');
    return { path: (data.path || []).length, cols: data.cols, rows: data.rows };
  });
  check('tiny board has a two stop route', tiny.path === 2 && tiny.cols === 2 && tiny.rows === 2, JSON.stringify(tiny));
  await page.evaluate(() => {
    window.__origRandom = Math.random;
    Math.random = () => 0;
    document.querySelector('.tt-mode-btn[data-mode="play"]').click();
  });
  await wait(350);
  await page.evaluate(() => { document.getElementById('ttQuickRoll').click(); });
  await wait(3200);
  const winState = await page.evaluate(() => ({
    open: !document.getElementById('ttWin').hidden,
    title: document.getElementById('ttWinTitle').textContent
  }));
  check('reaching the finish opens the win screen', winState.open && /wins/.test(winState.title), JSON.stringify(winState));
  await page.evaluate(() => { Math.random = window.__origRandom; });
  await page.evaluate(() => { document.getElementById('ttWinClose').click(); });

  const starterChecks = [
    { id: 'ludo', cols: 15, rows: 15, path: 56, pieces: 16 },
    { id: 'property', cols: 11, rows: 11, path: 40, pieces: 4 },
    { id: 'life', cols: 9, rows: 9, path: 81, pieces: 2 },
    { id: 'draughts', cols: 8, rows: 8, path: 0, pieces: 24 },
    { id: 'connect', cols: 7, rows: 6, path: 0, pieces: 0 }
  ];
  for (const starter of starterChecks) {
    await page.evaluate(id => { document.querySelector('[data-template="' + id + '"]').click(); }, starter.id);
    await wait(450);
    await page.evaluate(() => { document.getElementById('ttSave').click(); });
    await wait(300);
    const built = await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem('jvds-tabletop-v1') || '{}');
      return {
        cols: data.cols,
        rows: data.rows,
        path: (data.path || []).length,
        pieces: (data.tokens || []).length,
        named: data.name
      };
    });
    check('starter ' + starter.id + ' builds its board', built.cols === starter.cols && built.rows === starter.rows && built.path === starter.path && built.pieces === starter.pieces && !!built.named, JSON.stringify(built));
  }

  await page.evaluate(() => { document.querySelector('[data-template="ludo"]').click(); });
  await wait(500);
  await page.evaluate(() => {
    window.__origRandom = Math.random;
    Math.random = () => 0.99;
    document.querySelector('.tt-mode-btn[data-mode="play"]').click();
  });
  await wait(350);
  const ludoPieces = await page.evaluate(() => ({
    pawns: document.querySelectorAll('#ttTokens .tt-token--pawn').length,
    count: (JSON.parse(localStorage.getItem('jvds-tabletop-v1') || '{}').settings || {}).pawnsPerPlayer
  }));
  check('ludo starter sets four pawns per player', ludoPieces.pawns === 16, JSON.stringify(ludoPieces));
  await page.evaluate(() => { document.getElementById('ttQuickRoll').click(); });
  await wait(1800);
  const pawnChoice = await page.evaluate(() => ({
    open: !document.getElementById('ttChoice').hidden,
    title: document.getElementById('ttChoiceTitle').textContent,
    options: document.querySelectorAll('#ttChoiceOptions button').length
  }));
  check('ludo asks which pawn to move', pawnChoice.open && pawnChoice.title === 'Choose a pawn' && pawnChoice.options === 4, JSON.stringify(pawnChoice));
  await page.evaluate(() => { const b = document.querySelector('#ttChoiceOptions button'); if (b) b.click(); });
  await wait(2200);
  await page.evaluate(() => { document.getElementById('ttQuickRoll').click(); });
  await wait(1800);
  const pawnChoice2 = await page.evaluate(() => ({
    open: !document.getElementById('ttChoice').hidden,
    options: document.querySelectorAll('#ttChoiceOptions button').length
  }));
  check('the next player also chooses a pawn', pawnChoice2.open && pawnChoice2.options === 4, JSON.stringify(pawnChoice2));
  await page.evaluate(() => { const b = document.querySelector('#ttChoiceOptions button'); if (b) b.click(); });
  await wait(2600);
  await page.evaluate(() => { document.getElementById('ttSave').click(); });
  await wait(300);
  const captured = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('jvds-tabletop-v1') || '{}');
    const pawns = (data.tokens || []).filter(t => t.pawn);
    return {
      p1: (pawns.find(t => t.player === 1 && t.pawnIndex === 1) || {}).pathIndex,
      p2: (pawns.find(t => t.player === 2 && t.pawnIndex === 1) || {}).pathIndex,
      capture: data.settings && data.settings.capture,
      perPlayer: data.settings && data.settings.pawnsPerPlayer
    };
  });
  check('capture sends a rival pawn back to the start', captured.capture === true && captured.perPlayer === 4 && captured.p1 === 0 && captured.p2 === 6, JSON.stringify(captured));
  await page.evaluate(() => { Math.random = window.__origRandom; });

  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluate(() => { document.querySelector('[data-template="ludo"]').click(); });
  await wait(500);
  await page.evaluate(() => {
    document.getElementById('ttDiceTypes').closest('details').open = true;
    document.getElementById('ttModeSpinner').click();
    const size = document.getElementById('ttSpinnerSize');
    size.value = '4';
    size.dispatchEvent(new Event('change', { bubbles: true }));
    const labels = document.getElementById('ttSpinnerLabels');
    labels.value = '55, 55, 55, 55';
    labels.dispatchEvent(new Event('change', { bubbles: true }));
    const six = document.getElementById('ttRuleSix');
    if (six.checked) six.click();
    window.__origRandom = Math.random;
    Math.random = () => 0;
    document.querySelector('.tt-mode-btn[data-mode="play"]').click();
  });
  await wait(350);
  await page.evaluate(() => { document.getElementById('ttSpinBtn').click(); });
  await wait(1200);
  await page.evaluate(() => {
    if (!document.getElementById('ttChoice').hidden) {
      const b = document.querySelector('#ttChoiceOptions button');
      if (b) b.click();
    }
  });
  await wait(1200);
  await page.evaluate(() => { document.getElementById('ttSave').click(); });
  await wait(300);
  const laneReady = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('jvds-tabletop-v1') || '{}');
    const pawn = (data.tokens || []).find(t => t.pawn && t.player === 1 && t.pawnIndex === 1);
    return {
      pathIndex: pawn && pawn.pathIndex,
      inLane: pawn && pawn.inLane,
      lanes: (data.homeLanes || []).length,
      safe: (data.safeCells || []).length
    };
  });
  check('the Ludo starter ships four home lanes and safe squares', laneReady.lanes === 4 && laneReady.safe === 6, JSON.stringify(laneReady));
  check('a pawn can reach the lane entrance', laneReady.pathIndex === 55 && laneReady.inLane === false, JSON.stringify(laneReady));

  await page.evaluate(() => {
    document.getElementById('ttTurnDown').click();
    const labels = document.getElementById('ttSpinnerLabels');
    labels.value = '4, 4, 4, 4';
    labels.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await wait(250);
  await page.evaluate(() => { document.getElementById('ttSpinBtn').click(); });
  await wait(1200);
  await page.evaluate(() => {
    if (!document.getElementById('ttChoice').hidden) {
      const b = document.querySelector('#ttChoiceOptions button');
      if (b) b.click();
    }
  });
  await wait(1500);
  await page.evaluate(() => { document.getElementById('ttSave').click(); });
  await wait(300);
  const laneHome = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('jvds-tabletop-v1') || '{}');
    const pawn = (data.tokens || []).find(t => t.pawn && t.player === 1 && t.pawnIndex === 1);
    return { inLane: pawn && pawn.inLane, laneIndex: pawn && pawn.laneIndex, finished: pawn && pawn.finished };
  });
  check('a pawn finishes in its own home lane', laneHome.inLane === true && laneHome.laneIndex === 3 && laneHome.finished === true, JSON.stringify(laneHome));
  await page.evaluate(() => {
    document.getElementById('ttModeDice').click();
    Math.random = window.__origRandom;
  });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await wait(200);

  await page.evaluate(() => { document.querySelector('[data-template="property"]').click(); });
  await wait(500);
  const propertyBox = await page.$eval('#ttBoard', el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await page.mouse.click(propertyBox.x + propertyBox.w * (1.5 / 11), propertyBox.y + propertyBox.h * (0.5 / 11), { button: 'right' });
  await wait(250);
  await page.evaluate(() => {
    document.getElementById('ttTileOwner').value = '2';
    document.getElementById('ttTileSave').click();
    const rent = document.getElementById('ttRuleRent');
    if (!rent.checked) rent.click();
  });
  await wait(250);
  await page.mouse.click(propertyBox.x + propertyBox.w * (5.5 / 11), propertyBox.y + propertyBox.h * (0.5 / 11), { button: 'right' });
  await wait(250);
  await page.evaluate(() => {
    document.getElementById('ttTileEffect').value = 'card';
    document.getElementById('ttTileDeck').value = 'Chance';
    document.getElementById('ttTileSave').click();
  });
  await wait(200);
  await page.evaluate(() => { document.getElementById('ttSave').click(); });
  await wait(300);
  const boundCard = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('jvds-tabletop-v1') || '{}');
    const meta = (data.meta || [])[5];
    return {
      type: meta && meta.effect && meta.effect.type,
      deck: meta && meta.effect && meta.effect.deck,
      rent: data.settings && data.settings.rent,
      decks: (data.decks || []).map(d => ({ name: d.name, cards: (d.customCards || []).length })),
      chanceEffects: ((data.decks || []).find(d => d.name === 'Chance') || {}).customCards
        ? ((data.decks || []).find(d => d.name === 'Chance') || {}).customCards.filter(c => c.effect).length
        : 0
    };
  });
  check('rent toggle saves with the board', boundCard.rent === true, JSON.stringify(boundCard));
  check('seeded Chance cards carry real effects', boundCard.chanceEffects >= 5, JSON.stringify({ chanceEffects: boundCard.chanceEffects }));
  check('property tiles bind to named decks', boundCard.type === 'card' && boundCard.deck === 'Chance', JSON.stringify(boundCard));
  check('property starter seeds Chance and Community Chest', boundCard.decks.some(d => d.name === 'Chance' && d.cards > 0) && boundCard.decks.some(d => d.name === 'Community Chest' && d.cards > 0), JSON.stringify(boundCard.decks));
  await page.evaluate(() => { document.getElementById('ttRulesGenerate').click(); });
  await wait(200);
  const generatedRules = await page.evaluate(() => document.getElementById('ttRules').value);
  check('rules summary describes the board and rule toggles', /40 stops/.test(generatedRules) && /1500/.test(generatedRules) && /25 rent/.test(generatedRules), generatedRules.slice(0, 140));
  await page.evaluate(() => {
    window.__origRandom = Math.random;
    Math.random = () => 0;
    document.querySelector('.tt-mode-btn[data-mode="play"]').click();
  });
  await wait(350);
  await page.evaluate(() => { document.getElementById('ttQuickRoll').click(); });
  await wait(3200);
  await page.evaluate(() => { document.getElementById('ttSave').click(); });
  await wait(300);
  const rent = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('jvds-tabletop-v1') || '{}');
    const players = data.players || [];
    return { p1: players[0] && players[0].money, p2: players[1] && players[1].money, rent: data.settings && data.settings.rent };
  });
  check('rent moves ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£25 from the lander to the owner', rent.rent === true && rent.p1 === 1475 && rent.p2 === 1525, JSON.stringify(rent));

  await page.evaluate(() => {
    document.getElementById('ttSetupPawns').click();
    document.getElementById('ttTurnDown').click();
    Math.random = () => 0.8;
  });
  await wait(300);
  await page.evaluate(() => { document.getElementById('ttQuickRoll').click(); });
  await wait(2200);
  await page.evaluate(() => {
    if (!document.getElementById('ttChoice').hidden) {
      const buttons = document.querySelectorAll('#ttChoiceOptions button');
      if (buttons[1]) buttons[1].click();
    }
  });
  await wait(1600);
  await page.evaluate(() => { document.getElementById('ttSave').click(); });
  await wait(300);
  const deckDraw = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('jvds-tabletop-v1') || '{}');
    return {
      cards: (data.tokens || []).filter(t => t.type === 'card').length,
      activeDeck: (data.decks || []).find(d => d.id === data.activeDeckId) && (data.decks || []).find(d => d.id === data.activeDeckId).name,
      chanceLeft: ((data.decks || []).find(d => d.name === 'Chance') || {}).deck
    };
  });
  check('a deck-bound card tile draws from that deck', deckDraw.cards === 1 && deckDraw.activeDeck === 'Chance' && deckDraw.chanceLeft.length === 5, JSON.stringify({ cards: deckDraw.cards, activeDeck: deckDraw.activeDeck, left: deckDraw.chanceLeft ? deckDraw.chanceLeft.length : null }));
  await page.evaluate(() => { Math.random = window.__origRandom; });

  await page.evaluate(() => {
    window.__printHtml = '';
    window.__printed = false;
    window.__origOpen = window.open;
    window.open = function () {
      return {
        document: {
          write: function (html) { window.__printHtml = html; },
          close: function () {}
        },
        focus: function () {},
        print: function () { window.__printed = true; }
      };
    };
  });
  await page.evaluate(() => { document.getElementById('ttPrintKit').click(); });
  await wait(900);
  const kit = await page.evaluate(() => ({ html: window.__printHtml, printed: window.__printed }));
  const kitOk = /@page \{ size: A4/.test(kit.html) && /<img class="board"/.test(kit.html) && /<img class="cards"/.test(kit.html) && /<h2>Rules<\/h2>/.test(kit.html) && kit.printed;
  check('print kit includes the board, cards and rules', kitOk, (kit.html || '').slice(0, 160));
  await page.select('#ttPrintSize', 'A3');
  await page.evaluate(() => { document.getElementById('ttPrintKit').click(); });
  await wait(900);
  const kitA3 = await page.evaluate(() => window.__printHtml);
  check('print kit switches to A3', /@page \{ size: A3/.test(kitA3));
  await page.evaluate(() => { window.open = window.__origOpen; });

  await page.evaluate(() => { document.getElementById('ttShareCopy').click(); });
  await wait(300);
  const shareCode = await page.evaluate(() => document.getElementById('ttShareCode').value);
  check('share code is generated in the box', /^TT3-/.test(shareCode) && shareCode.length > 300, String(shareCode.length));
  await page.click('#ttClear');
  await page.click('#ttClear');
  await wait(400);
  await page.evaluate(code => { document.getElementById('ttShareCode').value = code; }, shareCode);
  await page.evaluate(() => { document.getElementById('ttShareLoad').click(); });
  await wait(700);
  const shareRestored = await page.evaluate(() => ({
    name: document.getElementById('ttBoardName').value,
    tokens: document.querySelectorAll('#ttTokens .tt-token').length,
    emptyHidden: document.getElementById('ttEmpty').hidden
  }));
  check('share code rebuilds the board', shareRestored.name === 'Property Loop' && shareRestored.tokens >= 4 && shareRestored.emptyHidden, JSON.stringify(shareRestored));

  const qolBox = await page.$eval('#ttBoard', el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await page.evaluate((box) => {
    document.getElementById('ttSelectArea').click();
    const cv = document.getElementById('ttBoard');
    const points = [
      [box.x + box.w * (0.5 / 11), box.y + box.h * (0.5 / 11)],
      [box.x + box.w * (2.5 / 11), box.y + box.h * (2.5 / 11)]
    ];
    points.forEach(([x, y], i) => {
      cv.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerId: 40 + i, isPrimary: true, button: 0, buttons: 1, pointerType: 'mouse' }));
      cv.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y, pointerId: 40 + i, isPrimary: true, button: 0, buttons: 0, pointerType: 'mouse' }));
    });
  }, qolBox);
  await wait(200);
  const selectedArea = await page.evaluate(() => document.getElementById('ttSelectHint').textContent);
  check('select area marks a rectangle', /Area: 3 x 3/.test(selectedArea), selectedArea);
  await page.evaluate(() => { document.getElementById('ttCopyArea').click(); });
  await wait(200);
  const copyToast = await page.evaluate(() => document.getElementById('ttToast').textContent);
  check('copy area reports the copied size', /Copied a 3 x 3 area/.test(copyToast), copyToast);
  await page.evaluate(() => { document.getElementById('ttStampArea').click(); });
  await wait(200);
  await page.evaluate(() => { document.getElementById('ttMirrorBoard').click(); });
  await wait(200);
  const mirrorToast = await page.evaluate(() => document.getElementById('ttToast').textContent);
  check('mirror board runs', /Board mirrored/.test(mirrorToast), mirrorToast);
  await page.evaluate(() => {
    document.getElementById('ttDupRow').click();
    document.getElementById('ttSave').click();
  });
  await wait(300);
  await page.evaluate(() => { document.getElementById('ttDupCol').click(); });
  await wait(200);
  await page.evaluate(() => { document.getElementById('ttSave').click(); });
  await wait(300);
  const grown = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('jvds-tabletop-v1') || '{}');
    return { cols: data.cols, rows: data.rows, w: document.getElementById('ttBoard').width, h: document.getElementById('ttBoard').height };
  });
  check('duplicate row and column grow the board', grown.cols === 12 && grown.rows === 12 && grown.w === 960 && grown.h === 960, JSON.stringify(grown));

  await page.evaluate(() => {
    document.getElementById('ttRoundUp').closest('details').open = true;
    document.getElementById('ttRoundUp').click();
  });
  await wait(150);
  const roundUp = await page.evaluate(() => document.getElementById('ttRound').textContent);
  await page.evaluate(() => { document.getElementById('ttUndo').click(); });
  await wait(200);
  const roundUndone = await page.evaluate(() => document.getElementById('ttRound').textContent);
  check('undo restores a round change', roundUp === '2' && roundUndone === '1', roundUp + '/' + roundUndone);

  await page.evaluate(() => {
    const search = document.getElementById('ttPieceSearch');
    search.value = 'dragon';
    search.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await wait(150);
  const filtered = await page.evaluate(() => ({
    visible: Array.from(document.querySelectorAll('#ttPieces [data-piece]')).filter(b => !b.hidden).length,
    label: (Array.from(document.querySelectorAll('#ttPieces [data-piece]')).find(b => !b.hidden) || {}).textContent || ''
  }));
  check('piece search filters the palette', filtered.visible === 1 && /Dragon/.test(filtered.label), JSON.stringify(filtered));
  await page.evaluate(() => {
    const search = document.getElementById('ttPieceSearch');
    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-terrain="sand"]').click();
    document.querySelector('[data-terrain="water"]').click();
  });
  await wait(200);
  const recent = await page.evaluate(() => document.querySelectorAll('#ttRecentColours .tt-recent-colour').length);
  check('recent colours appear after painting', recent >= 2, String(recent));

  await page.evaluate(() => { document.getElementById('ttStartBlank').click(); });
  await wait(300);
  await page.evaluate(() => {
    document.getElementById('ttCols').value = '4';
    document.getElementById('ttRows').value = '2';
    document.getElementById('ttSizeApply').click();
    document.getElementById('ttPathSerpentine').click();
  });
  await wait(300);
  const branchBox = await page.$eval('#ttBoard', el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await page.evaluate((box) => {
    document.getElementById('ttBranchLabel').value = 'Career';
    document.getElementById('ttBranchTool').click();
    const cv = document.getElementById('ttBoard');
    const points = [
      [box.x + box.w * (1.5 / 4), box.y + box.h * (0.5 / 2)],
      [box.x + box.w * (1.5 / 4), box.y + box.h * (1.5 / 2)]
    ];
    points.forEach(([x, y], i) => {
      cv.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerId: 60 + i, isPrimary: true, button: 0, buttons: 1, pointerType: 'mouse' }));
      cv.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y, pointerId: 60 + i, isPrimary: true, button: 0, buttons: 0, pointerType: 'mouse' }));
    });
  }, branchBox);
  await wait(300);
  await page.evaluate(() => {
    document.getElementById('ttSetupPawns').click();
    document.getElementById('ttSave').click();
  });
  await wait(350);
  const branchSaved = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('jvds-tabletop-v1') || '{}');
    return { branches: (data.branches || []).length, path: (data.path || []).length, label: (data.branches || [])[0] && data.branches[0].label };
  });
  check('branch saves with the board', branchSaved.branches === 1 && branchSaved.path === 8 && branchSaved.label === 'Career', JSON.stringify(branchSaved));

  await page.evaluate(() => {
    window.__origRandom = Math.random;
    Math.random = () => 0;
    document.querySelector('.tt-mode-btn[data-mode="play"]').click();
  });
  await wait(350);
  await page.evaluate(() => { document.getElementById('ttQuickRoll').click(); });
  await wait(2600);
  const choice = await page.evaluate(() => ({
    open: !document.getElementById('ttChoice').hidden,
    options: document.querySelectorAll('#ttChoiceOptions button').length,
    label: (document.querySelector('#ttChoiceOptions button') || {}).textContent || ''
  }));
  check('landing on a branch opens the choice dialog', choice.open && choice.options === 1 && /Career/.test(choice.label), JSON.stringify(choice));
  await page.keyboard.press('1');
  await wait(2600);
  await page.evaluate(() => { document.getElementById('ttSave').click(); });
  await wait(300);
  const branchMove = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('jvds-tabletop-v1') || '{}');
    const pawn = (data.tokens || []).find(t => t.pawn && t.player === 1);
    return { pathIndex: pawn && pawn.pathIndex, turn: data.turn };
  });
  check('choosing a branch moves the pawn and continues the turn', branchMove.pathIndex === 6 && branchMove.turn === 2, JSON.stringify(branchMove));
  await page.evaluate(() => { Math.random = window.__origRandom; });

  await page.evaluate(() => {
    document.getElementById('ttDiceTypes').closest('details').open = true;
    const faces = document.getElementById('ttActionFaces');
    faces.value = 'Climb, 2, Draw a card, Miss a turn, Roll again, 3';
    document.getElementById('ttActionSave').click();
    document.getElementById('ttDiceAction').click();
    window.__origRandom = Math.random;
    Math.random = () => 0;
  });
  await wait(250);
  await page.evaluate(() => { document.getElementById('ttQuickRoll').click(); });
  await wait(2500);
  const actionRoll = await page.evaluate(() => ({
    result: document.getElementById('ttDiceResult').textContent,
    history: document.getElementById('ttDiceHistory').textContent,
    actionPressed: document.getElementById('ttDiceAction').getAttribute('aria-pressed'),
    label: document.getElementById('ttBarResult').textContent
  }));
  check('action die shows the custom face label', /Climb/.test(actionRoll.result) && /Action = Climb/.test(actionRoll.history) && actionRoll.actionPressed === 'true' && actionRoll.label === 'Climb', JSON.stringify(actionRoll));

  await page.evaluate(() => {
    const faces = document.getElementById('ttActionFaces');
    faces.value = '2, Climb, Draw a card, Miss a turn, Roll again, 3';
    document.getElementById('ttActionSave').click();
    document.getElementById('ttSetupPawns').click();
    document.getElementById('ttTurnDown').click();
    document.getElementById('ttTurnDown').click();
    Math.random = () => 0;
  });
  await wait(250);
  await page.evaluate(() => { document.getElementById('ttQuickRoll').click(); });
  await wait(2600);
  await page.evaluate(() => { document.getElementById('ttSave').click(); });
  await wait(300);
  const actionMove = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('jvds-tabletop-v1') || '{}');
    const pawn = (data.tokens || []).find(t => t.pawn && t.player === 1);
    return { pathIndex: pawn && pawn.pathIndex, turn: data.turn, faces: (data.actionFaces || []).length, mode: data.dieMode };
  });
  check('action face starting with a number moves the pawn', actionMove.pathIndex === 2 && actionMove.turn === 2 && actionMove.faces === 6, JSON.stringify(actionMove));
  check('action faces save with the board', actionMove.faces === 6 && actionMove.mode === 'action', JSON.stringify(actionMove));
  await page.evaluate(() => {
    Math.random = window.__origRandom;
    document.getElementById('ttDiceNormal').click();
  });
  await wait(200);

  await page.evaluate(() => { document.querySelector('.tt-mode-btn[data-mode="build"]').click(); });
  const effectBox = await page.$eval('#ttBoard', el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await page.mouse.click(effectBox.x + effectBox.w * (2.5 / 4), effectBox.y + effectBox.h * (0.5 / 2), { button: 'right' });
  await wait(250);
  await page.evaluate(() => {
    document.getElementById('ttTileEffect').value = 'toStart';
    document.getElementById('ttTileSave').click();
    document.getElementById('ttTurnDown').click();
    document.getElementById('ttSetupPawns').click();
    document.getElementById('ttSave').click();
  });
  await wait(300);
  const savedEffect = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('jvds-tabletop-v1') || '{}');
    const meta = (data.meta || [])[2];
    return meta && meta.effect && meta.effect.type;
  });
  check('new landing effects save on a tile', savedEffect === 'toStart', String(savedEffect));
  await page.evaluate(() => {
    window.__origRandom = Math.random;
    Math.random = () => 0.2;
    document.querySelector('.tt-mode-btn[data-mode="play"]').click();
  });
  await wait(350);
  await page.evaluate(() => { document.getElementById('ttQuickRoll').click(); });
  await wait(2600);
  await page.evaluate(() => { document.getElementById('ttSave').click(); });
  await wait(300);
  const sentBack = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('jvds-tabletop-v1') || '{}');
    const pawn = (data.tokens || []).find(t => t.pawn && t.player === 1);
    return { pathIndex: pawn && pawn.pathIndex, turn: data.turn };
  });
  check('go-back-to-start sends the pawn to the start', sentBack.pathIndex === 0 && sentBack.turn === 2, JSON.stringify(sentBack));
  await page.evaluate(() => { Math.random = window.__origRandom; });

  await page.evaluate(() => {
    document.getElementById('ttTurnDown').click();
    document.getElementById('ttSetupPawns').click();
    document.getElementById('ttCardAdd').closest('details').open = true;
    document.querySelectorAll('#ttCardList [data-card-delete]').forEach(b => b.click());
    const standard = document.getElementById('ttDeckStandard');
    if (standard.checked) standard.click();
    document.getElementById('ttCardEffect').value = 'forward';
    document.getElementById('ttCardEffectValue').value = '2';
    document.getElementById('ttCardName').value = 'Step Two';
    document.getElementById('ttCardText').value = 'Move forward two';
    document.getElementById('ttCardAdd').click();
    document.getElementById('ttReshuffleDeck').click();
    document.getElementById('ttDrawCard').click();
  });
  await wait(2200);
  await page.evaluate(() => { document.getElementById('ttSave').click(); });
  await wait(300);
  const cardMove = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('jvds-tabletop-v1') || '{}');
    const pawn = (data.tokens || []).find(t => t.pawn && t.player === 1);
    return { pathIndex: pawn && pawn.pathIndex };
  });
  check('a drawn movement card moves the pawn', cardMove.pathIndex === 2, JSON.stringify(cardMove));
  await page.evaluate(() => {
    const row = Array.from(document.querySelectorAll('#ttCardList .tt-card-row')).find(r => /Step Two/.test(r.textContent));
    if (row) {
      const del = row.querySelector('[data-card-delete]');
      if (del) del.click();
    }
    const standard = document.getElementById('ttDeckStandard');
    if (!standard.checked) standard.click();
  });
  await wait(200);

  await page.evaluate(() => { document.querySelector('.tt-mode-btn[data-mode="build"]').click(); });
  const buyBox = await page.$eval('#ttBoard', el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await page.mouse.click(buyBox.x + buyBox.w * (2.5 / 4), buyBox.y + buyBox.h * (0.5 / 2), { button: 'right' });
  await wait(250);
  await page.evaluate(() => {
    document.getElementById('ttTilePrice').value = '100';
    document.getElementById('ttTileRent').value = '10';
    document.getElementById('ttTileSave').click();
    const money = document.getElementById('ttStartingMoney');
    money.value = '500';
    money.dispatchEvent(new Event('change', { bubbles: true }));
    const rent = document.getElementById('ttRuleRent');
    if (!rent.checked) rent.click();
    document.getElementById('ttSetupPawns').click();
    document.getElementById('ttTurnDown').click();
    document.getElementById('ttTurnDown').click();
    window.__origRandom = Math.random;
    Math.random = () => 0.2;
    document.querySelector('.tt-mode-btn[data-mode="play"]').click();
  });
  await wait(350);
  await page.evaluate(() => { document.getElementById('ttQuickRoll').click(); });
  await wait(2200);
  const buyDialog = await page.evaluate(() => ({
    open: !document.getElementById('ttChoice').hidden,
    title: document.getElementById('ttChoiceTitle').textContent,
    options: document.querySelectorAll('#ttChoiceOptions button').length
  }));
  check('landing on a priced tile offers a buy step', buyDialog.open && /^Buy /.test(buyDialog.title) && buyDialog.options === 2, JSON.stringify(buyDialog));
  await page.evaluate(() => { const b = document.querySelector('#ttChoiceOptions button'); if (b) b.click(); });
  await wait(900);
  await page.evaluate(() => { document.getElementById('ttSave').click(); });
  await wait(300);
  const bought = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('jvds-tabletop-v1') || '{}');
    return {
      money: (data.players || [])[0] && data.players[0].money,
      owner: ((data.meta || [])[2] || {}).owner,
      price: ((data.meta || [])[2] || {}).price,
      rent: ((data.meta || [])[2] || {}).rent
    };
  });
  check('buying a tile deducts the price and sets the owner', bought.owner === 1 && bought.money === 400 && bought.price === 100 && bought.rent === 10, JSON.stringify(bought));

  await page.evaluate(() => { document.getElementById('ttQuickRoll').click(); });
  await wait(2200);
  await page.evaluate(() => { document.getElementById('ttSave').click(); });
  await wait(300);
  const paidRent = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('jvds-tabletop-v1') || '{}');
    const players = data.players || [];
    return { p1: players[0] && players[0].money, p2: players[1] && players[1].money };
  });
  check('rent pays the tile rent to the owner', paidRent.p1 === 410 && paidRent.p2 === 490, JSON.stringify(paidRent));
  await page.evaluate(() => { Math.random = window.__origRandom; });

  await page.evaluate(() => { document.getElementById('ttStartBlank').click(); });
  await wait(300);
  await page.evaluate(() => {
    document.getElementById('ttCols').value = '2';
    document.getElementById('ttRows').value = '2';
    document.getElementById('ttSizeApply').click();
    document.getElementById('ttPathSerpentine').click();
    const count = document.getElementById('ttPawnCount');
    count.value = '2';
    count.dispatchEvent(new Event('change', { bubbles: true }));
    const all = document.getElementById('ttRuleAllPawns');
    all.checked = true;
    all.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await wait(350);
  await page.evaluate(() => {
    window.__origRandom = Math.random;
    Math.random = () => 0.99;
    document.querySelector('.tt-mode-btn[data-mode="play"]').click();
  });
  await wait(350);
  await page.evaluate(() => { document.getElementById('ttQuickRoll').click(); });
  await wait(1800);
  const twoPawns = await page.evaluate(() => ({
    open: !document.getElementById('ttChoice').hidden,
    options: document.querySelectorAll('#ttChoiceOptions button').length
  }));
  check('two-pawn games ask which pawn to move', twoPawns.open && twoPawns.options === 2, JSON.stringify(twoPawns));
  await page.evaluate(() => { const b = document.querySelector('#ttChoiceOptions button'); if (b) b.click(); });
  await wait(2400);
  await page.evaluate(() => { document.getElementById('ttTurnDown').click(); });
  await wait(200);
  await page.evaluate(() => { document.getElementById('ttQuickRoll').click(); });
  await wait(2400);
  const allHome = await page.evaluate(() => ({
    win: !document.getElementById('ttWin').hidden,
    title: document.getElementById('ttWinTitle').textContent
  }));
  check('all pawns home wins a multi-pawn game', allHome.win && /Player 1 wins/.test(allHome.title), JSON.stringify(allHome));
  await page.evaluate(() => {
    Math.random = window.__origRandom;
    document.getElementById('ttWinClose').click();
  });
  await wait(200);

  await page.evaluate(() => { document.getElementById('ttStartBlank').click(); });
  await wait(300);
  await page.evaluate(() => {
    document.getElementById('ttCols').value = '3';
    document.getElementById('ttRows').value = '2';
    document.getElementById('ttSizeApply').click();
    document.getElementById('ttPathSerpentine').click();
    document.getElementById('ttSetupPawns').click();
    document.getElementById('ttPlaytest').click();
    window.__origRandom = Math.random;
    Math.random = () => 0.99;
    document.querySelector('.tt-mode-btn[data-mode="play"]').click();
  });
  await wait(350);
  await page.evaluate(() => { document.getElementById('ttQuickRoll').click(); });
  await wait(2600);
  const playtest = await page.evaluate(() => ({
    on: document.getElementById('ttPlaytest').getAttribute('aria-pressed'),
    lines: Array.from(document.querySelectorAll('#ttPlaytestLog li')).map(li => li.textContent)
  }));
  check('playtest logs rolls, landings and a win', playtest.on === 'true' && playtest.lines.some(l => /rolled 6/.test(l)) && playtest.lines.some(l => /landed on/.test(l)) && playtest.lines.some(l => /won the game/.test(l)), JSON.stringify(playtest.lines.slice(-4)));

  await page.evaluate(() => {
    window.__printHtml = '';
    window.__origOpen = window.open;
    window.open = function () {
      return {
        document: { write: function (html) { window.__printHtml = html; }, close: function () {} },
        focus: function () {},
        print: function () {}
      };
    };
    document.getElementById('ttPlaytestPrint').click();
  });
  await wait(900);
  const feedback = await page.evaluate(() => window.__printHtml);
  check('feedback sheet includes the log and questions', /playtest feedback/.test(feedback) && /rolled 6/.test(feedback) && /most fun moment/.test(feedback) && /rule would you change/.test(feedback), (feedback || '').slice(0, 120));
  await page.evaluate(() => {
    window.open = window.__origOpen;
    document.getElementById('ttPlaytestClear').click();
  });
  await wait(200);
  const clearedLog = await page.evaluate(() => document.querySelectorAll('#ttPlaytestLog li').length);
  check('playtest log clears for the next test', clearedLog === 0, String(clearedLog));
  await page.evaluate(() => {
    Math.random = window.__origRandom;
    document.getElementById('ttWinClose').click();
    document.getElementById('ttStartBlank').click();
  });
  await wait(300);
  await page.evaluate(() => {
    document.getElementById('ttCols').value = '3';
    document.getElementById('ttRows').value = '2';
    document.getElementById('ttSizeApply').click();
    document.getElementById('ttPathSerpentine').click();
    document.getElementById('ttSetupPawns').click();
    window.__origRandom = Math.random;
    Math.random = () => 0;
    document.querySelector('.tt-mode-btn[data-mode="play"]').click();
  });
  await wait(350);
  await page.evaluate(() => { document.getElementById('ttSave').click(); });
  await wait(300);
  const keyboardSetup = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('jvds-tabletop-v1') || '{}');
    return { path: (d.path || []).length, winner: d.winner, mode: d.mode, turn: d.turn, per: d.settings && d.settings.pawnsPerPlayer };
  });
  check('keyboard test board is ready', keyboardSetup.path === 6 && keyboardSetup.mode === 'play', JSON.stringify(keyboardSetup));
  await page.keyboard.press('r');
  await wait(2200);
  const keyboardRoll = await page.evaluate(() => ({
    result: document.getElementById('ttDiceResult').textContent,
    turn: document.getElementById('ttTurn').textContent,
    choice: !document.getElementById('ttChoice').hidden,
    choiceTitle: document.getElementById('ttChoiceTitle').textContent,
    options: document.querySelectorAll('#ttChoiceOptions button').length,
    pawns: document.querySelectorAll('#ttTokens .tt-token--pawn').length
  }));
  check('R rolls for the current player', /You rolled 1/.test(keyboardRoll.result) && keyboardRoll.turn === '2', JSON.stringify(keyboardRoll));
  await page.keyboard.press('e');
  await wait(250);
  const keyboardEndTurn = await page.evaluate(() => document.getElementById('ttTurn').textContent);
  check('E ends the turn', keyboardEndTurn === '3', String(keyboardEndTurn));
  await page.keyboard.press('p');
  await wait(250);
  const keyboardAids = await page.evaluate(() => document.getElementById('ttRules').closest('details').open);
  check('P opens Play aids', keyboardAids === true, String(keyboardAids));
  await page.evaluate(() => { document.getElementById('ttBoard').focus(); });
  await page.keyboard.press('ArrowRight');
  await wait(250);
  const keyboardCursor = await page.evaluate(() => document.getElementById('ttAnnounce').textContent);
  check('arrow keys move a board cursor in Play mode', /Row 1, column 2/.test(keyboardCursor), keyboardCursor);
  await page.evaluate(() => { Math.random = window.__origRandom; });

  await page.select('#ttSize', '12x9');
  await wait(300);

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
    set('ttCardIcon', 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢');
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

  await page.evaluate(() => {
    const money = document.querySelectorAll('.tt-player-money')[0];
    window.__moneyBeforeCard = parseInt((money ? money.textContent : '0').replace(/[^0-9-]/g, ''), 10) || 0;
    const standard = document.getElementById('ttDeckStandard');
    if (standard.checked) standard.click();
    document.getElementById('ttCardEffect').value = 'money';
    document.getElementById('ttCardEffectValue').value = '50';
    document.getElementById('ttCardName').value = 'Cash Bonus';
    document.getElementById('ttCardText').value = 'Collect fifty pounds';
    document.getElementById('ttCardAdd').click();
    document.getElementById('ttReshuffleDeck').click();
    document.getElementById('ttDrawCard').click();
    document.getElementById('ttDrawCard').click();
  });
  await wait(500);
  const cardMoney = await page.evaluate(() => {
    const money = document.querySelectorAll('.tt-player-money')[0];
    return {
      before: window.__moneyBeforeCard,
      after: parseInt((money ? money.textContent : '0').replace(/[^0-9-]/g, ''), 10) || 0
    };
  });
  check('a drawn money card changes the player bank', cardMoney.after === cardMoney.before + 50, JSON.stringify(cardMoney));
  await page.evaluate(() => {
    const row = Array.from(document.querySelectorAll('#ttCardList .tt-card-row')).find(r => /Cash Bonus/.test(r.textContent));
    if (row) {
      const del = row.querySelector('[data-card-delete]');
      if (del) del.click();
    }
    const standard = document.getElementById('ttDeckStandard');
    if (!standard.checked) standard.click();
  });
  await wait(200);

  await page.evaluate(() => {
    document.getElementById('ttDiceTypes').closest('details').open = true;
    document.getElementById('ttModeSpinner').click();
    document.getElementById('ttSpinnerSize').value = '4';
    document.getElementById('ttSpinnerSize').dispatchEvent(new Event('change', { bubbles: true }));
    const labels = document.getElementById('ttSpinnerLabels');
    labels.value = 'A, B, C, D';
    labels.dispatchEvent(new Event('change', { bubbles: true }));
    window.__origRandom = Math.random;
    Math.random = () => 0;
  });
  await wait(250);
  await page.evaluate(() => { document.getElementById('ttSpinBtn').click(); });
  await wait(2200);
  const spinner = await page.evaluate(() => ({
    chips: document.querySelectorAll('#ttSpinnerWheel .tt-spinner-seg').length,
    winner: (document.querySelector('#ttSpinnerWheel .is-winner') || {}).textContent || '',
    result: document.getElementById('ttSpinnerResult').textContent,
    panel: !document.getElementById('ttSpinnerPanel').hidden,
    diceHidden: document.getElementById('ttDicePanel').hidden
  }));
  check('spinner has editable segments and lands on one', spinner.chips === 4 && spinner.winner === 'A' && /landed on A/.test(spinner.result) && spinner.panel && spinner.diceHidden, JSON.stringify(spinner));
  await page.evaluate(() => {
    Math.random = window.__origRandom;
    document.getElementById('ttModeDice').click();
  });
  await wait(200);

  await page.evaluate(() => {
    document.getElementById('ttDeckSelect').closest('details').open = true;
    document.getElementById('ttDeckName').value = 'Chance';
    document.getElementById('ttDeckAdd').click();
  });
  await wait(300);
  await page.evaluate(() => {
    document.getElementById('ttCardName').value = 'Chance Card';
    document.getElementById('ttCardText').value = 'Move to GO';
    document.getElementById('ttCardAdd').click();
  });
  await wait(250);
  await page.evaluate(() => { document.getElementById('ttSave').click(); });
  await wait(350);
  const decks = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('jvds-tabletop-v1') || '{}');
    const list = (data.decks || []).map(d => ({ name: d.name, cards: (d.customCards || []).length }));
    return { list, options: document.querySelectorAll('#ttDeckSelect option').length, active: data.activeDeckId };
  });
  check('named decks keep their own cards', decks.list.length === 2 && decks.options === 2 && decks.list.some(d => d.name === 'Chance' && d.cards === 1) && decks.list.some(d => d.name === 'Main deck' && d.cards === 1), JSON.stringify(decks));
  await page.evaluate(() => {
    const select = document.getElementById('ttDeckSelect');
    const main = Array.from(select.options).find(o => o.textContent === 'Main deck');
    if (main) { select.value = main.value; select.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await wait(250);
  const mainDeckRows = await page.evaluate(() => document.querySelectorAll('#ttCardList .tt-card-row').length);
  check('switching decks switches the card list', mainDeckRows === 1, String(mainDeckRows));

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
  check('save writes the board to localStorage', !!saved && saved.tokens >= 3, saved ? JSON.stringify(saved) : 'no save');
  check('save stores the board name', !!saved && saved.name === 'Test board', saved && saved.name);

  await page.goto('http://127.0.0.1:' + port + '/tools/tabletop-studio.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('#ttTerrain .tt-swatch', { timeout: 10000 });
  await wait(400);
  const restored = await page.evaluate(() => ({
    tokens: document.querySelectorAll('#ttTokens .tt-token').length,
    savedLabel: document.getElementById('ttSaved').textContent,
    emptyHidden: document.getElementById('ttEmpty').hidden
  }));
  check('saved board reloads', restored.tokens >= 3, JSON.stringify(restored));
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
    document.getElementById('ttLib').closest('details').open = true;
    const rows = Array.from(document.querySelectorAll('#ttLib .tt-lib-row'));
    const other = rows.find(row => !row.classList.contains('is-active'));
    const rename = other && other.querySelector('[data-board-rename]');
    if (rename) rename.click();
  });
  await wait(250);
  await page.evaluate(() => {
    const input = document.querySelector('#ttLib .tt-lib-rename');
    if (input) {
      input.value = 'Renamed board';
      input.blur();
    }
  });
  await wait(300);
  const renamed = await page.evaluate(() => {
    const lib = JSON.parse(localStorage.getItem('jvds-tabletop-v2') || '{}');
    return { names: (lib.boards || []).map(b => b.name), rows: document.querySelectorAll('#ttLib .tt-lib-row').length };
  });
  check('library rename saves without opening the board', renamed.names.includes('Renamed board') && renamed.rows === 2, JSON.stringify(renamed));

  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('#ttLib .tt-lib-row'));
    const first = rows[0];
    const name = first.querySelector('.tt-lib-name') ? first.querySelector('.tt-lib-name').textContent : '';
    window.__firstLibName = name;
    const down = first.querySelector('[data-board-down]');
    if (down) down.click();
  });
  await wait(250);
  const reordered = await page.evaluate(() => {
    const lib = JSON.parse(localStorage.getItem('jvds-tabletop-v2') || '{}');
    return { order: (lib.boards || []).map(b => b.name), firstBefore: window.__firstLibName };
  });
  check('library reorder moves a board down', reordered.order[0] !== reordered.firstBefore && reordered.order.includes(reordered.firstBefore), JSON.stringify(reordered));

  await page.evaluate(() => { window.__backupBlobs = []; });
  await page.evaluate(() => {
    const original = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function (blob) {
      window.__backupBlobs.push(blob);
      return original(blob);
    };
    document.getElementById('ttBackupExport').click();
  });
  await wait(300);
  const backup = await page.evaluate(async () => {
    const blobs = window.__backupBlobs;
    if (!blobs || !blobs.length) return null;
    const text = await blobs[blobs.length - 1].text();
    const data = JSON.parse(text);
    return { boards: (data.boards || []).length, names: (data.boards || []).map(b => b.name) };
  });
  check('backup exports every board as one file', !!backup && backup.boards === 2, backup ? JSON.stringify(backup) : 'no blob');

  const restorePath = path.join(require('os').tmpdir(), 'jvds-tabletop-backup.json');
  fs.writeFileSync(restorePath, JSON.stringify({
    v: 2,
    boards: [{
      id: 'restored-1',
      name: 'Restored board',
      updated: Date.now(),
      data: {
        cols: 4,
        rows: 3,
        shape: 'square',
        name: 'Restored board',
        tiles: ['grass', 'grass', 'grass', 'grass', 'path', 'path', 'path', 'path', 'water', 'water', 'water', 'water'],
        meta: [],
        path: [],
        links: [],
        branches: [],
        tokens: [],
        deck: [],
        customCards: [],
        players: [],
        settings: {}
      }
    }]
  }));
  await (await page.$('#ttBackupFile')).uploadFile(restorePath);
  await wait(600);
  const restoredLibrary = await page.evaluate(() => ({
    rows: document.querySelectorAll('#ttLib .tt-lib-row').length,
    name: document.getElementById('ttBoardName').value,
    width: document.getElementById('ttBoard').width
  }));
  check('restore backup replaces the library', restoredLibrary.rows === 1 && restoredLibrary.name === 'Restored board' && restoredLibrary.width === 320, JSON.stringify(restoredLibrary));
  fs.unlinkSync(restorePath);

  await page.evaluate(() => { document.getElementById('ttSave').click(); });
  await wait(300);
  await page.select('#ttSize', '8x8');
  await wait(300);
  await page.evaluate(() => { document.getElementById('ttSave').click(); });
  await wait(300);
  await page.evaluate(() => { document.getElementById('ttVersionBtn').click(); });
  await wait(300);
  const versionRows = await page.evaluate(() => document.querySelectorAll('#ttVersionList .tt-version-row').length);
  check('autosave history keeps an earlier version', versionRows >= 1, String(versionRows));
  await page.evaluate(() => {
    const restore = document.querySelector('#ttVersionList [data-version-index]');
    if (restore) restore.click();
  });
  await wait(700);
  const versionRestored = await page.evaluate(() => ({
    width: document.getElementById('ttBoard').width,
    open: !document.getElementById('ttVersions').hidden
  }));
  check('restoring a version brings the old board back', versionRestored.width === 320 && versionRestored.open === false, JSON.stringify(versionRestored));

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









