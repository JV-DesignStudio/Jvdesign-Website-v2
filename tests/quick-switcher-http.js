#!/usr/bin/env node
/*
 * tests/quick-switcher-http.js , A1632
 * The global Ctrl/Cmd+K quick-switcher (nav.js) must open on any page, filter
 * /search-index.json, jump on Enter and close on Escape, with no horizontal
 * overflow at 390px or 1440px. Run: node tests/quick-switcher-http.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.QUICK_SWITCHER_PORT || 8996;
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

  async function pressChord(page){
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyK');
    await page.keyboard.up('Control');
  }

  async function run(width, label){
    const page = await browser.newPage();
    await page.setViewport({width, height:900});
    const errs = [];
    page.on('pageerror', e=> errs.push(e.message));

    await page.goto(BASE+'index.html', {waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.JVDS && typeof window.JVDS.openSwitcher === 'function', {timeout:15000});
    check(`[${label}] nav.js exposes the switcher`, true);

    // Ctrl+K opens
    await pressChord(page);
    await page.waitForSelector('.jvds-switcher[data-open="true"]', {timeout:5000});
    check(`[${label}] Ctrl+K opens the switcher`, true);

    const focused = await page.evaluate(()=>document.activeElement && document.activeElement.id);
    check(`[${label}] the search input is focused`, focused === 'jvdsSwitcherInput', focused);

    // Typing filters the shared index
    await page.type('#jvdsSwitcherInput', 'pixel');
    await page.waitForFunction(()=>document.querySelectorAll('#jvdsSwitcherList .jvds-switcher-option').length > 0, {timeout:5000});
    const titles = await page.evaluate(()=>Array.from(document.querySelectorAll('#jvdsSwitcherList .jvds-switcher-option-title')).map(e=>e.textContent));
    check(`[${label}] typing filters the index`, titles.length > 0 && titles.some(t=>/pixel/i.test(t)), titles.slice(0,3).join(' | '));

    // Each result carries a root-absolute target
    const hrefs = await page.evaluate(()=>Array.from(document.querySelectorAll('#jvdsSwitcherList .jvds-switcher-option')).map(o=>o.getAttribute('data-href')));
    check(`[${label}] results use root-absolute urls`, hrefs.length > 0 && hrefs.every(h=>h && h.startsWith('/')), hrefs.slice(0,3).join(' '));

    // No horizontal overflow while open
    const overflow = await page.evaluate(()=>document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`[${label}] no horizontal overflow while open`, overflow <= 1, 'overflow='+overflow);

    // Escape closes
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>document.querySelector('.jvds-switcher').getAttribute('data-open') === 'false', {timeout:3000});
    check(`[${label}] Escape closes the switcher`, true);

    // Enter jumps to the top result
    await pressChord(page);
    await page.waitForSelector('.jvds-switcher[data-open="true"]', {timeout:5000});
    await page.type('#jvdsSwitcherInput', 'pixel studio');
    await page.waitForFunction(()=>document.querySelectorAll('#jvdsSwitcherList .jvds-switcher-option').length > 0, {timeout:5000});
    const target = await page.evaluate(()=>{ const o=document.querySelector('#jvdsSwitcherList .jvds-switcher-option'); return o?o.getAttribute('data-href'):''; });
    await Promise.all([
      page.waitForNavigation({waitUntil:'domcontentloaded', timeout:10000}).catch(()=>null),
      page.keyboard.press('Enter')
    ]);
    const landed = new URL(page.url()).pathname;
    check(`[${label}] Enter jumps to the top result`, landed === target, landed+' vs '+target);

    check(`[${label}] no page errors`, errs.length === 0, errs.join(' | '));
    await page.close();
  }

  await run(1440, 'desktop');
  await run(390, 'mobile');

  await browser.close();
  server.close();
  console.log(failures ? ('\n'+failures+' FAILED') : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
