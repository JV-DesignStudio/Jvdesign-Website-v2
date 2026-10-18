/* games-first-win.js (A1673): prove a run can actually be started and played.

   The other game suites only prove a page loads, has an interactive surface,
   survives touch and can restart (tests/games-mobile-touch.js,
   tests/games-keep-rule.js). None of them prove a run can be played to a score,
   a win or a finish, so "playable and fun" was asserted, not measured.

   This drives real input into every catalogued game - clicks the start control,
   sends arrow/space keys, taps and pointer drags - then checks the game left the
   start state and something progressed (a HUD/score/timer number changed, the
   canvas animated, or a run-end overlay appeared). It prints a per-game baseline.

   Method: before = numbers on the page + a canvas fingerprint; after = the same
   after input. Progress = any of: numbers changed, canvas fingerprint changed,
   or an end/game-over overlay appeared.

   Run: node tests/games-first-win.js
*/
const fs = require('fs'), http = require('http'), path = require('path'), vm = require('vm');
const puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4' };

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'games-registry.js'), 'utf8'), ctx);
const GAMES = ctx.window.JVDS_GAMES;

const R = path.normalize(ROOT);
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.normalize(path.join(ROOT, u));
  if (!f.startsWith(R) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

const START_SELECTOR = '[data-jvds-play],#startBtn,#btnStart,#startGame,#start,#playBtn,#modalPrimary,.rune-btn,.btn-play,.pz-play';
const START_TEXT = /^(play|start|begin|go|serve|hop|tap to start|start hopping|start run|start game|new game)\b/i;
const END_RE = /game over|you (won|lost|survived|made)|final score|try again|play again|squished|well done|you win|constellation complete|run over|out of/i;

const snapshot = () => {
  const text = document.body ? document.body.innerText : '';
  const nums = (text.match(/\d+/g) || []).join(',');
  let canvas = null;
  const c = document.querySelector('canvas');
  if (c) { try { const d = c.toDataURL('image/png'); let h = 0; for (let i = 0; i < d.length; i += 61) h = (h * 31 + d.charCodeAt(i)) >>> 0; canvas = d.length + ':' + h; } catch (e) { canvas = 'blocked'; } }
  return { nums, canvas };
};

let failures = 0;
const results = [];
function check(name, ok, detail = '') { console.log((ok ? '  PASS ' : '  FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; }

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] });

  try {
    for (const g of GAMES) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message.split('\n')[0].slice(0, 70)));
      page.on('console', m => { if (m.type() === 'error' && !/ERR_NETWORK|Failed to load resource|ERR_ABORTED|ERR_FILE|ERR_FAILED|fullscreen|Fullscreen/i.test(m.text())) errors.push(m.text().slice(0, 70)); });
      await page.setRequestInterception(true);
      page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') || r.url().startsWith('blob:') ? r.continue() : r.abort());
      await page.setViewport({ width: 1280, height: 900 });

      let outcome = 'error';
      try {
        await page.goto(base + '/games/' + g.file, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await new Promise(r => setTimeout(r, 700));

        const before = await page.evaluate(snapshot);
        const funnelPresent = await page.evaluate(() => !!(window.JVDSFunnel && typeof window.JVDSFunnel.steps === 'function'));
        check(g.id + ': first-play funnel module is wired', funnelPresent, funnelPresent ? '' : 'window.JVDSFunnel missing');
        const startedOverlay = await page.evaluate((sel, re) => {
          const rx = new RegExp(re, 'i');
          const vis = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 1 && r.height > 1 && s.display !== 'none' && s.visibility !== 'hidden'; };
          return [...document.querySelectorAll('button,a,[role="button"],.overlay,#startScreen')].some(el => vis(el) && (el.matches(sel) || rx.test((el.textContent || '').trim())));
        }, START_SELECTOR, START_TEXT.source);

        // Start the run: honour the declared control (data-jvds-play), else the text heuristic.
        await page.evaluate((sel) => {
          const vis = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 1 && r.height > 1 && s.display !== 'none' && s.visibility !== 'hidden' && s.pointerEvents !== 'none'; };
          const declared = [...document.querySelectorAll('[data-jvds-play],' + sel)].filter(vis);
          const byText = [...document.querySelectorAll('button,a,[role="button"]')].filter(vis)
            .find(el => /play|start|begin|go|serve|hop|new kingdom|new game/i.test((el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '')));
          const b = declared[0] || byText;
          if (b) b.click();
        }, START_SELECTOR);
        await new Promise(r => setTimeout(r, 500));
        // Clear any how-to / continue overlay that appears after the first click.
        await page.evaluate(() => {
          const vis = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 1 && r.height > 1 && s.display !== 'none' && s.visibility !== 'hidden'; };
          const b = [...document.querySelectorAll('button,[role="button"]')].filter(vis)
            .find(el => /got it|how to|continue|let's go|lets go|^ok$|next/i.test((el.textContent || '').trim()));
          if (b) b.click();
        });
        await new Promise(r => setTimeout(r, 500));

        // Send a mixed burst of real input on the play area.
        const keys = ['ArrowUp', 'ArrowRight', 'Space', 'ArrowLeft', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW'];
        for (const k of keys) { try { await page.keyboard.press(k); } catch (e) {} await new Promise(r => setTimeout(r, 90)); }
        for (let i = 0; i < 10; i++) {
          try { await page.mouse.move(640, 450); await page.mouse.down(); await page.mouse.move(500 + i * 20, 400 + i * 8, { steps: 3 }); await page.mouse.up(); } catch (e) {}
          try { await page.touchscreen.tap(600, 430); } catch (e) {}
          try { await page.evaluate(() => { const c = document.querySelector('canvas') || document.body; ['pointerdown', 'pointermove', 'pointerup'] .forEach(t => c.dispatchEvent(new PointerEvent(t, { clientX: 620, clientY: 440, bubbles: true }))); }); } catch (e) {}
          await new Promise(r => setTimeout(r, 130));
        }
        await new Promise(r => setTimeout(r, 1200));

        const after = await page.evaluate(snapshot);
        const endVisible = await page.evaluate(re => new RegExp(re, 'i').test(document.body.innerText), END_RE.source);
        const numsChanged = before.nums !== after.nums;
        const canvasChanged = before.canvas && after.canvas && before.canvas !== after.canvas;
        const progressed = numsChanged || canvasChanged || endVisible;
        outcome = progressed ? 'progress' : 'no-progress';
        results.push({ id: g.id, q: g.quality, progressed, numsChanged, canvasChanged, endVisible, errors: errors.length });
        check(g.id + ' (' + g.quality + '): run starts and progresses', progressed,
          [numsChanged ? 'numbers changed' : '', canvasChanged ? 'canvas animated' : '', endVisible ? 'run ended' : ''].filter(Boolean).join(' + ') || 'nothing changed' + (errors.length ? ' | errors: ' + errors[0] : ''));
        if (startedOverlay && !progressed) console.log('       (a start control was visible before play)');
      } catch (e) {
        check(g.id + ': run starts and progresses', false, 'harness error: ' + e.message.slice(0, 60));
        results.push({ id: g.id, q: g.quality, progressed: false, error: e.message.slice(0, 60) });
      }
      await page.close();
    }
  } finally {
    await browser.close();
    await new Promise(r => server.close(r));
  }

  const ok = results.filter(r => r.progressed).length;
  console.log('\nfirst-win baseline: ' + ok + '/' + GAMES.length + ' catalogued games start and progress');
  console.log('  progressing: ' + results.filter(r => r.progressed).map(r => r.id).join(', '));
  const stuck = results.filter(r => !r.progressed).map(r => r.id);
  if (stuck.length) console.log('  no-progress: ' + stuck.join(', '));
  console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL CATALOGUED GAMES START AND PROGRESS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
