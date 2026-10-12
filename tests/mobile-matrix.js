// A1432 mobile viewport + device matrix.
// Loads a representative set of pages at phone/landscape viewports and checks
// for critical overflow, breaking console errors, and usable primary controls.
// Usage: node tests/mobile-matrix.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg', '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };

const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!path.extname(p)) p = path.join(p, 'index.html');
  if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); return res.end('missing'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(d);
  });
});

const PAGES = [
  'index.html', 'pick-your-path.html', 'arcade.html',
  'tools/pixel-studio.html', 'tools/bitmap-font-maker.html', 'tools/game-logo-maker.html',
  'workshops/learn.html', 'workshops/start-here.html', 'games/ember-smash.html',
  'pages/workshop.html', 'pages/downloads.html', 'pages/parent-guide.html',
  'pages/books.html', 'pages/games.html', 'pages/learn-hub.html',
  'newsletter.html', 'meet-the-crew.html', 'pages/contact.html'
];

const VIEWPORTS = [
  { w: 320, h: 568, label: '320x568' },
  { w: 375, h: 812, label: '375x812' },
  { w: 390, h: 844, label: '390x844' },
  { w: 844, h: 390, label: '844x390 land' }
];

let critical = 0, advisory = 0;

async function run(browser, base, rel, vp) {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message.split('\n')[0]));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR_|Failed to load resource/i.test(m.text())) errs.push('console: ' + m.text().split('\n')[0]); });
  await page.setViewport({ width: vp.w, height: vp.h, isMobile: vp.w <= 480, hasTouch: vp.w <= 480, deviceScaleFactor: vp.w <= 480 ? 2 : 1 });
  try {
    await page.goto(base + '/' + rel, { waitUntil: 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, 350));
    const m = await page.evaluate(() => {
      const doc = document.documentElement;
      const overflow = doc.scrollWidth - doc.clientWidth;
      const main = document.querySelector('main') || document.body;
      const clickable = [...main.querySelectorAll('a,button,[role="button"],input[type="submit"],select')];
      let controls = 0, primary = 0, small = [];
      for (const el of clickable) {
        const r = el.getBoundingClientRect();
        const st = getComputedStyle(el);
        if (r.width < 1 || r.height < 1 || st.display === 'none' || st.visibility === 'hidden') continue;
        controls++;
        const min = Math.min(r.width, r.height);
        if (min >= 40) primary++;
        else if (el.matches('button,.btn,[role="button"]') && min < 36) small.push((el.textContent || el.tagName).trim().slice(0, 24));
      }
      return { overflow, controls, primary, small: small.slice(0, 4), h1: document.querySelectorAll('h1').length };
    });
    const problems = [];
    if (m.overflow > 2) { problems.push('overflow ' + m.overflow + 'px'); }
    if (errs.length) { problems.push(errs.length + ' console error(s)'); }
    if (m.controls === 0) { problems.push('no controls in main'); }
    const tag = problems.length ? 'FAIL' : 'ok  ';
    if (problems.length) critical++;
    const smallNote = m.small.length ? '  small targets: ' + m.small.join(', ') : '';
    if (m.small.length) advisory++;
    console.log(`${tag} ${rel.padEnd(34)} ${vp.label.padEnd(13)} overflow=${String(m.overflow).padStart(4)} ctrl=${m.controls} primary=${m.primary} h1=${m.h1}${problems.length ? '  <-- ' + problems.join('; ') : ''}${smallNote}`);
  } catch (e) {
    critical++;
    console.log(`FAIL ${rel.padEnd(34)} ${vp.label.padEnd(13)} LOAD_ERROR ${e.message.split('\n')[0]}`);
  }
  await page.close();
}

(async () => {
  server.listen(0); await new Promise(r => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    for (const rel of PAGES) for (const vp of VIEWPORTS) await run(browser, base, rel, vp);
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
  console.log('\ncritical failures: ' + critical + ', advisory small-target pages: ' + advisory);
  console.log(critical === 0 ? 'MOBILE MATRIX: PASS' : 'MOBILE MATRIX: ' + critical + ' CRITICAL FAILURE(S)');
  process.exit(critical === 0 ? 0 : 1);
})().catch(e => { console.error('Harness error:', e); process.exit(1); });
