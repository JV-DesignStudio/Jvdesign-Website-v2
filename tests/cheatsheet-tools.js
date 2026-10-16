// A1593: every engine cheat sheet gets a pinned version badge, copy-to-clipboard
// and search, and the Unity / Minecraft Forge / SFML content is corrected.
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff' };

let failures = 0;
function check(name, ok, detail = '') { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; }

const PAGES = [
  { slug: 'godot', version: null },
  { slug: 'unity', version: 'Unity 6' },
  { slug: 'minecraft', version: 'Minecraft 1.20.1 / Forge 47' },
  { slug: 'cpp', version: 'SFML 3.0 (C++17)' },
  { slug: 'python', version: 'Python 3.12 / Pygame 2.6' },
  { slug: 'unreal', version: 'Unreal Engine 5.4' }
];

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
    for (const p of PAGES) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.setRequestInterception(true);
      page.on('request', (r) => (r.url().startsWith(base) || r.url().startsWith('data:')) ? r.continue() : r.abort());
      await page.setViewport({ width: 1440, height: 900 });
      await page.goto(base + '/tools/' + p.slug + '-cheatsheet.html', { waitUntil: 'load' });
      if (await page.$('#cookie-decline')) await page.click('#cookie-decline');

      const res = await page.evaluate(async () => {
        const search = document.querySelector('.cheat-search');
        const all = Array.prototype.slice.call(document.querySelectorAll('.sheet-card'));
        const before = all.filter((c) => !c.hidden).length;
        let after = null;
        if (search) {
          search.value = 'zzznomatch';
          search.dispatchEvent(new Event('input', { bubbles: true }));
          after = all.filter((c) => !c.hidden).length;
          search.value = '';
          search.dispatchEvent(new Event('input', { bubbles: true }));
        }
        let copied = null;
        const btn = document.querySelector('.cheat-copy');
        if (btn) {
          try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.resolve() }, configurable: true }); } catch (e) {}
          btn.click();
          await new Promise((r) => setTimeout(r, 40));
          copied = btn.textContent.trim();
        }
        return {
          version: (document.querySelector('.cheat-version') || {}).textContent || '',
          hasSearch: !!search,
          before, after,
          copyCount: document.querySelectorAll('.cheat-copy').length,
          copied,
          cards: all.length,
          text: document.body.innerText,
          sw: document.documentElement.scrollWidth,
          cw: document.documentElement.clientWidth
        };
      });

      const label = p.slug;
      check(label + ': renders cards', res.cards >= 6, 'cards ' + res.cards);
      check(label + ': search box present and filters', res.hasSearch && res.after === 0 && res.before === res.cards, `before ${res.before} after ${res.after}`);
      check(label + ': copy button on code cards', res.copyCount >= 1 && res.copied === 'Copied', 'copy ' + res.copyCount + ' -> ' + res.copied);
      if (p.version) check(label + ': pinned version badge', res.version.indexOf(p.version) === 0 || res.version.indexOf(p.version) >= 0, res.version);
      check(label + ': no overflow at 1440', res.sw <= res.cw + 2, res.sw + '/' + res.cw);
      check(label + ': no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));

      if (p.slug === 'unity') {
        check('unity: uses rb.linearVelocity, not rb.velocity', res.text.indexOf('rb.linearVelocity') >= 0 && res.text.indexOf('rb.velocity') === -1);
      }
      if (p.slug === 'minecraft') {
        check('minecraft: removed the removed .tab() API', res.text.indexOf('.tab(CreativeModeTab') === -1, 'still has .tab(');
      }
      if (p.slug === 'cpp') {
        check('cpp: SFML 3 API (VideoMode braces, optional pollEvent)', res.text.indexOf('SFML 3.0') >= 0 && res.text.indexOf('VideoMode({') >= 0 && res.text.indexOf('pollEvent(event)') === -1);
      }

      await page.setViewport({ width: 390, height: 844, isMobile: true });
      await page.reload({ waitUntil: 'load' });
      const mob = await page.evaluate(() => document.documentElement.scrollWidth);
      check(label + ': no overflow at 390', mob <= 392, 'scrollWidth ' + mob);
      await page.close();
    }
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
  console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nALL CHEATSHEET TOOLS CHECKS PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
