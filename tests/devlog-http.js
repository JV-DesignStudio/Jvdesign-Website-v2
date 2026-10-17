#!/usr/bin/env node
/*
 * tests/devlog-http.js (A1658): the dev log shows a picture per post, related links to
 * what the post is about, and #post-<id> share links that actually open the post.
 * Run: node tests/devlog-http.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.DEVLOG_HTTP_PORT || 8991;
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
  await page.goto(BASE+'pages/devlog.html', {waitUntil:'domcontentloaded'});
  await page.waitForSelector('.post-card', {timeout:10000});
  await new Promise(r=>setTimeout(r,400));

  const render = await page.evaluate(()=>({
    cards: document.querySelectorAll('.post-card').length,
    withImg: document.querySelectorAll('.post-card img[src*="/assets/devlog/"]').length,
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth
  }));
  check('post cards render', render.cards > 0, String(render.cards));
  check('at least one card shows a real screenshot', render.withImg > 0, String(render.withImg));
  check('no horizontal overflow at 390', render.sw<=render.cw+2, render.sw+'/'+render.cw);

  // Click the newest post: modal must open, set the share link, and show related links.
  await page.click('.post-card');
  await new Promise(r=>setTimeout(r,300));
  const modal = await page.evaluate(()=>({
    open: document.getElementById('modalBackdrop').classList.contains('open'),
    hash: location.hash,
    links: document.querySelectorAll('#modalCta .modal-link').length,
    href: (document.querySelector('#modalCta .modal-link')||{}).getAttribute ? document.querySelector('#modalCta .modal-link').getAttribute('href') : ''
  }));
  check('clicking a post opens the modal', modal.open===true);
  check('open post sets #post-<id> share link', /^#post-\d+$/.test(modal.hash||''), modal.hash);
  check('modal shows at least one related link', modal.links >= 1, String(modal.links));
  check('related link has a real href', !!modal.href, modal.href);

  await page.keyboard.press('Escape');
  await new Promise(r=>setTimeout(r,200));
  const afterClose = await page.evaluate(()=>({ open: document.getElementById('modalBackdrop').classList.contains('open'), hash: location.hash }));
  check('Escape closes the modal and clears the share link', afterClose.open===false && afterClose.hash==='', afterClose.hash);

  // Deep link must open the post it points at.
  await page.goto(BASE+'pages/devlog.html#post-435', {waitUntil:'domcontentloaded'});
  await page.waitForSelector('.post-card', {timeout:10000});
  await new Promise(r=>setTimeout(r,500));
  const deep = await page.evaluate(()=>({
    open: document.getElementById('modalBackdrop').classList.contains('open'),
    title: (document.getElementById('modalTitle')||{}).textContent||''
  }));
  check('deep link #post-435 opens that post', deep.open===true, deep.title.slice(0,40));
  check('deep-linked post is VoidRush', /VoidRush/.test(deep.title), deep.title.slice(0,40));

  // A per-post CTA label (post 335 sets cta: "Open Part 1").
  await page.goto(BASE+'pages/devlog.html#post-335', {waitUntil:'domcontentloaded'});
  await page.waitForSelector('.post-card', {timeout:10000});
  await new Promise(r=>setTimeout(r,400));
  const cta = await page.evaluate(()=>{
    const el = document.querySelector('#modalCta .modal-link--primary');
    return { open: document.getElementById('modalBackdrop').classList.contains('open'), label: el ? el.textContent.trim() : '' };
  });
  check('post CTA label renders from the cta field', cta.open && /Open Part 1/.test(cta.label), cta.label);

  await page.setViewport({width:1440,height:900});
  await new Promise(r=>setTimeout(r,150));
  const ov = await page.evaluate(()=>({sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth}));
  check('no horizontal overflow at 1440', ov.sw<=ov.cw+2, ov.sw+'/'+ov.cw);

  check('devlog: no uncaught JS errors', errors.length===0, errors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL DEVLOG CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });
