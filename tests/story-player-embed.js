// A1596: Story Player embed mode. A ?embed=1 story renders chrome-free (no brand,
// footer or promos) and stays usable at 390px, while the plain link is unchanged.
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff' };

let failures = 0;
function check(name, ok, detail = '') { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; }

const story = {
  meta: { name: 'Embed Tale' },
  characters: [{ name: 'Narrator', emoji: '✨' }],
  variables: [],
  nodes: [
    { id: 'n1', type: 'choice', char: 'Narrator', text: 'Once upon a time. What next?', choices: [{ text: 'Open the door', to: 'n3' }, { text: 'Walk away', to: 'n4' }] },
    { id: 'n3', type: 'end', char: 'Narrator', text: 'You found treasure.' },
    { id: 'n4', type: 'end', char: 'Narrator', text: 'You went home.' }
  ]
};
const hash = '#s=' + Buffer.from(JSON.stringify(story), 'utf8').toString('base64');

(async () => {
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const f = path.join(root, u);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing'); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  server.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  try {
    // ---- Plain link still works (390) ----
    {
      const errors = [];
      const page = await browser.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      await page.setRequestInterception(true);
      page.on('request', (r) => (r.url().startsWith(base) || r.url().startsWith('data:')) ? r.continue() : r.abort());
      await page.setViewport({ width: 390, height: 844, isMobile: true });
      await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) {} });
      await page.goto(base + '/tools/story-player.html' + hash, { waitUntil: 'load' });
      const out = await page.evaluate(() => {
        const vis = (sel) => { const el = document.querySelector(sel); return !!el && getComputedStyle(el).display !== 'none'; };
        return {
          embedClass: document.documentElement.classList.contains('story-embed'),
          brand: vis('.brand'),
          footer: vis('.jvds-tools-footer'),
          card: vis('#card'),
          title: (document.getElementById('stTitle') || {}).textContent || '',
          text: (document.getElementById('scene') || {}).textContent || '',
          embedBtn: !!document.querySelector('.m-share'),
          choiceCount: document.querySelectorAll('.sc-choice:not([disabled])').length,
          sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth
        };
      });
      check('plain: story renders', out.card && out.title === 'Embed Tale' && out.text.indexOf('Once upon a time') >= 0, out.title);
      check('plain: keeps the site chrome', out.brand && out.footer && out.embedBtn);
      check('plain: not in embed mode', !out.embedClass);
      check('plain: choices are playable', out.choiceCount === 2, 'choices ' + out.choiceCount);
      check('plain: no overflow at 390', out.sw <= out.cw + 2, out.sw + '/' + out.cw);
      check('plain: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));

      // Embed snippet via the Embed button
      const snippet = await page.evaluate(async () => {
        const captured = [];
        try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { captured.push(t); return Promise.resolve(); } }, configurable: true }); } catch (e) {}
        const btn = document.querySelector('.m-share');
        if (btn) btn.click();
        await new Promise((r) => setTimeout(r, 40));
        return captured[0] || '';
      });
      check('plain: Embed copies an iframe snippet with ?embed=1', snippet.indexOf('<iframe') >= 0 && snippet.indexOf('?embed=1#s=') >= 0, snippet.slice(0, 80));
      await page.close();
    }

    // ---- Embed mode (390) ----
    {
      const errors = [];
      const page = await browser.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      await page.setRequestInterception(true);
      page.on('request', (r) => (r.url().startsWith(base) || r.url().startsWith('data:')) ? r.continue() : r.abort());
      await page.setViewport({ width: 390, height: 844, isMobile: true });
      await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) {} });
      await page.goto(base + '/tools/story-player.html?embed=1' + hash, { waitUntil: 'load' });
      const out = await page.evaluate(() => {
        const vis = (sel) => { const el = document.querySelector(sel); return !!el && getComputedStyle(el).display !== 'none'; };
        return {
          embedClass: document.documentElement.classList.contains('story-embed'),
          brand: vis('.brand'),
          footer: vis('.jvds-tools-footer'),
          promo: vis('#card > p.use-it-with'),
          charTouch: vis('.char-touch'),
          share: vis('.m-cancel'),
          embedBtn: vis('.m-share'),
          restart: vis('.m-ok'),
          text: (document.getElementById('scene') || {}).textContent || '',
          choices: document.querySelectorAll('.sc-choice:not([disabled])').length,
          sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth
        };
      });
      check('embed: chrome-free (no brand, footer, promo, char-touch)', out.embedClass && !out.brand && !out.footer && !out.promo && !out.charTouch, JSON.stringify(out));
      check('embed: share/embed buttons hidden, restart kept', !out.share && !out.embedBtn && out.restart);
      check('embed: story renders and is playable', out.text.indexOf('Once upon a time') >= 0 && out.choices === 2, out.text.slice(0, 40));
      check('embed: no overflow at 390', out.sw <= out.cw + 2, out.sw + '/' + out.cw);
      check('embed: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));

      // walking a choice still works in embed
      await page.evaluate(() => { document.querySelectorAll('.sc-choice')[0].click(); });
      await new Promise((r) => setTimeout(r, 60));
      const after = await page.evaluate(() => (document.getElementById('scene') || {}).textContent || '');
      check('embed: choice advances the story', after.indexOf('treasure') >= 0, after.slice(0, 40));
      await page.close();
    }
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL STORY PLAYER EMBED CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
