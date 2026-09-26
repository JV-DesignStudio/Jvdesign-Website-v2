#!/usr/bin/env node
/*
 * tests/echo-casebook-smoke.js , A594
 *
 * Echo's Casebook is one case now. The page used to cycle two cases behind a
 * Level counter with a "Next / replay" skip, and it had no ending at all: run
 * out of energy and the game simply carried on. This drives one case from the
 * clue board to a verdict, and the out-of-chances ending, then replays it.
 *
 * Run: node tests/echo-casebook-smoke.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.EC_PORT || 8149);
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
  caseName: (document.getElementById('task') || {}).textContent || '',
  brief: ((document.getElementById('brief') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
  clues: document.querySelectorAll('#clues .cell').length,
  suspects: document.querySelectorAll('.suspect').length,
  crossed: document.querySelectorAll('.suspect.out').length,
  disabled: document.querySelectorAll('.suspect[disabled]').length,
  score: (document.getElementById('score') || {}).textContent,
  case: (document.getElementById('level') || {}).textContent,
  energy: (document.getElementById('energy') || {}).textContent,
  feedback: ((document.getElementById('feedback') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
  replayShown: !(document.getElementById('reset') || {}).hidden,
  nextBtn: !!document.getElementById('next'),
  scrolls: document.documentElement.scrollWidth > window.innerWidth + 1
});

// double tap a suspect, which is how the game reads an accusation
const accuse = async (page, name) => {
  await page.evaluate(n => {
    const b = document.querySelector('.suspect[data-s="' + n + '"]');
    if (b) b.click();
  }, name);
  await new Promise(r => setTimeout(r, 60));
  await page.evaluate(n => {
    const b = document.querySelector('.suspect[data-s="' + n + '"]');
    if (b) b.click();
  }, name);
  await new Promise(r => setTimeout(r, 250));
};
const crossOut = async (page, name) => {
  await page.evaluate(n => {
    const b = document.querySelector('.suspect[data-s="' + n + '"]');
    if (b) b.click();
  }, name);
  await new Promise(r => setTimeout(r, 200));
};

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    const warm = await browser.newPage();
    await warm.goto(BASE + '/index.html', { waitUntil: 'load' });

    for (const vp of [{ name: '390px', width: 390, height: 844 }, { name: '1440px', width: 1440, height: 900 }]) {
      await warm.evaluate(() => localStorage.clear());
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 700 });
      await page.goto(BASE + '/games/echo-casebook.html', { waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector('.suspect', { timeout: 10000 });

      const start = await page.evaluate(SNAP);
      ok(vp.name + ': one case on the board', start.caseName === 'The Missing Muffin', start.caseName);
      ok(vp.name + ': four clues and four suspects', start.clues === 4 && start.suspects === 4, start.clues + '/' + start.suspects);
      ok(vp.name + ': the counter reads one case, not a level', start.case === '1/1', start.case);
      ok(vp.name + ': no next case skip button', !start.nextBtn);
      ok(vp.name + ': the case starts open with nothing crossed out', start.crossed === 0 && start.disabled === 0);
      ok(vp.name + ': the replay button is hidden until the case closes', start.replayShown === false);
      ok(vp.name + ': three chances are shown', start.energy === '3', start.energy);
      ok(vp.name + ': no sideways scrolling', !start.scrolls);

      // cross the three the evidence rules out, then accuse the fourth
      await crossOut(page, 'Owl');
      await crossOut(page, 'Fox');
      const twoOut = await page.evaluate(SNAP);
      ok(vp.name + ': tapping suspects crosses them out one by one', twoOut.crossed === 2, String(twoOut.crossed));
      await crossOut(page, 'Chef');
      await accuse(page, 'Gardener');
      const solved = await page.evaluate(SNAP);
      ok(vp.name + ': the right accusation closes the case', /case closed/i.test(solved.feedback), solved.feedback.slice(0, 60));
      ok(vp.name + ': the verdict names the culprit and the evidence',
         /gardener/i.test(solved.feedback) && /clue|hose|boots|crumbs/i.test(solved.feedback), solved.feedback.slice(0, 90));
      ok(vp.name + ': the board shows who the clues pointed at', solved.disabled === 4, String(solved.disabled));
      ok(vp.name + ': a score is banked', Number(solved.score) > 0, solved.score);
      ok(vp.name + ': the counter reads closed', /closed/i.test(solved.case), solved.case);
      ok(vp.name + ': the replay path appears', solved.replayShown === true);
      ok(vp.name + ': the clues are still readable after closing', solved.clues === 4, String(solved.clues));

      // replay reopens the same case, and the run can be lost kindly too
      await page.evaluate(() => document.getElementById('reset').click());
      await new Promise(r => setTimeout(r, 300));
      const replay = await page.evaluate(SNAP);
      ok(vp.name + ': replay reopens the case clean',
         replay.crossed === 0 && replay.disabled === 0 && replay.energy === '3' && replay.case === '1/1' && !replay.replayShown,
         JSON.stringify({ crossed: replay.crossed, energy: replay.energy, case: replay.case }));

      // three wrong accusations ends it kindly rather than leaving a dead board
      for (const wrong of ['Owl', 'Fox', 'Chef']) {
        await accuse(page, wrong);
        const st = await page.evaluate(SNAP);
        if (/out of chances/i.test(st.feedback)) break;
      }
      const lost = await page.evaluate(SNAP);
      ok(vp.name + ': running out of chances ends the case kindly',
         /out of chances/i.test(lost.feedback) && lost.replayShown === true, lost.feedback.slice(0, 70));
      ok(vp.name + ': the kind ending still explains the answer',
         /gardener/i.test(lost.feedback), lost.feedback.slice(0, 90));
      ok(vp.name + ': no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }
    await warm.close();

    const html = fs.readFileSync(path.join(ROOT, 'games', 'echo-casebook.html'), 'utf8');
    ok('no case ladder left in the page', !/caze|Next \/ replay|id="next"/.test(html));
    ok('the page promises one case', /one case/i.test(html));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nEcho's Casebook: all checks passed");
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('harness error', e); process.exit(1); });
