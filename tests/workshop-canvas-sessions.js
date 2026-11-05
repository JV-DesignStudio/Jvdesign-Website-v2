// workshop-canvas-sessions.js - A2287 regression guard.
//
// Canvas build-alongs now show an estimated time per step, mark a natural
// stop every three steps, and point a returning learner at the last step they
// finished with a one-click resume.
//
// Run: node tests/workshop-canvas-sessions.js
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

(async () => {
  let failures = 0;
  const check = (name, ok, detail = '') => {
    console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
    if (!ok) failures++;
  };

  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = path.join(root, u);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing ' + u); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  server.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', (r) => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());

    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(base + '/workshops/js-snake-canvas.html', { waitUntil: 'load' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.CW && window.CW_CONFIG && window.CW_CONFIG.steps, { timeout: 8000 });

    const fresh = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.cw-step'));
      return {
        steps: cards.length,
        times: cards.map((c) => {
          const el = c.querySelector('.cw-step-time');
          return el ? el.textContent.trim() : null;
        }),
        breaks: Array.from(document.querySelectorAll('.cw-break')).map((b) => b.textContent.trim()),
        breakAfterStep3: !!(document.getElementById('card-3') && document.getElementById('card-3').nextElementSibling &&
          document.getElementById('card-3').nextElementSibling.classList.contains('cw-break')),
        resume: !!document.querySelector('.cw-resume'),
        stopped: !!document.querySelector('.cw-last-done-tag')
      };
    });

    check('every step shows an estimated time',
      fresh.times.length === fresh.steps && fresh.times.every((t) => /^~\d+ min$/.test(t || '')),
      JSON.stringify(fresh.times));
    check('a stop marker appears after the third step',
      fresh.breaks.length === 1 && fresh.breakAfterStep3 && /Good place to stop/i.test(fresh.breaks[0]),
      JSON.stringify(fresh.breaks));
    check('no resume prompt or stopped marker on a fresh lesson',
      !fresh.resume && !fresh.stopped);

    // A learner who finished three steps and came back.
    await page.evaluate(() => localStorage.setItem('jvds-js-snake-canvas',
      JSON.stringify({ currentStep: 3, completed: { 1: 'a', 2: 'b', 3: 'c' }, codes: {} })));
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.CW && window.CW_CONFIG, { timeout: 8000 });
    // Show the build phase so the editor can actually take focus.
    await page.evaluate(() => {
      const b = document.getElementById('designStartBtn');
      if (b) b.click();
    });
    await new Promise((r) => setTimeout(r, 100));

    const back = await page.evaluate(() => {
      const box = document.querySelector('.cw-resume');
      const card3 = document.getElementById('card-3');
      return {
        text: box ? box.textContent : '',
        button: box && box.querySelector('[data-cw="resumeStep"]') ? box.querySelector('[data-cw="resumeStep"]').textContent : null,
        stopped: !!(card3 && card3.querySelector('.cw-last-done-tag'))
      };
    });
    check('returning points at the last completed step',
      /step 3/i.test(back.text) && /step 4/i.test(back.text) && back.stopped, JSON.stringify(back));
    check('resume button names the next step', /step 4/i.test(back.button || ''), back.button || '');

    await page.evaluate(() => {
      const btn = document.querySelector('.cw-resume [data-cw="resumeStep"]');
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 300));
    const resumed = await page.evaluate(() => {
      const ed = document.getElementById('editor-4');
      return {
        active: document.activeElement ? document.activeElement.id : '',
        boxGone: !document.querySelector('.cw-resume'),
        hasEditor: !!ed,
        disabled: ed ? ed.disabled : null,
        activeCard: (document.getElementById('card-4') || {}).className || ''
      };
    });
    check('resume focuses the next step editor and dismisses the prompt',
      resumed.active === 'editor-4' && resumed.boxGone, JSON.stringify(resumed));

    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.reload({ waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 500));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    check('session markers do not overflow at 390px', overflow);

    check('no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }

  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nPASS: per-step time, stop markers and resume work at 1440 and 390');
})().catch((e) => { console.error(e); process.exit(1); });
