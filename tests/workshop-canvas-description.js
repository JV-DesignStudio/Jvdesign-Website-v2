// workshop-canvas-description.js - A2497 regression guard.
//
// The game runs in an iframe, so a screen reader cannot describe it. Each step
// now shows "What you should see" and the canvas carries an aria description
// drawn from the step's expected result.
//
// Run: node tests/workshop-canvas-description.js
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
    await page.setRequestInterception(true);
    page.on('request', (r) => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());

    for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const tag = vp.width + 'x' + vp.height;
      await page.setViewport(vp);
      await page.goto(base + '/workshops/js-flappy-workshop.html', { waitUntil: 'load' });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => window.CW && window.CW_CONFIG && window.CW_CONFIG.steps, { timeout: 8000 });

      const state = await page.evaluate(() => {
        const expect = document.querySelector('#card-1 .cw-expect');
        const frame = document.getElementById('gameFrame');
        const desc = document.getElementById('cwCanvasDesc');
        return {
          expectText: expect ? expect.textContent : '',
          label: frame ? frame.getAttribute('aria-label') : '',
          describedby: frame ? frame.getAttribute('aria-describedby') : '',
          descText: desc ? desc.textContent : '',
          descClass: desc ? desc.className : ''
        };
      });
      check(tag + ' step shows what the canvas should look like',
        /What you should see/.test(state.expectText) && /sky-blue/i.test(state.expectText), state.expectText);
      check(tag + ' canvas has an accessible name and description',
        !!state.label && state.describedby === 'cwCanvasDesc' && /sky-blue/i.test(state.descText),
        state.label + ' / ' + state.descText);
      check(tag + ' description is visually hidden', state.descClass === 'cw-sr', state.descClass);

      // Completing step 1 must move the description to step 2.
      await page.evaluate(() => {
        const step = window.CW_CONFIG.steps.find((s) => s.num === 1);
        const ta = document.getElementById('editor-1');
        ta.disabled = false; ta.readOnly = false; ta.value = step.solution;
        window.CW.checkStep(1);
        window.CW.selectQuiz(1, 1);
        window.CW.checkQuiz(1);
      });
      await page.waitForFunction(() => {
        const desc = document.getElementById('cwCanvasDesc');
        return desc && /falls/i.test(desc.textContent);
      }, { timeout: 8000 });
      const next = await page.evaluate(() => document.getElementById('cwCanvasDesc').textContent);
      check(tag + ' description follows the next step', /falls/i.test(next), next);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      check(tag + ' description does not overflow', overflow);
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nPASS: canvas expected-output description works at 1440 and 390');
})().catch((e) => { console.error(e); process.exit(1); });
