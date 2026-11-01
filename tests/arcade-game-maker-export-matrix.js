#!/usr/bin/env node
/*
 * tests/arcade-game-maker-export-matrix.js , A2180
 * Proves every genre in the maker can be downloaded and booted offline, that a
 * compressed export still opens where DecompressionStream is missing (embedded
 * inflate), that the raw inline fallback works, and that older v-less projects
 * and share links migrate to v1 and load.
 * Run: node tests/arcade-game-maker-export-matrix.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = process.env.JVDS_SITE || path.join(__dirname, '..');
const PORT = Number(process.env.AGM_MATRIX_PORT || 0);
let BASE = '';
const MAKER = 'tools/arcade-game-maker.html';
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.gif':'image/gif', '.svg':'image/svg+xml',
  '.webp':'image/webp', '.woff':'font/woff', '.woff2':'font/woff2', '.mp3':'audio/mpeg', '.wav':'audio/wav' };
const HARD_CEILING = 1_500_000;

const exportsByGenre = new Map();
const extraPages = new Map();

let failures = 0;
function check(name, ok, detail){ console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; }
const kb = n => Math.round(n / 1024) + 'KB';
const sleep = ms => new Promise(r => setTimeout(r, ms));
function isIgnorable(text){
  return /ERR_NETWORK_ACCESS_DENIED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION|net::ERR_|ERR_FAILED/i.test(text)
    || /googletagmanager|google-analytics|fonts\.googleapis|fonts\.gstatic|gstatic\.com/i.test(text);
}

const server = http.createServer((req, res) => {
  const clean = decodeURIComponent(req.url.split('?')[0]);
  if (clean.startsWith('/__export/')) {
    const key = clean.slice('/__export/'.length);
    const html = extraPages.get(key) || exportsByGenre.get(key);
    if (!html) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
    res.end(html);
    return;
  }
  let p = clean;
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(path.join(ROOT, p), (err, buf) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
});

async function watchPage(page){
  const cspErrors = [], jsErrors = [], remote = [];
  await page.setRequestInterception(true);
  page.on('request', r => {
    const u = r.url();
    if (u.startsWith(BASE) || u.startsWith('data:') || u.startsWith('blob:') || u === 'about:blank') { r.continue(); return; }
    remote.push(u); r.abort();
  });
  page.on('pageerror', e => jsErrors.push(e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Content Security Policy|Refused to (execute|load|apply)/i.test(t)) { cspErrors.push(t); return; }
    if (/ERR_|Failed to load resource|Aborted|net::/i.test(t)) return;
    if (isIgnorable(t)) return;
    jsErrors.push(t);
  });
  return { cspErrors, jsErrors, remote };
}

async function waitPoll(page, fn, timeout){
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { if (await page.evaluate(fn)) return true; } catch (e) {}
    await sleep(250);
  }
  return false;
}

// The player shows a Start overlay; pressing Start is what actually launches
// Phaser (closeIntro -> ensurePhaser -> launch). Close it as soon as it appears
// so the boot check waits for the real boot, not for the overlay.
async function startAndWait(page){
  return waitPoll(page, () => {
    const g = window._phaserGame;
    const scenes = g && g.scene && g.scene.scenes ? g.scene.scenes : [];
    if (document.querySelector('#game-container canvas') && scenes.length > 0) return true;
    const el = document.getElementById('introOverlay');
    if (el && el.classList.contains('show')) {
      if (typeof closeIntro === 'function') closeIntro(); else el.classList.remove('show');
    }
    return false;
  }, 60000);
}

async function bootExport(browser, key, genre){
  const page = await browser.newPage();
  const errs = await watchPage(page);
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(BASE + '__export/' + encodeURIComponent(key), { waitUntil: 'domcontentloaded' });
  const booted = await startAndWait(page);
  await waitPoll(page, () => {
    const g = window._phaserGame;
    const scenes = g && g.scene && g.scene.scenes ? g.scene.scenes : [];
    return scenes.some(s => { try { return !!(s.sys && s.sys.isActive && s.sys.isActive()); } catch (e) { return false; } });
  }, 15000);
  await sleep(700);
  const r = await page.evaluate(() => {
    const g = window._phaserGame;
    const scenes = g && g.scene && g.scene.scenes ? g.scene.scenes : [];
    const errOv = document.getElementById('gameErrorOverlay');
    return {
      exportMode: window.__exportMode === true,
      playerError: window.__playerError ? String(window.__playerError.message || window.__playerError) : '',
      canvas: !!document.querySelector('#game-container canvas'),
      sceneCount: scenes.length,
      activeScenes: scenes.filter(s => { try { return !!(s.sys && s.sys.isActive && s.sys.isActive()); } catch (e) { return false; } }).length,
      genre: (document.getElementById('genreMode') || {}).value || '',
      engineGenre: (typeof _engineData !== 'undefined' && _engineData && _engineData.genre) || '',
      errShown: !!(errOv && errOv.style.display !== 'none' && getComputedStyle(errOv).display !== 'none')
    };
  });
  await page.close();
  return { booted, r, errs };
}

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  BASE = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  // 1. Build one export for every genre in the maker's roster.
  const maker = await browser.newPage();
  await maker.setViewport({ width: 1280, height: 900 });
  await maker.goto(BASE + MAKER, { waitUntil: 'domcontentloaded' });
  await maker.waitForFunction(() => typeof window._buildExportHtml === 'function', { timeout: 30000 });
  const genreList = await maker.$$eval('#genreMode option', opts => opts.map(o => o.value).filter(Boolean));
  check('maker exposes the full genre roster', genreList.length === 23, genreList.length + ' genres: ' + genreList.join(','));

  const built = await maker.evaluate(async (genres) => {
    const results = [];
    for (const genre of genres) {
      const title = 'Matrix ' + genre;
      const gt = document.getElementById('gameTitle');
      const gm = document.getElementById('genreMode');
      if (gt) gt.value = title;
      if (gm) gm.value = genre;
      _engineData = { title, genre, speed: 200, gravity: 600, jump: 450, map: null };
      const b = await _buildExportHtml();
      results.push({ genre, html: b ? b.html : '', filename: b ? b.filename : '' });
    }
    return results;
  }, genreList);
  await maker.close();

  for (const b of built) {
    const bytes = Buffer.byteLength(b.html, 'utf8');
    exportsByGenre.set(b.genre, b.html);
    check(b.genre + ' export downloads', b.html.length > 1000 && /\.html$/.test(b.filename), b.filename + ' ' + kb(bytes));
    check(b.genre + ' export is under 1.5 MB', bytes < HARD_CEILING, kb(bytes) + ' / ' + kb(HARD_CEILING));
  }
  check('every genre produced an export', exportsByGenre.size === genreList.length, exportsByGenre.size + '/' + genreList.length);

  // 2. Open each downloaded file offline and prove it boots its own genre.
  let bootFailures = 0;
  for (const genre of genreList) {
    const { booted, r, errs } = await bootExport(browser, genre, genre);
    const ok = booted && r.exportMode && !r.playerError && r.canvas && r.sceneCount > 0 &&
      r.activeScenes > 0 && r.genre === genre && r.engineGenre === genre &&
      r.errShown === false && errs.cspErrors.length === 0 && errs.jsErrors.length === 0 && errs.remote.length === 0;
    check(genre + ' export boots offline', ok,
      'booted=' + booted + ' scenes=' + r.sceneCount + ' active=' + r.activeScenes +
      ' exportMode=' + r.exportMode + ' canvas=' + r.canvas +
      ' genre=' + r.genre + '/' + r.engineGenre + ' errShown=' + r.errShown +
      (r.playerError ? ' playerError=' + r.playerError.slice(0, 80) : '') +
      (errs.cspErrors[0] ? ' csp=' + errs.cspErrors[0].slice(0, 60) : '') +
      (errs.jsErrors[0] ? ' js=' + errs.jsErrors[0].slice(0, 60) : '') +
      (errs.remote[0] ? ' remote=' + errs.remote[0] : ''));
    if (!ok) bootFailures++;
  }
  check('all 23 genres boot from their downloaded file', bootFailures === 0, bootFailures + ' failed');

  // 3. The compressed export must still open where DecompressionStream is gone.
  const compressed = exportsByGenre.get('SHOOTER') || '';
  check('normal export ships the compressed player payload', /var P="[^"]+",E="[^"]+"/.test(compressed));
  extraPages.set('no-ds-compressed', compressed);
  {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => { try { delete window.DecompressionStream; } catch (e) {} window.DecompressionStream = undefined; });
    const errs = await watchPage(page);
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(BASE + '__export/no-ds-compressed');
    let hasNoDs = false;
    hasNoDs = await page.evaluate(() => typeof DecompressionStream === 'undefined');
    await startAndWait(page);
    await sleep(700);
    const r = await page.evaluate(() => {
      const g = window._phaserGame;
      const scenes = g && g.scene && g.scene.scenes ? g.scene.scenes : [];
      return { canvas: !!document.querySelector('#game-container canvas'), scenes: scenes.length,
        playerError: window.__playerError ? String(window.__playerError.message || window.__playerError) : '' };
    });
    await page.close();
    check('compressed export boots with no DecompressionStream', hasNoDs && r.canvas && r.scenes > 0 && !r.playerError && errs.jsErrors.length === 0,
      'noDs=' + hasNoDs + ' scenes=' + r.scenes + (r.playerError ? ' playerError=' + r.playerError.slice(0, 80) : ''));
  }

  // 4. Builder without DecompressionStream uses the raw inline fallback.
  {
    const rawMaker = await browser.newPage();
    await rawMaker.setViewport({ width: 1280, height: 900 });
    await rawMaker.goto(BASE + MAKER, { waitUntil: 'domcontentloaded' });
    await rawMaker.waitForFunction(() => typeof window._buildExportHtml === 'function', { timeout: 30000 });
    const raw = await rawMaker.evaluate(async () => {
      try { delete window.DecompressionStream; } catch (e) {}
      window.DecompressionStream = undefined;
      _engineData = { title: 'Raw Fallback', genre: 'SHOOTER', speed: 200, gravity: 600, jump: 450, map: null };
      const b = await _buildExportHtml();
      return b ? b.html : '';
    });
    await rawMaker.close();
    check('no-DecompressionStream builder falls back to raw inline', raw.length > 1000 && !/var P="[^"]+",E="[^"]+"/.test(raw) && /function makeBaseScene/.test(raw),
      kb(Buffer.byteLength(raw, 'utf8')));
    extraPages.set('no-ds-raw', raw);
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => { try { delete window.DecompressionStream; } catch (e) {} window.DecompressionStream = undefined; });
    const errs = await watchPage(page);
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(BASE + '__export/no-ds-raw');
    const ok = await startAndWait(page);
    await sleep(700);
    const scenes = await page.evaluate(() => {
      const g = window._phaserGame;
      return { n: g && g.scene && g.scene.scenes ? g.scene.scenes.length : 0,
        err: window.__playerError ? String(window.__playerError.message || window.__playerError) : '' };
    });
    await page.close();
    check('raw inline export boots with no DecompressionStream', ok && scenes.n > 0 && !scenes.err && errs.jsErrors.length === 0,
      'scenes=' + scenes.n + (scenes.err ? ' playerError=' + scenes.err.slice(0, 80) : ''));
  }

  // 5. Older v-less projects and share links migrate to v1 and load.
  const projectFixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'arcade-game-maker', 'legacy-project-v0.fixture'), 'utf8'));
  const shareFixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'arcade-game-maker', 'legacy-share-v0.fixture'), 'utf8'));
  check('project fixture is v-less', projectFixture.v === undefined);
  check('share fixture is v-less', shareFixture.v === undefined);

  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(BASE + MAKER, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window._applyLoadData === 'function', { timeout: 20000 });
    const r = await page.evaluate((d) => {
      const mig = _migrateProjectPayload(d);
      _applyLoadData(d, { skipBoot: true });
      return {
        v: mig.v,
        lc: !!mig.lc,
        th: mig.th && Array.isArray(mig.th.c) ? mig.th.c.length : 0,
        bs: mig.bs,
        bn: mig.bn,
        achs: mig.customAchs ? mig.customAchs.length : -1,
        cuts: mig.cuts ? mig.cuts.length : -1,
        bosses: mig.bossPhases ? mig.bossPhases.length : -1,
        entities: !!(mig.entities && mig.entities.coins),
        userCode: /onCreate/.test(mig.userCode || ''),
        appliedTitle: document.getElementById('gameTitle').value,
        appliedGenre: document.getElementById('genreMode').value,
        appliedAch: (typeof _customAchs !== 'undefined' && _customAchs[0]) ? _customAchs[0].label : '',
        appliedCuts: (typeof _cutSlides !== 'undefined' && _cutSlides[0]) ? _cutSlides[0].text : '',
        appliedCutWhen: liveConfig.cutsceneWhen,
        appliedBoss: (typeof _bossPhases !== 'undefined' && _bossPhases[0]) ? _bossPhases[0].label : '',
        appliedEntities: customLevelEntities && customLevelEntities.coins ? customLevelEntities.coins.length : -1,
        appliedCode: (document.getElementById('customCodeEditor') || {}).value || '',
        codeRan: window.__legacyCodeLoaded === true
      };
    }, projectFixture);
    await page.close();
    check('v-less project migrates to schema v1', r.v === 1 && r.lc === true && r.th === 2, 'v=' + r.v + ' lc=' + r.lc + ' themeCols=' + r.th);
    check('v-less project keeps score, initials and creator data',
      r.bs === 42 && r.bn === 'OLD' && r.achs === 1 && r.cuts === 1 && r.bosses === 1 && r.entities === true && r.userCode === true,
      JSON.stringify({ bs: r.bs, bn: r.bn, achs: r.achs, cuts: r.cuts, bosses: r.bosses, entities: r.entities, userCode: r.userCode }));
    check('v-less project loads into the maker', r.appliedTitle === 'Legacy Project' && r.appliedGenre === 'PLATFORMER' && r.appliedAch === 'Legacy achievement' && r.appliedCuts === 'Legacy cutscene' && r.appliedCutWhen === 'after' && r.appliedBoss === 'Legacy phase' && r.appliedEntities === 1,
      JSON.stringify({ title: r.appliedTitle, genre: r.appliedGenre, ach: r.appliedAch, cut: r.appliedCuts, when: r.appliedCutWhen, boss: r.appliedBoss, entities: r.appliedEntities }));
    check('v-less project code is loaded but not auto-run', /onCreate/.test(r.appliedCode) && r.codeRan === false, 'codeRan=' + r.codeRan);
  }

  const legacyEnc = Buffer.from(encodeURIComponent(JSON.stringify(shareFixture)), 'utf8').toString('base64');
  {
    const page = await browser.newPage();
    const errs = await watchPage(page);
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(BASE + MAKER + '?game=' + encodeURIComponent(legacyEnc), { waitUntil: 'domcontentloaded' });
    const booted = await startAndWait(page);
    await sleep(700);
    const r = await page.evaluate(() => ({
      title: document.getElementById('gameTitle').value,
      genre: document.getElementById('genreMode').value,
      winTarget: liveConfig.winTarget,
      sharedFrom: window._sharedFrom || null,
      canvas: !!document.querySelector('#game-container canvas'),
      scenes: window._phaserGame && window._phaserGame.scene ? window._phaserGame.scene.scenes.length : 0
    }));
    await page.close();
    check('v-less share link loads its settings', r.title === 'Legacy Share' && r.genre === 'SNAKE' && r.winTarget === 12,
      JSON.stringify({ title: r.title, genre: r.genre, winTarget: r.winTarget }));
    check('v-less share link keeps the creator challenge', !!r.sharedFrom && r.sharedFrom.name === 'OLD' && r.sharedFrom.score === 77,
      JSON.stringify(r.sharedFrom));
    check('v-less share link boots', booted && r.canvas && r.scenes > 0 && errs.jsErrors.length === 0,
      'scenes=' + r.scenes + (errs.jsErrors[0] ? ' js=' + errs.jsErrors[0].slice(0, 60) : ''));
  }

  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(BASE + MAKER + '?remix=' + encodeURIComponent(legacyEnc), { waitUntil: 'domcontentloaded' });
    try {
      await page.waitForFunction(() => /Legacy Share/.test((document.getElementById('gameTitle') || {}).value || ''), { timeout: 15000 });
    } catch (e) {}
    const r = await page.evaluate(() => ({
      title: document.getElementById('gameTitle').value,
      genre: document.getElementById('genreMode').value,
      winTarget: liveConfig.winTarget
    }));
    await page.close();
    check('v-less remix link loads as an editable remix',
      /^\S+ Remix of Legacy Share$/.test(r.title) && r.genre === 'SNAKE' && r.winTarget === 12,
      JSON.stringify(r));
  }

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL ARCADE GAME MAKER EXPORT-MATRIX CHECKS PASSED');
})().catch(e => { console.error(e); try { server.close(); } catch (x) {} process.exit(1); });
