/* tests/games-onboarding.js (A1676)
 *
 * Every catalogued game must show Goal + Controls (and what it is practising)
 * before play, and one Echo improvement tip after a run. The arcade cabinet
 * must surface the registry's learning field.
 *
 * Run: node tests/games-onboarding.js
 */
const fs = require('fs'), http = require('http'), path = require('path'), vm = require('vm');
const puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4' };

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'games-registry.js'), 'utf8'), ctx);
const ALL_GAMES = ctx.window.JVDS_GAMES;
const ONLY = process.env.ONLY;
const GAMES = ONLY ? ALL_GAMES.filter(g => g.id === ONLY) : ALL_GAMES;

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

function staticChecks() {
  for (const g of GAMES) {
    const p = path.join(ROOT, 'games', g.file);
    const html = fs.readFileSync(p, 'utf8');
    check(g.id + ': page loads the onboarding module', /assets\/js\/game-onboarding\.js/.test(html));
    check(g.id + ': page loads the registry', /games-registry\.js/.test(html));
  }
  const arcade = fs.readFileSync(path.join(ROOT, 'arcade.html'), 'utf8');
  check('arcade renders the learning field', /g\.learning/.test(arcade) && /cab-learn/.test(arcade));
  const css = fs.readFileSync(path.join(ROOT, 'assets', 'css', 'game-onboarding.css'), 'utf8');
  check('onboarding stylesheet exists', /jvds-onboard/.test(css));
}

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.normalize(path.join(ROOT, u));
  if (!f.startsWith(path.normalize(ROOT)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

async function gameCheck(browser, base, g) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message.split('\n')[0].slice(0, 120)));
  await page.setViewport({ width: 1280, height: 900 });
  try {
    await page.goto(base + '/games/' + g.file, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForSelector('#jvds-onboard', { timeout: 12000 });
    await sleep(150);
    const card = await page.evaluate(() => {
      const n = document.getElementById('jvds-onboard');
      if (!n) return null;
      const r = n.getBoundingClientRect();
      const s = getComputedStyle(n);
      return {
        visible: r.width > 1 && r.height > 1 && s.display !== 'none' && s.visibility !== 'hidden',
        text: (n.textContent || '').replace(/\s+/g, ' ').trim()
      };
    });
    check(g.id + ': goal/controls card is visible', card && card.visible, card ? card.text.slice(0, 60) : 'missing');
    check(g.id + ': card names Goal, Controls and Practising', !!card && /Goal:/.test(card.text) && /Controls:/.test(card.text) && /Practising:/.test(card.text), card ? card.text.slice(0, 90) : '');

    // Echo tip: record a run if the engine is present, then exercise the tip
    // UI directly (wrapper pages navigate if we click their play link).
    await page.evaluate(() => {
      try { if (window.GameSystem && GameSystem.lastInstance) GameSystem.lastInstance.recordGamePlay(1200); } catch (e) {}
      if (window.JVDSOnboarding) window.JVDSOnboarding.showTip();
    });
    await sleep(200);
    const tip = await page.evaluate(() => {
      const n = document.getElementById('jvds-echo-tip');
      if (!n || n.hidden) return '';
      return (n.textContent || '').replace(/\s+/g, ' ').trim();
    });
    const tipDebug = await page.evaluate(() => {
      const n = document.getElementById('jvds-echo-tip');
      return { hasModule: typeof window.JVDSOnboarding, hasNode: !!n, hidden: n ? n.hidden : null, disp: n ? getComputedStyle(n).display : null };
    });
    check(g.id + ': Echo tip shows after a run', /Echo says/.test(tip) && /Next run:/.test(tip), tip ? tip.slice(0, 80) : JSON.stringify(tipDebug));
    check(g.id + ': no page errors', errors.length === 0, errors.join(' | '));
  } catch (e) {
    check(g.id + ': onboarding harness', false, e.message.slice(0, 80));
  }
  await page.close();
}

(async () => {
  staticChecks();
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] });
  try {
    for (const g of GAMES) await gameCheck(browser, base, g);

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(base + '/arcade.html', { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForSelector('#grid .cab', { timeout: 12000 });
    const learn = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('#grid .cab')];
      return { count: cards.length, withLearn: cards.filter(c => c.querySelector('.cab-learn')).length, sample: (cards[0] && cards[0].querySelector('.cab-learn')) ? cards[0].querySelector('.cab-learn').textContent : '' };
    });
    check('arcade shows learning on every cabinet', learn.count > 0 && learn.withLearn === learn.count, learn.withLearn + '/' + learn.count + ' ' + learn.sample.slice(0, 50));
    await page.close();
  } finally {
    await browser.close();
    await new Promise(r => server.close(r));
  }
  console.log(failures ? '\n' + failures + ' FAILED' : '\nALL GAME ONBOARDING CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
