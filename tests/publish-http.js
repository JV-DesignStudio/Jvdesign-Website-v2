#!/usr/bin/env node
/*
 * tests/publish-http.js , A1502
 * The Publish to Gallery flow: the maker has a Publish button + function, and
 * pages/publish.html carries a working Formspree form (name, email, title,
 * genre, files, consent), prefills title/genre from the query and lays out at
 * 390 and 1440. Run: node tests/publish-http.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PUBLISH_PORT || 8997;
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

  // Prefill title + genre from the query the maker opens.
  await page.goto(BASE+'pages/publish.html?title=Test%20Rocket&genre=Space%20Shooter', {waitUntil:'domcontentloaded'});
  await page.waitForSelector('#publishForm', {timeout:15000});

  const r = await page.evaluate(()=>{
    const f = document.getElementById('publishForm');
    const req = ['name','email','title','game','consent'];
    const fields = {};
    req.forEach(n=>{ const el = f.querySelector('[name="'+n+'"]'); fields[n] = !!(el && el.required); });
    return {
      title: document.title,
      action: f.getAttribute('action'),
      method: (f.getAttribute('method')||'').toUpperCase(),
      enctype: f.getAttribute('enctype') || f.enctype,
      hasFileInputs: f.querySelectorAll('input[type="file"]').length,
      required: fields,
      note: (document.querySelector('.gl-note')||{}).textContent || '',
      titleVal: (document.getElementById('pubTitle')||{}).value || '',
      genreVal: (document.getElementById('pubGenre')||{}).value || '',
      submit: !!f.querySelector('button[type="submit"]')
    };
  });

  check('publish page loads with a title', /Gallery/i.test(r.title), r.title);
  check('form posts to the Formspree endpoint', r.action === 'https://formspree.io/f/xvkowqqw', r.action);
  check('form uses POST + multipart (file uploads)', r.method === 'POST' && /multipart\/form-data/.test(r.enctype), r.method + ' ' + r.enctype);
  check('form has the required fields', Object.values(r.required).every(Boolean), JSON.stringify(r.required));
  check('form accepts a game file and a cover', r.hasFileInputs >= 2, r.hasFileInputs + ' file inputs');
  check('form has a submit button', r.submit === true);
  check('moderation step is explained', /check|review|before it appears|before it goes/i.test(r.note), r.note.slice(0,80));
  check('title prefills from the maker', r.titleVal === 'Test Rocket', r.titleVal);
  check('genre prefills from the maker', r.genreVal === 'Space Shooter', r.genreVal);

  // Layout at phone + desktop.
  for (const w of [390, 1440]) {
    await page.setViewport({width:w, height:880});
    await new Promise(res=>setTimeout(res,150));
    const ov = await page.evaluate(()=>document.documentElement.scrollWidth - window.innerWidth);
    check('no horizontal scroll at ' + w + 'px', ov <= 1, 'overflow ' + ov + 'px');
  }

  // The maker exposes the Publish action.
  await page.setViewport({width:1280,height:900});
  await page.goto(BASE+'tools/arcade-game-maker.html', {waitUntil:'domcontentloaded'});
  await page.waitForSelector('#runGameBtn', {timeout:15000});
  const maker = await page.evaluate(()=>({
    fn: typeof publishToGallery === 'function',
    btn: !!document.querySelector('button[onclick="publishToGallery()"]')
  }));
  check('maker has a publishToGallery function', maker.fn === true);
  check('maker has a Publish to Gallery button', maker.btn === true);

  check('no uncaught JS errors', jsErrors.length === 0, jsErrors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL PUBLISH CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });
