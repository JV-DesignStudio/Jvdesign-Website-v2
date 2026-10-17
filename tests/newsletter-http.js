#!/usr/bin/env node
/*
 * tests/newsletter-http.js (A1658): the newsletter page's dev log preview shows a
 * picture per post and links each card to that post's share link (#post-<id>).
 * Run: node tests/newsletter-http.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.NEWSLETTER_HTTP_PORT || 8992;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.woff2':'font/woff2' };

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }

(async()=>{
  const server = http.createServer((req,res)=>{
    let p = decodeURIComponent(req.url.split('?')[0]);
    if(p.endsWith('/')) p+='index.html';
    fs.readFile(path.join(ROOT,p),(err,buf)=>{
      if(err){ res.writeHead(404); res.end(); return; }
      res.writeHead(200,{'Content-Type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream'});
      res.end(buf);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({headless:'new', args:['--no-sandbox']});
  const page = await browser.newPage();
  const errors=[];
  page.on('pageerror', e=> errors.push('pageerror: '+e.message));
  page.on('console', m=>{
    if(m.type() !== 'error') return;
    const t = m.text();
    if(/ERR_|Failed to load resource|Aborted|net::|Content Security Policy|violates/i.test(t)) return;
    errors.push('console: '+t);
  });

  await page.setViewport({width:390,height:844,isMobile:true});
  await page.goto(BASE+'newsletter.html', {waitUntil:'domcontentloaded'});
  await page.waitForSelector('.nl-devlog-card', {timeout:10000});
  await new Promise(r=>setTimeout(r,400));

  const grid = await page.evaluate(()=>({
    cards: document.querySelectorAll('.nl-devlog-card').length,
    thumbs: document.querySelectorAll('.nl-devlog-card img.nl-devlog-thumb[src*="/assets/devlog/"]').length,
    hrefs: Array.from(document.querySelectorAll('.nl-devlog-card')).map(a=>a.getAttribute('href')),
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth
  }));
  check('preview renders 3 cards', grid.cards === 3, String(grid.cards));
  check('preview cards show a screenshot', grid.thumbs >= 1, String(grid.thumbs));
  check('preview cards link to #post-<id>', grid.hrefs.every(h=>/^\/devlog#post-\d+$/.test(h||'')), grid.hrefs.join(','));
  check('no horizontal overflow at 390', grid.sw<=grid.cw+2, grid.sw+'/'+grid.cw);

  await page.setViewport({width:1440,height:900});
  await new Promise(r=>setTimeout(r,150));
  const ov = await page.evaluate(()=>({sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth}));
  check('no horizontal overflow at 1440', ov.sw<=ov.cw+2, ov.sw+'/'+ov.cw);

  check('newsletter: no uncaught JS errors', errors.length===0, errors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL NEWSLETTER CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });
