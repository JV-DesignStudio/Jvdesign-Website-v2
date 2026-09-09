const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19250;
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.json':'application/json','.svg':'image/svg+xml'};
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
let failures=0;
function check(name, ok, detail=''){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }
(async()=>{
  await listen();
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  const errors=[];
  page.on('pageerror', e=>errors.push('pageerror: '+e.message));
  page.on('console', m=>{ if(m.type()==='error'){ const text=m.text(); if(!/ERR_NETWORK_ACCESS_DENIED|Failed to load resource/.test(text)) errors.push('console: '+text); }});
  await page.setViewport({width:390,height:844,isMobile:true});
  await page.goto(`http://127.0.0.1:${port}/tools/map-generator.html`, {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(r=>setTimeout(r, 1000));
  const data = await page.evaluate(() => {
    try { savedMaps = [{name:'<img src=x onerror=alert(1)>', mode:'dungeon', seed:'42', W:4, H:4, tiles:Array(16).fill(2), ctrls:{}}]; renderSavedMaps(); } catch(e) {}
    return {
      title: document.title,
      skipLinks: document.querySelectorAll('.skip-link').length,
      main: !!document.getElementById('main-content'),
      canvas: !!document.getElementById('map-canvas'),
      mapReady: typeof currentMap !== 'undefined' && !!currentMap,
      currentMapShape: (typeof currentMap !== 'undefined' && currentMap) ? `${currentMap.W}x${currentMap.H}` : '',
      cleanText: !/â|Ã|ï|�|ï¼|â†|âœ|âŸ/.test(document.body.innerText),
      undoText: [...document.querySelectorAll('.mini-btn')].map(b=>b.textContent.trim()).join('|'),
      savedHtml: document.getElementById('savedMapsList')?.innerHTML || '',
      savedText: document.getElementById('savedMapsList')?.textContent || '',
      rawSave: document.getElementById('savedMapsList')?.querySelector('img') !== null,
      shareFn: typeof window.copyShareLink === 'function',
      pngFn: typeof window.exportPNG === 'function',
      jsonFn: typeof window.exportJSON === 'function',
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    };
  });
  check('title loads', data.title.includes('Map Generator'), data.title);
  check('single skip link', data.skipLinks === 1, String(data.skipLinks));
  check('main target exists', data.main);
  check('canvas exists', data.canvas);
  check('map generated', !!data.currentMapShape, data.currentMapShape);
  check('visible text has no mojibake', data.cleanText);
  check('undo/redo labels clean', /↶ Undo\|↷ Redo/.test(data.undoText), data.undoText);
  check('saved map name escaped', data.savedText.includes('<img src=x') && !data.rawSave, data.savedHtml.slice(0,120));
  check('export/share functions exist', data.shareFn && data.pngFn && data.jsonFn);
  check('mobile does not overflow viewport', data.scrollWidth <= data.clientWidth + 2, `${data.scrollWidth}/${data.clientWidth}`);
  check('zero runtime errors', errors.length === 0, errors.join(' | '));
  await browser.close(); server.close();
  if(failures){ console.log(`\n${failures} FAILURE(S)`); process.exit(1); }
  console.log('\nALL MAP GENERATOR CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
