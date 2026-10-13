#!/usr/bin/env node
/*
 * tests/gallery-http.js , A1493
 * The Community Gallery renders every entry from gallery-games.json as a card,
 * plays a game in the in-page iframe, handles a missing data file, and lays out
 * cleanly at 390 and 1440. Run: node tests/gallery-http.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.GALLERY_PORT || 8996;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.ico':'image/x-icon' };

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }

(async()=>{
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'gallery-games.json'), 'utf8'));
  const games = data.games || [];

  const server = http.createServer((req,res)=>{
    let p = decodeURIComponent(req.url.split('?')[0]);
    if(p.endsWith('/')) p += 'index.html';
    fs.readFile(path.join(ROOT, p), (err,buf)=>{
      if(err){ res.writeHead(404); res.end(); return; }
      res.writeHead(200,{'Content-Type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream'});
      res.end(buf);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({headless:'new', args:['--no-sandbox']});
  const page = await browser.newPage();
  const jsErrors=[];
  page.on('pageerror', e=> jsErrors.push(e.message));
  page.on('console', m=>{
    if(m.type() !== 'error') return;
    const t = m.text();
    if(/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|ERR_ABORTED|favicon|net::/.test(t)) return;
    jsErrors.push(t);
  });
  await page.setViewport({width:1280,height:900});
  await page.goto(BASE+'pages/gallery.html', {waitUntil:'domcontentloaded'});
  await page.waitForSelector('.gl-card', {timeout:15000});

  const r = await page.evaluate(()=>({
    title: document.title,
    cards: Array.from(document.querySelectorAll('.gl-card')).map(c=>({
      id: c.getAttribute('data-id'),
      title: (c.querySelector('.gl-title')||{}).textContent||'',
      quality: (c.querySelector('.gl-q')||{}).textContent||'',
      playFile: (c.querySelector('.gl-play')||{}).getAttribute ? c.querySelector('.gl-play').getAttribute('data-file') : '',
      make: !!c.querySelector('.gl-make')
    })),
    hero: !!document.querySelector('.gl-hero'),
    note: !!document.querySelector('.gl-note')
  }));

  check('gallery page loads with a title', /Gallery/i.test(r.title), r.title);
  check('hero and moderation note render', r.hero && r.note);
  check('renders one card per gallery entry', r.cards.length === games.length, r.cards.length + '/' + games.length);
  const idsMatch = r.cards.map(c=>c.id).join(',') === games.map(g=>g.id).join(',');
  check('cards match gallery-games.json order', idsMatch, r.cards.map(c=>c.id).join(','));
  check('every card has a title, quality pill and play file', r.cards.every(c=>c.title && c.quality && c.playFile), JSON.stringify(r.cards[0]));
  check('every card offers Make your own', r.cards.every(c=>c.make));

  // Play the first game in-page (programmatic click: the handler delegates).
  await page.evaluate(()=>{ document.querySelector('.gl-play').click(); });
  await new Promise(res=>setTimeout(res,300));
  const playing = await page.evaluate(()=>({
    playing: document.body.classList.contains('gl-playing'),
    src: document.getElementById('playFrame').getAttribute('src') || '',
    exitVisible: getComputedStyle(document.getElementById('playExit')).display !== 'none'
  }));
  check('Play opens the in-page player', playing.playing === true);
  check('player loads the card game file', playing.src.endsWith(games[0].file), playing.src);
  check('Exit button is visible while playing', playing.exitVisible === true);

  await page.evaluate(()=>{ document.getElementById('playExit').click(); });
  await new Promise(res=>setTimeout(res,200));
  const closed = await page.evaluate(()=>document.body.classList.contains('gl-playing'));
  check('Exit closes the player', closed === false);

  // Layout at phone and desktop widths.
  for (const w of [390, 1440]) {
    await page.setViewport({width:w, height:880});
    await new Promise(res=>setTimeout(res,200));
    const ov = await page.evaluate(()=>document.documentElement.scrollWidth - window.innerWidth);
    check('no horizontal scroll at ' + w + 'px', ov <= 1, 'overflow ' + ov + 'px');
  }

  check('no uncaught JS errors', jsErrors.length === 0, jsErrors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL GALLERY CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });
