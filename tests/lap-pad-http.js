/* tools/lap-pad.html page check (A3129).

   The Lap Pad is the ages 5-6 first step: big colours, tap to paint, save or
   print, no reading needed. This checks the real page at 390 and 1440 and the
   homepage two-door links that point at it.

   Run: node tests/lap-pad-http.js
*/
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
  if (!ok) failures++;
}
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
const R = path.normalize(root);
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.normalize(path.join(root, u));
  if (!f.startsWith(R) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing'); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    for (const vp of [{ width: 1440, height: 900, name: '1440' }, { width: 390, height: 844, name: '390' }]) {
      const page = await browser.newPage(), errors = [];
      if (page.setBypassServiceWorker) await page.setBypassServiceWorker(true);
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error' && !/ERR_NETWORK|Failed to load resource|ERR_ABORTED|ERR_FILE|ERR_FAILED/.test(m.text())) errors.push(m.text().slice(0, 80)); });
      await page.setRequestInterception(true);
      page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 700 });
      const res = await page.goto(base + '/tools/lap-pad.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('.lp-cell', { timeout: 10000 });
      await new Promise(r => setTimeout(r, 250));

      const d = await page.evaluate(() => ({
        title: document.title,
        cells: document.querySelectorAll('.lp-cell').length,
        swatches: document.querySelectorAll('.lp-swatch').length,
        steps: document.querySelectorAll('.lp-steps li').length,
        ember: !!document.querySelector('img[alt="Ember"]'),
        text: document.body.innerText,
        status: (document.getElementById('lpStatus') || {}).textContent || '',
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      check(vp.name + ' page returns 200', res && res.status() === 200, res ? String(res.status()) : 'no response');
      check(vp.name + ' title names the Lap Pad', /lap pad/i.test(d.title), d.title);
      check(vp.name + ' has 36 big painting squares', d.cells === 36, String(d.cells));
      check(vp.name + ' has big colour choices', d.swatches >= 9, String(d.swatches));
      check(vp.name + ' shows three steps', d.steps === 3, String(d.steps));
      check(vp.name + ' has Ember', d.ember);
      check(vp.name + ' no classroom, teacher or student wording', !/classroom|teacher|student|pupil|lesson plan/i.test(d.text));
      check(vp.name + ' no horizontal overflow', d.overflow <= 2, 'overflow=' + d.overflow);

      await page.click('#lpColours .lp-swatch:nth-child(5)');
      await page.click('.lp-cell[data-i="10"]');
      const painted = await page.evaluate(() => {
        const c = document.querySelector('.lp-cell[data-i="10"]');
        return { filled: c.getAttribute('data-filled'), bg: getComputedStyle(c).backgroundColor };
      });
      check(vp.name + ' tapping a colour then a square paints it', painted.filled === '1' && !/255, 255, 255/.test(painted.bg), JSON.stringify(painted));

      await page.click('#lpClear');
      const cleared = await page.evaluate(() => document.querySelector('.lp-cell[data-i="10"]').getAttribute('data-filled'));
      check(vp.name + ' start again clears the picture', cleared === '0', cleared);

      await page.click('.lp-shape[data-shape="star"]');
      const star = await page.evaluate(() => ({
        pressed: document.querySelector('.lp-shape[data-shape="star"]').getAttribute('aria-pressed'),
        guide: document.querySelector('.lp-cell[data-i="3"]').getAttribute('data-guide'),
      }));
      check(vp.name + ' shape switch shows the star guide', star.pressed === 'true' && star.guide === '1', JSON.stringify(star));

      await page.click('#lpColours .lp-swatch:nth-child(3)');
      await page.click('.lp-cell[data-i="10"]');
      await page.click('#lpMove');
      await new Promise(r => setTimeout(r, 500));
      const moving = await page.evaluate(() => ({
        animating: document.getElementById('lpBoard').getAttribute('data-animating'),
        stopVisible: !document.getElementById('lpStop').hidden,
        noteVisible: !document.getElementById('lpMoveNote').hidden,
        painted: document.querySelectorAll('.lp-cell[data-filled="1"]').length,
      }));
      check(vp.name + ' make it move animates the picture', moving.animating === '1' && moving.stopVisible && moving.noteVisible, JSON.stringify(moving));
      await page.click('#lpStop');
      const stopped = await page.evaluate(() => ({
        animating: document.getElementById('lpBoard').getAttribute('data-animating'),
        stopHidden: document.getElementById('lpStop').hidden,
        filled: document.querySelector('.lp-cell[data-i="10"]').getAttribute('data-filled'),
      }));
      check(vp.name + ' stop restores the picture', !stopped.animating && stopped.stopHidden && stopped.filled === '1', JSON.stringify(stopped));

      const controls = await page.evaluate(() => ({
        save: !!document.getElementById('lpSave'),
        print: !!document.getElementById('lpPrint'),
        clear: !!document.getElementById('lpClear'),
      }));
      check(vp.name + ' save, print and start again controls exist', controls.save && controls.print && controls.clear, JSON.stringify(controls));

      await page.evaluate(() => document.getElementById('lpSave').click());
      await new Promise(r => setTimeout(r, 300));
      const prompt = await page.evaluate(() => !document.getElementById('lpParentPrompt').hidden);
      check(vp.name + ' saving shows the grown-up prompt', prompt === true, String(prompt));
      check(vp.name + ' no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
      await page.close();
    }

    // Static: the homepage two-door first step points at both paths.
    const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const lap = fs.readFileSync(path.join(root, 'tools', 'lap-pad.html'), 'utf8');
    check('homepage links to the Lap Pad', /href="\/tools\/lap-pad\.html"/.test(home));
    check('homepage keeps the guided first step', /href="\/workshops\/start-here\.html"/.test(home));
    check('homepage names both doors', /Making together/.test(home) && /Making on my own/.test(home));
    check('homepage puts the doors before the first make', home.indexOf('id="start-here"') > -1 && home.indexOf('id="start-here"') < home.indexOf('id="first-make"'));
    check('homepage hero points at the doors', /href="#start-here"/.test(home));
    check('the 7+ door opens the explorer path', /start-here\.html\?who=explorer/.test(home));
    check('lap pad links on to Pixel Studio', /pixel-studio\.html#first-mission/.test(lap));
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) { console.log('\n' + failures + ' LAP PAD CHECK(S) FAILED'); process.exit(1); }
  console.log('\nALL LAP PAD CHECKS PASSED');
})();
