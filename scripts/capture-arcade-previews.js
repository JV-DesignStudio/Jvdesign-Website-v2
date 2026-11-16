#!/usr/bin/env node
/*
 * scripts/capture-arcade-previews.js
 *
 * Renders every Arcade Game Maker template once and saves a small WebP preview
 * used by the starter picker and the first-run example grid, so a learner can
 * see a game before choosing it.
 *
 * Output: assets/arcade-previews/<template-key>.webp (480x300)
 * Run:    node scripts/capture-arcade-previews.js [--only key1,key2]
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const sharp = require('sharp');

const ROOT = process.env.JVDS_SITE || path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'arcade-previews');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.gif':'image/gif',
  '.svg':'image/svg+xml', '.webp':'image/webp', '.woff':'font/woff', '.woff2':'font/woff2',
  '.mp3':'audio/mpeg', '.wav':'audio/wav' };

const onlyArg = process.argv.find(a => a.startsWith('--only='));
const only = onlyArg ? (onlyArg.split('=')[1] || '').split(',').filter(Boolean) : null;
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    fs.readFile(path.join(ROOT, p), (err, buf) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewport({ width: 1280, height: 900 });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('jv_tutorial_done', '1'); } catch (e) {} });
  await page.goto(base + '/tools/arcade-game-maker.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('#runGameBtn', { timeout: 30000 });
  await page.waitForFunction(() => typeof _TEMPLATES === 'object' && typeof compileAndBootEngine === 'function', { timeout: 30000 });

  const templates = await page.evaluate(() => Object.keys(_TEMPLATES).map(k => ({ key: k, title: _TEMPLATES[k].title, genre: _TEMPLATES[k].genre })));
  const todo = only ? templates.filter(t => only.includes(t.key)) : templates;
  console.log(`\nRendering ${todo.length} previews into ${path.relative(ROOT, OUT)}`);

  let made = 0, failed = 0;
  for (const t of todo) {
    errors.length = 0;
    try {
      await page.evaluate(() => {
        try { if (window._phaserGame) window._phaserGame.destroy(true); } catch (e) {}
        window._phaserGame = null;
        const c = document.getElementById('game-container'); if (c) c.innerHTML = '';
      });
      await sleep(750);
      await page.evaluate(k => { if (typeof _loadTemplate === 'function') _loadTemplate(k); }, t.key);
      await sleep(300);
      await page.evaluate(() => { if (typeof compileAndBootEngine === 'function') compileAndBootEngine(); });
      await sleep(700);
      await page.evaluate(() => {
        const io = document.getElementById('introOverlay');
        if (io && io.classList.contains('show')) { if (typeof closeIntro === 'function') closeIntro(); else io.classList.remove('show'); }
        const w = document.getElementById('welcome-overlay'); if (w) w.classList.remove('show');
        document.body.classList.remove('overlay-active');
      });
      // Let the scene animate into a representative frame.
      await sleep(1600);
      const canvas = await page.$('#game-container canvas');
      if (!canvas) throw new Error('no canvas');
      const shot = await canvas.screenshot({ type: 'png' });
      if (!shot || shot.length < 1000) throw new Error('empty screenshot');
      const out = path.join(OUT, t.key + '.webp');
      await sharp(shot)
        .resize(480, 300, { fit: 'cover', position: 'centre' })
        .webp({ quality: 82 })
        .toFile(out);
      made++;
      console.log(`  ✓ ${t.key.padEnd(18)} ${String(t.genre).padEnd(13)} ${t.title || ''}`);
    } catch (e) {
      failed++;
      console.log(`  ✗ ${t.key.padEnd(18)} ${e.message}${errors.length ? ' , ' + errors[0].slice(0, 120) : ''}`);
    }
  }

  await browser.close();
  server.close();
  console.log(`\n${made} preview(s) written, ${failed} failed.`);
  if (failed) process.exit(1);
})().catch(e => { console.error('capture previews crashed:', e); process.exit(1); });
