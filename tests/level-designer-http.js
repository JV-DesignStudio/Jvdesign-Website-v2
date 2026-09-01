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
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', async d => { await d.dismiss().catch(()=>{}); });

  await page.goto('http://127.0.0.1:8126/tools/level-designer.html', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));

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

    ['draw','erase','fill','pick','rect','line','move','select','path','stamp'].forEach(t => {
      try { setTool(t); } catch (e) { out.push('FAIL setTool(' + t + ') threw: ' + e.message); }
    });
    ok('all 10 tools switch cleanly', true);
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
  await page.evaluate(() => document.getElementById('jvdsNavToggle').click());
  const navOpened = await page.evaluate(() => document.getElementById('jvdsNavLinks').classList.contains('open'));
  await page.evaluate(() => document.getElementById('jvdsNavToggle').click());
  const navClosed = await page.evaluate(() => !document.getElementById('jvdsNavLinks').classList.contains('open'));

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
               checks.canvasReady && navOpened && navClosed && errors.length === 0;
  console.log(pass ? 'HTTP RUNTIME CHECKS PASSED' : 'FAILURES PRESENT');
  await browser.close();
  server.close();
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
