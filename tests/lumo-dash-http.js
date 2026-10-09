#!/usr/bin/env node
/*
 * tests/lumo-dash-http.js - A967
 *
 * Lumo's Dash was rebuilt from the pattern-memory mini-game into the single
 * endless-runner side-scroller starring Lumo the purple fox, and the duplicate
 * "Lumo's Run" game was retired into a redirect.
 *
 * This test proves:
 *   - the game loads with no errors at 390 and 1440 and the fox sprite resolves
 *   - jump and slide actually move the fox
 *   - death shows the game-over modal above the fullscreen canvas (not hidden)
 *   - the page copy says "fox", never "firefly"
 *   - lumo-run.html redirects to lumo-dash.html
 *
 * Run: node tests/lumo-dash-http.js
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
  const responses = {};
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/ERR_|Failed to load resource|favicon|Manifest/.test(t)) return;
    errors.push('console: ' + t);
  });
  page.on('response', r => { responses[r.url()] = r.status(); });
  return { errors, responses };
}

async function desktop(browser, base) {
  const page = await browser.newPage();
  const { errors, responses } = watch(page);
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(base + '/games/lumo-dash.html', { waitUntil: 'load', timeout: 30000 });
  await sleep(300);
  const info = await page.evaluate(() => ({
    title: document.title,
    canvas: !!document.getElementById('game'),
    startVisible: !document.getElementById('startScreen').classList.contains('hidden'),
    body: document.body.textContent.toLowerCase(),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  }));
  check('desktop: title names Lumo', /lumo/i.test(info.title), info.title);
  check('desktop: canvas present', info.canvas);
  check('desktop: start screen visible', info.startVisible);
  check('desktop: copy says fox and never firefly', info.body.includes('fox') && !info.body.includes('firefly'));
  check('desktop: fox sprite responded 200', Object.entries(responses).some(([u, s]) => /chars\/lumo\.png/.test(u) && s === 200),
    Object.entries(responses).filter(([u]) => /lumo\.png/.test(u)).map(([u, s]) => s).join(','));
  check('desktop: no horizontal overflow', info.overflow <= 2, String(info.overflow));
  check('desktop: no page errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

async function mobile(browser, base) {
  const page = await browser.newPage();
  const errors = watch(page).errors;
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(base + '/games/lumo-dash.html', { waitUntil: 'load', timeout: 30000 });

  await page.evaluate(() => { if (window.JVDSGameShell) window.JVDSGameShell.enter(); });
  await page.evaluate(() => document.getElementById('playBtn').click());
  await sleep(300);

  const root = await page.evaluate(() => (document.querySelector('.jvds-root') || {}).className || null);
  check('mobile: fullscreen root is the game shell, not the canvas', !!root && root.includes('game-wrap'), root || 'none');

  // jump: fox leaves the ground then lands again
  await page.evaluate(() => document.getElementById('jumpBtn').click());
  let lifted = false, airborne = false, landed = false;
  for (let i = 0; i < 60; i++) {
    await sleep(20);
    const s = await page.evaluate(() => ({ y: window.__lumo.y, g: window.__lumo.groundY, grounded: window.__lumo.grounded }));
    if (s.y < s.g - 8) lifted = true;
    if (!s.grounded) airborne = true;
    if (airborne && s.grounded) { landed = true; break; }
  }
  check('mobile: jump lifts the fox off the ground', lifted);
  check('mobile: fox lands again after a jump', landed);

  // slide: duck below the branch line
  await page.evaluate(() => document.getElementById('slideBtn').click());
  let slid = false;
  for (let i = 0; i < 20 && !slid; i++) {
    await sleep(20);
    slid = await page.evaluate(() => window.__lumo.sliding);
  }
  check('mobile: slide makes the fox duck', slid === true);

  // death: keep running until an obstacle catches the fox
  let death = null;
  for (let i = 0; i < 200 && !death; i++) {
    await sleep(90);
    death = await page.evaluate(() => {
      if (!window.__lumo || !window.__lumo.dead) return null;
      const m = document.querySelector('.sr-modal.show');
      const c = document.getElementById('game');
      const center = document.elementFromPoint(195, 420);
      return {
        shown: !!m,
        modalZ: m ? parseInt(getComputedStyle(m).zIndex, 10) : null,
        canvasZ: parseInt(getComputedStyle(c).zIndex, 10) || 0,
        modalOnTop: !!(m && center && m.contains(center))
      };
    });
  }
  check('mobile: running into traffic ends the run', !!death);
  check('mobile: game-over modal is shown', !!(death && death.shown));
  check('mobile: game-over modal sits above the fullscreen canvas',
    !!(death && death.modalOnTop && death.modalZ > death.canvasZ),
    death ? 'modal z-' + death.modalZ + ' canvas z-' + death.canvasZ : 'n/a');

  const show = await page.evaluate(() => ({
    goal: (document.getElementById('goalHud') || {}).textContent,
    milestone: window.__lumo.milestone,
    shakeHits: window.__lumo.shakeHits
  }));
  check('showcase: goal is shown in the HUD', /m$/.test(show.goal || ''), show.goal);
  check('showcase: milestone progression is armed',
    [50, 100, 200, 400, null].includes(show.milestone), String(show.milestone));
  check('showcase: crash triggers a screen shake', show.shakeHits >= 1, 'hits=' + show.shakeHits);

  await page.evaluate(() => document.querySelector('.sr-again')?.click());
  await sleep(400);
  const restarted = await page.evaluate(() => ({ running: window.__lumo.running, dead: window.__lumo.dead }));
  check('mobile: play again restarts a live run', restarted.running && !restarted.dead, JSON.stringify(restarted));
  check('mobile: no page errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

async function redirect(browser, base) {
  const page = await browser.newPage();
  await page.goto(base + '/games/lumo-run.html', { waitUntil: 'load', timeout: 30000 });
  await sleep(600);
  const url = page.url();
  check('lumo-run.html redirects to lumo-dash.html', /\/games\/lumo-dash\.html$/.test(url), url);
  await page.close();
}

async function parallax(browser, base) {
  const page = await browser.newPage();
  const errors = watch(page).errors;
  await page.setViewport({ width: 1000, height: 700 });
  await page.goto(base + '/games/lumo-dash.html', { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(() => document.getElementById('playBtn').click());
  await sleep(450);
  const a = await page.evaluate(() => ({ p: window.__lumo.parallax, w: document.getElementById('game').width }));
  await sleep(320);
  const b = await page.evaluate(() => window.__lumo.parallax);

  const median = arr => { const s = [...arr].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  const delta = (x1, x2, w) => {
    const out = [];
    for (let i = 0; i < Math.min(x1.length, x2.length); i++) {
      const d = Math.abs(x2[i] - x1[i]);
      if (d < w * 0.4) out.push(d); // drop items that wrapped across the screen
    }
    return median(out);
  };
  const bg = a.p.speeds.background.map((_, i) => delta(a.p.layers[i], b.layers[i], a.w));
  const fg = delta(a.p.foreground, b.foreground, a.w);
  const gr = delta(a.p.ground, b.ground, a.w);

  check('parallax: at least four background layers', a.p.speeds.background.length >= 4, a.p.speeds.background.join(','));
  check('parallax: every environment layer has trees', a.p.layers.every(l => l.length > 0), a.p.layers.map(l => l.length).join('/'));
  let increasing = true;
  for (let i = 1; i < bg.length; i++) if (bg[i] <= bg[i - 1]) increasing = false;
  check('parallax: each layer scrolls faster than the one behind it', increasing, bg.map(x => x.toFixed(1)).join(' < '));
  check('parallax: foreground scrolls faster than the ground', fg > gr && gr > 0, 'fg=' + fg.toFixed(1) + ' ground=' + gr.toFixed(1));
  check('parallax: no page errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

(async () => {
  await withServer(async ({ base, browser }) => {
    await desktop(browser, base);
    await parallax(browser, base);
    await mobile(browser, base);
    await redirect(browser, base);
  });
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL LUMO DASH CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
