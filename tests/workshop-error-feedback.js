// workshop-error-feedback.js - A2266 regression guard.
//
// A failed canvas step used to say only "Almost! Make sure your code includes: X".
// It now diagnoses the failure: syntax vs logic, the missing behaviour, and
// expected vs actual. This test drives the real page at 1440 and 390 and checks
// that each failure names the problem without the old token-list message.
//
// Run: node tests/workshop-error-feedback.js
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

    const runCase = async (width, height) => {
      const tag = width + 'x' + height;
      await page.setViewport({ width, height });
      await page.goto(base + '/workshops/js-flappy-workshop.html', { waitUntil: 'load' });
      await page.waitForFunction(() => window.CW && window.CW_CONFIG && window.CW_CONFIG.steps, { timeout: 8000 });
      await page.evaluate(() => localStorage.clear());

      const feedback = (code) => page.evaluate((value) => {
        const ta = document.getElementById('editor-1');
        ta.disabled = false; ta.readOnly = false; ta.value = value;
        window.CW.checkStep(1);
        const fb = document.getElementById('feedback-1');
        return { text: fb ? fb.textContent : '', error: fb ? fb.classList.contains('error') : false };
      }, code);

      const logic = await feedback('ctx.fillStyle = "#70c5ce";');
      check(tag + ' logic failure names the missing behaviour', logic.error &&
        /Not yet\./.test(logic.text) && /Expected/.test(logic.text) && /Actual: not found/.test(logic.text) &&
        !/Make sure your code includes/.test(logic.text), logic.text);

      const syntax = await feedback('ctx.fillStyle = "#70c5ce";\nctx.fillRect(0, 0, 400, 500;');
      check(tag + ' syntax failure names the bracket', syntax.error &&
        /Syntax error/.test(syntax.text) && /bracket/.test(syntax.text), syntax.text);

      const blank = await feedback('ctx.___ = "#70c5ce";\nctx.___(0, 0, 400, 500);');
      check(tag + ' unfilled blank is named', blank.error && /blank to fill/.test(blank.text), blank.text);

      const empty = await feedback('// nothing yet');
      check(tag + ' empty editor is named', empty.error && /editor is empty/.test(empty.text), empty.text);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      check(tag + ' feedback does not overflow', overflow);
    };

    await runCase(1440, 900);
    await runCase(390, 844);

    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(base + '/workshops/js-snake-workshop.html', { waitUntil: 'load' });
    await page.waitForFunction(() => window.CW && window.CW_CONFIG && window.CW_CONFIG.steps, { timeout: 8000 });
    await page.evaluate(() => {
      const ta = document.getElementById('editor-1');
      ta.disabled = false; ta.readOnly = false;
      ta.value = '// unshift pop snake[0]\nvar cheat = 1;';
      window.CW.checkStep(1);
    });
    await page.waitForFunction(() => {
      const fb = document.getElementById('feedback-1');
      return fb && fb.classList.contains('error');
    }, { timeout: 8000 });
    const testFail = await page.evaluate(() => document.getElementById('feedback-1').textContent);
    check('executable test failure names the test and expected vs actual',
      /Test "/.test(testFail) && /Expected:/.test(testFail) && /Actual:/.test(testFail), testFail);
  } finally {
    await browser.close();
    server.close();
  }

  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nPASS: workshop error feedback names the failure at 1440 and 390');
})().catch((e) => { console.error(e); process.exit(1); });
