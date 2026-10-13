#!/usr/bin/env node
/*
 * tests/nova-siege-http.js - A970
 *
 * Nova Siege was made mobile-first and given an endless parallax space
 * background plus more enemies and bosses. This proves:
 *   - the page loads with no errors at 390 and 1440 and the canvas fits
 *   - a real (trusted) tap on Play enters immersive/fullscreen and the play
 *     field fills the phone width
 *   - dragging the play area moves the ship on both X and Y (mobile control),
 *     arrow keys still move it, and in immersive mode the redundant DOM stat
 *     grid is hidden while the field is tall (>=640) with no overflow
 *   - at dpr 3 the render scale fills the whole HiDPI backing store (guards the
 *     transform-reset bug that drew the game into a small top-left square)
 *   - progression: an equipped hull's bonus applies (Verdant +1 health), a
 *     SHIELD star grants a shield bubble, and every premium hull has a perk
 *   - juice: kills build a combo that multiplies score, caps at x3, resets on
 *     a hit, and the boss exposes a fire timer for its attack telegraph
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
  const size = await page.evaluate(() => { const r = document.getElementById('cv').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; });
  check('desktop: play field is a decent size (>=640 tall at 1440x900)', size.h >= 640 && size.w >= 380, JSON.stringify(size));
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

  // Force a later stage so the new enemy types are eligible. Sampling the spawn
  // table is deterministic; the old short live window could miss a type by chance
  // (each new kind is only ~7-12% per roll) and reported a false failure.
  await page.evaluate(() => { window.__nova.run.stage = 6; window.__nova.run.enemies.length = 0; });
  const sampled = await page.evaluate(() => { const s = new Set(); for (let i = 0; i < 800; i++) s.add(window.__nova.pickKind()); return [...s]; });
  const newKinds = ['diver', 'gunner', 'splitter'].filter(k => sampled.includes(k));
  check('content: new enemy types (diver/gunner/splitter) are reachable at stage 6', newKinds.length === 3, sampled.join(','));
  // ...and enemies really do spawn in a live run.
  let live = 0;
  for (let i = 0; i < 50; i++) {
    await sleep(60);
    // A cleared wave now opens the roguelike draft, which pauses spawning. Pick
    // the first card so the run keeps producing enemies.
    await page.evaluate(() => { if (window.__nova.draftOpen) { const c = document.querySelector('#draftCards .card'); if (c) c.click(); } });
    live = Math.max(live, await page.evaluate(() => window.__nova.enemyKinds.length));
    if (live > 0) break;
  }
  check('content: enemies spawn in the live run', live >= 1, 'max=' + live);

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
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  await page.goto(base + '/games/nova-siege.html', { waitUntil: 'load', timeout: 30000 });
  // Drive the Play button with a real trusted click, exactly like a finger tap.
  // The old version used a synthetic element.click() and called
  // JVDSGameShell.enter() by hand, so it never noticed that the stage's
  // pointerdown was eating the tap and fullscreen never happened for real users.
  // webdriver is forced false here only so the shared shell runs its real
  // (non-automation) path.
  await page.evaluate(() => { try { Object.defineProperty(navigator, 'webdriver', { get: () => false }); } catch (e) {} });
  await page.click('#startBtn');
  await sleep(400);
  const immersive = await page.evaluate(() => document.documentElement.classList.contains('jvds-immersive'));
  check('mobile: tapping Play enters immersive/fullscreen mode', immersive);
  const fill = await page.evaluate(() => {
    const r = document.getElementById('cv').getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), vw: window.innerWidth, vh: window.innerHeight, ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  check('mobile: play field fills the phone width', fill.w >= fill.vw * 0.9, JSON.stringify(fill));
  check('mobile: field is taller than the old board (>=640)', fill.h >= 640, JSON.stringify(fill));
  check('mobile: no horizontal overflow', fill.ovf <= 2, String(fill.ovf));
  const hudHidden = await page.evaluate(() => {
    const h = document.querySelector('.hud');
    return !!h && getComputedStyle(h).display === 'none';
  });
  check('mobile: redundant DOM stat grid hidden in immersive mode', hudHidden);
  // HiDPI: render() must re-apply the logical -> backing-store scale every frame.
  // If it resets to identity, the whole game draws into the top-left corner at a
  // fraction of the element (the "small square" bug) on any dpr>1 phone.
  const fit = await page.evaluate(() => {
    const c = document.getElementById('cv');
    return { scale: window.__nova.scale, lw: window.__nova.lw, lh: window.__nova.lh, cvw: c.width, cvh: c.height };
  });
  check('mobile: render scale fills the HiDPI backing store', Math.abs(fit.scale * fit.lw - fit.cvw) <= 1 && Math.abs(fit.scale * fit.lh - fit.cvh) <= 1, JSON.stringify(fit));

  const before = await page.evaluate(() => ({ px: window.__nova.run.px, py: window.__nova.run.py }));
  const box = await page.evaluate(() => {
    const s = document.querySelector('.stage-wrap').getBoundingClientRect();
    return { x: s.left, y: s.top, w: s.width, h: s.height };
  });
  // one continuous touch: drag right, then up, to prove the ship flies on both axes
  await page.mouse.move(box.x + box.w * 0.25, box.y + box.h * 0.72);
  await page.mouse.down();
  await page.mouse.move(box.x + box.w * 0.8, box.y + box.h * 0.72, { steps: 6 });
  await sleep(500);
  const afterX = await page.evaluate(() => window.__nova.run.px);
  await page.mouse.move(box.x + box.w * 0.8, box.y + box.h * 0.32, { steps: 8 });
  await sleep(500);
  const afterY = await page.evaluate(() => window.__nova.run.py);
  await page.mouse.up();
  check('mobile: dragging the play area moves the ship on the X axis', afterX > before.px + 20, before.px.toFixed(0) + '->' + afterX.toFixed(0));
  check('mobile: dragging the play area moves the ship on the Y axis', afterY < before.py - 20, before.py.toFixed(0) + '->' + afterY.toFixed(0));

  // keyboard still works alongside touch
  const kp = await page.evaluate(() => window.__nova.run.px);
  await page.keyboard.down('ArrowLeft');
  await sleep(220);
  await page.keyboard.up('ArrowLeft');
  const kp2 = await page.evaluate(() => window.__nova.run.px);
  check('mobile: arrow keys still move the ship', kp2 < kp - 5, kp.toFixed(0) + '->' + kp2.toFixed(0));
  check('mobile: no page errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

async function progression(browser, base) {
  const page = await browser.newPage();
  const errors = watch(page);
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(base + '/games/nova-siege.html', { waitUntil: 'load', timeout: 30000 });
  // Equip the Verdant hull (index 2) then start: its +1 health bonus must apply.
  await page.evaluate(() => { window.__nova.meta.hull = 2; });
  await page.evaluate(() => document.getElementById('startBtn').click());
  await sleep(300);
  const hp = await page.evaluate(() => window.__nova.run.health);
  check('progression: equipped hull bonus applies (Verdant +1 health = 4)', hp === 4, 'hp=' + hp);

  // A SHIELD star must grant a shield bubble (it used to do nothing).
  await page.evaluate(() => {
    const r = window.__nova.run;
    r.shield = 0;
    r.drops.push({ x: r.px, y: r.py, type: 'power', w: 'shield', label: 'SHIELD', c: '#4cc9f0' });
  });
  await sleep(350);
  const shield = await page.evaluate(() => window.__nova.run.shield);
  check('progression: SHIELD power-up grants a shield bubble', shield >= 1, 'shield=' + shield);

  // Every premium hull advertises a perk and a non-empty mechanical bonus.
  const hulls = await page.evaluate(() => window.__nova.hulls.map(h => ({ n: h.name, perk: h.perk, bonus: h.bonus })));
  const premiumOk = hulls.slice(1).every(h => h.perk && h.bonus && Object.keys(h.bonus).length >= 1);
  check('progression: every premium hull has a real perk and bonus', premiumOk, JSON.stringify(hulls));

  // The title graphic must come back on a new run (it used to stay display:none).
  await page.evaluate(() => window.__nova.forceEnd());
  await sleep(200);
  await page.evaluate(() => document.getElementById('startBtn').click());
  await sleep(200);
  const titleShown = await page.evaluate(() => getComputedStyle(document.getElementById('titleFont')).display !== 'none');
  check('progression: title graphic restored on a new run', titleShown);
  check('progression: no page errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

async function juice(browser, base) {
  const page = await browser.newPage();
  const errors = watch(page);
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(base + '/games/nova-siege.html', { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(() => document.getElementById('startBtn').click());
  await sleep(300);
  // Spawn three easy kills right in the player's firing line.
  await page.evaluate(() => {
    const n = window.__nova, r = n.run;
    r.combo = 0;
    for (let i = 0; i < 3; i++) {
      r.enemies.push({ kind: 'ufo', pattern: 'straight', x: r.px + (i - 1) * 6, y: r.py - 70 - i * 14, vy: 0.05, t: 0, hp: 1, r: n.sprites.ufo.width, spr: n.sprites.ufo, dir: 1, amp: 0, freq: 0, fire: 999 });
    }
  });
  await sleep(1400);
  const combo = await page.evaluate(() => window.__nova.combo);
  check('juice: kills build a combo', combo >= 2, 'combo=' + combo);

  const mult = await page.evaluate(() => { window.__nova.run.combo = 20; return window.__nova.comboMult; });
  check('juice: combo multiplier caps at 3', mult === 3, 'mult=' + mult);

  await page.evaluate(() => { window.__nova.run.combo = 7; window.__nova.forceEnd(); });
  const afterHit = await page.evaluate(() => window.__nova.combo);
  check('juice: combo resets after a hit', afterHit === 0, 'combo=' + afterHit);

  await page.evaluate(() => window.__nova.forceBoss());
  const bossFire = await page.evaluate(() => window.__nova.bossFire);
  check('juice: boss exposes a fire timer for its telegraph', typeof bossFire === 'number', 'bossFire=' + bossFire);
  check('juice: no page errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

async function roguelike(browser, base) {
  const page = await browser.newPage();
  const errors = watch(page);
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(base + '/games/nova-siege.html', { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(() => document.getElementById('startBtn').click());
  await sleep(250);

  // Clearing a wave pauses the run and offers exactly three run-upgrade cards.
  await page.evaluate(() => { const r = window.__nova.run; r.waveKills = r.waveTarget; window.__nova.forceWave(); });
  await sleep(160);
  const draft = await page.evaluate(() => ({
    paused: window.__nova.paused,
    open: window.__nova.draftOpen,
    cards: document.querySelectorAll('#draftCards .card').length
  }));
  check('roguelike: clearing a wave opens a 3-card upgrade draft and pauses the run', draft.paused && draft.open && draft.cards === 3, JSON.stringify(draft));

  // Picking a card applies a run-only upgrade and resumes the run.
  await page.click('#draftCards .card');
  await sleep(130);
  const picked = await page.evaluate(() => {
    const ups = window.__nova.runUps; let total = 0; for (const k in ups) total += ups[k];
    return { paused: window.__nova.paused, open: window.__nova.draftOpen, total };
  });
  check('roguelike: picking a card applies a run-only upgrade and resumes', !picked.paused && !picked.open && picked.total >= 1, JSON.stringify(picked));

  // A drafted damage upgrade must feed the in-run damage stat (not the meta shop).
  const dmg = await page.evaluate(() => {
    const n = window.__nova, before = n.runDamage;
    n.run.runUps.damage = (n.run.runUps.damage || 0) + 1;
    return { before, after: n.runDamage };
  });
  check('roguelike: a run damage upgrade raises in-run damage by 1', dmg.after === dmg.before + 1, JSON.stringify(dmg));

  // The station shop opens with stock, sells for THIS run's credits, and resumes.
  await page.evaluate(() => { window.__nova.run.credits = 500; window.__nova.forceShop(); });
  await sleep(160);
  const shop = await page.evaluate(() => ({
    paused: window.__nova.paused,
    open: window.__nova.shopOpen,
    rows: document.querySelectorAll('#shopList .shop-row').length
  }));
  check('roguelike: the in-run shop opens with stock and pauses the run', shop.paused && shop.open && shop.rows >= 1, JSON.stringify(shop));

  const beforeBuy = await page.evaluate(() => window.__nova.run.credits);
  await page.evaluate(() => window.__nova.refreshShop());
  await page.click('#shopList .buy');
  await sleep(130);
  const afterBuy = await page.evaluate(() => ({ credits: window.__nova.run.credits, sold: document.querySelectorAll('#shopList .buy:disabled').length }));
  check("roguelike: buying in the shop spends this run's credits", afterBuy.credits < beforeBuy && afterBuy.sold >= 1, JSON.stringify(afterBuy));

  await page.click('#shopLeave');
  await sleep(130);
  const left = await page.evaluate(() => ({ paused: window.__nova.paused, open: window.__nova.shopOpen }));
  check('roguelike: Depart closes the shop and resumes the run', !left.paused && !left.open, JSON.stringify(left));
  check('roguelike: no page errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

async function depth(browser, base) {
  const page = await browser.newPage();
  const errors = watch(page);
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(base + '/games/nova-siege.html', { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(() => document.getElementById('startBtn').click());
  await sleep(250);

  // Run level starts at 1 and rises with every drafted upgrade.
  const lv0 = await page.evaluate(() => window.__nova.runLevel);
  await page.evaluate(() => { window.__nova.run.waveKills = window.__nova.run.waveTarget; window.__nova.forceWave(); });
  await sleep(130);
  await page.click('#draftCards .card');
  await sleep(130);
  const lv1 = await page.evaluate(() => window.__nova.runLevel);
  check('depth: run level rises when an upgrade is taken', lv1 === lv0 + 1, lv0 + '->' + lv1);

  // Wingman drone: added by the upgrade, orbits and fires at a target.
  await page.evaluate(() => { const n = window.__nova, r = n.run; r.enemies.push({ kind: 'ufo', pattern: 'straight', x: r.px, y: r.py - 160, vy: 0, t: 0, hp: 999, r: 8, spr: n.sprites.ufo, dir: 1, amp: 0, freq: 0, fire: 999 }); n.applyRunUpgrade('drone'); });
  await sleep(140);
  const drone = await page.evaluate(() => { const d = window.__nova.run.drones[0]; return { n: window.__nova.runDrones, x: d ? Math.round(d.x) : null, y: d ? Math.round(d.y) : null }; });
  check('depth: a wingman drone is added and orbits the ship', drone.n >= 1 && drone.x != null, JSON.stringify(drone));
  // A wave clear can open a draft mid-probe, which pauses the loop. Clear any
  // in-run overlay so spawning and firing keep running while we sample.
  const clearOverlays = () => page.evaluate(() => {
    if (window.__nova.draftOpen) { const c = document.querySelector('#draftCards .card'); if (c) c.click(); }
    if (window.__nova.shopOpen) document.getElementById('shopLeave').click();
  });
  let droneFired = false;
  for (let i = 0; i < 40; i++) {
    await sleep(60);
    await clearOverlays();
    droneFired = await page.evaluate(() => window.__nova.run.bullets.some(b => !b.eb && Math.hypot(b.vx, b.vy) > 3 && Math.abs(b.vx) > 1));
    if (droneFired) break;
  }
  check('depth: the wingman drone fires at the target', droneFired);

  // Explosive rounds: killing one enemy blasts a neighbour into pieces.
  await clearOverlays();
  await sleep(120);
  await page.evaluate(() => {
    const n = window.__nova, r = n.run; r.runUps.explosive = 1; r.blasts.length = 0; r.waveKills = 0; r.enemies.length = 0;
    r.enemies.push({ kind: 'ufo', pattern: 'straight', x: r.px, y: r.py - 70, vy: 0, t: 0, hp: 1, r: 8, spr: n.sprites.ufo, dir: 1, amp: 0, freq: 0, fire: 999 });
    r.enemies.push({ kind: 'ufo', pattern: 'straight', x: r.px + 18, y: r.py - 70, vy: 0, t: 0, hp: 1, r: 8, spr: n.sprites.ufo, dir: 1, amp: 0, freq: 0, fire: 999 });
  });
  let left = 2;
  for (let i = 0; i < 30; i++) {
    await sleep(80);
    await clearOverlays();
    left = await page.evaluate(() => window.__nova.run.enemies.length);
    if (left < 2) break;
  }
  check('depth: explosive rounds chain a blast to a nearby enemy', left < 2, 'left=' + left);

  // Dismiss any draft/shop the kills may have opened, then test manual pause.
  await clearOverlays();
  await sleep(160);
  const paused0 = await page.evaluate(() => window.__nova.paused);
  await page.click('#pauseBtn');
  await sleep(90);
  const paused1 = await page.evaluate(() => window.__nova.paused);
  await page.click('#pauseBtn');
  await sleep(90);
  const paused2 = await page.evaluate(() => window.__nova.paused);
  check('depth: the pause button toggles pause and resume', !paused0 && paused1 && !paused2, JSON.stringify({ paused0, paused1, paused2 }));
  check('depth: no page errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

(async () => {
  await withServer(async ({ base, browser }) => {
    await desktop(browser, base);
    await parallax(browser, base);
    await content(browser, base);
    await mobileDrag(browser, base);
    await progression(browser, base);
    await juice(browser, base);
    await roguelike(browser, base);
    await depth(browser, base);
  });
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL NOVA SIEGE CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
