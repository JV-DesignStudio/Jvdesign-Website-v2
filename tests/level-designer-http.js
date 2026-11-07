// HTTP runtime verification for the Level Designer (server + puppeteer in one process).
// Covers static packaging checks (manifest, JSON-LD) plus a functional pass over
// every core subsystem: tools, undo/redo, fill, rect, layers, resize, stamps,
// save slots, JSON level data, Game Maker export, Level Doctor and play mode.
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json','.webp':'image/webp'};

const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!path.extname(p)) p = path.join(p, 'index.html');
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, {'Content-Type': MIME[path.extname(p)] || 'application/octet-stream'});
    res.end(d);
  });
});

(async () => {
  await new Promise(r => server.listen(8126, r));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  // Bypass CSP so inline scripts execute when served over plain HTTP (no nonces).
  await page.setBypassCSP(true);
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (text.includes('ERR_NETWORK_ACCESS_DENIED')) return;
    if (text.includes('Content-Security-Policy')) return;
    errors.push('console: ' + text);
  });
  page.on('dialog', async d => { await d.dismiss().catch(()=>{}); });

  await page.goto('http://127.0.0.1:8126/tools/level-designer.html', { waitUntil: 'networkidle2', timeout: 60000 });
  // Wait until the app has actually initialised (canvas + layers exist) instead
  // of a fixed sleep, so the test does not flake under parallel load.
  await page.waitForFunction(() => typeof canvas !== 'undefined' && !!canvas && typeof layers !== 'undefined' && layers.length === 4, { timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 800));

  const checks = await page.evaluate(() => ({
    manifestLinked: !!document.querySelector('link[rel="manifest"]'),
    manifestIsDedicated: ((document.querySelector('link[rel="manifest"]')||{}).href||'').includes('level-designer.webmanifest'),
    jsonLdPresent: !!document.querySelector('script[type="application/ld+json"]'),
    levelNameFieldPresent: !!document.getElementById('levelName'),
    canvasReady: !!(canvas && ctx),
    layersReady: layers.length === 4,
  }));

  const results = await page.evaluate(async () => {
    const out = [];
    const ok = (name, cond) => out.push((cond ? 'PASS ' : 'FAIL ') + name);

    ['draw','erase','fill','pick','rect','line','move','select','path','stamp','collision'].forEach(t => {
      try { setTool(t); } catch (e) { out.push('FAIL setTool(' + t + ') threw: ' + e.message); }
    });
    ok('all 11 tools switch cleanly', true);

    // Three drawing layers keep their own tiles (Background / Terrain / Objects).
    const stack = [];
    for (let li = 0; li < 3; li++) {
      currentLayer = li;
      pushUndo('stack-' + li);
      setCell(1, 1, li + 1);
      stack.push(getCell(1, 1));
    }
    ok('three layers stack independently', stack[0] === 1 && stack[1] === 2 && stack[2] === 3);
    currentLayer = 1;

    setTool('draw');

    // A2070: collision brush, Tiled .tmj, CSV matrices, JS arrays and tileset drop.
    setTool('collision');
    setCollisionMode('solid');
    setCollisionCell(2, 2, 1);
    setCollisionCell(3, 2, 2);
    ok('collision brush paints solid + hazard', effectiveCollisionAt(2, 2) === 1 && effectiveCollisionAt(3, 2) === 2 && collisionCounts().painted === 2);
    pushUndo('collision-test');
    setCollisionCell(2, 2, -1);
    ok('collision erase overrides tile rules', effectiveCollisionAt(2, 2) === 0);
    undo();
    ok('collision undo restores cell', effectiveCollisionAt(2, 2) === 1);

    const atlas = buildTileAtlas();
    const tm = buildTiledMap(atlas);
    const tileLayers = tm.layers.filter(l => l.type === 'tilelayer');
    const collisionLayer = tm.layers.find(l => l.type === 'objectgroup');
    ok('Tiled map has stacked layers + collision objects',
      tm.type === 'map' && tm.width === gridW && tm.height === gridH && tm.tilesets.length === 1 &&
      tileLayers.length === layers.length && !!collisionLayer && collisionLayer.objects.length >= 1);
    ok('Tiled tile data has one gid per cell', tileLayers.every(l => l.data.length === gridW * gridH));
    ok('Tiled gids are valid', tileLayers.every(l => l.data.every(v => Number.isInteger(v) && v >= 0 && v <= tm.tilesets[0].tilecount)));
    ok('Tiled map JSON round-trips', JSON.parse(JSON.stringify(tm)).layers.length === tm.layers.length);

    const csvRows = buildCollisionCSV().split('\n');
    ok('collision CSV matrix rows/cols', csvRows.length === gridH && csvRows.every(r => r.split(',').length === gridW));
    const jsArrays = buildJSArrays();
    ok('JS arrays include collision + layer arrays',
      /export const collision = \[/.test(jsArrays) && /export const tileWidth = 24;/.test(jsArrays) &&
      (jsArrays.match(/export const /g) || []).length >= layers.length + 5);

    const pngB64 = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAARUlEQVRYhe3XsREAMAhC0YxIzXRuarZImlfYeyfC52S6P+dYIE4wRFhvuIworHiEUcXxApJAsgGlheWrmEQ1G+W0z3VwAROdJIjCnJG2AAAAAElFTkSuQmCC';
    const bin = atob(pngB64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'drop-test.png', { type: 'image/png' }));
    const drop = document.getElementById('tilesetDrop');
    drop.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
    drop.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 400));
    ok('drag-drop tileset populates palette', !!tilesetImage && tilesetCols === 2 && document.querySelectorAll('#tilePalette .tile-btn').length >= 4);
    setTool('draw');

    pushUndo('test'); setCell(5, 5, 3); renderAll();
    ok('cell painted', getCell(5, 5) === 3);
    undo(); ok('undo removes cell', getCell(5, 5) === 0);
    redo(); ok('redo restores cell', getCell(5, 5) === 3);
    undo();

    pushUndo('fill-test');
    const before = layers[currentLayer].data.reduce((a,b)=>a+(b>0?1:0),0);
    floodFill(0, 0, 24); renderAll();
    const after = layers[currentLayer].data.reduce((a,b)=>a+(b>0?1:0),0);
    ok('flood fill paints region', after > before);
    undo(); renderAll();

    pushUndo('rect-test'); drawRect2(2, 2, 6, 4, 4); renderAll();
    ok('rect drawn outline', getCell(2, 2) === 4 && getCell(3, 3) === 0);
    undo(); renderAll();

    const lc = layers.length;
    addLayer(); dupeLayer();
    ok('layer add + dupe', layers.length === lc + 2);

    const oldW = gridW; resizeGrid(20, 15);
    ok('resize to 20x15', gridW === 20 && gridH === 15);
    resizeGrid(oldW, 16);

    selRect = {x:1, y:1, w:3, h:2};
    const stampsBefore = stamps.length;
    saveStamp(); ok('stamp saved', stamps.length === stampsBefore + 1);
    placeStamp(stamps[stamps.length-1], 10, 10);
    selRect = null;

    setLevelName('TestLevel');
    saveToSlot(0);
    const slots = getSlots();
    ok('save slot roundtrip', slots[0] && slots[0].name === 'TestLevel' && Array.isArray(slots[0].layers));

    const ld = getLevelData();
    ok('levelData shape', !!(ld.meta && ld.tileDefs && ld.layers && ld.meta.width === gridW));

    try { sendToGameMaker(); } catch (e) { out.push('FAIL sendToGameMaker threw: ' + e.message); }
    const gm = JSON.parse(localStorage.getItem('jvds_level_autosave'));
    ok('game maker export 20x15 flat map', gm && gm.gridW === 20 && gm.gridH === 15 && gm.layers.length === 1);

    openAICritic(); runAICritic();
    await new Promise(r => setTimeout(r, 200));
    const doc = document.getElementById('ai-response').textContent;
    ok('Level Doctor sections render', /WHAT.S WORKING/.test(doc) && /ISSUES TO FIX/.test(doc));
    closeAIPanel();

    openPlayMode();
    await new Promise(r => setTimeout(r, 400));
    ok('play mode opens', document.getElementById('play-overlay').classList.contains('show'));
    if (playState) playState.keys.right = true;
    await new Promise(r => setTimeout(r, 600));
    if (playState) playState.keys.right = false;
    ok('physics stable (no NaN)', playState && isFinite(playState.px) && isFinite(playState.py));
    closePlayMode();

    showHotkeys(); ok('hotkeys overlay', document.getElementById('hotkey-overlay').classList.contains('show'));
    closeHotkeys();

    return out;
  });

  await page.setViewport({ width: 390, height: 780 });
  await new Promise(r => setTimeout(r, 200));
  await page.evaluate(() => document.getElementById('navToggle').click());
  const navOpened = await page.evaluate(() => {
    const nav = document.getElementById('mainNav');
    const btn = document.getElementById('navToggle');
    return nav.classList.contains('open') && btn.getAttribute('aria-expanded') === 'true';
  });
  await page.evaluate(() => document.getElementById('navToggle').click());
  const navClosed = await page.evaluate(() => {
    const nav = document.getElementById('mainNav');
    const btn = document.getElementById('navToggle');
    return !nav.classList.contains('open') && btn.getAttribute('aria-expanded') === 'false';
  });

  // Save and restore a real project, not just generation. Write the same
  // autosave payload the app writes, reload, accept the restore prompt, and
  // confirm the name and a painted tile survived the reload.
  await page.evaluate(() => {
    setLevelName('Restore Lab');
    currentLayer = 1;
    pushUndo('restore-test');
    setCell(4, 4, 7);
    renderAll();
    localStorage.setItem('jvds_level_autosave', JSON.stringify({
      name: getLevelName(), gridW, gridH, themeId: currentTheme.id,
      layers: layers.map(l => ({ name: l.name, visible: l.visible, locked: l.locked, data: Array.from(l.data) })),
      enemyPaths, tileProps, ts: Date.now()
    }));
  });
  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction(() => typeof layers !== 'undefined' && layers.length > 0, { timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 500));
  const promptShown = await page.evaluate(() => {
    const shown = document.getElementById('modal-overlay').classList.contains('show');
    document.getElementById('modal-confirm-btn').click();
    return shown;
  });
  await new Promise(r => setTimeout(r, 300));
  const restored = await page.evaluate(() => ({
    name: getLevelName(),
    tile: getCell(4, 4),
    w: gridW,
    h: gridH
  }));
  const restorePass = promptShown && restored.name === 'Restore Lab' && restored.tile === 7;
  console.log('restore:', JSON.stringify({ promptShown, ...restored }));

  console.log('checks:', JSON.stringify(checks));
  results.forEach(l => console.log(l));
  console.log('hamburger opens:', navOpened, '| closes:', navClosed);
  if (errors.length) {
    console.log('ERRORS (' + errors.length + '):');
    errors.slice(0, 8).forEach(e => console.log('  ' + e));
  } else {
    console.log('NO RUNTIME ERRORS over HTTP');
  }
  const fails = results.filter(l => l.startsWith('FAIL')).length;
  const pass = fails === 0 && checks.manifestIsDedicated && checks.levelNameFieldPresent &&
               checks.canvasReady && navOpened && navClosed && restorePass && errors.length === 0;
  console.log(pass ? 'HTTP RUNTIME CHECKS PASSED' : 'FAILURES PRESENT');
  await browser.close();
  server.close();
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
