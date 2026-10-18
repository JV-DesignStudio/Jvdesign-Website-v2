#!/usr/bin/env node
/*
 * tests/arcade-tilemap-paint.js
 * The level tilemap painter in the Arcade Game Maker (#tilemapCanvas) must be
 * paintable on a school computer. On the live site the page CSP allows script
 * hashes but not unsafe-inline/unsafe-hashes, so the old inline onmousedown/
 * onmousemove handlers never ran, and the three duplicated data-on-event
 * attributes only kept touchend. Net effect: painting a Platformer/Roguelike/
 * Racing level did nothing. This proves a real pointer gesture paints tiles,
 * and that the canvas carries no dead inline handlers or duplicate attributes.
 * Run: node tests/arcade-tilemap-paint.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.AGM_TM_PORT || 8991;
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
  await page.goto(`http://localhost:${PORT}/tools/arcade-game-maker.html`, {waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof tmSetTool === 'function', {timeout:20000});

  // Static guard: the canvas must not carry dead inline handlers or the broken
  // duplicated data-on attributes that caused the bug.
  const html = await page.evaluate(()=>{
    const cv = document.getElementById('tilemapCanvas');
    return cv ? cv.outerHTML : '';
  });
  check('canvas exists', html.length > 0);
  check('canvas has no inline mouse/touch handlers',
    !/\son(click|mousedown|mousemove|mouseup|mouseleave|touchstart|touchmove|touchend)=/i.test(html),
    html.slice(0,140));
  check('canvas has no duplicate data-on attributes', (html.match(/data-on=/g) || []).length === 0);
  check('canvas disables touch scrolling (touch-action:none)', /touch-action:\s*none/i.test(html));

  // Make the tilemap editor visible and pick a platformer, then scroll it in.
  await page.evaluate(()=>{
    // The tilemap editor lives in the default Build tab (#tab-build).
    document.getElementById('tab-build').classList.add('on');
    const g = document.getElementById('genreMode'); if (g) g.value = 'PLATFORMER';
    try { if (typeof onGenreChange === 'function') onGenreChange(); } catch(e){}
    const lmg = document.getElementById('levelMapGroup'); if (lmg) lmg.style.display = '';
    try { if (typeof tmSetTool === 'function') tmSetTool(1); } catch(e){}
    const cv = document.getElementById('tilemapCanvas'); if (cv) cv.scrollIntoView({block:'center'});
  });

  const box = await page.evaluate(()=>{
    const r = document.getElementById('tilemapCanvas').getBoundingClientRect();
    return { x:r.x, y:r.y, w:r.width, h:r.height };
  });
  check('tilemap canvas is visible', box.w > 0 && box.h > 0, `w=${box.w} h=${box.h}`);

  // A real pointer drag across the middle of the canvas.
  const y = box.y + box.h * 0.4;
  await page.mouse.move(box.x + box.w * 0.10, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(box.x + box.w * (0.10 + i * 0.12), y);
  await page.mouse.up();

  const after = await page.evaluate(()=>({
    data: (typeof _tmData !== 'undefined') ? _tmData.slice() : null,
    map: (typeof customLevelMap !== 'undefined') ? customLevelMap : null
  }));
  const painted = (after.data || []).filter(v=>v && v !== 0).length;
  check('mouse drag paints tiles into _tmData', painted > 0, `painted cells=${painted}`);
  check('customLevelMap reflects the paint', (after.map || []).filter(v=>v && v !== 0).length > 0,
    `non-empty=${(after.map || []).filter(v=>v && v !== 0).length}`);

  check('no uncaught page errors', errors.length === 0, errors.join(' | '));

  await browser.close();
  server.close();
  console.log(failures === 0 ? 'ALL ARCADE TILEMAP PAINT CHECKS PASSED' : failures + ' FAILURES');
  process.exit(failures === 0 ? 0 : 1);
})().catch(e=>{ console.error(e); process.exit(1); });
