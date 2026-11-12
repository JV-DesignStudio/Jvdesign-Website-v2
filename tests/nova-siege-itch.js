#!/usr/bin/env node
/*
 * tests/nova-siege-itch.js
 *
 * Proves the standalone itch.io build of Nova Siege plays without the studio
 * arcade layer. The build lives outside the public site repo at
 * F:/Website/itch/nova-siege; if it is missing this test rebuilds it first.
 *
 * Checks:
 *   - the ZIP has index.html at its root
 *   - the single-file build has no ../ refs, no external <script src>, no
 *     site-only stylesheet, and no analytics/funnel/shell code
 *   - at 390x844 and 1440x900 it loads with no console errors, page errors or
 *     external requests (only the local test server is contacted)
 *   - Play starts a run, arrow keys move the ship, a pointer drag moves it,
 *     pause/resume and mute work, the save key is written, and the run ends on
 *     the game's own report screen
 *
 * Run: node tests/nova-siege-itch.js
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BUILD_DIR = path.resolve(ROOT, '..', 'itch', 'nova-siege');
const INDEX = path.join(BUILD_DIR, 'index.html');
const ZIP = path.resolve(ROOT, '..', 'itch', 'nova-siege.zip');
const BUILDER = path.join(ROOT, 'scripts', 'build-itch-nova-siege.cjs');

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
  if (!ok) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ensureBuild() {
  if (!fs.existsSync(INDEX)) {
    execFileSync(process.execPath, [BUILDER, '--no-shots', '--no-zip'], { cwd: ROOT, stdio: 'inherit' });
  }
}

function checkZip() {
  try {
    const buf = fs.readFileSync(ZIP);
    const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (eocd < 0) return check('ZIP has index.html at root', false, 'no end-of-central-directory');
    const count = buf.readUInt16LE(eocd + 10);
    const cdOffset = buf.readUInt32LE(eocd + 16);
    const names = [];
    let p = cdOffset;
    for (let i = 0; i < count; i += 1) {
      const nameLen = buf.readUInt16LE(p + 28);
      const extraLen = buf.readUInt16LE(p + 30);
      const commentLen = buf.readUInt16LE(p + 32);
      names.push(buf.slice(p + 46, p + 46 + nameLen).toString('utf8'));
      p += 46 + nameLen + extraLen + commentLen;
    }
    check('ZIP has index.html at root', names.includes('index.html'), names.join(', '));
    check('ZIP contains no nested site paths', names.every((n) => !n.includes('..')), names.join(', '));
  } catch (err) {
    check('ZIP has index.html at root', false, err.message);
  }
}

function checkBuild() {
  const html = fs.readFileSync(INDEX, 'utf8');
  check('build has no ../ reference', !/(?:src|href)="\.\.\//i.test(html));
  check('build has no external script tag', !/<script[^>]+\bsrc=/i.test(html));
  check('build has no site stylesheet', !/<link[^>]+rel="stylesheet"/i.test(html));
  check('build is titled Nova Siege', /<title>Nova Siege<\/title>/i.test(html));
  const banned = ['jvds-funnel', 'game-shell.js', 'games-registry.js', 'game-onboarding.js', 'googletagmanager', 'google-analytics', 'formspree', 'perf-sentinel'];
  for (const name of banned) {
    check('build has no ' + name, !html.includes(name));
  }
}

function serve(dir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent((req.url || '/').split('?')[0]);
      const file = path.join(dir, rel === '/' ? 'index.html' : rel);
      if (!file.startsWith(dir)) { res.writeHead(403); res.end(); return; }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html' : 'application/octet-stream' });
        res.end(data);
      });
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function testViewport(browser, base, width, height, label) {
  const page = await browser.newPage();
  const problems = [];
  try {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    page.on('console', (msg) => { if (msg.type() === 'error') problems.push('console: ' + msg.text()); });
    page.on('pageerror', (err) => problems.push('pageerror: ' + err.message));
    page.on('requestfailed', (req) => problems.push('requestfailed: ' + req.url()));
    page.on('request', (req) => {
      const url = req.url();
      if (/^https?:/i.test(url) && !url.startsWith(base)) problems.push('external: ' + url);
    });

    await page.goto(base + '/index.html', { waitUntil: 'load', timeout: 30000 });
    await sleep(500);

    const titleShown = await page.evaluate(() => {
      const ov = document.getElementById('overlay');
      return !!ov && !ov.classList.contains('hidden') && !!document.getElementById('startBtn');
    });
    check(label + ': title screen and Play show', titleShown);
    check(label + ': game API is present', await page.evaluate(() => !!window.__nova));

    const layout = await page.evaluate(() => {
      const cv = document.getElementById('cv');
      const r = cv.getBoundingClientRect();
      return {
        noXScroll: document.documentElement.scrollWidth <= window.innerWidth + 1,
        canvasFits: r.width > 100 && r.height > 200 && r.left >= -1 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1
      };
    });
    check(label + ': no horizontal scroll', layout.noXScroll);
    check(label + ': canvas fits the viewport', layout.canvasFits);

    await page.click('#startBtn');
    await sleep(800);
    check(label + ': Play starts a run', await page.evaluate(() => window.__nova.run.over === false));

    const beforeKey = await page.evaluate(() => window.__nova.run.px);
    await page.keyboard.down('ArrowLeft');
    await sleep(250);
    await page.keyboard.up('ArrowLeft');
    const afterKey = await page.evaluate(() => window.__nova.run.px);
    check(label + ': arrow keys move the ship', afterKey < beforeKey, beforeKey.toFixed(1) + ' -> ' + afterKey.toFixed(1));

    const box = await page.evaluate(() => {
      const r = document.getElementById('cv').getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
    const beforeDrag = await page.evaluate(() => ({ x: window.__nova.run.px, y: window.__nova.run.py }));
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h * 0.7;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + box.w * 0.18, cy - box.h * 0.08, { steps: 6 });
    await page.mouse.up();
    await sleep(200);
    const afterDrag = await page.evaluate(() => ({ x: window.__nova.run.px, y: window.__nova.run.py }));
    check(label + ': pointer drag moves the ship', afterDrag.x !== beforeDrag.x || afterDrag.y !== beforeDrag.y,
      beforeDrag.x.toFixed(1) + ',' + beforeDrag.y.toFixed(1) + ' -> ' + afterDrag.x.toFixed(1) + ',' + afterDrag.y.toFixed(1));

    await page.click('#pauseBtn');
    await sleep(120);
    check(label + ': pause works', await page.evaluate(() => window.__nova.paused === true));
    await page.click('#pauseResume');
    await sleep(120);
    check(label + ': resume works', await page.evaluate(() => window.__nova.paused === false));

    const muted = await page.evaluate(() => {
      window.__nova.toggleMute();
      const on = window.__nova.mute;
      window.__nova.toggleMute();
      return on;
    });
    check(label + ': mute toggles', muted === true);

    check(label + ': run saves on the device', await page.evaluate(() => !!localStorage.getItem('jvds-nova-siege-v1')));

    await page.evaluate(() => window.__nova.forceEnd());
    await sleep(200);
    const ended = await page.evaluate(() => ({
      over: window.__nova.run.over === true,
      overlay: !document.getElementById('overlay').classList.contains('hidden'),
      report: /Run report/i.test(document.getElementById('ovText').textContent || '')
    }));
    check(label + ': run ends on its own report screen', ended.over && ended.overlay && ended.report);

    check(label + ': no console/page errors', problems.filter((p) => !p.startsWith('requestfailed')).length === 0, problems.join(' | '));
    check(label + ': no external requests', problems.filter((p) => p.startsWith('external:')).length === 0, problems.join(' | '));
    check(label + ': no failed local requests', problems.filter((p) => p.startsWith('requestfailed:')).length === 0, problems.join(' | '));
  } catch (err) {
    check(label + ': test ran', false, err.message);
  } finally {
    await page.close();
  }
}

(async () => {
  ensureBuild();
  checkBuild();
  checkZip();

  let puppeteer;
  try { puppeteer = require('puppeteer'); } catch (e) { puppeteer = null; }
  if (!puppeteer) {
    console.log('SKIP browser checks - puppeteer is not installed');
  } else {
    const server = await serve(BUILD_DIR);
    const base = 'http://127.0.0.1:' + server.address().port;
    let browser = null;
    try {
      browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
      await testViewport(browser, base, 390, 844, '390x844');
      await testViewport(browser, base, 1440, 900, '1440x900');
    } catch (err) {
      console.log('SKIP browser checks - ' + err.message);
    } finally {
      if (browser) await browser.close();
      server.close();
    }
  }

  console.log('\n' + (failures ? failures + ' FAILED' : 'ALL PASS'));
  process.exit(failures ? 1 : 0);
})();
