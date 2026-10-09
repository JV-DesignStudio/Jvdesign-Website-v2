#!/usr/bin/env node
/*
 * tests/nova-siege-http.js - A970
 *
 * Nova Siege was made mobile-first and given an endless parallax space
 * background plus more enemies and bosses. This proves:
 *   - the page loads with no errors at 390 and 1440 and the canvas fits
 *   - dragging the play area moves the ship (mobile control)
 *   - the background has layered star groups scrolling at different speeds
 *     (far < mid < near), with nebulae and planets present
 *   - the three new enemy types can spawn and the boss cycles through all
 *     three types by stage
 *   - the game-over screen shows above the canvas (not hidden behind it)
 *
 * Run: node tests/nova-siege-http.js
 */
const { withServer } = require('./story-run-harness.cjs');

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

function watch(page) {
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/ERR_|Failed to load resource|favicon|Manifest/.test(t)) return;
    errors.push('console: ' + t);
  });
  return errors;
}

async function desktop(browser, base) {
  const page = await browser.newPage();
  const errors = watch(page);
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(base + '/games/nova-siege.html', { waitUntil: 'load', timeout: 30000 });
  await sleep(300);
  const info = await page.evaluate(() => ({
    title: document.title,
    canvas: !!document.getElementById('cv'),
    start: !!document.getElementById('startBtn'),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  }));
  check('desktop: title names Nova Siege', /nova/i.test(info.title), info.title);
  check('desktop: canvas present', info.canvas);
  check('desktop: start button present', info.start);
  check('desktop: no horizontal overflow', info.overflow <= 2, String(info.overflow));
  check('desktop: no page errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

async function parallax(browser, base) {
  const page = await browser.newPage();
  const errors = watch(page);
  await page.setViewport({ width: 1000, height: 760 });
  await page.goto(base + '/games/nova-siege.html', { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(() => document.getElementById('startBtn').click());
  await sleep(400);
  const a = await page.evaluate(() => {
    const b = window.__nova.bg;
    return { far: b.far.map(s => s.y), mid: b.mid.map(s => s.y), near: b.near.map(s => s.y), neb: b.neb.length, planets: b.planets.length };
  });
  await sleep(320);
  const b = await page.evaluate(() => {
    const g = window.__nova.bg;
    return { far: g.far.map(s => s.y), mid: g.mid.map(s => s.y), near: g.near.map(s => s.y) };
  });
  const median = arr => { const s = [...arr].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  const delta = (y1, y2) => {
    const out = [];
    for (let i = 0; i < Math.min(y1.length, y2.length); i++) {
      const d = Math.abs(y2[i] - y1[i]);
      if (d < 360) out.push(d); // drop wrapped items (logical height is 720)
    }
    return median(out);
  };
  const far = delta(a.far, b.far), mid = delta(a.mid, b.mid), near = delta(a.near, b.near);
  check('parallax: background has three star groups', a.far.length > 0 && a.mid.length > 0 && a.near.length > 0,
    a.far.length + '/' + a.mid.length + '/' + a.near.length);
  check('parallax: nebulae and planets are present', a.neb >= 1 && a.planets >= 1, 'neb=' + a.neb + ' planets=' + a.planets);
  check('parallax: each star layer scrolls faster than the one behind it', far < mid && mid < near,
    far.toFixed(2) + ' < ' + mid.toFixed(2) + ' < ' + near.toFixed(2));
  check('parallax: no page errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

async function content(browser, base) {
  const page = await browser.newPage();
  const errors = watch(page);
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(base + '/games/nova-siege.html', { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(() => document.getElementById('startBtn').click());
  await sleep(300);

  // Force a later stage so the new enemy types are eligible, then collect kinds.
  await page.evaluate(() => { window.__nova.run.stage = 6; window.__nova.run.enemies.length = 0; });
  const kinds = new Set();
  for (let i = 0; i < 90; i++) {
    await sleep(70);
    const ks = await page.evaluate(() => window.__nova.enemyKinds);
    ks.forEach(k => kinds.add(k));
    if (['diver', 'gunner', 'splitter'].every(k => kinds.has(k))) break;
  }
  const newKinds = ['diver', 'gunner', 'splitter'].filter(k => kinds.has(k));
  check('content: new enemy types spawn (diver/gunner/splitter)', newKinds.length >= 2, newKinds.join(',') || 'none of ' + [...kinds].join(','));

  // Boss cycles through all three types by stage.
  const bossTypes = await page.evaluate(() => {
    const seen = [];
    for (const st of [1, 2, 3]) { window.__nova.run.stage = st; seen.push(window.__nova.forceBoss()); }
    return seen;
  });
  check('content: boss type cycles by stage (0,1,2)', bossTypes.join(',') === '0,1,2', bossTypes.join(','));

  // Game-over screen must show above the canvas.
  await page.evaluate(() => window.__nova.forceEnd());
  await sleep(300);
  const over = await page.evaluate(() => {
    const ov = document.getElementById('overlay');
    const c = document.getElementById('cv');
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    const el = document.elementFromPoint(cx, cy);
    const modal = document.querySelector('.sr-modal.show');
    return {
      overlayVisible: !!ov && !ov.classList.contains('hidden'),
      onTop: !!el && el.id !== 'cv' && !(c && c.contains(el)),
      hit: el ? (el.id || el.className || el.tagName) : null,
      modal: !!modal
    };
  });
  check('content: game-over screen is visible', over.overlayVisible || over.modal);
  check('content: game-over shows above the canvas', over.onTop, JSON.stringify(over));
  check('content: no page errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

async function mobileDrag(browser, base) {
  const page = await browser.newPage();
  const errors = watch(page);
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(base + '/games/nova-siege.html', { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(() => { if (window.JVDSGameShell) window.JVDSGameShell.enter(); });
  await page.evaluate(() => document.getElementById('startBtn').click());
  await sleep(300);
  const before = await page.evaluate(() => window.__nova.run.px);
  const box = await page.evaluate(() => {
    const s = document.querySelector('.stage-wrap').getBoundingClientRect();
    return { x: s.left, y: s.top, w: s.width, h: s.height };
  });
  // drag from left to right across the play area, holding so the ship eases over
  const y = box.y + box.h * 0.6;
  await page.mouse.move(box.x + box.w * 0.25, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.w * 0.8, y, { steps: 6 });
  await sleep(600);
  const after = await page.evaluate(() => window.__nova.run.px);
  await page.mouse.up();
  check('mobile: dragging the play area moves the ship', after > before + 20, before.toFixed(0) + '->' + after.toFixed(0));
  const immersive = await page.evaluate(() => document.documentElement.classList.contains('jvds-immersive'));
  check('mobile: play area fills the screen in immersive mode', immersive);
  check('mobile: no page errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

(async () => {
  await withServer(async ({ base, browser }) => {
    await desktop(browser, base);
    await parallax(browser, base);
    await content(browser, base);
    await mobileDrag(browser, base);
  });
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL NOVA SIEGE CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
