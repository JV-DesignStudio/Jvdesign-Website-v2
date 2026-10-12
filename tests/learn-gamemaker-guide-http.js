/* Checks the GameMaker for Beginners guide (learn/gamemaker-for-beginners.html):
   loads clean, has the right SEO surface, links real workshops, fits mobile. */
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const PAGE = '/learn/gamemaker-for-beginners.html';
let failures = 0;
function check(name, ok, detail = '') { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : '')); if (!ok) failures++; }
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(root, u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('missing ' + u); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
(async () => {
  server.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort());
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(base + PAGE, { waitUntil: 'load' });

    const s = await page.evaluate(() => {
      const canon = document.querySelector('link[rel="canonical"]');
      const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map(x => x.textContent).join(' ');
      const ws = [...new Set([...document.querySelectorAll('main a[href*="/workshops/"]')].map(a => new URL(a.href).pathname))];
      return {
        title: document.title,
        h1: (document.querySelector('h1') || {}).textContent || '',
        canonical: canon ? canon.getAttribute('href') : '',
        course: /"@type"\s*:\s*"Course"/.test(ld),
        callout: !!document.querySelector('.lh-callout img'),
        workshopLinks: ws,
        sw: document.documentElement.scrollWidth,
        dashes: (document.body.innerText.match(/[\u2013\u2014]/g) || []).length
      };
    });
    check('title names GameMaker for beginners', /GameMaker for Beginners/i.test(s.title), s.title);
    check('has the right H1', /GameMaker for Beginners/i.test(s.h1), s.h1);
    check('canonical is the clean /learn url', s.canonical === 'https://jvdesignstudio.co.uk/learn/gamemaker-for-beginners', s.canonical);
    check('Course structured data present', s.course);
    check('Stardust callout present', s.callout);
    check('links 6+ gamemaker workshops', s.workshopLinks.length >= 6, 'links ' + s.workshopLinks.length);
    check('guide has no dashes', s.dashes === 0, 'dashes ' + s.dashes);
    check('desktop no overflow', s.sw <= 1442, s.sw + '');

    const missing = s.workshopLinks.filter(p => !fs.existsSync(path.join(root, p.replace(/^\//, ''))));
    check('every linked workshop exists on disk', missing.length === 0, missing.join(', '));

    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.reload({ waitUntil: 'load' });
    const mob = await page.evaluate(() => document.documentElement.scrollWidth);
    check('390px no overflow', mob <= 392, 'scrollWidth ' + mob);

    check('no browser errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
  console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
