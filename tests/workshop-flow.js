// workshop-flow.js - A3127 regression guard.
//
// The shared workshop engine now carries the learner flow: a progress spine
// with step kinds, a character phase header, step-kind colour bars and a
// resume prompt. This drives a pure engine workshop (no canvas engine) at
// 1440 and 390 and checks the flow survives a reload.
//
// Run: node tests/workshop-flow.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2'
};
const PAGE = '/workshops/blender-cube-workshop.html';

(async () => {
  let failures = 0;
  const check = (name, ok, detail) => {
    console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : ''));
    if (!ok) failures++;
  };

  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = path.join(root, u);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404); return res.end('missing ' + u);
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  server.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setRequestInterception(true);
    page.on('request', (r) => (r.url().startsWith(base) || r.url().startsWith('data:')) ? r.continue() : r.abort());

    for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const tag = vp.width + 'x' + vp.height;
      await page.setViewport(vp);
      await page.goto(base + PAGE, { waitUntil: 'load' });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => document.querySelector('.ws-spine .ws-node'), { timeout: 8000 });

      const flow = await page.evaluate(() => {
        const total = window.WORKSHOP_TOTAL || 0;
        return {
          total,
          key: window.WORKSHOP_KEY || '',
          nodes: document.querySelectorAll('.ws-spine .ws-node').length,
          chips: document.querySelectorAll('.ws-phase-head .ws-phase-chip').length,
          activeChips: document.querySelectorAll('.ws-phase-chip[data-on="1"]').length,
          kinds: [...document.querySelectorAll('.step-card')].map((c) => c.getAttribute('data-ws-kind')),
          css: !!document.getElementById('ws-flow-css'),
          now: (document.querySelector('.ws-now') || {}).textContent || '',
          overflow: document.documentElement.scrollWidth <= window.innerWidth + 1
        };
      });
      check(tag + ' spine shows one node per step', flow.nodes === flow.total, flow.nodes + '/' + flow.total);
      check(tag + ' phase header has four chips with one active', flow.chips === 4 && flow.activeChips === 1, flow.chips + ' chips, ' + flow.activeChips + ' active');
      check(tag + ' every step card has a kind', flow.kinds.length === flow.total && flow.kinds.every(Boolean), flow.kinds.join(','));
      check(tag + ' flow stylesheet is injected', flow.css);
      check(tag + ' now-line names a character', /Lumo|Ember|Pip|Echo/.test(flow.now), flow.now.trim());
      check(tag + ' no horizontal overflow', flow.overflow);

      // Seed a part-finished save and reload: the learner must be offered a resume.
      await page.evaluate(() => {
        localStorage.setItem(window.WORKSHOP_KEY, JSON.stringify({
          version: 1, completed: [1, 2], total: window.WORKSHOP_TOTAL,
          xp: 30, level: 1, streak: 0, bestStreak: 0, totalQuizzes: 2, correctFirst: 2
        }));
      });
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => document.querySelector('.ws-resume'), { timeout: 8000 });
      const resume = await page.evaluate(() => {
        const box = document.querySelector('.ws-resume');
        return {
          text: box ? box.textContent : '',
          step3Open: !document.getElementById('step-3').classList.contains('locked'),
          overflow: document.documentElement.scrollWidth <= window.innerWidth + 1
        };
      });
      check(tag + ' resume prompt names the next step', /step 3/i.test(resume.text), resume.text.trim().slice(0, 80));
      check(tag + ' resume unlocks the next step', resume.step3Open);
      check(tag + ' resume prompt does not overflow', resume.overflow);

      await page.$eval('.ws-resume-btn.primary', (b) => b.click());
      await page.waitForFunction(() => !document.querySelector('.ws-resume'), { timeout: 4000 }).catch(() => {});
      const dismissed = await page.evaluate(() => !document.querySelector('.ws-resume'));
      check(tag + ' carry on dismisses the prompt', dismissed);
    }

    check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }

  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nPASS: workshop flow spine, step kinds and resume work at 1440 and 390');
})().catch((e) => { console.error(e); process.exit(1); });
