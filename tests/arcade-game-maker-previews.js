#!/usr/bin/env node
/*
 * tests/arcade-game-maker-previews.js , A3060 follow-up
 *
 * The first screen should let a learner see a game before choosing it:
 *   - every starter has a real WebP capture on disk,
 *   - the selected-genre preview loads and names the starter,
 *   - every starter button and welcome example points at a preview,
 *   - Surprise me boots a finished recommended genre,
 *   - the preview survives 390px and 1440px without overflow.
 *
 * Run: node tests/arcade-game-maker-previews.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.AGM_PREVIEW_PORT || 8992);
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.gif':'image/gif', '.svg':'image/svg+xml',
  '.webp':'image/webp', '.woff':'font/woff', '.woff2':'font/woff2', '.mp3':'audio/mpeg', '.wav':'audio/wav' };

let failures = 0;
function check(name, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
function isIgnorable(text) {
  return /ERR_NETWORK_ACCESS_DENIED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION|net::ERR_|ERR_FAILED/i.test(text)
    || /googletagmanager|google-analytics|fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr|gstatic\.com/i.test(text);
}

(async () => {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    fs.readFile(path.join(ROOT, p), (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !isIgnorable(m.text())) pageErrors.push(m.text()); });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('jv_tutorial_done', '1'); } catch (e) {} });

  async function load(width, height) {
    await page.setViewport({ width, height });
    await page.goto(`http://localhost:${PORT}/tools/arcade-game-maker.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#runGameBtn', { timeout: 20000 });
    await page.waitForFunction(() => document.querySelectorAll('#starterGrid .starter-btn').length > 0, { timeout: 20000 });
    await page.evaluate(() => {
      const w = document.getElementById('welcome-overlay'); if (w) w.classList.remove('show');
      document.body.classList.remove('overlay-active');
    });
    await sleep(350);
  }

  console.log('\n\u25b8 arcade game maker: starter previews + Surprise me');
  await load(1280, 900);

  const starters = await page.evaluate(() => Object.values(_STARTERS));
  const disk = starters.filter(k => {
    const f = path.join(ROOT, 'assets', 'arcade-previews', k + '.webp');
    if (!fs.existsSync(f)) return false;
    const b = fs.readFileSync(f);
    return b.length > 500 && b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP';
  });
  check('every starter has a real WebP preview', disk.length === starters.length, `${disk.length}/${starters.length}`);

  const buttons = await page.evaluate(() => {
    const list = Array.from(document.querySelectorAll('#starterGrid .starter-btn'));
    return {
      count: list.length,
      thumbs: list.filter(b => b.querySelector('img.starter-thumb')).length,
      srcs: list.map(b => (b.querySelector('img.starter-thumb') || {}).getAttribute('src') || ''),
      labels: list.map(b => (b.querySelector('.starter-name') || {}).textContent.trim())
    };
  });
  check('every genre starter button has a thumbnail', buttons.count >= 20 && buttons.thumbs === buttons.count, `${buttons.thumbs}/${buttons.count}`);
  check('thumbnails point at the preview folder', buttons.srcs.every(s => /^\/assets\/arcade-previews\/[a-z0-9_]+\.webp$/.test(s)), buttons.srcs.find(s => !/arcade-previews/.test(s)) || '');
  check('starter buttons still name the template', buttons.labels.every(l => l && l.length > 2), buttons.labels.slice(0, 3).join(' | '));

  const preview = await page.evaluate(() => {
    const box = document.getElementById('genrePreview');
    const img = document.getElementById('genrePreviewImg');
    img.scrollIntoView({ block: 'center' });
    return {
      visible: !!box && !box.hidden,
      key: box && box.dataset.key,
      title: (document.getElementById('genrePreviewTitle') || {}).textContent || '',
      src: img ? img.getAttribute('src') : '',
      loadedW: img ? img.naturalWidth : 0
    };
  });
  await sleep(400);
  const previewLoaded = await page.evaluate(() => (document.getElementById('genrePreviewImg') || {}).naturalWidth || 0);
  check('first screen shows the selected starter preview', preview.visible === true && preview.key === 'ocean_shooter', JSON.stringify(preview));
  check('selected starter preview image loads', previewLoaded > 0, 'naturalWidth ' + previewLoaded);
  check('selected starter preview names the game', /Ocean Defender/.test(preview.title), preview.title);

  await page.evaluate(() => {
    const card = document.querySelector('.genre-card[data-genre="RUNNER"]');
    if (card) card.click();
  });
  await sleep(400);
  const runnerPreview = await page.evaluate(() => {
    const box = document.getElementById('genrePreview');
    const img = document.getElementById('genrePreviewImg');
    return { key: box && box.dataset.key, title: (document.getElementById('genrePreviewTitle') || {}).textContent || '', src: img ? img.getAttribute('src') : '' };
  });
  check('picking Runner updates the preview to Dino Dash', runnerPreview.key === 'dino_runner' && /Dino Dash/.test(runnerPreview.title), JSON.stringify(runnerPreview));

  // Welcome examples show real thumbnails.
  const welcomeThumbs = await page.evaluate(async () => {
    const details = document.querySelector('.fg-examples');
    if (details) details.open = true;
    const w = document.getElementById('welcome-overlay');
    if (w) w.classList.add('show');
    const imgs = Array.from(document.querySelectorAll('.welcome-tpl img.wt-thumb'));
    await new Promise(r => setTimeout(r, 500));
    const res = imgs.map(i => ({ src: i.getAttribute('src'), w: i.naturalWidth }));
    if (w) w.classList.remove('show');
    return { count: imgs.length, loaded: res.filter(x => x.w > 0).length, bad: res.find(x => !x.w) || null };
  });
  check('welcome examples show preview thumbnails', welcomeThumbs.count >= 5 && welcomeThumbs.loaded >= 5, JSON.stringify(welcomeThumbs));

  // Surprise me boots a recommended genre.
  pageErrors.length = 0;
  await page.evaluate(() => { const w = document.getElementById('welcome-overlay'); if (w) w.classList.remove('show'); document.body.classList.remove('overlay-active'); });
  await page.evaluate(() => { const b = document.getElementById('surpriseMeBtn'); if (b) b.click(); });
  // The normal flow shows the title/intro screen first; close it to boot.
  await page.waitForFunction(() => {
    const io = document.getElementById('introOverlay');
    return !!(io && io.classList.contains('show') && typeof closeIntro === 'function');
  }, { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => {
    const io = document.getElementById('introOverlay');
    if (io && io.classList.contains('show')) { if (typeof closeIntro === 'function') closeIntro(); else io.classList.remove('show'); }
  });
  await page.waitForFunction(() => {
    const g = window._phaserGame || window.currentPhaserGame;
    const sc = g && g.scene && g.scene.getScenes(true)[0];
    return !!(sc && sc.sys && sc.sys.isActive());
  }, { timeout: 25000 }).catch(() => {});
  await page.evaluate(() => {
    const io = document.getElementById('introOverlay');
    if (io && io.classList.contains('show')) { if (typeof closeIntro === 'function') closeIntro(); else io.classList.remove('show'); }
  });
  const surprise = await page.evaluate(() => {
    const g = window._phaserGame || window.currentPhaserGame;
    const sc = g && g.scene && g.scene.getScenes(true)[0];
    const box = document.getElementById('genrePreview');
    const rec = (typeof GENRE_RECOMMENDED !== 'undefined') ? GENRE_RECOMMENDED : [];
    return {
      scene: sc ? sc.sys.settings.key : '',
      genre: document.getElementById('genreMode').value,
      recommended: rec.includes(document.getElementById('genreMode').value),
      previewKey: box && box.dataset.key,
      title: document.getElementById('gameTitle').value
    };
  });
  check('Surprise me boots a game', !!surprise.scene, JSON.stringify(surprise));
  check('Surprise me stays on a finished recommended genre', surprise.recommended === true, surprise.genre);
  check('Surprise me updates the preview to the chosen starter', !!surprise.previewKey, surprise.previewKey);
  check('no JS errors during previews and Surprise me', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));

  // Mobile: the preview must fit without sideways scroll.
  const errsBefore = pageErrors.length;
  await load(390, 844);
  const mobile = await page.evaluate(() => {
    const de = document.documentElement;
    const box = document.getElementById('genrePreview');
    const img = document.getElementById('genrePreviewImg');
    return {
      scrollWidth: de.scrollWidth,
      clientWidth: de.clientWidth,
      previewVisible: !!box && !box.hidden,
      previewWidth: img ? Math.round(img.getBoundingClientRect().width) : 0
    };
  });
  check('mobile preview is visible', mobile.previewVisible === true, JSON.stringify(mobile));
  check('mobile preview does not overflow', mobile.scrollWidth <= mobile.clientWidth + 1 && mobile.previewWidth > 100, JSON.stringify(mobile));
  check('no JS errors at 390px', pageErrors.length === errsBefore, (pageErrors[errsBefore] || '').slice(0, 160));

  // Short laptop (768px tall): the compact preview must keep Run on screen.
  const errsBefore768 = pageErrors.length;
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await load(1280, 768);
  const short = await page.evaluate(() => {
    const run = document.getElementById('runGameBtn');
    const panel = document.querySelector('.studio-panel');
    const box = document.getElementById('genrePreview');
    const rr = run ? run.getBoundingClientRect() : null;
    const pr = panel ? panel.getBoundingClientRect() : null;
    return {
      runBottom: rr ? Math.round(rr.bottom) : 0,
      panelBottom: pr ? Math.round(pr.bottom) : 0,
      previewHeight: box ? box.offsetHeight : 0
    };
  });
  check('short laptop keeps Run on the first screen', short.runBottom > 0 && short.runBottom <= short.panelBottom + 1, JSON.stringify(short));
  check('short laptop uses the compact preview', short.previewHeight > 0 && short.previewHeight < 150, JSON.stringify(short));
  check('no JS errors at 768px', pageErrors.length === errsBefore768, (pageErrors[errsBefore768] || '').slice(0, 160));

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nARCADE GAME MAKER PREVIEW CHECKS PASSED');
})().catch(e => { console.error('preview test crashed:', e); process.exit(1); });
