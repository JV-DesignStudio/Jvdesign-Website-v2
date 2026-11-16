#!/usr/bin/env node
/*
 * tests/arcade-game-maker-funnel.js , A3065
 *
 * Proves the first-session funnel is instrumented end to end. A new learner's
 * path should emit template_pick -> postrun_tweak/first_tweak -> export, and
 * the preview and Surprise paths should emit preview_play / surprise_pick.
 *
 * Run: node tests/arcade-game-maker-funnel.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.AGM_FUNNEL_PORT || 8999);
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.svg':'image/svg+xml',
  '.mp3':'audio/mpeg', '.wav':'audio/wav' };
let failures = 0;
function check(name, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

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

  async function newPage() {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewport({ width: 1280, height: 900 });
    await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) {} });
    await page.goto(`http://localhost:${PORT}/tools/arcade-game-maker.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#runGameBtn', { timeout: 20000 });
    await page.waitForFunction(() => {
      const w = document.getElementById('welcome-overlay');
      return !!(w && w.classList.contains('show'));
    }, { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => {
      window.__funnel = [];
      const orig = window._trackEvent;
      window._trackEvent = (name, data) => { window.__funnel.push(name); if (typeof orig === 'function') { try { orig(name, data); } catch (e) {} } };
    });
    return { page, errors };
  }

  // 1. The guided first game -> tweak -> keep path.
  {
    const { page, errors } = await newPage();
    const picked = await page.evaluate(() => {
      const idea = document.querySelector('.fg-choice[data-fg-genre="RUNNER"]'); if (idea) idea.click();
      const level = document.querySelector('.fg-level[data-on-arg="normal"]'); if (level) level.click();
      const build = document.querySelector('.fg-build'); if (build) build.click();
      return { genre: (document.getElementById('genreMode') || {}).value || '' };
    });
    await page.waitForFunction(() => {
      const io = document.getElementById('introOverlay');
      return !!(io && io.classList.contains('show'));
    }, { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => {
      const io = document.getElementById('introOverlay');
      if (io && io.classList.contains('show')) { if (typeof closeIntro === 'function') closeIntro(); else io.classList.remove('show'); }
    });
    await page.waitForFunction(() => {
      const g = window._phaserGame; const sc = g && g.scene && g.scene.getScenes(true)[0];
      return !!(sc && sc.sys && sc.sys.isActive());
    }, { timeout: 20000 }).catch(() => {});
    await page.evaluate(() => { try { showGameOver(10); } catch (e) {} const ov = document.getElementById('goOverlay'); if (ov) ov.classList.add('show'); });
    await sleep(250);
    await page.evaluate(() => {
      const b = document.querySelector('#goMakeYours [data-on-arg="speed"]'); if (b) b.click();
      window.exportGame = () => {};
      const k = document.querySelector('#goMakeYours [data-on="_postRunKeep"]'); if (k) k.click();
    });
    await sleep(250);
    const funnel = await page.evaluate(() => window.__funnel.slice());
    check('first game emits template_pick', picked.genre === 'RUNNER' && funnel.includes('template_pick'), funnel.join(','));
    check('a first tweak emits first_tweak', funnel.includes('first_tweak'), funnel.join(','));
    check('Keep it emits export', funnel.includes('export'), funnel.join(','));
    check('first path has no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // 2. Preview -> Play this and Surprise.
  {
    const { page, errors } = await newPage();
    await page.evaluate(() => {
      const w = document.getElementById('welcome-overlay'); if (w) w.classList.remove('show');
      document.body.classList.remove('overlay-active');
      const card = document.querySelector('.genre-card[data-genre="SHOOTER"]'); if (card) card.click();
    });
    await sleep(300);
    await page.evaluate(() => { const b = document.getElementById('genrePreviewPlay'); if (b) b.click(); });
    await sleep(900);
    await page.evaluate(() => {
      const io = document.getElementById('introOverlay');
      if (io && io.classList.contains('show')) { if (typeof closeIntro === 'function') closeIntro(); else io.classList.remove('show'); }
      const b = document.getElementById('surpriseMeBtn'); if (b) b.click();
    });
    await sleep(1200);
    const funnel = await page.evaluate(() => window.__funnel.slice());
    check('Play this emits preview_play', funnel.includes('preview_play'), funnel.join(','));
    check('Surprise emits surprise_pick', funnel.includes('surprise_pick'), funnel.join(','));
    check('preview path has no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nARCADE GAME MAKER FUNNEL CHECKS PASSED');
})().catch(e => { console.error('funnel test crashed:', e); process.exit(1); });
