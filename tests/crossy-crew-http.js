#!/usr/bin/env node
/*
 * tests/crossy-crew-http.js
 *
 * Regression guard for games/crossy-crew.html.
 *
 * Two mobile defects shipped with the game:
 *   1. On touch devices game-shell.js picked the <canvas id="game"> as the
 *      fullscreen root, so the on-screen D-pad sat behind the fixed canvas.
 *      Every tap on the board became a forward hop, so the player could not
 *      move left or right.
 *   2. On death the shared StoryRun game-over modal (z-index 9999) rendered
 *      behind the fullscreen canvas (z-index 99990). The loop stops on death,
 *      so the frozen board looked like a crash with no way to restart.
 *
 * The fix gives the game shell the immersive root + storyrun host, keeps one
 * animation loop, and lifts the game-over modal above the shell. This test
 * forces the immersive path (the same one a real Start tap takes) and proves
 * the D-pad is reachable, left/right hops move the frog, and the game-over
 * screen is visible on top.
 *
 * Run: node tests/crossy-crew-http.js
 */
const { withServer } = require('./story-run-harness.cjs');

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

function watchErrors(page) {
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
  const errors = watchErrors(page);
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(base + '/games/crossy-crew.html', { waitUntil: 'load', timeout: 30000 });
  const info = await page.evaluate(() => ({
    title: document.title,
    canvas: !!document.getElementById('game'),
    startVisible: !document.getElementById('startScreen').classList.contains('hidden'),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  }));
  check('desktop: title loads', info.title.includes('Crossy Crew'), info.title);
  check('desktop: canvas present', info.canvas);
  check('desktop: start screen visible', info.startVisible);
  check('desktop: no horizontal overflow', info.overflow <= 2, String(info.overflow));
  check('desktop: no page errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

async function mobile(browser, base) {
  const page = await browser.newPage();
  const errors = watchErrors(page);
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(base + '/games/crossy-crew.html', { waitUntil: 'load', timeout: 30000 });

  // Real touch Start also enters immersive fullscreen; force the same path so
  // the test is not skipped by puppeteer's navigator.webdriver guard.
  await page.evaluate(() => { if (window.JVDSGameShell) window.JVDSGameShell.enter(); });
  await page.evaluate(() => document.getElementById('playBtn').click());
  await sleep(300);

  const reach = await page.evaluate(() => {
    const at = id => {
      const r = document.getElementById(id).getBoundingClientRect();
      const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return e ? (e.id || e.tagName) : null;
    };
    const root = document.querySelector('.jvds-root');
    return {
      rootClass: root ? root.className : null,
      left: at('dLeft'), right: at('dRight'), up: at('dUp'), down: at('dDown')
    };
  });
  check('mobile: fullscreen root is the game shell, not the canvas',
    !!reach.rootClass && reach.rootClass.includes('game-wrap'), reach.rootClass || 'none');
  check('mobile: D-pad left is reachable', reach.left === 'dLeft', String(reach.left));
  check('mobile: D-pad right is reachable', reach.right === 'dRight', String(reach.right));
  check('mobile: D-pad up is reachable', reach.up === 'dUp', String(reach.up));
  check('mobile: D-pad down is reachable', reach.down === 'dDown', String(reach.down));

  const col0 = await page.evaluate(() => window.__crossy.col);
  await page.evaluate(() => document.getElementById('dLeft').click());
  await sleep(150);
  const colL = await page.evaluate(() => window.__crossy.col);
  await page.evaluate(() => document.getElementById('dRight').click());
  await page.evaluate(() => document.getElementById('dRight').click());
  await sleep(150);
  const colR = await page.evaluate(() => window.__crossy.col);
  check('mobile: left hop moves the frog left', colL === col0 - 1, col0 + '->' + colL);
  check('mobile: right hops move the frog right', colR === colL + 2, colL + '->' + colR);

  // Idle for longer than the game's 6s "too slow" timer (or a traffic hit) to
  // reach the game-over screen.
  await sleep(7200);
  const death = await page.evaluate(() => {
    const m = document.querySelector('.sr-modal.show');
    const c = document.getElementById('game');
    const center = document.elementFromPoint(195, 420);
    return {
      shown: !!m,
      modalZ: m ? parseInt(getComputedStyle(m).zIndex, 10) : null,
      canvasZ: parseInt(getComputedStyle(c).zIndex, 10) || 0,
      modalOnTop: !!(m && center && m.contains(center)),
      dead: !!(window.__crossy && window.__crossy.dead)
    };
  });
  check('mobile: reaching the end shows a game-over state', death.dead);
  check('mobile: game-over modal is shown', death.shown);
  check('mobile: game-over modal sits above the fullscreen canvas',
    death.modalOnTop && death.modalZ > death.canvasZ,
    'modal z-' + death.modalZ + ' canvas z-' + death.canvasZ);

  await page.evaluate(() => document.querySelector('.sr-again')?.click());
  await sleep(500);
  const restarted = await page.evaluate(() => ({
    running: window.__crossy.running, dead: window.__crossy.dead, row: window.__crossy.row
  }));
  check('mobile: play again restarts a live run',
    restarted.running && !restarted.dead && restarted.row === 0, JSON.stringify(restarted));
  check('mobile: no page errors', errors.length === 0, errors.join(' | '));
  await page.close();
}

(async () => {
  await withServer(async ({ base, browser }) => {
    await desktop(browser, base);
    await mobile(browser, base);
  });
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL CROSSY CREW CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
