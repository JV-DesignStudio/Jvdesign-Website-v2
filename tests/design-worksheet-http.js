#!/usr/bin/env node
/*
 * tests/design-worksheet-http.js (A1601): the Level Layout grid on
 * tools/design-worksheet.html copies JSON that tools/level-designer.html
 * (World Builder) imports as a level. Run: node tests/design-worksheet-http.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.DESIGN_WS_PORT || 8991;
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
  await page.goto(BASE+'tools/design-worksheet.html', {waitUntil:'domcontentloaded'});
  await new Promise(r=>setTimeout(r,300));

  const ui = await page.evaluate(()=>({
    copy: !!document.querySelector('[data-on="copyLevelJSON"]'),
    download: !!document.querySelector('[data-on="downloadLevelJSON"]'),
    wb: !!document.querySelector('a[href="level-designer.html"]'),
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth
  }));
  check('Copy as JSON + Download JSON + World Builder link present', ui.copy && ui.download && ui.wb, JSON.stringify(ui));
  check('no horizontal overflow at 390', ui.sw<=ui.cw+2, ui.sw+'/'+ui.cw);

  // Use a tall viewport BEFORE switching tabs (a resize resets the active tab),
  // then show the Level Layout tab so the grid is on-screen
  await page.setViewport({width:1000,height:2600});
  await new Promise(r=>setTimeout(r,200));
  await page.evaluate(()=>{ document.querySelector('.hb-tab[data-tab="ws3"]').click(); });
  await new Promise(r=>setTimeout(r,150));
  await page.evaluate(()=>{ const g=document.querySelector('.level-grid'); if(g) g.scrollIntoView({block:'center'}); });
  await new Promise(r=>setTimeout(r,200));

  // Paint 3 ground tiles (colour 0) then 1 coin tile (colour 2) through the real handler
  const paint = (r,c) => page.evaluate((r,c)=>{
    const gr=document.getElementById('levelGrid');
    const el=gr.querySelector('.level-cell[data-row="'+r+'"][data-col="'+c+'"]');
    const bx=el.getBoundingClientRect();
    const x=bx.left+bx.width/2, y=bx.top+bx.height/2;
    const mk=t=>new PointerEvent(t,{clientX:x,clientY:y,bubbles:true,pointerId:1});
    gr.dispatchEvent(mk('pointerdown'));
    gr.dispatchEvent(mk('pointermove'));
    gr.dispatchEvent(mk('pointerup'));
    return el.dataset.tile;
  }, r, c);
  await paint(2,2); await paint(2,3); await paint(2,4);
  await page.evaluate(()=>{ document.querySelectorAll('.legend-swatch')[2].click(); }); // Coin
  await paint(5,5);

  // Capture the clipboard write, then press Copy as JSON
  await page.evaluate(()=>{
    window.__copied = null;
    try{ Object.defineProperty(navigator,'clipboard',{value:{writeText:(t)=>{ window.__copied=t; return Promise.resolve(); }},configurable:true}); }catch(e){}
  });
  await page.evaluate(()=>{ document.querySelector('[data-on="copyLevelJSON"]').click(); });
  await new Promise(r=>setTimeout(r,250));

  const copied = await page.evaluate(()=>window.__copied);
  let level = null;
  try{ level = JSON.parse(copied); }catch(e){}
  check('Copy as JSON writes a level payload', !!level && !!level.meta && Array.isArray(level.layers), copied ? copied.slice(0,60) : 'no clipboard write');
  const data = (level && level.layers && level.layers[0] && level.layers[0].data) || [];
  const painted = data.filter(v=>v>0).length;
  check('painted grid is encoded (20x12, ground=1 and coin=12)', !!(level && level.meta.width===20 && level.meta.height===12 && painted>=4 && data.includes(1) && data.includes(12)), JSON.stringify({w:level&&level.meta.width,h:level&&level.meta.height,painted}));

  // End-to-end: World Builder imports the copied JSON
  if(level){
    const b64 = Buffer.from(JSON.stringify(level),'utf8').toString('base64');
    const wb = await browser.newPage();
    const wbErrors=[];
    wb.on('pageerror', e=> wbErrors.push(e.message));
    wb.on('console', m=>{ if(m.type()!=='error') return; const t=m.text(); if(/ERR_|Failed to load resource|Aborted|net::|Content Security Policy|violates/i.test(t)) return; wbErrors.push(t); });
    await wb.setViewport({width:1280,height:900});
    await wb.goto(BASE+'tools/level-designer.html?level='+encodeURIComponent(b64), {waitUntil:'domcontentloaded', timeout:30000});
    await new Promise(r=>setTimeout(r,800));
    const state = await wb.evaluate(()=>({ w:gridW, h:gridH, painted:layers.reduce((a,l)=>a+l.data.filter(v=>v>0).length,0) }));
    check('World Builder imports the worksheet level', state.w===20 && state.h===12 && state.painted>=4, JSON.stringify(state));
    check('World Builder: no uncaught JS errors', wbErrors.length===0, wbErrors.slice(0,2).join(' | '));
    await wb.close();
  } else {
    check('World Builder imports the worksheet level', false, 'no level JSON to import');
  }

  await page.setViewport({width:1440,height:900});
  await new Promise(r=>setTimeout(r,150));
  const ov = await page.evaluate(()=>({sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth}));
  check('no horizontal overflow at 1440', ov.sw<=ov.cw+2, ov.sw+'/'+ov.cw);

  check('worksheet: no uncaught JS errors', errors.length===0, errors.slice(0,2).join(' | '));

  await browser.close();
  server.close();
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL DESIGN WORKSHEET CHECKS PASSED');
})().catch(e=>{ console.error(e); process.exit(1); });
