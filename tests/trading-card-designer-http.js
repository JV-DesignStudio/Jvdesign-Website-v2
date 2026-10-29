const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19257;
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.json':'application/json','.svg':'image/svg+xml','.mjs':'application/javascript'};
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
function listen(){return new Promise(resolve=>server.listen(port, resolve));}
function check(name, ok, detail=''){
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if(!ok) failures++;
}
let failures = 0;
(async()=>{
  await listen();
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  const errors=[];
  page.on('pageerror', e=>errors.push('pageerror: '+e.message));
  page.on('console', m=>{
    if(m.type() !== 'error') return;
    const text = m.text();
    if(/ERR_NETWORK_ACCESS_DENIED|Failed to load resource/.test(text)) return;
    errors.push('console: '+text);
  });
  await page.setViewport({width:1280,height:800});
  await page.goto('http://127.0.0.1:' + port + '/tools/trading-card-designer.html', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(resolve=>setTimeout(resolve, 1000));

  const initial = await page.evaluate(()=>({
    title: document.title,
    skipLinks: document.querySelectorAll('.skip-link').length,
    main: !!document.getElementById('main-content'),
    canvas: !!document.getElementById('card-canvas'),
    rarityBtns: document.getElementById('rarityBtns')?.children?.length || 0,
    statsContainer: !!document.getElementById('statsContainer'),
    pngScaleSelect: !!document.getElementById('pngScale'),
    exportHDBtn: !!document.getElementById('exportHDBtn'),
    cleanText: !/[âÃï�]/.test(document.body.innerText),
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    exportPNG: typeof window.exportPNG === 'function',
    exportSheet: typeof window.exportSheet === 'function',
    exportDeck: typeof window.exportDeck === 'function',
    exportHD: typeof window.exportHD === 'function',
    hdWorkerSrc: typeof window._hdWorkerSrc === 'string' && window._hdWorkerSrc.length > 100,
    canvasHasContent: (()=>{
      const cv = document.getElementById('card-canvas');
      const ctx = cv.getContext('2d');
      const d = ctx.getImageData(0,0,cv.width,cv.height);
      return d.data.some(v=>v>0);
    })()
  }));
  check('title loads', initial.title.includes('Trading Card'), initial.title);
  check('single skip link', initial.skipLinks === 1, String(initial.skipLinks));
  check('main target exists', initial.main);
  check('card canvas exists', initial.canvas);
  check('rarity buttons built', initial.rarityBtns === 6, String(initial.rarityBtns));
  check('stats container exists', initial.statsContainer);
  check('png scale selector exists', initial.pngScaleSelect);
  check('exportHD button exists', initial.exportHDBtn);
  check('no visible mojibake', initial.cleanText);
  check('no horizontal overflow at 1280px', initial.scrollWidth <= initial.clientWidth + 2, initial.scrollWidth + '/' + initial.clientWidth);
  check('exportPNG exists', initial.exportPNG);
  check('exportSheet (print sheet) exists', initial.exportSheet);
  check('exportDeck (JSON definitions) exists', initial.exportDeck);
  check('exportHD (300 DPI worker) exists', initial.exportHD);
  check('worker source string present', initial.hdWorkerSrc);
  check('canvas renders card on load', initial.canvasHasContent);

  // Test rarity changes re-render
  const rarityTest = await page.evaluate(()=>{
    const btn = document.querySelector('#rarityBtns button:last-child');
    if(btn) btn.click();
    return {clicked: !!btn};
  });
  check('rarity button clickable', rarityTest.clicked);

  // Test stats: add a stat
  const statsBefore = await page.evaluate(()=>window.stats ? window.stats.length : -1);
  await page.evaluate(()=>window.addStat && window.addStat());
  const statsAfter = await page.evaluate(()=>window.stats ? window.stats.length : -1);
  check('addStat increases stats array', statsAfter > statsBefore, `${statsBefore} -> ${statsAfter}`);

  // Test exportDeck produces JSON blob
  const deckExport = await page.evaluate(()=>{
    const origCreate = document.createElement.bind(document);
    let filename = '';
    document.createElement = function(tag){
      const el = origCreate(tag);
      if(tag === 'a') { el.click = ()=>{ filename = el.download; }; }
      return el;
    };
    const origURL = URL.createObjectURL;
    URL.createObjectURL = ()=>'blob:mock';
    window.exportDeck();
    URL.createObjectURL = origURL;
    document.createElement = origCreate;
    return {filename};
  });
  check('exportDeck downloads JSON file', deckExport.filename.endsWith('.json'), deckExport.filename);

  // Test exportHD uses OffscreenCanvas + Worker (UI thread unblocked: check worker source contains onmessage)
  const hdTest = await page.evaluate(()=>{
    const src = window._hdWorkerSrc;
    return {
      hasOnMessage: src.includes('self.onmessage'),
      hasConvertToBlob: src.includes('convertToBlob'),
      hasRenderCard: src.includes('renderCard'),
      hasOffscreen: src.includes('OffscreenCanvas') || src.includes('canvas.getContext')
    };
  });
  check('worker src has onmessage handler', hdTest.hasOnMessage);
  check('worker src calls convertToBlob', hdTest.hasConvertToBlob);
  check('worker src has self-contained renderCard', hdTest.hasRenderCard);
  check('worker src uses canvas context', hdTest.hasOffscreen);

  // Test exportSheet mock download (async toBlob)
  const sheetExport = await page.evaluate(()=>new Promise(resolve=>{
    const origCreate = document.createElement.bind(document);
    let filename = '';
    document.createElement = function(tag){
      const el = origCreate(tag);
      if(tag === 'a') { el.click = ()=>{ filename = el.download; document.createElement=origCreate; URL.createObjectURL=origURL; resolve({filename}); }; }
      return el;
    };
    const origURL = URL.createObjectURL;
    URL.createObjectURL = ()=>'blob:mock';
    window.exportSheet();
    setTimeout(()=>{ document.createElement=origCreate; URL.createObjectURL=origURL; resolve({filename}); }, 3000);
  }));
  check('exportSheet downloads PNG file', sheetExport.filename.includes('sheet'), sheetExport.filename);

  // Mobile viewport
  await page.setViewport({width:390,height:844,isMobile:true});
  await page.goto('http://127.0.0.1:' + port + '/tools/trading-card-designer.html', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(resolve=>setTimeout(resolve, 600));
  const mobile = await page.evaluate(()=>({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  check('no horizontal overflow at 390px', mobile.scrollWidth <= mobile.clientWidth + 2, mobile.scrollWidth + '/' + mobile.clientWidth);

  check('zero runtime errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  server.close();
  if(failures){console.log('\n' + failures + ' FAILURE(S)');process.exit(1);}
  console.log('\nALL TRADING CARD DESIGNER CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
