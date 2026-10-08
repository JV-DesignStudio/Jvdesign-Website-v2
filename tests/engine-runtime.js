#!/usr/bin/env node
// A939 engine runtime contract: the shared runtime kit (loop / input / collide /
// juice) exposed as JVDSEngine.runtime must behave as documented and must no-op
// its motion helpers under prefers-reduced-motion. Run: node tests/engine-runtime.js
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '..');
const RUNTIME_VERSION = '2.1.0';

const NOISE = /ServiceWorker|MIME type|Failed to load resource|net::ERR|ERR_FAILED|ERR_ABORTED|favicon/i;
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const server = http.createServer((req, res) => {
    const p = path.resolve(ROOT, '.' + decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(p, (e, b) => { res.writeHead(e ? 404 : 200); res.end(e ? '' : b); });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows'
    ]
  });
  let failures = 0;
  const check = (n, c, d) => { console.log(`${c ? '✓' : '✗'} ${n}${d ? ' - ' + d : ''}`); if (!c) failures++; };

  async function newPage(motion) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => { const m = String(e.message || e); if (!NOISE.test(m)) errors.push(m); });
    await page.setViewport({ width: 390, height: 720 });
    await page.setContent('<!doctype html><html><head></head><body></body></html>');
    await page.bringToFront();
    if (motion) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: motion }]);
    await page.addScriptTag({ url: base + '/engine-runtime.js' });
    await sleep(50);
    return { page, errors };
  }

  try {
    const { page, errors } = await newPage();

    // 1. Surface + version.
    const surface = await page.evaluate(() => {
      const rt = window.JVDSEngine && window.JVDSEngine.runtime;
      return {
        version: (window.JVDSEngine && window.JVDSEngine.version) || null,
        runtimeVersion: rt && rt.version,
        loop: !!(rt && typeof rt.loop === 'function'),
        input: !!(rt && typeof rt.input === 'function'),
        collide: !!(rt && rt.collide && typeof rt.collide.aabb === 'function' && typeof rt.collide.circle === 'function'),
        juice: !!(rt && rt.juice && typeof rt.juice.tween === 'function' && typeof rt.juice.burst === 'function')
      };
    });
    check('runtime: exposed with loop/input/collide/juice', surface.loop && surface.input && surface.collide && surface.juice);
    check('runtime: version ' + RUNTIME_VERSION, surface.runtimeVersion === RUNTIME_VERSION, surface.runtimeVersion || 'none');

    // 2. Fixed-timestep loop. rAF + performance.now are replaced with a manual
    // clock so the fixed-step maths is exact and never depends on real frame
    // timing (which is throttled in headless Chrome).
    const l = await page.evaluate(() => {
      const rt = window.JVDSEngine.runtime;
      const realRaf = window.requestAnimationFrame, realCaf = window.cancelAnimationFrame, realNow = window.performance.now;
      let now = 0, queue = [];
      window.requestAnimationFrame = fn => { queue.push(fn); return queue.length; };
      window.cancelAnimationFrame = () => {};
      window.performance.now = () => now;
      const pump = ms => { now += ms; const batch = queue; queue = []; batch.forEach(fn => fn(now)); };
      const tick = n => { for (let i = 0; i < n; i++) pump(20); }; // 20ms frames = exactly one 0.02 step
      try {
        let count = 0, lastStep = 0, lastElapsed = 0;
        const loop = rt.loop({ step: 0.02, update: (step, elapsed) => { count++; lastStep = step; lastElapsed = elapsed; } });
        loop.start();
        pump(0);
        tick(5);
        const afterTick = count, elapsedAtTick = lastElapsed;
        loop.pause();
        const pausedAt = count;
        tick(5);
        const afterPause = count;
        loop.resume();
        tick(5);
        const afterResume = count;
        loop.stop();
        const atStop = count;
        tick(5);
        const afterStop = count;
        const runningAfterStop = loop.running;
        let bigCount = 0;
        const loop2 = rt.loop({ step: 0.02, maxSubSteps: 5, update: () => { bigCount++; } });
        loop2.start();
        pump(0);
        pump(1000);
        loop2.destroy();
        return { afterTick, elapsedAtTick, pausedAt, afterPause, afterResume, atStop, afterStop, runningAfterStop, lastStep, bigCount };
      } finally {
        window.requestAnimationFrame = realRaf;
        window.cancelAnimationFrame = realCaf;
        window.performance.now = realNow;
      }
    });
    check('loop: fixed step delivers step value', l.lastStep === 0.02, String(l.lastStep));
    check('loop: 100ms pumps five 20ms steps', l.afterTick === 5, String(l.afterTick));
    check('loop: elapsed tracks steps', Math.abs(l.elapsedAtTick - 4 * 0.02) < 1e-9, String(l.elapsedAtTick));
    check('loop: pause halts updates', l.afterPause === l.pausedAt, l.pausedAt + '->' + l.afterPause);
    check('loop: resume resumes updates', l.afterResume === 10, String(l.afterResume));
    check('loop: stop halts updates', l.afterStop === l.atStop, l.atStop + '->' + l.afterStop);
    check('loop: running getter false after stop', l.runningAfterStop === false, 'running=' + l.runningAfterStop);
    check('loop: maxSubSteps caps catch-up after a stall', l.bigCount === 5, String(l.bigCount));
    check('runtime surface: no uncaught errors so far', errors.length === 0, errors[0] || '');

    // 3. Input.
    const inp = await page.evaluate(() => {
      const rt = window.JVDSEngine.runtime;
      const host = document.createElement('div');
      host.style.cssText = 'position:absolute;left:10px;top:20px;width:200px;height:100px';
      document.body.appendChild(host);
      const input = rt.input(host);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true }));
      const down = input.isDown('arrowleft');
      const downByCode = input.isDown('ArrowLeft');
      const pressed = input.wasPressed('arrowleft');
      input.endFrame();
      const pressedCleared = input.wasPressed('arrowleft');
      const stillDown = input.isDown('arrowleft');
      const axis = input.axis(['arrowleft'], ['arrowright']);
      const mk = (type, x, y) => {
        let e; try { e = new PointerEvent(type, { clientX: x, clientY: y, bubbles: true }); }
        catch (err) { e = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }); }
        host.dispatchEvent(e);
      };
      mk('pointerdown', 40, 55);
      const pDown = input.pointer.down;
      const pPressed = input.pointer.pressed;
      const pX = input.pointer.x, pY = input.pointer.y;
      mk('pointermove', 70, 55);
      const dx = input.pointer.dx;
      input.endFrame();
      const pPressedCleared = input.pointer.pressed;
      const pDxCleared = input.pointer.dx;
      mk('pointerup', 70, 55);
      const pReleased = input.pointer.released;
      input.endFrame();
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true }));
      const wasUp = input.wasReleased('arrowleft');
      const nowUp = !input.isDown('arrowleft');
      input.destroy();
      const destroyed = !input.isDown('arrowleft');
      return { down, downByCode, pressed, pressedCleared, stillDown, axis, pDown, pPressed, pX, pY, dx, pPressedCleared, pDxCleared, pReleased, wasUp, nowUp, destroyed };
    });
    check('input: keydown isDown', inp.down && inp.downByCode);
    check('input: wasPressed then cleared by endFrame', inp.pressed === true && inp.pressedCleared === false);
    check('input: isDown survives endFrame', inp.stillDown === true);
    check('input: axis combines keys', inp.axis === -1, String(inp.axis));
    check('input: pointer down + local coords', inp.pDown === true && inp.pPressed === true && inp.pX === 30 && inp.pY === 35, `${inp.pX},${inp.pY}`);
    check('input: pointer dx accumulates', inp.dx === 30, String(inp.dx));
    check('input: pointer one-shots cleared by endFrame', inp.pPressedCleared === false && inp.pDxCleared === 0);
    check('input: pointer up + keyup release', inp.pReleased === true && inp.wasUp === true && inp.nowUp === true);
    check('input: destroy detaches listeners', inp.destroyed === true);
    check('input: no uncaught errors', errors.length === 0, errors[0] || '');

    // 4. Collision.
    const col = await page.evaluate(() => {
      const c = window.JVDSEngine.runtime.collide;
      const a = { x: 0, y: 0, w: 10, h: 10 };
      const b = { x: 5, y: 5, w: 10, h: 10 };
      const far = { x: 100, y: 100, w: 10, h: 10 };
      const o = c.overlap(a, b);
      const mover = { x: 4, y: 0, w: 10, h: 10 };
      const corr = c.resolve(mover, { x: 0, y: 0, w: 10, h: 10 });
      return {
        hit: c.aabb(a, b), miss: c.aabb(a, far),
        pointIn: c.pointInRect(5, 5, a), pointOut: c.pointInRect(50, 5, a),
        circle: c.circle({ x: 0, y: 0, r: 5 }, { x: 8, y: 0, r: 5 }),
        circleMiss: c.circle({ x: 0, y: 0, r: 5 }, { x: 50, y: 0, r: 5 }),
        circleRect: c.circleRect({ x: 12, y: 5, r: 4 }, { x: 0, y: 0, w: 10, h: 10 }),
        circleRectMiss: c.circleRect({ x: 30, y: 5, r: 4 }, { x: 0, y: 0, w: 10, h: 10 }),
        overlap: o, resolveCorr: corr, resolveX: mover.x
      };
    });
    check('collide: aabb hit + miss', col.hit === true && col.miss === false);
    check('collide: pointInRect hit + miss', col.pointIn === true && col.pointOut === false);
    check('collide: circle hit + miss', col.circle === true && col.circleMiss === false);
    check('collide: circleRect hit + miss', col.circleRect === true && col.circleRectMiss === false);
    check('collide: overlap returns intersection', col.overlap && col.overlap.x === 5 && col.overlap.w === 5, JSON.stringify(col.overlap));
    check('collide: resolve pushes out on least axis', col.resolveCorr.x === 6 && col.resolveCorr.y === 0 && col.resolveX === 10, JSON.stringify(col.resolveCorr) + ' x=' + col.resolveX);

    // 5. Juice (motion allowed). The tween uses a manual clock so it completes
    // deterministically regardless of headless frame timing.
    const j = await page.evaluate(() => {
      const juice = window.JVDSEngine.runtime.juice;
      const f = juice.float('+12', 100, 100);
      const beforeBurst = document.querySelectorAll('.jvdse-particle').length;
      juice.burst(100, 100, { count: 8 });
      const afterBurst = document.querySelectorAll('.jvdse-particle').length;
      const node = document.createElement('div');
      document.body.appendChild(node);
      juice.shake(node, { intensity: 4 });

      const realRaf = window.requestAnimationFrame, realCaf = window.cancelAnimationFrame, realNow = window.performance.now;
      let now = 0, queue = [];
      window.requestAnimationFrame = fn => { queue.push(fn); return queue.length; };
      window.cancelAnimationFrame = () => {};
      window.performance.now = () => now;
      const pump = ms => { now += ms; const batch = queue; queue = []; batch.forEach(fn => fn(now)); };
      let last = null, completed = false;
      try {
        juice.tween({ from: 0, to: 50, duration: 100, onUpdate: v => { last = v; }, onComplete: () => { completed = true; } });
        pump(0);   // start
        pump(50);  // halfway
        const mid = last;
        pump(50);  // finish
        return { floatCreated: !!f && document.querySelectorAll('.jvdse-float').length >= 1, burstCount: afterBurst - beforeBurst, tweenMid: mid, tweenFinal: last, tweenCompleted: completed };
      } finally {
        window.requestAnimationFrame = realRaf;
        window.cancelAnimationFrame = realCaf;
        window.performance.now = realNow;
      }
    });
    check('juice: float creates a node', j.floatCreated === true);
    check('juice: burst spawns particles', j.burstCount === 8, String(j.burstCount));
    check('juice: tween eases through and reaches target', j.tweenMid > 0 && j.tweenMid < 50 && j.tweenFinal === 50 && j.tweenCompleted === true, `${j.tweenMid}->${j.tweenFinal}`);

    // 6. Reduced motion: motion helpers must no-op.
    const { page: rm, errors: rmErrors } = await newPage('reduce');
    const r = await rm.evaluate(async () => {
      const juice = window.JVDSEngine.runtime.juice;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const f = juice.float('x', 10, 10);
      juice.burst(10, 10, { count: 6 });
      const floats = document.querySelectorAll('.jvdse-float').length;
      const particles = document.querySelectorAll('.jvdse-particle').length;
      const tweenFinal = await new Promise(resolve => {
        let last = null;
        juice.tween({ from: 0, to: 9, duration: 500, onUpdate: v => { last = v; }, onComplete: () => resolve(last) });
        setTimeout(() => resolve(last), 120);
      });
      const node = document.createElement('div');
      document.body.appendChild(node);
      juice.shake(node, { intensity: 4 });
      return { reduced, returnsNull: f === null, floats, particles, tweenFinal };
    });
    check('reduced-motion: media query active', r.reduced === true);
    check('reduced-motion: float no-ops (no node, returns null)', r.returnsNull === true && r.floats === 0, 'floats=' + r.floats);
    check('reduced-motion: burst spawns no particles', r.particles === 0, 'particles=' + r.particles);
    check('reduced-motion: tween snaps to target immediately', r.tweenFinal === 9, String(r.tweenFinal));
    check('reduced-motion: no uncaught errors', rmErrors.length === 0, rmErrors[0] || '');

    check('runtime: no uncaught errors overall', errors.length === 0, errors[0] || '');
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n✗ engine runtime: ${failures} check(s) failed` : '\n✓ engine runtime: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('✗ engine runtime: ' + e.message); process.exit(1); });
