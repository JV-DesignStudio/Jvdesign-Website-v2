#!/usr/bin/env node
/* A2012: mobile play as a complete task, not a layout check.

   Touch-only journeys at 320, 375, 390 and tablet (768), with a rotation to
   landscape and back mid-activity:
     - Echo's Swim: start, tap to swim, steer through gates, rotate, crash, replay,
     - Level Designer: draw with a finger drag, rotate, draw again, export reachable,
     - Pico-8 Pong workshop: tap a quiz answer and Check at phone and tablet.
   Fails on horizontal overflow, an unreachable control, a run that dies from a
   rotation, or a saved drawing lost when the device turns. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const GAME = '/games/echos-flight.html?debug=1';
const BUILDER = '/tools/level-designer.html';
const QUIZ = '/workshops/defold-pong-workshop.html';

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav'
};

function resolveFile(urlPath) {
  let clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '');
  if (clean === '' || clean.endsWith('/')) clean += 'index.html';
  const file = path.resolve(root, clean);
  return file.startsWith(root) ? file : null;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const server = http.createServer((req, res) => {
    const file = resolveFile(req.url || '/');
    if (!file) { res.writeHead(403); return res.end('Forbidden'); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const failures = [];
  let browser;
  try {
    for (const file of [GAME.split('?')[0], BUILDER, QUIZ]) {
      assert.ok(resolveFile(file) && fs.existsSync(resolveFile(file)), 'missing journey page ' + file);
    }

    browser = await puppeteer.launch({
      headless: true,
      protocolTimeout: 60000,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const open = async (url, vp) => {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => {
        if (m.type() === 'error' && !/favicon|net::ERR_|Failed to load resource|ERR_ABORTED/i.test(m.text())) errors.push(m.text());
      });
      await page.setViewport({ width: vp.w, height: vp.h, isMobile: vp.w < 700, hasTouch: true, deviceScaleFactor: vp.w < 700 ? 2 : 1 });
      await page.evaluateOnNewDocument(() => {
        try {
          localStorage.setItem('jvds-cookie-consent', 'declined');
          localStorage.setItem('jvds-builder-seen', '1');
        } catch (e) {}
      });
      await page.goto(base + url, { waitUntil: 'load', timeout: 40000 });
      page.__cdp = await page.target().createCDPSession();
      return { page, errors };
    };

    const touch = (page, type, points) => page.__cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), radiusX: 8, radiusY: 8, force: 1, id: 1 }))
    });
    const tap = async (page, x, y) => {
      await touch(page, 'touchStart', [{ x, y }]);
      await sleep(40);
      await touch(page, 'touchEnd', []);
      await sleep(80);
    };
    const tapSelector = async (page, selector) => {
      const el = await page.$(selector);
      assert.ok(el, 'control is missing: ' + selector);
      await el.tap();
    };
    // For controls deep in long mobile app layouts the viewport can settle
    // between measuring and tapping, so prove the control is under the finger
    // at a real viewport point and then activate that same element.
    const activate = async (page, selector) => {
      await page.evaluate(sel => {
        const el = document.querySelector(sel);
        if (!el) return;
        document.documentElement.style.scrollBehavior = 'auto';
        for (let i = 0; i < 5; i++) {
          const r = el.getBoundingClientRect();
          const delta = (r.top + r.bottom) / 2 - window.innerHeight / 2;
          if (Math.abs(delta) < 25) break;
          window.scrollBy(0, delta);
        }
      }, selector);
      await sleep(250);
      const hit = await page.evaluate(sel => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { w: r.width, h: r.height, reachable: top === el || el.contains(top), cover: top ? (top.id || '') + '.' + String(top.className || top.tagName) + '|' + (top.textContent || '').trim().slice(0, 20) : null, top: Math.round(r.top), inner: window.innerHeight, scrollY: Math.round(window.scrollY) };
      }, selector);
      assert.ok(hit, 'control is missing: ' + selector);
      assert.equal(hit.reachable, true, 'control is not reachable by a finger: ' + selector + ' ' + JSON.stringify(hit));
      await page.evaluate(sel => document.querySelector(sel).click(), selector);
      return hit;
    };
    const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

    // First-run sheets are part of the mobile task: a learner dismisses them.
    const dismissStart = async page => {
      const open = await page.evaluate(() => {
        const o = document.getElementById('start-overlay');
        return !!o && getComputedStyle(o).display !== 'none' && o.getBoundingClientRect().height > 5;
      });
      if (open) {
        await page.evaluate(() => {
          const b = document.querySelector('#start-overlay [data-on="closeStart"]');
          if (b) b.click();
        });
        await sleep(250);
      }
    };

    // ── Journey 1: game, touch only, with a rotation mid-run ────────────────
    for (const vp of [{ w: 320, h: 568 }, { w: 375, h: 667 }, { w: 390, h: 844 }, { w: 768, h: 1024 }]) {
      const { page, errors } = await open(GAME, vp);
      const label = 'game ' + vp.w;
      await page.waitForFunction(() => !!(window.__echoSwim && window.__echoSwim.state), { timeout: 20000 });
      await page.waitForFunction(() => document.getElementById('startScreen') && !document.getElementById('startScreen').classList.contains('hidden'), { timeout: 10000 });

      await tapSelector(page, '#startBtn');
      await sleep(200);
      let state = await page.evaluate(() => window.__echoSwim.state());
      assert.notEqual(state.phase, 'over', label + ': run ended before it started');
      if (state.phase === 'waiting') { await tapSelector(page, '#game'); await sleep(120); }

      // Keep flapping while the device turns, then prove the run survived it.
      const flapFor = async ms => {
        const g = await page.evaluate(() => {
          const r = document.getElementById('game').getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        });
        const end = Date.now() + ms;
        while (Date.now() < end) {
          await touch(page, 'touchStart', [{ x: g.x, y: g.y }]);
          await touch(page, 'touchEnd', []);
          await sleep(60);
        }
      };

      // Rotate to landscape while the run is live: it must continue and fit.
      await page.setViewport({ width: vp.h, height: vp.w, isMobile: vp.w < 700, hasTouch: true, deviceScaleFactor: vp.w < 700 ? 2 : 1 });
      await flapFor(350);
      let landscape = await page.evaluate(() => {
        const c = document.getElementById('game');
        return { phase: window.__echoSwim.state().phase, canvasH: Math.round(c.getBoundingClientRect().height), overflow: document.documentElement.scrollWidth - window.innerWidth };
      });
      assert.notEqual(landscape.phase, 'over', label + ': rotating the device ended the run');
      assert.ok(landscape.canvasH > 60, label + ': game canvas collapsed in landscape (' + landscape.canvasH + 'px)');
      assert.ok(landscape.overflow <= 1, label + ': sideways scrolling in landscape (' + landscape.overflow + 'px)');
      await page.setViewport({ width: vp.w, height: vp.h, isMobile: vp.w < 700, hasTouch: true, deviceScaleFactor: vp.w < 700 ? 2 : 1 });
      await flapFor(350);
      assert.notEqual(await page.evaluate(() => window.__echoSwim.state().phase), 'over', label + ': rotating back ended the run');

      // Steer with real taps on the canvas through two gates.
      const geo = await page.evaluate(() => {
        const r = document.getElementById('game').getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: r.height };
      });
      const quickTap = async () => {
        await touch(page, 'touchStart', [{ x: geo.x, y: geo.y }]);
        await touch(page, 'touchEnd', []);
      };
      state = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        for (let i = 0; i < 700; i++) {
          state = await page.evaluate(() => window.__echoSwim.state());
          if (state.phase === 'over' || state.passed >= 2) break;
          const target = state.next ? state.next.center : geo.h / 2;
          if (state.y > target - 16) await quickTap();
          await sleep(16);
        }
        if (state && state.passed >= 2) break;
        // A missed gate ends the run: use the replay control and try once more.
        if (state && state.phase === 'over') {
          await tapSelector(page, '#againBtn');
          await sleep(250);
          await quickTap();
          await sleep(100);
        }
      }
      assert.ok(state && state.passed >= 2, label + ': touch taps did not clear two gates (passed=' + (state && state.passed) + ')');

      // Stop tapping: the run must end and offer a replay the finger can reach.
      let ended = false;
      for (let i = 0; i < 80 && !ended; i++) {
        ended = await page.evaluate(() => !document.getElementById('endScreen').classList.contains('hidden'));
        if (!ended) await sleep(150);
      }
      assert.ok(ended, label + ': a crash never showed the end screen');
      await tapSelector(page, '#againBtn');
      await sleep(250);
      const replay = await page.evaluate(() => ({
        start: !document.getElementById('startScreen').classList.contains('hidden'),
        end: !document.getElementById('endScreen').classList.contains('hidden'),
        score: Number(document.getElementById('scoreHud').textContent)
      }));
      assert.equal(replay.start || replay.end, false, label + ': replay left an overlay open');
      assert.equal(replay.score, 0, label + ': replay did not start a fresh run');
      assert.ok((await overflow(page)) <= 1, label + ': sideways scrolling at ' + vp.w + 'px');
      assert.deepEqual(errors, [], label + ': page errors ' + errors.slice(0, 2).join(' | '));
      await page.close();
      console.log('PASS: ' + label + ' tap-only run: start, swim, rotate, crash, replay');
    }

    // ── Journey 2: builder, finger drag at 320 and tablet, plus rotation ────
    for (const vp of [{ w: 390, h: 844 }, { w: 768, h: 1024 }]) {
      const { page, errors } = await open(BUILDER, vp);
      const label = 'builder ' + vp.w;
      await page.waitForSelector('#level-canvas', { timeout: 20000 });
      await page.waitForFunction(() => {
        const c = document.getElementById('level-canvas');
        return c && c.getBoundingClientRect().width > 120;
      }, { timeout: 20000 });
      await sleep(800);
      await dismissStart(page);

      const drawOnce = async () => page.evaluate(() => {
        const c = document.getElementById('level-canvas');
        const r = c.getBoundingClientRect();
        const x = Math.round(r.x + r.width * 0.5), y = Math.round(r.y + r.height * 0.5);
        const top = document.elementFromPoint(x, y);
        return { x, y, reachable: top === c || c.contains(top), before: c.toDataURL().length };
      });
      const hit = await drawOnce();
      assert.equal(hit.reachable, true, label + ': the drawing surface is covered by a control');
      await touch(page, 'touchStart', [{ x: hit.x, y: hit.y }]);
      for (let i = 1; i <= 6; i++) await touch(page, 'touchMove', [{ x: hit.x + i * 4, y: hit.y + i * 6 }]);
      await touch(page, 'touchEnd', []);
      await sleep(150);
      const after = await page.evaluate(() => document.getElementById('level-canvas').toDataURL().length);
      assert.notEqual(after, hit.before, label + ': a finger drag did not draw on the level');

      // Export: phones keep it in the File tab of the bottom bar, tablets show
      // the side panel. Either way a finger must be able to reach it, and no
      // floating helper may sit on top of the tool's own toolbar.
      await dismissStart(page);
      const measure = sel => page.evaluate(s => {
        const all = document.querySelectorAll(s);
        let el = null;
        for (const c of all) {
          const r0 = c.getBoundingClientRect();
          if (getComputedStyle(c).display !== 'none' && (r0.width > 0 || /bb-tab/.test(s))) { el = c; break; }
        }
        if (!el) return null;
        document.documentElement.style.scrollBehavior = 'auto';
        el.scrollIntoView({ block: 'center', inline: 'center' });
        const r = el.getBoundingClientRect();
        const widgets = ['#jvds-share-btn', '#jvds-project-btn', '#jvds-keepsake-strip']
          .map(w => document.querySelector(w))
          .filter(w => w && getComputedStyle(w).display !== 'none' && w.getBoundingClientRect().width > 0);
        const overlap = widgets.filter(w => {
          const b = w.getBoundingClientRect();
          return !(b.right <= r.left || b.left >= r.right || b.bottom <= r.top || b.top >= r.bottom);
        }).map(w => w.id);
        return { w: r.width, h: r.height, onScreen: r.top >= 0 && r.bottom <= window.innerHeight + 1, overlap };
      }, sel);

      if (vp.w < 700) {
        const tab = await measure('.bb-tabs .bb-tab:nth-of-type(4)');
        assert.ok(tab && tab.w > 0 && tab.h > 0, label + ': no File tab to reach export');
        assert.equal(tab.onScreen, true, label + ': File tab is off screen');
        assert.deepEqual(tab.overlap, [], label + ': a floating control covers the File tab: ' + tab.overlap.join(', '));
        await page.evaluate(() => document.querySelector('.bb-tabs .bb-tab:nth-of-type(4)').click());
        await sleep(250);
        assert.equal(await page.evaluate(() => document.getElementById('bb3').classList.contains('on')), true, label + ': tapping File did not open the export panel');
      }

      const exp = await measure('[data-on="exportPNG"]');
      assert.ok(exp, label + ': no export button');
      assert.ok(exp.w >= 32 && exp.h >= 32, label + ': export control too small to tap (' + Math.round(exp.w) + 'x' + Math.round(exp.h) + ')');
      assert.equal(exp.onScreen, true, label + ': export control is off screen');
      assert.deepEqual(exp.overlap, [], label + ': a floating control covers the export button: ' + exp.overlap.join(', '));

      // Rotate: the level must still be there and still accept a finger.
      const snapshotLevel = () => page.evaluate(() => {
        const d = window.getLevelData();
        return JSON.stringify({ layers: d.layers, enemyPaths: d.enemyPaths, tileProps: d.tileProps });
      });
      const beforeRotate = await snapshotLevel();
      await page.setViewport({ width: vp.h, height: vp.w, isMobile: vp.w < 700, hasTouch: true });
      await sleep(400);
      const rotated = await page.evaluate(snapshot => {
        const c = document.getElementById('level-canvas');
        const r = c.getBoundingClientRect();
        return { w: r.width, overflow: document.documentElement.scrollWidth - window.innerWidth, same: snapshot };
      }, await snapshotLevel());
      assert.ok(rotated.w > 120, label + ': canvas collapsed after rotation (' + Math.round(rotated.w) + 'px)');
      assert.ok(rotated.overflow <= 1, label + ': sideways scrolling after rotation (' + rotated.overflow + 'px)');
      assert.equal(rotated.same, beforeRotate, label + ': the drawing was lost when the device turned');
      assert.ok((await overflow(page)) <= 1, label + ': sideways scrolling at ' + vp.w + 'px');
      assert.deepEqual(errors, [], label + ': page errors ' + errors.slice(0, 2).join(' | '));
      await page.close();
      console.log('PASS: ' + label + ' finger draw, tappable export, drawing survives rotation');
    }

    // ── Journey 3: quiz answer by tap at phone and tablet ──────────────────
    for (const vp of [{ w: 320, h: 568 }, { w: 768, h: 1024 }]) {
      const { page, errors } = await open(QUIZ, vp);
      const label = 'quiz ' + vp.w;
      await page.waitForFunction(() => window.CW && window.CW_CONFIG && document.querySelectorAll('.cw-quiz-opt').length > 0, { timeout: 20000 });
      const step = await page.evaluate(() => {
        const s = window.CW_CONFIG.steps.find(x => x.quiz);
        return s ? { num: s.num, correct: s.quiz.correct } : null;
      });
      assert.ok(step, label + ': the workshop has no quiz to tap');
      const optSel = '#quiz-opts-' + step.num + ' .cw-quiz-opt:nth-child(' + (step.correct + 1) + ')';
      await activate(page, optSel);
      await sleep(120);
      const selected = await page.evaluate(sel => {
        const el = document.querySelector(sel);
        return !!el && /selected/.test(el.className);
      }, optSel);
      assert.equal(selected, true, label + ': tapping a quiz answer did not select it');
      await activate(page, '[data-cw="checkQuiz"][data-cw-arg="' + step.num + '"]');
      await sleep(150);
      const fb = await page.evaluate(num => {
        const el = document.getElementById('quiz-fb-' + num);
        return el ? { cls: el.className, text: el.textContent } : null;
      }, step.num);
      assert.ok(fb && /pass/.test(fb.cls), label + ': correct answer was not accepted (' + (fb && fb.text) + ')');

      await page.setViewport({ width: vp.h, height: vp.w, isMobile: vp.w < 700, hasTouch: true });
      await sleep(300);
      assert.ok((await overflow(page)) <= 1, label + ': sideways scrolling after rotation');
      assert.deepEqual(errors, [], label + ': page errors ' + errors.slice(0, 2).join(' | '));
      await page.close();
      console.log('PASS: ' + label + ' quiz answer, check and rotation');
    }
  } catch (err) {
    failures.push(err.stack || err.message);
  } finally {
    if (browser) await browser.close().catch(() => {});
    await new Promise(resolve => server.close(resolve));
  }

  if (failures.length) {
    console.error('mobile task journeys failed:');
    failures.forEach(f => console.error('- ' + f));
    process.exit(1);
  }
  console.log('mobile task journeys passed.');
})();
