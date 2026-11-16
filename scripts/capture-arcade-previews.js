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
const crypto = require('crypto');
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

// The real Phaser scene key for each genre, so a preview can never be captured
// from a stale or idle scene.
const SCENE_KEYS = {
  SHOOTER:'ShooterScene', PLATFORMER:'PlatformerScene', DODGE:'DodgeScene', BREAKER:'BreakerScene',
  RUNNER:'RunnerScene', FLAPPY:'FlappyScene', INVADERS:'InvadersScene', PONG:'PongScene',
  SNAKE:'SnakeScene', ASTEROIDS:'AsteroidsScene', ROGUELIKE:'RoguelikeScene', RACING:'RacingScene',
  HOPPER:'HopperScene', BEAT:'BeatScene', PUZZLE:'PuzzleScene', RHYTHM:'RhythmScene',
  DEFENSE:'TDScene', PINBALL:'PinballScene', CLICKER:'ClickerScene', MEMORY:'MemoryScene',
  WAVESURVIVAL:'WaveSurvivalScene', PAPERTOSS:'PaperTossScene', CUSTOM:'CustomScene',
};

// A stable fingerprint of the tuning a preview represents. If a template's
// title, genre, theme or key tuning changes, the preview is stale.
function tplHash(t) {
  const subset = { title: t.title, genre: t.genre, theme: t.theme, speed: t.speed, lives: t.lives,
    obstacleSpeed: t.obstacleSpeed, enemySpeed: t.enemySpeed, difficultyScale: t.difficultyScale, spawnDelay: t.spawnDelay };
  return crypto.createHash('sha256').update(JSON.stringify(subset)).digest('hex').slice(0, 16);
}

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

  const templates = await page.evaluate(() => Object.keys(_TEMPLATES).map(k => Object.assign({ key: k }, _TEMPLATES[k])));
  const todo = only ? templates.filter(t => only.includes(t.key)) : templates;
  console.log(`\nRendering ${todo.length} previews into ${path.relative(ROOT, OUT)}`);

  const manifestPath = path.join(OUT, 'manifest.json');
  let manifest = { version: 1, capturedAt: new Date().toISOString(), entries: {} };
  if (only && fs.existsSync(manifestPath)) {
    try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (e) {}
  }
  manifest.version = 1;
  manifest.capturedAt = new Date().toISOString();

  let made = 0, failed = 0;
  for (const t of todo) {
    errors.length = 0;
    try {
      const boot = async () => {
        await page.evaluate(() => {
          try { if (window._phaserGame) window._phaserGame.destroy(true); } catch (e) {}
          window._phaserGame = null; window.currentPhaserGame = null;
          const c = document.getElementById('game-container'); if (c) c.innerHTML = '';
        });
        await sleep(350);
        await page.evaluate(k => { if (typeof _loadTemplate === 'function') _loadTemplate(k); }, t.key);
        await sleep(300);
        await page.evaluate(() => {
          if (typeof compileAndBootEngine === 'function') { compileAndBootEngine._lastRun = 0; compileAndBootEngine(); }
        });
        await sleep(750);
        await page.evaluate(() => {
          const io = document.getElementById('introOverlay');
          if (io && io.classList.contains('show')) { if (typeof closeIntro === 'function') closeIntro(); else io.classList.remove('show'); }
          // Clear every end-of-run overlay a previous template may have left up.
          ['welcome-overlay', 'tutOverlay', 'goOverlay', 'rewindOverlay'].forEach(id => {
            const el = document.getElementById(id); if (el) el.classList.remove('show');
          });
          const pm = document.getElementById('pauseMenu'); if (pm) pm.style.display = 'none';
          const cd = document.getElementById('countdownOverlay'); if (cd) cd.style.display = 'none';
          document.body.classList.remove('overlay-active');
        });
        return page.waitForFunction(arg => {
          const gm = window._phaserGame;
          const sc = gm && gm.scene && gm.scene.getScenes(true)[0];
          return !!(sc && sc.sys && sc.sys.isActive() && sc.sys.settings.key === arg.key &&
            typeof _engineData !== 'undefined' && _engineData && _engineData.genre === arg.genre);
        }, { timeout: 12000 }, { genre: t.genre, key: SCENE_KEYS[t.genre] }).then(() => true).catch(() => false);
      };
      let ok = await boot();
      if (!ok) { await sleep(900); ok = await boot(); }
      if (!ok) throw new Error('scene did not boot for ' + t.genre);
      // Let the scene animate into a representative frame. Snake moves fast,
      // so capture it early while the first apple is still on screen.
      const delay = ({ glow_serpent: 350, snake_b: 350, snake_c: 350 })[t.key] || 1600;
      await sleep(delay);
      await page.evaluate(() => {
        ['goOverlay', 'rewindOverlay'].forEach(id => { const el = document.getElementById(id); if (el) el.classList.remove('show'); });
        document.body.classList.remove('overlay-active');
      });
      const canvas = await page.$('#game-container canvas');
      if (!canvas) throw new Error('no canvas');
      const shot = await canvas.screenshot({ type: 'png' });
      if (!shot || shot.length < 1000) throw new Error('empty screenshot');
      const out = path.join(OUT, t.key + '.webp');
      await sharp(shot)
        .resize(480, 300, { fit: 'cover', position: 'centre' })
        .webp({ quality: 82 })
        .toFile(out);
      manifest.entries[t.key] = { file: t.key + '.webp', title: t.title || t.key, genre: t.genre || '', configHash: tplHash(t), capturedAt: new Date().toISOString() };
      made++;
      console.log(`  ✓ ${t.key.padEnd(18)} ${String(t.genre).padEnd(13)} ${t.title || ''}`);
    } catch (e) {
      failed++;
      console.log(`  ✗ ${t.key.padEnd(18)} ${e.message}${errors.length ? ' , ' + errors[0].slice(0, 120) : ''}`);
    }
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  await browser.close();
  server.close();
  console.log(`\n${made} preview(s) written, ${failed} failed. Manifest: ${path.relative(ROOT, manifestPath)}`);
  if (failed) process.exit(1);
})().catch(e => { console.error('capture previews crashed:', e); process.exit(1); });
