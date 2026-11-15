// home-continue-hero.js (A2981): the homepage hero carries one next-step strip.
// A first visit points at Start Here; a returning visit swaps in the A1776
// continue card (last activity plus one suggested next step). It never shows
// both and never brings back the browse stat counters. 390 and 1440, no errors.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(root, url));
  if (!file.startsWith(path.normalize(root))) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});
let failures = 0;
function check(name, ok, detail = '') { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : '')); if (!ok) failures++; }

const readHero = (page) => page.evaluate(() => {
  const hero = document.querySelector('.home-hero');
  const start = document.getElementById('hero-next-start');
  const card = document.getElementById('continue-card');
  const link = document.getElementById('continue-card-link');
  const title = document.getElementById('continue-card-title');
  const next = document.getElementById('continue-card-next');
  return {
    hasHero: !!hero,
    startVisible: !!(start && !start.hidden),
    startHref: start && start.querySelector('a') ? start.querySelector('a').getAttribute('href') : '',
    cardVisible: !!(card && !card.hidden),
    cardHref: link ? link.getAttribute('href') : '',
    cardTitle: title ? title.textContent.trim() : '',
    nextHref: next ? next.getAttribute('href') : '',
    nextText: next ? next.textContent.trim() : '',
    stats: document.querySelectorAll('.hero-stat, .hero-stat-num').length,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  };
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    for (const vp of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844, isMobile: true }]) {
      // First visit: no storage, so the strip points at Start Here.
      const fresh = await browser.newPage();
      await fresh.setViewport(vp);
      const freshErrors = [];
      fresh.on('pageerror', e => freshErrors.push('pageerror: ' + e.message));
      fresh.on('console', m => { if (m.type() === 'error' && !/ERR_NETWORK_ACCESS_DENIED|Failed to load resource/.test(m.text())) freshErrors.push('console: ' + m.text()); });
      await fresh.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise(r => setTimeout(r, 900));
      const first = await readHero(fresh);
      check(vp.name + ': hero present', first.hasHero);
      check(vp.name + ': first visit shows the Start Here strip', first.startVisible && !first.cardVisible, 'start=' + first.startVisible + ' card=' + first.cardVisible);
      check(vp.name + ': Start Here strip links to #start-here', first.startHref === '#start-here', first.startHref);
      check(vp.name + ': hero has no stat counters', first.stats === 0, first.stats + ' found');
      check(vp.name + ': no horizontal overflow', first.overflow <= 2, String(first.overflow));
      check(vp.name + ': zero runtime errors on first visit', freshErrors.length === 0, freshErrors.slice(0, 3).join(' | '));
      await fresh.close();

      // Returning visit: a saved tool activity swaps in the continue card.
      const back = await browser.newPage();
      await back.setViewport(vp);
      await back.evaluateOnNewDocument(() => {
        localStorage.setItem('jvds_last_activity', JSON.stringify({ type: 'tool', url: '/tools/pixel-studio.html', title: 'Pixel Studio', ts: Date.now() }));
      });
      const backErrors = [];
      back.on('pageerror', e => backErrors.push('pageerror: ' + e.message));
      back.on('console', m => { if (m.type() === 'error' && !/ERR_NETWORK_ACCESS_DENIED|Failed to load resource/.test(m.text())) backErrors.push('console: ' + m.text()); });
      await back.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise(r => setTimeout(r, 900));
      const resumed = await readHero(back);
      check(vp.name + ': returning visit shows the continue card', resumed.cardVisible && !resumed.startVisible, 'card=' + resumed.cardVisible + ' start=' + resumed.startVisible);
      check(vp.name + ': continue link points at the last page', resumed.cardHref === '/tools/pixel-studio.html', resumed.cardHref);
      check(vp.name + ': continue card names the last page', /pixel studio/i.test(resumed.cardTitle), resumed.cardTitle);
      check(vp.name + ': continue card offers one next step', resumed.nextHref === '/workshop' && /learn the skill/i.test(resumed.nextText), resumed.nextHref + ' | ' + resumed.nextText);
      check(vp.name + ': never shows both card and Start Here', !(resumed.cardVisible && resumed.startVisible));
      check(vp.name + ': zero runtime errors on return', backErrors.length === 0, backErrors.slice(0, 3).join(' | '));
      await back.close();

      // Broken storage must fall back to Start Here without a console error.
      const broken = await browser.newPage();
      await broken.setViewport(vp);
      await broken.evaluateOnNewDocument(() => localStorage.setItem('jvds_last_activity', '{bad json'));
      const brokenErrors = [];
      broken.on('pageerror', e => brokenErrors.push('pageerror: ' + e.message));
      broken.on('console', m => { if (m.type() === 'error' && !/ERR_NETWORK_ACCESS_DENIED|Failed to load resource/.test(m.text())) brokenErrors.push('console: ' + m.text()); });
      await broken.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise(r => setTimeout(r, 500));
      const fallback = await readHero(broken);
      check(vp.name + ': broken storage falls back to Start Here', fallback.startVisible && !fallback.cardVisible);
      check(vp.name + ': broken storage logs no error', brokenErrors.length === 0, brokenErrors.slice(0, 2).join(' | '));
      await broken.close();
    }
  } finally {
    await browser.close().catch(() => {});
    await new Promise(r => server.close(r));
  }
  if (failures) { console.log(`\n${failures} FAILURE(S)`); process.exit(1); }
  console.log('\nALL HOME CONTINUE HERO CHECKS PASSED');
})().catch(e => { console.error(e); server.close(); process.exit(1); });
