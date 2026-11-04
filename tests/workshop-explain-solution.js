// workshop-explain-solution.js - A2284 / A2285 regression guard.
//
// After a step, the learner can explain it back in their own words, and the
// solution is annotated with per-line notes instead of being dumped in bare.
// Both are optional and persist with the step.
//
// Run: node tests/workshop-explain-solution.js
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

      const hasExplain = await page.evaluate(() => !!document.querySelector('#card-1 .cw-explain-back'));
      check(tag + ' step 1 asks the learner to explain it back', hasExplain);

      await page.evaluate(() => {
        const ta = document.getElementById('explain-1');
        ta.value = 'fillStyle picks the colour and fillRect paints the rectangle.';
        document.querySelector('#card-1 [data-cw="saveExplain"]').click();
      });
      const saved = await page.evaluate(() => {
        const fb = document.getElementById('explain-fb-1');
        return fb ? fb.textContent : '';
      });
      check(tag + ' explain answer saves', /Saved/.test(saved), saved);

      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => window.CW && window.CW_CONFIG, { timeout: 8000 });
      const restored = await page.evaluate(() => {
        const ta = document.getElementById('explain-1');
        return ta ? ta.value : '';
      });
      check(tag + ' explain answer survives a reload', /fillStyle/.test(restored), restored);

      const notes = await page.evaluate(() => {
        window.CW.showSolution(1);
        const box = document.querySelector('#card-1 .cw-sol-notes');
        return {
          text: box ? box.textContent : '',
          hasSolution: (document.getElementById('editor-1') || {}).value || ''
        };
      });
      check(tag + ' annotated solution shows per-line notes',
        /Why each line is there/.test(notes.text) && /fillRect/.test(notes.text) && /fillRect/.test(notes.hasSolution),
        notes.text.slice(0, 80));

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      check(tag + ' explain and notes do not overflow', overflow);
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nPASS: explain-it-back and annotated solutions work at 1440 and 390');
})().catch((e) => { console.error(e); process.exit(1); });
