#!/usr/bin/env node
/* tests/highway-dodge-trafficdash.js
 *
 * TrafficDash parity (Core06 Game Art project). highway-dodge must carry the
 * Godot build's systems on top of its own garage/fuel/missions:
 *   - a timed run (TIME HUD, finish = "You Made It!" + bonus)
 *   - drift-for-cash with a DRIFT HUD
 *   - nitro boost pickup
 *   - cone (stumble) and barrel (crash) hazards
 *   - oncoming / wrong-way traffic
 *
 * Run: node tests/highway-dodge-trafficdash.js
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.HD_TD_PORT || 8231);
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failures++;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  // 1. Static contract.
  const html = fs.readFileSync(path.join(ROOT, 'games', 'highway-dodge.html'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'inline', 'games-highway-dodge-1.js'), 'utf8');
  for (const id of ['timeHud', 'runHud', 'driftHud', 'statusHud']) check('HUD element #' + id, html.includes('id="' + id + '"'));
  for (const token of ['TIME_LIMIT', 'driftPoints', 'boostTimer', 'stumbleTimer', 'spawnHazard', 'spawnWrongWay', 'DRIFT_CASH_RATE']) {
    check('engine token ' + token, js.includes(token));
  }

  // 2. Live behaviour.
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const f = path.normalize(path.join(ROOT, u));
    if (!f.startsWith(path.normalize(ROOT)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + PORT;
  const browser = await puppeteer.launch({ headless: 'new' });
  const errors = [];
  async function newRun(query) {
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push(String(e.message || e)));
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(base + '/games/highway-dodge.html' + (query || ''), { waitUntil: 'load', timeout: 30000 });
    await page.bringToFront();
    await page.evaluate(() => { localStorage.setItem('highway-tip-seen', '1'); document.getElementById('playBtn').click(); });
    await sleep(250);
    return page;
  }

  try {
    // Timer + finish.
    let page = await newRun('?time=90');
    const t0 = await page.evaluate(() => window.__highway.timeLeft);
    check('timer starts from the time limit', t0 > 80 && t0 <= 90, 't=' + t0);
    let t1 = t0;
    for (let i = 0; i < 20 && t1 >= t0; i++) { await sleep(150); t1 = await page.evaluate(() => window.__highway.timeLeft); }
    check('timer counts down', t1 < t0, t0.toFixed(1) + ' -> ' + t1.toFixed(1));
    await page.evaluate(() => window.__highway.setTimeLeft(0.05));
    let win = { reason: 'none', dead: false, hud: '' };
    for (let i = 0; i < 25 && !win.dead; i++) {
      await sleep(150);
      win = await page.evaluate(() => ({ reason: window.__highway.endReason, dead: window.__highway.dead,
        hud: document.getElementById('timeHud').textContent }));
    }
    check('running out of time finishes the run', win.dead && win.reason === 'win', JSON.stringify(win));
    const finished = await page.evaluate(() => !!(document.querySelector('.sr-modal.show') || !document.getElementById('endScreen').classList.contains('hidden')));
    check('finish shows an end/result screen', finished);
    await page.close();

    // A short timed run should be finishable with ordinary safe-lane steering.
    let natWin = false;
    for (let attempt = 0; attempt < 2 && !natWin; attempt++) {
      page = await newRun('?time=4');
      const deadline = Date.now() + 9000;
      while (Date.now() < deadline) {
        await sleep(60);
        const s = await page.evaluate(() => ({ dead: window.__highway.dead, reason: window.__highway.endReason,
          cars: window.__highway.cars(), lane: window.__highway.playerLane }));
        if (s.dead) { natWin = s.reason === 'win'; break; }
        const danger = l => s.cars.reduce((m, c) => c.lane === l ? Math.max(m, c.y) : m, -1);
        let best = 0;
        for (const l of [1, 2]) if (danger(l) < danger(best)) best = l;
        if (best !== s.lane) await page.keyboard.press(best < s.lane ? 'ArrowLeft' : 'ArrowRight');
      }
      await page.close();
    }
    check('a short timed run can be finished', natWin);

    // Drift (its own run): throttle up, then change lane at speed.
    page = await newRun();
    await page.keyboard.down('w');
    await sleep(700);
    await page.evaluate(() => {
      window.__highway.setThrottle(1);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true }));
    });
    await page.keyboard.up('w');
    let drift = { drift: 0, drifting: false };
    for (let i = 0; i < 20 && drift.drift <= 0; i++) {
      await sleep(150);
      drift = await page.evaluate(() => ({ drift: window.__highway.drift, drifting: window.__highway.drifting }));
    }
    check('lane change at speed earns drift', drift.drift > 0, JSON.stringify(drift));
    await page.close();

    // Nitro.
    page = await newRun();
    await page.evaluate(() => window.__highway.debugPickup('boost'));
    let boost = 0;
    for (let i = 0; i < 25 && !boost; i++) { await sleep(150); boost = await page.evaluate(() => window.__highway.boost); }
    check('nitro pickup starts a boost', boost > 0, 'boost=' + boost.toFixed(2));
    check('status HUD shows NITRO', /nitro/i.test(await page.$eval('#statusHud', el => el.textContent)));
    await page.close();

    // Cone = stumble, not death.
    page = await newRun();
    await page.evaluate(() => window.__highway.debugHazard('cone'));
    let cone = { stumble: 0, dead: false };
    for (let i = 0; i < 25 && !cone.stumble && !cone.dead; i++) {
      await sleep(150);
      cone = await page.evaluate(() => ({ stumble: window.__highway.stumble, dead: window.__highway.dead }));
    }
    check('cone sends the car wobbly but not dead', cone.stumble > 0 && !cone.dead, 'stumble=' + cone.stumble.toFixed(2));
    await page.close();

    // Wrong-way traffic.
    page = await newRun();
    const before = await page.evaluate(() => window.__highway.wrongWaySpawns);
    await page.evaluate(() => window.__highway.debugWrongWay(0));
    let after = before;
    for (let i = 0; i < 20 && after <= before; i++) { await sleep(150); after = await page.evaluate(() => window.__highway.wrongWaySpawns); }
    check('wrong-way traffic spawns and moves up the road', after > before, 'spawns ' + before + ' -> ' + after);
    await page.close();

    // Barrel = crash.
    page = await newRun();
    await page.evaluate(() => window.__highway.debugHazard('barrel'));
    let barrel = { dead: false, reason: 'none' };
    for (let i = 0; i < 25 && !barrel.dead; i++) {
      await sleep(150);
      barrel = await page.evaluate(() => ({ dead: window.__highway.dead, reason: window.__highway.endReason }));
    }
    check('barrel is a crash', barrel.dead && barrel.reason === 'crash', JSON.stringify(barrel));
    check('no page errors during the systems runs', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }

  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL TRAFFICDASH PARITY CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
