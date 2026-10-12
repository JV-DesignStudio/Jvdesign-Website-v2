// first-make-home.js (A1452): the homepage "first make" entry.
// Verifies the guided first-creation section exists, the tiny pixel canvas is
// present and paintable (pointer + keyboard), the primary CTA deep-links to the
// Pixel Studio first-mission, and there is no overflow or runtime error at
// 390px and 1440px.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = 'F:/Website/Jvdesign-Website-v2';
const port = 19259;
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon'};
const server = http.createServer((req,res)=>{
  let url = decodeURIComponent(req.url.split('?')[0]);
  if(url === '/') url = '/index.html';
  const file = path.normalize(path.join(root, url));
  if(!file.startsWith(path.normalize(root))){res.writeHead(403);res.end('Forbidden');return;}
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'});
    res.end(data);
  });
});
function listen(){return new Promise(r=>server.listen(port, r));}
let failures = 0;
function check(name, ok, detail=''){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }

const pixel = (page, i) => page.evaluate((i) => {
  const c = document.getElementById('fmCanvas');
  const ctx = c.getContext('2d');
  const COLS = 8, CELL = 32;
  const x = (i % COLS) * CELL + CELL / 2, y = Math.floor(i / COLS) * CELL + CELL / 2;
  const d = ctx.getImageData(x, y, 1, 1).data;
  return [d[0], d[1], d[2]].join(',');
}, i);

(async()=>{
  await listen();
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});
  for (const vp of [{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844,isMobile:true,hasTouch:true}]) {
    const page = await browser.newPage();
    await page.setViewport(vp);
    const errors=[];
    page.on('pageerror', e=>errors.push('pageerror: '+e.message));
    page.on('console', msg=>{ if(msg.type()==='error' && !/ERR_NETWORK_ACCESS_DENIED|Failed to load resource/.test(msg.text())) errors.push('console: '+msg.text()); });
    await page.goto(`http://127.0.0.1:${port}/index.html`, {waitUntil:'networkidle0', timeout:30000});
    await new Promise(resolve => setTimeout(resolve, 900));
    // A first-time visitor gets the mascot guide modal (mascots.js) ~900ms in.
    // Dismiss it so the rest of the page (including the first-make canvas) is reachable.
    await page.evaluate(() => {
      const bd = document.querySelector('.mascot-quiz-backdrop');
      if (bd) { const skip = bd.querySelector('#quizSkip'); if (skip) skip.click(); else bd.remove(); }
    });
    await new Promise(resolve => setTimeout(resolve, 150));

    const dom = await page.evaluate(() => {
      const sec = document.querySelector('.first-make');
      const cta = document.querySelector('.first-make-cta');
      const canvas = document.getElementById('fmCanvas');
      return {
        section: !!sec,
        heading: (document.getElementById('first-make-title')||{}).textContent||'',
        ctaHref: cta ? cta.getAttribute('href') : '',
        canvas: !!canvas,
        canvasTab: canvas ? canvas.getAttribute('tabindex') : '',
        swatches: document.querySelectorAll('#fmPalette .fm-swatch').length,
        hasUndo: !!document.getElementById('fmUndo'),
        hasClear: !!document.getElementById('fmClear'),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    check(vp.name+': first-make section present', dom.section);
    check(vp.name+': heading names the first make', /first character/i.test(dom.heading), dom.heading);
    check(vp.name+': CTA deep-links to Pixel Studio first-mission', dom.ctaHref === '/tools/pixel-studio.html#first-mission', dom.ctaHref);
    check(vp.name+': pixel canvas present', dom.canvas);
    check(vp.name+': canvas is keyboard focusable', dom.canvasTab === '0', dom.canvasTab);
    check(vp.name+': palette has 8 colours', dom.swatches === 8, String(dom.swatches));
    check(vp.name+': undo + clear present', dom.hasUndo && dom.hasClear);
    check(vp.name+': no horizontal overflow', dom.overflow <= 0, String(dom.overflow));

    // pointer paint: pick pink swatch, tap the top-left cell, expect it painted
    const before = await pixel(page, 0);
    await page.evaluate(() => document.querySelectorAll('#fmPalette .fm-swatch')[1].click());
    const canvasEl = await page.$('#fmCanvas');
    await canvasEl.scrollIntoView();
    await new Promise(resolve => setTimeout(resolve, 250));
    const pt = await page.evaluate(() => {
      const r = document.getElementById('fmCanvas').getBoundingClientRect();
      return { x: r.left + r.width / 16, y: r.top + r.height / 16 };
    });
    if (vp.hasTouch) await page.touchscreen.tap(pt.x, pt.y);
    else await page.mouse.click(pt.x, pt.y);
    await new Promise(resolve => setTimeout(resolve, 150));
    const after = await pixel(page, 0);
    check(vp.name+': click paints a pixel', before !== after, before+' -> '+after);

    // keyboard paint: focus canvas, move right, Enter, expect a painted cell
    const kBefore = await pixel(page, 1);
    await page.evaluate(() => document.getElementById('fmCanvas').focus());
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await new Promise(resolve => setTimeout(resolve, 120));
    const kAfter = await pixel(page, 1);
    check(vp.name+': keyboard paints a pixel', kBefore !== kAfter, kBefore+' -> '+kAfter);

    // clear resets the canvas
    await page.evaluate(() => document.getElementById('fmClear').click());
    await new Promise(resolve => setTimeout(resolve, 80));
    const cleared = await pixel(page, 0);
    check(vp.name+': clear resets the canvas', cleared === before, cleared);

    check(vp.name+': zero runtime errors', errors.length === 0, errors.slice(0,3).join(' | '));
    await page.close();
  }
  console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL FIRST-MAKE CHECKS PASSED');
  await browser.close();
  server.close();
  process.exit(failures ? 1 : 0);
})().catch(e=>{ console.error('Harness error:', e); server.close(); process.exit(1); });
