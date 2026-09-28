#!/usr/bin/env node
/*
 * tests/cozy-cafe-smoke.js , A608
 *
 * Cozy Cafe Match is one morning rush now: serve 5 guests, then shutters
 * close with a tip-jar count and Stardust thank-you. No vault grind, no
 * daily/weekly queues. This serves 5 guests through the real fulfilGuest
 * path, checks the shutters-close ending, replays, and ensures the shift
 * is the only loop.
 *
 * Run: node tests/cozy-cafe-smoke.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.CC_PORT || 8157);
const BASE = `http://127.0.0.1:${PORT}`;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.m4a': 'audio/mp4' };

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

const SNAP = () => ({
  shift: document.getElementById('happyCount').textContent,
  done: document.getElementById('shiftResult').classList.contains('show'),
  title: document.getElementById('shiftTitle').textContent,
  text: document.getElementById('shiftText').textContent,
  boardCells: document.querySelectorAll('#board .tile').length,
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    for (const vp of [{ name: '390px', width: 390, height: 844 }, { name: '1440px', width: 1440, height: 900 }]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 700 });
      await page.evaluateOnNewDocument(() => localStorage.clear());
      await page.goto(BASE + '/games/cozy-cafe-match-game.html', { waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector('#board', { timeout: 10000 });
      await new Promise(r => setTimeout(r, 900));

      const start = await page.evaluate(SNAP);
      ok(vp.name + ': board of 64 tiles', start.boardCells === 64, start.boardCells + ' cells');
      ok(vp.name + ': shift starts 0/5, not an unbounded cafe', start.shift === '0/5', start.shift);
      ok(vp.name + ': morning rush copy on the page', /One morning rush|Serve 5 guests/i.test(await page.evaluate(()=>document.body.textContent)));
      ok(vp.name + ': no shutters overlay yet', !start.done);

      // serve 4 guests - should not yet be done
      for(let i=0;i<4;i++){ await page.evaluate(()=>window.__cafeTest.serveOne()); await new Promise(r=>setTimeout(r,300)); }
      const mid = await page.evaluate(SNAP);
      ok(vp.name + ': after 4 guests shift reads 4/5', mid.shift === '4/5', mid.shift);
      ok(vp.name + ': shutters still open after 4', !mid.done);

      // 5th guest closes shutters
      await page.evaluate(()=>window.__cafeTest.serveOne());
      await new Promise(r=>setTimeout(r,500));
      const done = await page.evaluate(SNAP);
      ok(vp.name + ': 5th guest closes shutters', done.done && /Shutters close|morning rush done/i.test(done.title), done.title);
      ok(vp.name + ': tip jar and Stardust thank-you on the closing card', /Tip jar|Stardust|served 5/i.test(done.text), done.text.slice(0,80));
      ok(vp.name + ': shift reads 5/5 at close', done.shift === '5/5', done.shift);

      // serve again is a fresh 0/5
      await page.evaluate(()=>window.__cafeTest.reset());
      await new Promise(r=>setTimeout(r,600));
      const fresh = await page.evaluate(SNAP);
      ok(vp.name + ': serving again resets to 0/5 with no overlay', !fresh.done && fresh.shift === '0/5', JSON.stringify({shift:fresh.shift, done:fresh.done}));
      ok(vp.name + ': no sideways scrolling', await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth + 1));
      ok(vp.name + ': no page errors', errors.length===0, errors.slice(0,2).join(' | '));
      await page.close();
    }
    const html = fs.readFileSync(path.join(ROOT,'games','cozy-cafe-match-game.html'),'utf8');
    ok('shift target 5 and shutters logic present', /SHIFT_TARGET\s*=\s*5/.test(html) && /showShiftResult/.test(html));
    ok('no em dash in the touched game file', !/\u2014/.test(html));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} FAILED` : '\nCozy Cafe run: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e=>{console.error('harness error',e);process.exit(1);});
