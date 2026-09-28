#!/usr/bin/env node
/*
 * tests/theme-park-smoke.js , A603
 *
 * Mini Theme Park Builder is one Festival Night now: £60, paths plus two
 * attractions, one ticket choice, one Open Gates press, a verdict, and a
 * replay. The 5-day season, research tiers, upgrades and goal checklist are
 * gone. This builds a connected park through the real UI to the Festival
 * hit ending, parties again, then opens the gates on an empty field to the
 * kind Quiet night ending.
 *
 * Run: node tests/theme-park-smoke.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.TP_PORT || 8155);
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
  cash: document.getElementById('cash').textContent,
  night: document.getElementById('day').textContent,
  tools: [...document.querySelectorAll('#tools .tool')].map(t => t.textContent.replace(/\s+/g, ' ').trim()),
  resultShown: document.getElementById('result').classList.contains('show'),
  resultText: document.getElementById('result').textContent.replace(/\s+/g, ' ').trim(),
});

const BUILD = (tool, cell) => {
  document.querySelector(`[data-tool="${tool}"]`).click();
  document.querySelector(`[data-cell="${cell}"]`).click();
};

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
      await page.goto(BASE + '/games/mini-theme-park-builder.html', { waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector('#park .cell', { timeout: 10000 });

      const start = await page.evaluate(SNAP);
      ok(vp.name + ': one night on the board, not a 5-day season', start.night === 'Night 1/1', start.night);
      ok(vp.name + ': the night starts with £60', start.cash === '£60', start.cash);
      ok(vp.name + ': four build choices, no locked tiers', start.tools.length === 4 && !/Research tier/.test(start.tools.join(' ')), start.tools.length + ' tools');
      const copy = await page.evaluate(() => document.body.textContent);
      ok(vp.name + ': no season, research, upgrades or goals on the page', !/five-day|Research Lab|Staff Training|goals cleared/i.test(copy));
      ok(vp.name + ': the page states one festival night', /one festival night/i.test(copy));

      // good build: path, cups, burger, all connected, then open the gates
      await page.evaluate(BUILD, 'path', 33);
      await page.evaluate(BUILD, 'cups', 32);
      await page.evaluate(BUILD, 'burger', 34);
      const built = await page.evaluate(SNAP);
      ok(vp.name + ': £60 covers paths plus two attractions', built.cash === '£10', built.cash);
      await page.evaluate(() => document.getElementById('openBtn').click());
      await new Promise(r => setTimeout(r, 600));
      const won = await page.evaluate(SNAP);
      ok(vp.name + ': a connected park earns the Festival hit ending', won.resultShown && /festival hit/i.test(won.resultText), won.resultText.slice(0, 90));
      ok(vp.name + ': the night reads Closed after the gates close', won.night === 'Closed', won.night);
      ok(vp.name + ': the ending names the score and the gate honour', /final score|Lumo puts your name/i.test(won.resultText));

      // party again is a fresh £60 field
      await page.evaluate(() => document.getElementById('againBtn').click());
      await new Promise(r => setTimeout(r, 300));
      const fresh = await page.evaluate(SNAP);
      ok(vp.name + ': partying again resets to a fresh £60 night', !fresh.resultShown && fresh.cash === '£60' && fresh.night === 'Night 1/1');

      // empty field: opening the gates with nothing built fails kindly
      await page.evaluate(() => document.getElementById('openBtn').click());
      await new Promise(r => setTimeout(r, 600));
      const lost = await page.evaluate(SNAP);
      ok(vp.name + ': an empty park gets the kind Quiet night ending', lost.resultShown && /quiet night/i.test(lost.resultText), lost.resultText.slice(0, 90));
      ok(vp.name + ': the loss tells the player how to fix it', /two attractions|joy over 40/i.test(lost.resultText));
      ok(vp.name + ': no sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      ok(vp.name + ': no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }

    const html = fs.readFileSync(path.join(ROOT, 'games', 'mini-theme-park-builder.html'), 'utf8');
    ok('no season ladder left in the page', !/Soft opening|Rain shower|School trip|Influencer visit/.test(html));
    ok('no research, upgrades or goals machinery left', !/scoreGoals|meta\.goals|data-up|Research tier/.test(html));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} FAILED` : '\nTheme Park run: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('harness error', e); process.exit(1); });
