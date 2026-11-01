/* Parents & Teachers first-session quick start (A1980).

   pages/parents.html must let a teacher who has never used the site prepare and
   run a first session. This pins the quick-start block and keeps the page usable
   at 390px and 1440px.

   Run: node tests/parents-http.js
*/
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
let failures = 0;
function check(name, ok, detail = '') { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : '')); if (!ok) failures++; }
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
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
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/ERR_NETWORK|Failed to load resource|ERR_ABORTED|ERR_FILE|ERR_FAILED/.test(m.text())) errors.push(m.text().slice(0, 80)); });
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());

    const read = async () => page.evaluate(() => {
      const q = sel => document.querySelector(sel);
      const txt = sel => (q(sel) ? q(sel).innerText : '');
      const links = [...document.querySelectorAll('#quick-start a')].map(a => a.getAttribute('href') || '');
      return {
        title: document.title,
        text: document.body.innerText,
        quick: !!q('#quick-start'),
        heading: txt('#quick-start .section-heading'),
        facts: [...document.querySelectorAll('#quick-start .qs-fact-label')].map(e => e.innerText),
        steps: [...document.querySelectorAll('#quick-start .qs-steps li')].length,
        modes: [...document.querySelectorAll('#quick-start .qs-mode-title')].map(e => e.innerText),
        cards: [...document.querySelectorAll('#quick-start .qs-card h3')].map(e => e.innerText),
        links,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    await page.setViewport({ width: 1440, height: 900 });
    const res = await page.goto(base + '/pages/parents.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise(r => setTimeout(r, 600));
    const d = await read();

    check('page returns 200', res && res.status() === 200, res ? String(res.status()) : 'no response');
    check('page has a title', /Parents and Teachers/i.test(d.title), d.title);
    check('quick start section exists', d.quick);
    check('quick start has a heading', /first session/i.test(d.heading), d.heading);
    check('quick start states what they make', d.facts.some(f => /what they make/i.test(f)), d.facts.join(' | '));
    check('quick start states how long', d.facts.some(f => /how long/i.test(f)), d.facts.join(' | '));
    check('quick start states what you need', d.facts.some(f => /what you need/i.test(f)), d.facts.join(' | '));
    check('four setup steps', d.steps === 4, 'steps=' + d.steps);
    check('one-to-one mode explained', d.modes.some(m => /one to one/i.test(m)), d.modes.join(' | '));
    check('whole-class mode explained', d.modes.some(m => /whole class/i.test(m)), d.modes.join(' | '));
    check('extension tasks card', d.cards.some(c => /finish early/i.test(c)), d.cards.join(' | '));
    check('printable materials card', d.cards.some(c => /print/i.test(c)), d.cards.join(' | '));
    check('troubleshooting card', d.cards.some(c => /goes wrong/i.test(c)), d.cards.join(' | '));
    check('character touchpoint (Ember tip)', /Ember says/i.test(d.text));
    check('printable guide link', d.links.some(h => /parent-guide/.test(h)), d.links.join(' | '));
    check('desktop 1440 no overflow', d.overflow <= 2, 'overflow=' + d.overflow);
    check('desktop no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));

    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 600));
    const mob = await read();
    check('phone 390 no overflow', mob.overflow <= 2, 'overflow=' + mob.overflow);
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
  console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
