#!/usr/bin/env node
/*
 * tests/dungeon-delve-smoke.js , A586
 *
 * Dungeon Delve is one delve now: a fixed 7-room dungeon, take the key past
 * the monster, rest at the shrine, reach the exit on a single torch. No
 * random dungeon, no merchant economy, no infinite re-queue. This walks the
 * safe route to the Escaped ending, then walks a wasteful route to the
 * kindly-revealed torch-out ending, and delves again.
 *
 * Run: node tests/dungeon-delve-smoke.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.DD_PORT || 8153);
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
  hp: document.getElementById('hp').textContent,
  torch: document.getElementById('torch').textContent,
  gold: document.getElementById('gold').textContent,
  keys: document.getElementById('keys').textContent,
  nodes: document.querySelectorAll('#map button').length,
  eventShown: document.getElementById('event').classList.contains('show'),
  eventText: document.getElementById('event').textContent.replace(/\s+/g, ' ').trim(),
});

const ENTER = (id) => { document.querySelectorAll('#map button')[id].click(); };

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    for (const vp of [{ name: '390px', width: 390, height: 844 }, { name: '1440px', width: 1440, height: 900 }]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 700 });
      await page.goto(BASE + '/games/dungeon-delve.html', { waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector('#map button', { timeout: 10000 });

      const start = await page.evaluate(SNAP);
      ok(vp.name + ': one fixed dungeon of 7 rooms, not a random 12', start.nodes === 7, start.nodes + ' nodes');
      ok(vp.name + ': one torch of 8 and no key yet', start.torch === '8' && start.keys === '0', 'torch=' + start.torch + ' keys=' + start.keys);
      ok(vp.name + ': the page states one delve on a single torch', /single torch/i.test(await page.evaluate(() => document.body.textContent)));

      // safe route: monster, key, shrine, exit
      for (const id of [1, 2, 4, 6]) {
        await page.evaluate(ENTER, id);
        await new Promise(r => setTimeout(r, 120));
      }
      const won = await page.evaluate(SNAP);
      ok(vp.name + ': the safe route reaches the Escaped ending', won.eventShown && /escaped/i.test(won.eventText), won.eventText.slice(0, 80));
      ok(vp.name + ': the ending names the safe route, not just a score', /monster.*key|key.*shrine/i.test(won.eventText), won.eventText.slice(0, 100));
      ok(vp.name + ': the ending offers another delve', /delve again/i.test(won.eventText));

      // delve again, then waste the torch: trap, treasure, wander, locked exit, out
      await page.evaluate(() => document.getElementById('again').click());
      await new Promise(r => setTimeout(r, 300));
      const fresh = await page.evaluate(SNAP);
      ok(vp.name + ': delving again resets to a fresh torch', !fresh.eventShown && fresh.torch === '8' && fresh.keys === '0');
      for (const id of [1, 3, 5, 3, 4, 6, 4, 3]) {
        await page.evaluate(ENTER, id);
        await new Promise(r => setTimeout(r, 120));
      }
      const lost = await page.evaluate(SNAP);
      ok(vp.name + ': wasting the torch reaches the kind torch-out ending', lost.eventShown && /torch went out/i.test(lost.eventText), lost.eventText.slice(0, 80));
      ok(vp.name + ': the loss still reveals the safe route', /monster.*key|safe route/i.test(lost.eventText));
      ok(vp.name + ': no sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      ok(vp.name + ': no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }

    const html = fs.readFileSync(path.join(ROOT, 'games', 'dungeon-delve.html'), 'utf8');
    ok('no random dungeon pool left in the page', !/pool\[\(i\+Math\.floor\(Math\.random\(\)\*pool\.length\)\)/.test(html));
    ok('the fixed delve has one key, one exit, no merchant', /fixed=\['start','monster','key','trap','shrine','treasure','exit'\]/.test(html));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} FAILED` : '\nDungeon Delve run: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('harness error', e); process.exit(1); });
