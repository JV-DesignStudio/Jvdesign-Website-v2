#!/usr/bin/env node
/*
 * tests/nav-gallery.js , A1505
 * The Community Gallery must be reachable from the site navigation (injected on
 * every built page via partials/nav-content.html), and the gallery must link
 * back to the maker and Publish. Run: node tests/nav-gallery.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.NAV_GALLERY_PORT || 8992;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.ico':'image/x-icon' };

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }

(async()=>{
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

  // The nav link, present on the home page (injected from the partial).
  await page.goto(BASE+'index.html', {waitUntil:'domcontentloaded'});
  await page.waitForSelector('.nav-dropdown-menu', {timeout:15000});
  const nav = await page.evaluate(()=>Array.from(document.querySelectorAll('.nav-dropdown-menu a')).map(a=>a.getAttribute('href')));
  check('home nav links to the gallery', nav.includes('/pages/gallery.html'), nav.join(' '));

  // Gallery links back to the maker and Publish.
  await page.goto(BASE+'pages/gallery.html', {waitUntil:'domcontentloaded'});
  await page.waitForSelector('#galleryGrid', {timeout:15000});
  const links = await page.evaluate(()=>Array.from(document.querySelectorAll('a')).map(a=>a.getAttribute('href')));
  check('gallery links to the maker', links.includes('../tools/arcade-game-maker.html'));
  check('gallery links to Publish', links.includes('publish.html'));

  // And the nav link is present on the gallery page too.
  const nav2 = await page.evaluate(()=>Array.from(document.querySelectorAll('.nav-dropdown-menu a')).map(a=>a.getAttribute('href')));
  check('nav link present on the gallery page', nav2.includes('/pages/gallery.html'));

  check('no uncaught JS errors', jsErrors.length === 0, jsErrors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL NAV GALLERY CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });
