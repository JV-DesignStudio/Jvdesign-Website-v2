#!/usr/bin/env node
/*
 * tests/marble-run-lab-smoke.js , A983
 *
 * The 3D Marble Run Creator used to be a flat 2D grid with fake depth: turns
 * only ever bent one way, picking a different tool on an occupied socket just
 * rotated the old part instead of swapping it, boosters sped the marble up
 * forever, and nothing told you which way a piece would send the marble.
 *
 * This drives the page in a real browser and proves the four fixes:
 *   1. a Left turn part exists and is labelled for learners,
 *   2. choosing a different tool replaces the tile on a socket,
 *   3. directional parts show an exit arrow,
 *   4. the track steps down in 3D height and a built run reaches the catcher.
 *
 * Run: node tests/marble-run-lab-smoke.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

let failures = 0;
const ok = (name, cond, detail) => {
  console.log((cond ? '  [PASS] ' : '  [FAIL] ') + name + (detail ? ' - ' + detail : ''));
  if (!cond) failures++;
};

const server = http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    for (const vp of [{ name: '390px', width: 390, height: 844 }, { name: '1440px', width: 1440, height: 900 }]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.evaluateOnNewDocument(() => { try { localStorage.setItem('jvds-marble-3d-seen', '1'); } catch (e) {} });
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 700 });
      await page.goto(base + '/games/marble-run-lab.html', { waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector('#tools [data-tool]', { timeout: 10000 });

      const tools = await page.$$eval('#tools [data-tool]', els => els.map(e => e.dataset.tool));
      ok(vp.name + ': a Left turn part exists', tools.includes('turnL'), tools.join(','));
      ok(vp.name + ': the original turn part still exists', tools.includes('turn'));
      const leftLabel = await page.$$eval('#tools [data-tool]', els => {
        const b = els.find(e => e.dataset.tool === 'turnL');
        return b ? b.textContent : '';
      });
      ok(vp.name + ': the Left part is labelled for learners', /left/i.test(leftLabel), leftLabel.replace(/\s+/g, ' ').trim());

      const swap = await page.evaluate(() => {
        loadMission(0);
        selected = 'ramp'; place(1, 1);
        const first = board[1][1] && board[1][1].type;
        selected = 'wall'; place(1, 1);
        const second = board[1][1] && board[1][1].type;
        const rot = board[1][1] && board[1][1].rot;
        return { first, second, rot };
      });
      ok(vp.name + ': a different tool replaces the tile', swap.first === 'ramp' && swap.second === 'wall' && swap.rot === 0, JSON.stringify(swap));

      const arrows = await page.evaluate(() => {
        loadMission(0);
        selected = 'ramp'; place(1, 1);
        selected = 'turn'; place(2, 1);
        selected = 'drop'; place(3, 1);
        return {
          ramp: !!document.querySelector('.piece.ramp .arrow'),
          turn: !!document.querySelector('.piece.turn .arrow'),
          drop: !!document.querySelector('.piece.drop .arrow'),
          start: !!document.querySelector('.piece.start .arrow')
        };
      });
      ok(vp.name + ': ramp/turn/drop show a direction arrow', arrows.ramp && arrows.turn && arrows.drop, JSON.stringify(arrows));
      ok(vp.name + ': the launcher does not need an arrow', !arrows.start);

      const stepped = await page.evaluate(() => {
        loadMission(0);
        for (let x = 1; x <= 7; x++) board[2][x] = { type: 'ramp', rot: 0 };
        render();
        const zs = [...document.querySelectorAll('.piece:not(.start):not(.cup)')].map(e => e.style.getPropertyValue('--z'));
        return { count: zs.length, distinct: new Set(zs).size };
      });
      ok(vp.name + ': the track steps down in 3D height', stepped.distinct > 1, stepped.distinct + ' distinct heights across ' + stepped.count + ' parts');

      await page.evaluate(() => {
        loadMission(0);
        for (let x = 1; x <= 7; x++) board[2][x] = { type: 'ramp', rot: 0 };
        render(); launch();
      });
      await page.waitForFunction(() => document.getElementById('feedback').classList.contains('good'), { timeout: 15000 }).catch(() => {});
      const fb = await page.$eval('#feedback', e => ({ cls: e.className, txt: e.textContent }));
      ok(vp.name + ': a built run reaches the catcher', /good/.test(fb.cls), fb.txt.slice(0, 60));
      const score = await page.$eval('#score', e => Number(e.textContent));
      ok(vp.name + ': completing the run scores', score > 0, String(score));

      await page.evaluate(() => { loadMission(0); selected = 'ramp'; place(1, 2); render(); launch(); });
      await page.waitForFunction(() => document.getElementById('feedback').classList.contains('bad'), { timeout: 15000 }).catch(() => {});
      const bad = await page.$eval('#feedback', e => e.className);
      ok(vp.name + ': a broken run reports a miss', /bad/.test(bad));

      if (vp.width === 1440) {
        await page.reload({ waitUntil: 'load' });
        await page.waitForSelector('#tools [data-tool]', { timeout: 10000 });

        const supports = await page.evaluate(() => {
          loadMission(0);
          for (let x = 1; x <= 4; x++) board[2][x] = { type: 'ramp', rot: 0 };
          render();
          return { posts: document.querySelectorAll('.post').length, shadows: document.querySelectorAll('.gshadow').length };
        });
        ok(vp.name + ': raised pieces get support posts', supports.posts >= 4, JSON.stringify(supports));
        ok(vp.name + ': every piece gets a ground shadow', supports.shadows >= 5, String(supports.shadows));

        const ghost = await page.evaluate(() => ({ dots: document.querySelectorAll('.ghost').length, gap: document.querySelectorAll('.ghost.gap').length }));
        ok(vp.name + ': a preview shows the route', ghost.dots > 0, String(ghost.dots));
        ok(vp.name + ': the first gap is marked', ghost.gap === 1, String(ghost.gap));

        const ur = await page.evaluate(() => {
          loadMission(0);
          selected = 'ramp'; place(1, 1);
          const after = board[1][1] && board[1][1].type;
          undo();
          const undone = board[1][1];
          redo();
          const redone = board[1][1] && board[1][1].type;
          return { after, undone, redone };
        });
        ok(vp.name + ': undo removes the last piece', ur.after === 'ramp' && ur.undone === null, JSON.stringify(ur));
        ok(vp.name + ': redo restores it', ur.redone === 'ramp');

        await page.evaluate(() => { loadMission(0); selected = 'ramp'; render(); });
        const center = (x, y) => page.$eval(`.socket[data-x="${x}"][data-y="${y}"]`, el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
        const c1 = await center(1, 3), c2 = await center(2, 3), c3 = await center(3, 3);
        await page.mouse.move(c1.x, c1.y); await page.mouse.down();
        await page.mouse.move(c2.x, c2.y, { steps: 4 }); await page.mouse.move(c3.x, c3.y, { steps: 4 });
        await page.mouse.up();
        const painted = await page.evaluate(() => [board[3][1], board[3][2], board[3][3]].map(p => p && p.type));
        ok(vp.name + ': dragging paints a row of pieces', painted.every(t => t === 'ramp'), JSON.stringify(painted));

        const beforeCam = await page.evaluate(() => world.style.getPropertyValue('--cam'));
        const vr = await page.$eval('.viewport', el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
        await page.mouse.move(vr.x + vr.w / 2, vr.y + 25); await page.mouse.down();
        await page.mouse.move(vr.x + vr.w / 2 + 180, vr.y + 25, { steps: 6 }); await page.mouse.up();
        const afterCam = await page.evaluate(() => world.style.getPropertyValue('--cam'));
        ok(vp.name + ': dragging the background orbits the camera', beforeCam !== afterCam, beforeCam + ' -> ' + afterCam);

        await page.mouse.move(vr.x + vr.w / 2, vr.y + vr.h / 2);
        await page.mouse.wheel({ deltaY: -300 });
        const z = await page.evaluate(() => parseFloat(world.style.getPropertyValue('--zoom')) || 1);
        ok(vp.name + ': the wheel zooms the board', z > 1, String(z));

        const slots = await page.evaluate(() => {
          localStorage.removeItem('jvds-marble-3d-slots');
          slotName.value = 'Test Run';
          saveSlot();
          return { stored: (JSON.parse(localStorage.getItem('jvds-marble-3d-slots')) || []).length, shown: document.querySelectorAll('#slots .slot').length };
        });
        ok(vp.name + ': a run saves into a named slot', slots.stored === 1 && slots.shown === 1, JSON.stringify(slots));

        const shareOk = await page.evaluate(() => {
          const code = codeOf(board);
          const back = JSON.parse(decodeURIComponent(escape(atob(code))));
          return Array.isArray(back) && back.length === board.length;
        });
        ok(vp.name + ': the share code round-trips', shareOk);

        const momentum = await page.evaluate(async () => {
          loadMission(0);
          for (let x = 1; x <= 7; x++) board[2][x] = { type: 'ramp', rot: 0 };
          board[2][3] = { type: 'boost', rot: 0 };
          render(); launch();
          let peak = 0;
          for (let i = 0; i < 160; i++) {
            if (run) peak = Math.max(peak, run.speed);
            await new Promise(r => requestAnimationFrame(r));
            if (!run || !run.alive) break;
          }
          return { peak, base: SPEED_BASE };
        });
        ok(vp.name + ': the marble picks up speed through boosts/drops', momentum.peak > momentum.base, JSON.stringify(momentum));

        await page.evaluate(() => { loadMission(0); selected = 'ramp'; viewport.focus(); });
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Enter');
        await page.keyboard.press('KeyR');
        const kbState = await page.evaluate(() => ({ at: board[2][2] && board[2][2].type, rot: board[2][2] && board[2][2].rot, cursor: cursor.x + ',' + cursor.y }));
        await page.keyboard.press('Backspace');
        const kbErased = await page.evaluate(() => board[2][2]);
        await page.keyboard.press('3');
        const kbTool = await page.evaluate(() => selected);
        ok(vp.name + ': arrow keys move the cursor and Enter places', kbState.at === 'ramp' && kbState.cursor === '2,2', JSON.stringify(kbState));
        ok(vp.name + ': R rotates and Backspace erases', kbState.rot === 90 && kbErased === null, JSON.stringify({ rot: kbState.rot, erased: kbErased }));
        ok(vp.name + ': number keys pick a tool', kbTool === 'steep', kbTool);

        const label = await page.evaluate(() => document.querySelector('.socket[data-x="0"][data-y="2"]').getAttribute('aria-label'));
        ok(vp.name + ': sockets announce their contents', /column 1, row 3/.test(label), label);

        const auto = await page.evaluate(() => { loadMission(0); selected = 'ramp'; place(1, 1); return !!localStorage.getItem('jvds-marble-3d-auto'); });
        ok(vp.name + ': the build autosaves', auto);

        const solved = await page.evaluate(() => { loadMission(1); solve(); return pathPreview().win; });
        ok(vp.name + ': Show me fills a working route', solved);

        await page.evaluate(() => { loadMission(0); for (let x = 1; x <= 7; x++) board[2][x] = { type: 'ramp', rot: 0 }; render(); launch(); });
        await page.waitForFunction(() => document.getElementById('feedback').classList.contains('good'), { timeout: 15000 }).catch(() => {});
        const met = await page.evaluate(() => document.querySelectorAll('#goals .goal.met').length);
        ok(vp.name + ': mission goals tick off', met >= 1, String(met));

        const fit = await page.evaluate(() => { cam = 90; zoom = 1.6; panX = 50; applyCam(); fitBtn.click(); return { cam: cam, zoom: zoom, px: world.style.getPropertyValue('--px') }; });
        ok(vp.name + ': Fit resets the camera and pan', fit.cam === -36 && fit.zoom === 1 && fit.px === '0px', JSON.stringify(fit));

        await page.reload({ waitUntil: 'load' });
        await page.waitForSelector('#tools [data-tool]', { timeout: 10000 });
        const vr2 = await page.$eval('.viewport', el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
        const beforePan = await page.evaluate(() => world.style.getPropertyValue('--px'));
        await page.mouse.move(vr2.x + vr2.w / 2, vr2.y + vr2.h / 2); await page.mouse.down({ button: 'right' });
        await page.mouse.move(vr2.x + vr2.w / 2 + 120, vr2.y + vr2.h / 2 + 40, { steps: 6 }); await page.mouse.up({ button: 'right' });
        const afterPan = await page.evaluate(() => world.style.getPropertyValue('--px'));
        ok(vp.name + ': right-drag pans the board', beforePan !== afterPan, beforePan + ' -> ' + afterPan);

        await page.evaluate(() => { loadMission(0); selected = 'ramp'; place(1, 2); render(); launch(); });
        await page.waitForFunction(() => document.querySelector('.marker'), { timeout: 8000 }).catch(() => {});
        ok(vp.name + ': a failed launch marks the gap', await page.evaluate(() => document.querySelectorAll('.marker').length > 0));

        ok(vp.name + ': no page errors after the interactive pass', errors.length === 0, errors.slice(0, 2).join(' | '));
      }

      ok(vp.name + ': no sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      ok(vp.name + ': no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 900 });
      await page.evaluateOnNewDocument(() => { try { localStorage.removeItem('jvds-marble-3d-seen'); } catch (e) {} });
      await page.goto(base + '/games/marble-run-lab.html', { waitUntil: 'load' });
      await page.waitForSelector('.coach.show', { timeout: 6000 }).catch(() => {});
      const shown = await page.$eval('#coach', el => el.classList.contains('show')).catch(() => false);
      const t0 = await page.$eval('#coachText', e => e.textContent).catch(() => '');
      await page.click('#coachNext').catch(() => {});
      await new Promise(r => setTimeout(r, 200));
      const t1 = await page.$eval('#coachText', e => e.textContent).catch(() => '');
      await page.click('#coachSkip').catch(() => {});
      await new Promise(r => setTimeout(r, 150));
      const done = await page.$eval('#coach', el => el.classList.contains('show')).catch(() => true);
      ok('first-run: the coachmarks appear', shown && t0.length > 10, t0.slice(0, 40));
      ok('first-run: Next advances the tour', t1 !== t0 && t1.length > 10, t1.slice(0, 40));
      ok('first-run: the tour can be skipped closed', !done);
      await page.close();
    }

    {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 900 });
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      await page.evaluateOnNewDocument(() => { try { localStorage.setItem('jvds-marble-3d-seen', '1'); } catch (e) {} });
      await page.goto(base + '/games/marble-run-lab.html', { waitUntil: 'load' });
      await page.waitForSelector('#tools [data-tool]', { timeout: 10000 });
      const rm = await page.evaluate(() => {
        loadMission(0);
        for (let x = 1; x <= 7; x++) board[2][x] = { type: 'ramp', rot: 0 };
        render(); launch();
        return { marbles: document.querySelectorAll('.marble').length, good: document.getElementById('feedback').classList.contains('good') };
      });
      ok('reduced motion: the run resolves without an animated marble', rm.marbles === 0 && rm.good, JSON.stringify(rm));
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  const html = fs.readFileSync(path.join(ROOT, 'games', 'marble-run-lab.html'), 'utf8');
  ok('left turns and height code are present', /turnL/.test(html) && /computeHeights/.test(html) && /GRAV/.test(html));
  ok('the old permanent-boost speed bug is gone', !/run\.speed=\.062/.test(html));
  ok('keyboard, solver, goals and autosave are present', /keydown/.test(html) && /bfsPath/.test(html) && /renderGoals/.test(html) && /AUTOSAVE/.test(html));
  ok('reduced-motion support is present', /prefers-reduced-motion/.test(html));

  console.log(failures ? `\n${failures} FAILED` : '\n3D Marble Run: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('harness error', e); process.exit(1); });
