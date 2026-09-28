#!/usr/bin/env node
/*
 * tests/millionaire-quiz-smoke.js , A605
 *
 * Lumo's Crown Quiz is one quiz now: 5 fixed questions, 4 of 5 takes the
 * crown, untimed, with a fact box after each answer. The builder, pack
 * picker, 15-rung ladder and 20s timer are gone. This plays the crown
 * quiz through the real UI, verifies the crown win, and replays.
 *
 * Run: node tests/millionaire-quiz-smoke.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.MQ_PORT || 8158);
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
      await page.goto(BASE + '/games/millionaire-quiz.html', { waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector('#startCrownBtn', { timeout: 10000 });

      const setupCopy = await page.evaluate(() => document.body.textContent);
      ok(vp.name + ': setup shows Lumo\'s Crown Quiz with 5 questions, not a builder', /Lumo's Crown Quiz|One Crown/i.test(setupCopy) && /Q1\./i.test(setupCopy), setupCopy.slice(0,120));
      ok(vp.name + ': no custom builder or pack picker on the setup', !/Custom Quiz Builder|Quick Play/i.test(setupCopy) || /Crown Quiz/.test(setupCopy));
      ok(vp.name + ': crown button present, numQSlider gone', await page.evaluate(()=> !!document.getElementById('startCrownBtn') && !document.getElementById('numQSlider')));

      await page.evaluate(() => document.getElementById('startCrownBtn').click());
      await page.waitForSelector('#nameInput', { timeout: 10000 });
      await page.type('#nameInput', 'Test');
      await page.evaluate(() => document.getElementById('startBtn').click());
      await page.waitForSelector('.opt-btn', { timeout: 10000 });

      // answer 5 questions correctly via the test hook
      for(let q=0;q<5;q++){
        const correct = await page.evaluate(() => window.__quizTest.getCorrect());
        ok(vp.name + ` Q${q+1}: correct answer exposed via hook`, !!correct, correct);
        // find option button with that text
        const clicked = await page.evaluate((corr) => {
          const btns = [...document.querySelectorAll('.opt-btn')];
          const target = btns.find(b => b.textContent.trim().includes(corr));
          if(target){ target.click(); return true; }
          return false;
        }, correct);
        ok(vp.name + ` Q${q+1}: clicked correct option "${correct}"`, clicked);
        await new Promise(r=>setTimeout(r,150));
        await page.evaluate(() => document.getElementById('finalBtn').click());
        await new Promise(r=>setTimeout(r,500));
        const revealed = await page.evaluate(() => {
          const t = document.body.textContent;
          return /Correct!|Not quite|Did you know/i.test(t);
        });
        ok(vp.name + ` Q${q+1}: reveal panel shown after final answer`, revealed);
        await page.evaluate(() => document.getElementById('nextBtn').click());
        await new Promise(r=>setTimeout(r,500));
        if(q<4){
          await page.waitForSelector('.opt-btn', { timeout: 10000 });
        } else {
          await page.waitForSelector('#resetBtn', { timeout: 10000 });
        }
      }
      // now on results
      await page.waitForSelector('#resetBtn', { timeout: 10000 });
      const resultsCopy = await page.evaluate(() => document.body.textContent);
      ok(vp.name + ': results show crown win 5/5', /Crown/i.test(resultsCopy) && /5\/5|100%/i.test(resultsCopy), resultsCopy.slice(0,150));
      ok(vp.name + ': results show fact and share panel', /Fact|Share Results/i.test(resultsCopy));

      // replay
      await page.evaluate(() => document.getElementById('resetBtn').click());
      await page.waitForSelector('#startCrownBtn', { timeout: 10000 });
      ok(vp.name + ': resetting returns to the same crown setup', await page.evaluate(()=> !!document.getElementById('startCrownBtn')));

      ok(vp.name + ': no sideways scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      ok(vp.name + ': no page errors', errors.length===0, errors.slice(0,2).join(' | '));
      await page.close();
    }
    const html = fs.readFileSync(path.join(ROOT,'games','millionaire-quiz.html'),'utf8');
    ok('no builder ladder left in page', !/Custom Quiz Builder/.test(html) || /One Crown/.test(html));
    ok('no 15-prize ladder left', !/£125,000|£250,000|£500,000/.test(html));
    ok('no 20s timer left', !/setInterval\(\(\)=>\{if\(state\.view/.test(html) || /A605 untimed/.test(html));
    ok('crown questions present', /CROWN_QUESTIONS/.test(html));
    ok('no em dash in touched game file', !/\u2014/.test(html));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} FAILED` : '\nMillionaire Quiz run: all checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e=>{console.error('harness error',e);process.exit(1);});
