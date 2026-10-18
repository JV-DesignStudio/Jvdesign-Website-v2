/* Critter Whack landing-page parity (A1671).

   games/critter-whack-page.html is the registry file for the critter-whack
   arcade card and embeds games/critter-whack.html, which is "Critter Whack:
   Ranger Sort". This pins the public landing copy to the game it actually
   plays: Ranger Sort, Echo present, no stale whack-a-mole / bombs copy.

   Run: node tests/critter-whack-page-http.js
*/
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
let failures = 0;
function check(name, ok, detail = '') { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; }
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
const R = path.normalize(root);
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.normalize(path.join(root, u));
  if (!f.startsWith(R) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing'); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

const BANNED = /whack-a-mole|whack a mole|\bbombs?\b|bonk|duck back down|30 seconds of chaos/i;

(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/ERR_NETWORK|Failed to load resource|ERR_ABORTED|ERR_FILE|ERR_FAILED/.test(m.text())) errors.push(m.text().slice(0, 80)); });
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());

    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(base + '/games/critter-whack-page.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise(r => setTimeout(r, 600));
    const d = await page.evaluate(() => {
      const meta = n => { const e = document.querySelector(n); return e ? (e.getAttribute('content') || '') : ''; };
      return {
        title: document.title,
        desc: meta('meta[name="description"]'),
        og: meta('meta[property="og:description"]'),
        text: document.body.innerText,
        iframe: (document.querySelector('iframe') || {}).getAttribute ? document.querySelector('iframe').getAttribute('src') : '',
        echo: !!document.querySelector('meta[property="og:description"]') && /Echo/.test(document.querySelector('meta[property="og:description"]').content),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    check('page loads with a Ranger Sort title', /Ranger Sort/.test(d.title), d.title);
    check('meta description describes Ranger Sort', /ranger clue|sort/i.test(d.desc) && !BANNED.test(d.desc), d.desc.slice(0, 70));
    check('og:description is Ranger Sort and names Echo', /ranger clue|sort/i.test(d.og) && /Echo/.test(d.og), d.og.slice(0, 70));
    check('body copy is Ranger Sort', /ranger/i.test(d.text) && /habitat|movement|behaviour/i.test(d.text));
    check('body copy drops the old whack-a-mole wording', !BANNED.test(d.text));
    check('body names Echo (registry character)', /Echo/.test(d.text));
    check('embeds the Ranger Sort game', /critter-whack\.html$/.test(d.iframe), d.iframe);
    check('desktop 1440 no overflow', d.overflow <= 2, 'overflow=' + d.overflow);
    check('desktop no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));

    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 600));
    const mob = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('phone 390 no overflow', mob <= 2, 'overflow=' + mob);
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
  console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
