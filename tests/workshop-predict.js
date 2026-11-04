// workshop-predict.js - A2282 regression guard.
//
// Converted steps ask the learner to predict the result before they run the
// code. The prediction is optional: answering it gives a right/wrong reveal and
// persists across reloads, but skipping it never blocks the code check.
//
// Run: node tests/workshop-predict.js
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

      const hasBox = await page.evaluate(() => !!document.querySelector('#card-1 .cw-predict'));
      check(tag + ' step 1 asks for a prediction', hasBox);

      // Step 1's correct option is index 1, so index 0 is deliberately wrong.
      await page.evaluate(() => {
        const opts = document.querySelectorAll('#predict-opts-1 .cw-predict-opt');
        opts[0].click();
        document.querySelector('#card-1 [data-cw="checkPredict"]').click();
      });
      const wrong = await page.evaluate(() => {
        const fb = document.getElementById('predict-fb-1');
        const opts = document.querySelectorAll('#predict-opts-1 .cw-predict-opt');
        return {
          text: fb ? fb.textContent : '',
          correctMarked: opts[1] && opts[1].classList.contains('correct'),
          wrongMarked: opts[0] && opts[0].classList.contains('wrong'),
          locked: !document.querySelector('#card-1 [data-cw="checkPredict"]')
        };
      });
      check(tag + ' wrong prediction is revealed and locked',
        /Not quite/.test(wrong.text) && wrong.correctMarked && wrong.wrongMarked && wrong.locked, wrong.text);

      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => window.CW && window.CW_CONFIG, { timeout: 8000 });
      const restored = await page.evaluate(() => {
        const opts = document.querySelectorAll('#predict-opts-1 .cw-predict-opt');
        return {
          locked: !document.querySelector('#card-1 [data-cw="checkPredict"]'),
          correctMarked: opts[1] && opts[1].classList.contains('correct')
        };
      });
      check(tag + ' prediction survives a reload', restored.locked && restored.correctMarked);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      check(tag + ' prediction box does not overflow', overflow);
    }

    // Skipping the prediction must never block the code check.
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(base + '/workshops/js-flappy-workshop.html', { waitUntil: 'load' });
    await page.waitForFunction(() => window.CW && window.CW_CONFIG && window.CW_CONFIG.steps, { timeout: 8000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.CW && window.CW_CONFIG, { timeout: 8000 });
    const skip = await page.evaluate(() => {
      const step = window.CW_CONFIG.steps.find((s) => s.num === 1);
      const ta = document.getElementById('editor-1');
      ta.disabled = false; ta.readOnly = false; ta.value = step.solution;
      window.CW.checkStep(1);
      const fb = document.getElementById('feedback-1');
      return { text: fb.textContent, success: fb.classList.contains('success') };
    });
    check('skipping the prediction does not block the code check',
      skip.success && /correct|complete/i.test(skip.text), skip.text);
  } finally {
    await browser.close();
    server.close();
  }

  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nPASS: predict-before-run works and never blocks at 1440 and 390');
})().catch((e) => { console.error(e); process.exit(1); });
