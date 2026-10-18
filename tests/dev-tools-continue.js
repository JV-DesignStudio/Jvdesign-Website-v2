#!/usr/bin/env node
/*
 * tests/dev-tools-continue.js
 * A1679: the toolbox hub must close the loop. When a learner has saved work (the
 * tools write their own localStorage keys), the hub shows a "Continue where you
 * left off" strip with a link back to each tool; when there is nothing saved it
 * shows the empty message. The strip also carries Stardust (Imagine) and an Echo
 * next-step, so the hub always has both characters, not just the global nav.
 * Run: node tests/dev-tools-continue.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.HUB_CONTINUE_PORT || 8992;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml',
  '.woff2':'font/woff2', '.map':'application/json', '.xml':'application/xml', '.txt':'text/plain' };

let failures = 0;
function check(name, ok, detail){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' -- '+detail:'')); if(!ok) failures++; }

(async()=>{
  const server = http.createServer((req,res)=>{
    let file = decodeURIComponent(req.url.split('?')[0]);
    if (file.endsWith('/')) file += 'index.html';
    fs.readFile(path.join(ROOT, file), (err,buf)=>{
      if (err){ res.writeHead(404); res.end(); return; }
      res.writeHead(200, {'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'});
      res.end(buf);
    });
  }).listen(PORT);

  const browser = await puppeteer.launch({headless:'new', args:['--no-sandbox']});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewport({width:1280, height:900});
  const url = `http://localhost:${PORT}/pages/dev-tools.html`;

  // 1. Nothing saved.
  await page.goto(url, {waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{ try { localStorage.clear(); } catch(e){} });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!document.getElementById('continueList'));
  const empty = await page.evaluate(()=>({
    listHidden: document.getElementById('continueList').hidden,
    emptyHidden: document.getElementById('continueEmpty').hidden,
    stardust: !!document.querySelector('.continue-strip img[src*="stardust"]'),
    echo: (document.querySelector('.continue-echo') || {}).textContent || ''
  }));
  check('continue list hidden when nothing saved', empty.listHidden === true);
  check('empty message shown when nothing saved', empty.emptyHidden === false);
  check('hub continue strip shows Stardust', empty.stardust);
  check('hub continue strip shows an Echo next-step', /Echo says/.test(empty.echo));

  // 2. One saved project.
  await page.evaluate(()=>{ localStorage.setItem('jvds_pixel', '{"v":1}'); });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>{ const l=document.getElementById('continueList'); return l && !l.hidden; });
  const one = await page.evaluate(()=>{
    const a = document.querySelector('#continueList .continue-chip');
    return { chips: document.querySelectorAll('#continueList .continue-chip').length,
      text: a ? a.textContent : '', href: a ? a.getAttribute('href') : '',
      emptyHidden: document.getElementById('continueEmpty').hidden };
  });
  check('one saved project shows one chip', one.chips === 1, 'chips=' + one.chips);
  check('chip names the tool', /Pixel Studio/i.test(one.text), one.text);
  check('chip links to the tool page', /pixel-studio\.html$/.test(one.href), one.href);
  check('empty message hidden when a save exists', one.emptyHidden === true);

  // 3. Several saves: dedupe by tool, cap at 4.
  await page.evaluate(()=>{
    localStorage.setItem('jvds_music_last', 'x');
    localStorage.setItem('jvds_sfx_last', 'x');        // same tool as music -> dedupe
    localStorage.setItem('jvds_level_autosave', 'x');
    localStorage.setItem('jvds_gdd', 'x');
    localStorage.setItem('jvds_story_last', 'x');
    localStorage.setItem('jvds_bitmapfont', 'x');
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('#continueList .continue-chip').length > 0);
  const many = await page.evaluate(()=>[].slice.call(document.querySelectorAll('#continueList .continue-chip')).map(a=>a.textContent.trim()));
  check('chips capped at four', many.length <= 4, 'chips=' + many.length);
  check('no duplicate tool chips', new Set(many).size === many.length, many.join(' | '));

  check('no uncaught page errors', errors.length === 0, errors.join(' | '));

  await browser.close();
  server.close();
  console.log(failures === 0 ? 'ALL DEV-TOOLS CONTINUE CHECKS PASSED' : failures + ' FAILURES');
  process.exit(failures === 0 ? 0 : 1);
})().catch(e=>{ console.error(e); process.exit(1); });
