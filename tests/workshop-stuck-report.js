// workshop-stuck-report.js - A2342 regression guard.
//
// A learner can flag a step as broken from inside the workshop. The report is
// stored locally (workshop, step, note) and appears on My Progress. No network.
//
// Run: node tests/workshop-stuck-report.js
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

      const controls = await page.evaluate(() => document.querySelectorAll('.cw-report').length);
      check(tag + ' every canvas step has a report control', controls === 6, 'controls ' + controls);

      await page.evaluate(() => {
        document.getElementById('report-note-1').value = 'The canvas stays blank when I press Check.';
        document.querySelector('#card-1 [data-cw="reportStep"]').click();
      });
      const stored = await page.evaluate(() => {
        const fb = document.getElementById('report-fb-1');
        let items = [];
        try { items = JSON.parse(localStorage.getItem('jvds_stuck_reports') || '[]'); } catch (e) {}
        return { fb: fb ? fb.textContent : '', items };
      });
      check(tag + ' report is saved locally',
        /Reported/.test(stored.fb) && stored.items.length === 1 &&
        stored.items[0].workshop === 'js-flappy-workshop.html' &&
        stored.items[0].step === 1 &&
        /blank when I press Check/.test(stored.items[0].note),
        stored.fb);

      await page.goto(base + '/workshops/my-progress.html', { waitUntil: 'load' });
      await page.waitForFunction(() => {
        const s = document.getElementById('stuckReports');
        return s && s.style.display !== 'none';
      }, { timeout: 8000 });
      const panel = await page.evaluate(() => {
        const s = document.getElementById('stuckReports');
        return { visible: s && s.style.display !== 'none', text: s ? s.textContent : '' };
      });
      check(tag + ' My Progress lists the reported step',
        panel.visible && /js-flappy-workshop\.html/.test(panel.text) && /blank when I press Check/.test(panel.text),
        panel.text.replace(/\s+/g, ' ').slice(0, 100));

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      check(tag + ' reported-steps panel does not overflow', overflow);
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nPASS: broken-step reports save locally and appear on My Progress at 1440 and 390');
})().catch((e) => { console.error(e); process.exit(1); });
