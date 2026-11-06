#!/usr/bin/env node
/* A2563: low-spec performance sentinel.
 * Proves the sentinel samples real rAF frames, then drops to low quality when
 * the frame rate stays under 45, shrinks Tower Drop's render scale, disables its
 * heavy effects, and restores full quality when the frame rate recovers.
 * Run: node tests/perf-sentinel.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };

let failures = 0;
let checks = 0;
const check = (name, ok, detail) => {
  checks++;
  if (ok) { console.log('  [ok] ' + name); return; }
  failures++;
  console.log('  [FAIL] ' + name + (detail ? ' [' + detail + ']' : ''));
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const server = http.createServer((req, res) => {
    let rel;
    try { rel = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
    if (rel === '/') rel = '/index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('missing'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  const pageUrl = 'http://127.0.0.1:' + port + '/games/tower-drop.html';

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR_|Failed to load resource/i.test(m.text())) errors.push(m.text()); });
      await page.evaluateOnNewDocument(() => {
        window.__qualityEvents = [];
        window.addEventListener('jvds:quality', e => window.__qualityEvents.push(e.detail.level));
      });
      await page.setViewport({ width, height: 900, deviceScaleFactor: 2, isMobile: width < 700 });
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await sleep(600);
      await page.evaluate(() => {
        window.__perfLoop = true;
        (function loop() { if (!window.__perfLoop) return; requestAnimationFrame(loop); })();
      });
      await sleep(700);

      const real = await page.evaluate(() => {
        const perf = window.JVDSPerf && window.JVDSPerf.getState();
        return { hasPerf: !!window.JVDSPerf, state: perf, game: !!(window.__towerDrop && window.__towerDrop.snapshot) };
      });
      check(width + 'px: sentinel is running', real.hasPerf && real.state && real.state.running);
      check(width + 'px: real rAF frames are sampled', real.state && real.state.frames > 5, real.state ? real.state.frames + ' frames' : 'none');
      check(width + 'px: Tower Drop is alive', real.game);

      await page.evaluate(() => { for (let i = 0; i < 3; i++) window.JVDSPerf._testFps(60); });
      await sleep(150);
      const high = await page.evaluate(() => {
        const canvas = document.getElementById('game');
        return { level: window.JVDSPerf.getState().level, scale: window.JVDSPerf.getState().scale, width: canvas.width, height: canvas.height };
      });
      check(width + 'px: starts in high quality', high.level === 'high' && high.scale === 1);

      await page.evaluate(() => { for (let i = 0; i < 2; i++) window.JVDSPerf._testFps(20); });
      await sleep(250);
      const low = await page.evaluate(() => {
        const canvas = document.getElementById('game');
        return {
          level: window.JVDSPerf.getState().level,
          scale: window.JVDSPerf.getState().scale,
          width: canvas.width,
          tall: canvas.height,
          classOn: document.documentElement.classList.contains('jvds-low-perf'),
          dataset: document.documentElement.dataset.jvdsQuality,
          style: !!document.getElementById('jvds-perf-style'),
          events: window.__qualityEvents.slice()
        };
      });
      check(width + 'px: drops to low quality under 45 FPS', low.level === 'low' && low.scale === 0.75);
      check(width + 'px: low quality class and dataset are set', low.classOn && low.dataset === 'low');
      check(width + 'px: heavy effect styles are installed', low.style);
      check(width + 'px: render scale is capped without reload', low.width <= high.width * 0.55 && low.width > 0, high.width + ' -> ' + low.width);
      check(width + 'px: quality event is dispatched', low.events.indexOf('low') !== -1, low.events.join(','));

      await page.evaluate(() => { for (let i = 0; i < 3; i++) window.JVDSPerf._testFps(60); });
      await sleep(250);
      const restored = await page.evaluate(() => {
        const canvas = document.getElementById('game');
        return {
          level: window.JVDSPerf.getState().level,
          width: canvas.width,
          classOn: document.documentElement.classList.contains('jvds-low-perf'),
          events: window.__qualityEvents.slice()
        };
      });
      check(width + 'px: recovers to high quality', restored.level === 'high' && !restored.classOn);
      check(width + 'px: render scale is restored', restored.width === high.width, high.width + ' vs ' + restored.width);
      check(width + 'px: recovery event is dispatched', restored.events.indexOf('high') !== -1, restored.events.join(','));

      if (width === 390) {
        const cdp = await page.createCDPSession();
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 50 }).catch(() => {});
        await sleep(2600);
        const throttled = await page.evaluate(() => {
          const s = window.JVDSPerf.getState();
          return { fps: s.fps, level: s.level, windows: s.windows };
        });
        check(width + 'px: throttled profile is measured', throttled.windows >= 1, JSON.stringify(throttled));
        check(width + 'px: throttled profile stays error-free', errors.length === 0, errors.slice(0, 2).join(' | '));
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => {});
        await sleep(2600);
        const afterThrottle = await page.evaluate(() => {
          const s = window.JVDSPerf.getState();
          return { fps: s.fps, level: s.level };
        });
        check(width + 'px: quality recovers after the throttle is removed', afterThrottle.level === 'high' || afterThrottle.fps > 45, JSON.stringify(afterThrottle));
      }

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(width + 'px: no horizontal overflow', overflow <= 1, '+' + overflow + 'px');
      check(width + 'px: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (failures) {
    console.log('\nperf-sentinel: FAIL (' + failures + ' of ' + checks + ')');
    process.exitCode = 1;
  } else {
    console.log('\nperf-sentinel: PASS (' + checks + ' checks)');
  }
})().catch(e => { console.error('harness error', e); process.exit(1); });

