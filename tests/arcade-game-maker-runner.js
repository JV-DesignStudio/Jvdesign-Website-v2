#!/usr/bin/env node
/*
 * tests/arcade-game-maker-runner.js , A3060
 *
 * The Endless Runner template is one of the first things a learner picks, so it
 * has to actually run. This drives the real RUNNER scene and proves four things:
 *   1. every obstacle body matches the barrier that is drawn (the old code left
 *      a 450px body that hit the player in every lane),
 *   2. a low barrier can be jumped and a wall can be dodged by changing lane,
 *   3. a non-fatal hit costs one life and the run keeps going (it used to freeze),
 *   4. at zero lives the game-over overlay appears and the run stops.
 *
 * Run: node tests/arcade-game-maker-runner.js
 *   JVDS_SITE=<dir>          serve a different site root
 *   AGM_RUNNER_PORT=<n>      port to serve on (default 8991)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = process.env.JVDS_SITE || path.join(__dirname, '..');
const PORT = Number(process.env.AGM_RUNNER_PORT || 8991);
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.gif':'image/gif', '.svg':'image/svg+xml',
  '.webp':'image/webp', '.woff':'font/woff', '.woff2':'font/woff2', '.mp3':'audio/mpeg', '.wav':'audio/wav' };

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log((ok ? '  \u2713 ' : '  \u2717 ') + name + (detail ? ' , ' + detail : ''));
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Network noise that is not a game bug (fonts, analytics, CDN).
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

  async function bootRunner(width, height) {
    pageErrors.length = 0;
    await page.setViewport({ width, height });
    await page.goto(`http://localhost:${PORT}/tools/arcade-game-maker.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#runGameBtn', { timeout: 20000 });
    await page.evaluate(() => {
      document.getElementById('genreMode').value = 'RUNNER';
      if (typeof onGenreChange === 'function') onGenreChange();
    });
    await sleep(250);
    await page.evaluate(() => { if (typeof compileAndBootEngine === 'function') compileAndBootEngine(); });
    await sleep(600);
    await page.evaluate(() => {
      const ov = document.getElementById('introOverlay');
      if (ov && ov.classList.contains('show')) {
        if (typeof closeIntro === 'function') closeIntro(); else ov.classList.remove('show');
      }
    });
    await page.waitForFunction(() => {
      const g = window._phaserGame || window.currentPhaserGame;
      const sc = g && g.scene && g.scene.getScene && g.scene.getScene('RunnerScene');
      return !!(sc && sc.sys && sc.sys.isActive());
    }, { timeout: 20000 });
    await sleep(500);
  }

  console.log('\n\u25b8 arcade game maker: endless runner template');
  console.log('  root: ' + ROOT);

  await bootRunner(1280, 900);
  check('runner boots and its scene is active', true);

  // ── 1. Hitboxes match the drawn barriers ─────────────────────────────────
  const sizes = await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScene('RunnerScene');
    sc.spawnTimer.paused = true;
    sc._clearHazards();
    gameState.lives = 99;
    sc._invincible = false;
    sc._spawnWave();
    const obs = sc.obstacles.getChildren().map(o => ({
      displayW: o.displayWidth, displayH: o.displayHeight,
      bodyW: o.body ? o.body.width : -1, bodyH: o.body ? o.body.height : -1,
      type: o.getData('type'), laneW: sc._laneW
    }));
    sc._clearHazards();
    return obs;
  });
  check('runner spawns at least one obstacle', sizes.length > 0, String(sizes.length));
  const fitsLane = sizes.every(o => o.bodyW > 0 && o.bodyW < o.laneW && o.bodyW <= o.displayW + 1);
  check('obstacle bodies fit inside one lane and match the drawn size', fitsLane,
    sizes.map(o => `${o.type}:${Math.round(o.displayW)}/${Math.round(o.bodyW)}`).join(' '));

  // ── 2a. A low barrier can be jumped ──────────────────────────────────────
  await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScene('RunnerScene');
    sc._clearHazards();
    sc.spawnTimer.paused = true;
    gameState.lives = 5;
    sc._invincible = false;
    sc._dead = false;
    sc._lane = 1;
    sc.actor.x = sc._lanes[1];
    sc.actor.y = sc._actorBaseY;
    sc._jumpY = 0; sc._jumpVy = 0;
    sc._jumping = false; sc._sliding = false;
    sc._doJump();
    const ob = sc.obstacles.create(sc._lanes[1], sc._actorBaseY, 'block')
      .setDisplaySize(sc._laneW * 0.62, 18).setTint(0xef4444);
    ob.refreshBody();
    ob.body.setSize(ob.width * 0.9, ob.height * 0.9, true);
    ob.body.allowGravity = false;
    ob.setImmovable(true);
    ob.setData('type', 'low');
  });
  await sleep(280);
  const jumped = await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScene('RunnerScene');
    return { lives: gameState.lives, jumping: sc._jumping, dead: sc._dead };
  });
  check('jumping over a low barrier costs no life', jumped.lives === 5, JSON.stringify(jumped));

  // ── 2b. A wall can be dodged by changing lane ────────────────────────────
  await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScene('RunnerScene');
    sc._clearHazards();
    sc.spawnTimer.paused = true;
    gameState.lives = 5;
    sc._invincible = false;
    sc._dead = false;
    sc._jumping = false; sc._sliding = false;
    sc._jumpY = 0; sc._jumpVy = 0;
    // Undo the stretch left by the jump test so this run starts from rest.
    const s = Math.round(32 * (liveConfig.playerScale || 1));
    sc.actor.setDisplaySize(s, s);
    sc.actor.body.setSize(Math.round(s * .65), Math.round(s * .65), true);
    sc.actor.body.setOffset(
      (sc.actor.width - sc.actor.body.width) / 2,
      (sc.actor.height - sc.actor.body.height) / 2
    );
    sc._lane = 1;
    sc.actor.x = sc._lanes[1];
    sc.actor.y = sc._actorBaseY;
    const ob = sc.obstacles.create(sc._lanes[1], sc._actorBaseY - 140, 'block')
      .setDisplaySize(sc._laneW * 0.72, 38).setTint(0xf97316);
    ob.refreshBody();
    ob.body.setSize(ob.width * 0.9, ob.height * 0.9, true);
    ob.body.allowGravity = false;
    ob.setImmovable(true);
    ob.setData('type', 'wall');
    ob.setVelocityY(300);
    sc._moveLane(-1);
  });
  await sleep(700);
  const dodged = await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScene('RunnerScene');
    return { lives: gameState.lives, x: Math.round(sc.actor.x), dead: sc._dead };
  });
  check('changing lane dodges a wall', dodged.lives === 5 && dodged.x < 320, JSON.stringify(dodged));

  // ── 3. A non-fatal hit costs one life and the run keeps going ────────────
  const hitBefore = await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScene('RunnerScene');
    sc._clearHazards();
    sc.spawnTimer.paused = true;
    gameState.lives = 3;
    sc._invincible = false;
    sc._dead = false;
    sc._jumping = false; sc._sliding = false;
    sc._jumpY = 0; sc._jumpVy = 0;
    const s = Math.round(32 * (liveConfig.playerScale || 1));
    sc.actor.setDisplaySize(s, s);
    sc.actor.body.setSize(Math.round(s * .65), Math.round(s * .65), true);
    sc.actor.body.setOffset(
      (sc.actor.width - sc.actor.body.width) / 2,
      (sc.actor.height - sc.actor.body.height) / 2
    );
    sc._lane = 1;
    sc.actor.x = sc._lanes[1];
    sc.actor.y = sc._actorBaseY;
    const ob = sc.obstacles.create(sc._lanes[1], sc._actorBaseY, 'block')
      .setDisplaySize(sc._laneW * 0.72, 38).setTint(0xf97324);
    ob.refreshBody();
    ob.body.setSize(ob.width * 0.9, ob.height * 0.9, true);
    ob.body.allowGravity = false;
    ob.setImmovable(true);
    ob.setData('type', 'wall');
    return { lives: gameState.lives, score: Math.round(sc.score) };
  });
  await sleep(350);
  const hitAfter = await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScene('RunnerScene');
    return { lives: gameState.lives, dead: sc._dead, invincible: sc._invincible };
  });
  check('a non-fatal hit costs exactly one life', hitAfter.lives === hitBefore.lives - 1, JSON.stringify(hitAfter));
  check('the run is not frozen after a non-fatal hit', hitAfter.dead === false);
  await sleep(1600);
  const resumed = await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScene('RunnerScene');
    return { score: Math.round(sc.score), dead: sc._dead, invincible: sc._invincible };
  });
  check('the score keeps climbing after recovery', resumed.score > hitBefore.score && resumed.dead === false,
    `${hitBefore.score} -> ${resumed.score}`);

  // ── 4. Zero lives ends the run with the game-over overlay ────────────────
  await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScene('RunnerScene');
    sc._clearHazards();
    sc.spawnTimer.paused = true;
    gameState.lives = 1;
    sc._invincible = false;
    sc._dead = false;
    sc._jumping = false; sc._sliding = false;
    sc._jumpY = 0; sc._jumpVy = 0;
    const s = Math.round(32 * (liveConfig.playerScale || 1));
    sc.actor.setDisplaySize(s, s);
    sc.actor.body.setSize(Math.round(s * .65), Math.round(s * .65), true);
    sc.actor.body.setOffset(
      (sc.actor.width - sc.actor.body.width) / 2,
      (sc.actor.height - sc.actor.body.height) / 2
    );
    sc._lane = 1;
    sc.actor.x = sc._lanes[1];
    sc.actor.y = sc._actorBaseY;
    const ob = sc.obstacles.create(sc._lanes[1], sc._actorBaseY, 'block')
      .setDisplaySize(sc._laneW * 0.72, 38).setTint(0xf97324);
    ob.refreshBody();
    ob.body.setSize(ob.width * 0.9, ob.height * 0.9, true);
    ob.body.allowGravity = false;
    ob.setImmovable(true);
    ob.setData('type', 'wall');
  });
  await page.waitForFunction(() => {
    const el = document.getElementById('goOverlay');
    return !!(el && el.classList.contains('show'));
  }, { timeout: 8000 }).catch(() => {});
  await sleep(300);
  const over = await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScene('RunnerScene');
    const el = document.getElementById('goOverlay');
    return { overlay: !!(el && el.classList.contains('show')), dead: sc._dead, lives: gameState.lives };
  });
  check('at zero lives the game-over overlay appears', over.overlay === true, JSON.stringify(over));
  check('the runner stops once the run is over', over.dead === true, JSON.stringify(over));

  check('no page or console errors during the run', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));

  // ── 5. Build sliders actually reach the runner ───────────────────────────
  const jumpCfg = await page.evaluate(() => {
    const sc = window._phaserGame.scene.getScene('RunnerScene');
    const go = document.getElementById('goOverlay');
    if (go) go.classList.remove('show');
    sc._dead = false; sc._invincible = false;
    sc._clearHazards();
    const reset = () => { sc._jumping = false; sc._jumpsUsed = 0; sc._jumpY = 0; sc._jumpVy = 0; };
    reset(); liveConfig.jumpForce = 400; sc._doJump();
    const low = sc._jumpVy;
    reset(); liveConfig.jumpForce = 800; sc._doJump();
    const high = sc._jumpVy;
    reset(); liveConfig.jumpForce = 450;
    liveConfig.doubleJump = true;
    sc._doJump(); const first = sc._jumpsUsed;
    sc._jumpY = -50; sc._jumping = true;
    sc._doJump(); const second = sc._jumpsUsed;
    sc._doJump(); const third = sc._jumpsUsed;
    liveConfig.doubleJump = false;
    reset();
    return { low, high, first, second, third };
  });
  check('Jump Force slider changes the jump', Math.abs(jumpCfg.high) > Math.abs(jumpCfg.low) * 1.5,
    `${jumpCfg.low} -> ${jumpCfg.high}`);
  check('doubleJump gives two jumps then stops', jumpCfg.first === 1 && jumpCfg.second === 2 && jumpCfg.third === 2,
    JSON.stringify(jumpCfg));

  try {
    const gLow = await page.evaluate(async () => {
      const sc = window._phaserGame.scene.getScene('RunnerScene');
      liveConfig.gravity = 100;
      sc._jumping = true; sc._jumpY = -200; sc._jumpVy = 0; sc._jumpsUsed = 0;
      await new Promise(r => setTimeout(r, 140));
      return sc._jumpVy;
    });
    const gHigh = await page.evaluate(async () => {
      const sc = window._phaserGame.scene.getScene('RunnerScene');
      liveConfig.gravity = 2000;
      sc._jumping = true; sc._jumpY = -200; sc._jumpVy = 0; sc._jumpsUsed = 0;
      await new Promise(r => setTimeout(r, 140));
      return sc._jumpVy;
    });
    await page.evaluate(() => {
      const sc = window._phaserGame.scene.getScene('RunnerScene');
      liveConfig.gravity = 600;
      sc._jumping = false; sc._jumpY = 0; sc._jumpVy = 0; sc._jumpsUsed = 0;
      sc.actor.y = sc._actorBaseY;
    });
    check('Gravity slider changes the fall', gHigh > gLow * 3, `${Math.round(gLow)} -> ${Math.round(gHigh)}`);
  } catch (e) {
    check('Gravity slider changes the fall', false, String(e.message || e));
  }

  // ── 6. Touch: tap jumps, swipes dodge/slide without a phantom jump ───────
  const touchPage = await browser.newPage();
  const touchErrors = [];
  touchPage.on('pageerror', e => touchErrors.push(e.message));
  await touchPage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await touchPage.evaluateOnNewDocument(() => { try { localStorage.setItem('jv_tutorial_done', '1'); } catch (e) {} });
  await touchPage.goto(`http://localhost:${PORT}/tools/arcade-game-maker.html`, { waitUntil: 'domcontentloaded' });
  await touchPage.waitForSelector('#runGameBtn', { timeout: 20000 });
  await touchPage.evaluate(() => {
    document.getElementById('genreMode').value = 'RUNNER';
    if (typeof onGenreChange === 'function') onGenreChange();
  });
  await sleep(250);
  await touchPage.evaluate(() => { if (typeof compileAndBootEngine === 'function') compileAndBootEngine(); });
  await sleep(600);
  await touchPage.evaluate(() => {
    const ov = document.getElementById('introOverlay');
    if (ov && ov.classList.contains('show')) { if (typeof closeIntro === 'function') closeIntro(); else ov.classList.remove('show'); }
    const w = document.getElementById('welcome-overlay'); if (w) w.classList.remove('show');
    document.body.classList.remove('overlay-active');
  });
  await touchPage.waitForFunction(() => {
    const g = window._phaserGame || window.currentPhaserGame;
    const sc = g && g.scene && g.scene.getScene && g.scene.getScene('RunnerScene');
    return !!(sc && sc.sys && sc.sys.isActive());
  }, { timeout: 20000 });
  await sleep(500);

  const touchButtons = await touchPage.evaluate(() => {
    const vis = id => { const el = document.getElementById(id); return el ? getComputedStyle(el).display !== 'none' : false; };
    return { up: vis('tc-up'), down: vis('tc-down'), fire: vis('tc-fire') };
  });
  check('runner shows jump and slide buttons', touchButtons.up === true && touchButtons.down === true, JSON.stringify(touchButtons));
  check('runner hides the dead fire button', touchButtons.fire === false, JSON.stringify(touchButtons));

  await touchPage.evaluate(() => {
    const sc = window._phaserGame.scene.getScene('RunnerScene');
    sc.spawnTimer.paused = true; sc._clearHazards();
    gameState.lives = 5; sc._invincible = false; sc._dead = false;
  });
  const rect = await touchPage.evaluate(() => {
    const c = document.querySelector('#game-container canvas');
    const r = c.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  const cx = Math.round(rect.x + rect.w / 2), cy = Math.round(rect.y + rect.h * 0.6);
  const cdp = await touchPage.target().createCDPSession();
  const resetRunner = () => touchPage.evaluate(() => {
    const sc = window._phaserGame.scene.getScene('RunnerScene');
    sc._lane = 1; sc.actor.x = sc._lanes[1];
    sc._jumping = false; sc._sliding = false;
    sc._jumpY = 0; sc._jumpVy = 0; sc._jumpsUsed = 0;
    sc.actor.y = sc._actorBaseY;
  });
  const runnerState = () => touchPage.evaluate(() => {
    const sc = window._phaserGame.scene.getScene('RunnerScene');
    return { jumping: sc._jumping, sliding: sc._sliding, lane: sc._lane };
  });
  async function gesture(dx, dy) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 1 }] });
    await sleep(30);
    if (dx || dy) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + dx, y: cy + dy, id: 1 }] });
    await sleep(30);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(120);
  }

  await resetRunner(); await gesture(0, 0);
  const tap = await runnerState();
  check('tap jumps', tap.jumping === true, JSON.stringify(tap));

  await sleep(700); await resetRunner(); await gesture(0, 90);
  const down = await runnerState();
  check('swipe down slides without jumping', down.sliding === true && down.jumping === false, JSON.stringify(down));

  await sleep(600); await resetRunner(); await gesture(-90, 0);
  const left = await runnerState();
  check('swipe left changes lane without jumping', left.lane === 0 && left.jumping === false, JSON.stringify(left));

  check('no touch-page errors', touchErrors.length === 0, touchErrors.slice(0, 2).join(' | '));
  await touchPage.close();

  // ── 7. The template boots at phone and desktop widths ────────────────────
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    const before = pageErrors.length;
    await bootRunner(w, h);
    const hasCanvas = await page.evaluate(() => {
      const c = document.querySelector('#game-container canvas');
      return !!c && c.width > 0;
    });
    check(`runner renders at ${w}px`, hasCanvas, hasCanvas ? '' : 'no canvas');
    check(`no JS errors at ${w}px`, pageErrors.length === before, (pageErrors[before] || '').slice(0, 160));
  }

  await browser.close();
  server.close();

  const failed = results.filter(r => !r.ok);
  console.log('\n' + '\u2500'.repeat(52));
  console.log(`${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    failed.forEach(f => console.log('  FAILED: ' + f.name + (f.detail ? ' , ' + f.detail : '')));
    process.exit(1);
  }
  console.log('\u2713 arcade game maker runner: the endless runner plays');
})().catch(e => { console.error('runner test crashed:', e); process.exit(1); });
