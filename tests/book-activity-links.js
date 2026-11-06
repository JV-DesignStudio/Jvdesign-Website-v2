// A1985: every story book page links to a live related activity, and each
// linked activity links back to the book that inspired it.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19314;
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(root, url));
  if (!file.startsWith(path.normalize(root))) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

const LINKS = [
  { book: 'books/Stardust.html', bookHref: '/books/Stardust.html', activity: 'games/stardust_collection.html', activityHref: '/games/stardust_collection.html' },
  { book: 'books/Pip_and_the_night_sky.html', bookHref: '/books/Pip_and_the_night_sky.html', activity: 'games/pip_star_connect.html', activityHref: '/games/pip_star_connect.html' },
  { book: 'books/lumo_and_the_grumble_grit.html', bookHref: '/books/lumo_and_the_grumble_grit.html', activity: 'games/lumo_firefly_night.html', activityHref: '/games/lumo_firefly_night.html' },
  { book: 'books/Echo_and_the_mountain_of_choice.html', bookHref: '/books/Echo_and_the_mountain_of_choice.html', activity: 'games/echo_fruit_catch.html', activityHref: '/games/echo_fruit_catch.html' },
  { book: 'books/Elara.html', bookHref: '/books/Elara.html', activity: 'workshops/cyber-security.html', activityHref: '/workshops/cyber-security.html' }
];

for (const link of LINKS) {
  const bookHtml = fs.readFileSync(path.join(root, link.book), 'utf8');
  const activityHtml = fs.readFileSync(path.join(root, link.activity), 'utf8');
  check(link.book + ' has a related activity section', /Keep the story going/i.test(bookHtml));
  check(link.book + ' links to ' + link.activity, bookHtml.includes('href="' + link.activityHref + '"'));
  check(link.activity + ' links back to ' + link.book, activityHtml.includes('href="' + link.bookHref + '"'));
}

(async () => {
  await new Promise((resolve) => server.listen(port, resolve));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|ERR_ABORTED|ERR_FILE_NOT_FOUND|favicon|googletagmanager|google-analytics/.test(text)) return;
    errors.push('console: ' + text);
  });

  for (const width of [1440, 390]) {
    await page.setViewport({ width, height: width === 390 ? 844 : 900 });
    for (const link of LINKS) {
      await page.goto('http://127.0.0.1:' + port + '/' + link.book, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await new Promise((resolve) => setTimeout(resolve, 250));
      const state = await page.evaluate((href) => ({
        hasLink: [...document.querySelectorAll('a')].some((a) => a.getAttribute('href') === href),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      }), link.activityHref);
      check(width + 'px: ' + link.book + ' shows the activity link', state.hasLink);
      check(width + 'px: ' + link.book + ' has no horizontal overflow', state.overflow <= 2, String(state.overflow));
    }
  }
  check('no runtime errors', errors.length === 0, errors.join(' | '));

  await browser.close();
  server.close();
  if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
  console.log('\nALL BOOK ACTIVITY LINK CHECKS PASSED');
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
