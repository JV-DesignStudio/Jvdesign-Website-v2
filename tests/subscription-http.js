#!/usr/bin/env node
/*
 * tests/subscription-http.js (A1604): the Golden Key gate on tools/subscription.html
 * must NOT accept an arbitrary GOLDEN- prefix. Only the fixed demo code unlocks,
 * and the page is clearly labelled as a demo with no real payment.
 * Run: node tests/subscription-http.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.SUB_PORT || 8987;
const BASE = `http://localhost:${PORT}/`;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.css?v':'text/css' };

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
  const jsErrors=[];
  page.on('pageerror', e=> jsErrors.push(e.message));
  page.on('console', m=>{
    if(m.type() !== 'error') return;
    const t = m.text();
    if(/ERR_|Failed to load resource|Aborted|net::|Content Security Policy|violates/i.test(t)) return;
    jsErrors.push(t);
  });

  await page.setViewport({width:390,height:844,isMobile:true});
  await page.goto(BASE+'tools/subscription.html', {waitUntil:'domcontentloaded'});
  await page.waitForSelector('#btnUnlock', {timeout:15000});
  await new Promise(r=>setTimeout(r,300));

  const r = await page.evaluate(()=>{
    const $ = id=>document.getElementById(id);
    const out = {};
    localStorage.removeItem('jvds_subscription');
    out.bannerText = (document.body.innerText.match(/Demo page[\s\S]{0,120}/i)||[''])[0];
    out.labelledDemo = /Demo page/i.test(document.body.innerText) && /no (real )?payment|payment is taken/i.test(document.body.innerText);
    // 1) an arbitrary GOLDEN- prefix must be rejected
    $('keyInput').value = 'GOLDEN-9999-XX';
    $('btnUnlock').click();
    out.bogusMsg = $('msg').textContent;
    out.bogusTier = (JSON.parse(localStorage.getItem('jvds_subscription')||'{"tier":"free"}')||{}).tier;
    // 2) the exact demo key must unlock
    $('keyInput').value = 'GOLDEN-2026-09';
    $('btnUnlock').click();
    const s = JSON.parse(localStorage.getItem('jvds_subscription')||'null');
    out.afterTier = s && s.tier;
    out.unlockedLen = s && s.unlocked && s.unlocked.length;
    out.okMsg = $('msg').textContent;
    out.status = $('statusBox').innerText;
    // 3) reset clears
    $('btnReset').click();
    out.afterReset = JSON.parse(localStorage.getItem('jvds_subscription')||'null');
    return out;
  });

  check('page is clearly labelled a demo (no real payment)', r.labelledDemo === true, r.bannerText.slice(0,80));
  check('arbitrary GOLDEN- prefix is rejected', r.bogusTier === 'free' && /not the demo key/i.test(r.bogusMsg), r.bogusMsg);
  check('exact demo key unlocks (this device)', r.afterTier === 'monthly' && r.unlockedLen >= 1 && /Demo unlocked/i.test(r.okMsg), r.okMsg);
  check('reset returns to free', r.afterReset === null);

  await page.setViewport({width:1440,height:900});
  await new Promise(r=>setTimeout(r,150));
  const ov = await page.evaluate(()=>({sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth}));
  check('no horizontal overflow at 1440', ov.sw <= ov.cw + 2, `${ov.sw}/${ov.cw}`);
  await page.setViewport({width:390,height:844,isMobile:true});
  await new Promise(r=>setTimeout(r,150));
  const ov2 = await page.evaluate(()=>({sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth}));
  check('no horizontal overflow at 390', ov2.sw <= ov2.cw + 2, `${ov2.sw}/${ov2.cw}`);

  check('no uncaught JS errors', jsErrors.length === 0, jsErrors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL SUBSCRIPTION CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });
