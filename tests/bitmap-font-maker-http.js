const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19255;
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
function check(name, ok, detail=''){
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
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
  await page.setViewport({width:390,height:844,isMobile:true});
  await page.goto('http://127.0.0.1:' + port + '/tools/bitmap-font-maker.html', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(resolve=>setTimeout(resolve, 1000));
  const initial = await page.evaluate(()=>( {
    title: document.title,
    skipLinks: document.querySelectorAll('.skip-link').length,
    main: !!document.getElementById('main-content'),
    gridCanvas: !!document.getElementById('grid-canvas'),
    previewCanvas: !!document.getElementById('pv-canvas'),
    gridSize: (document.getElementById('grid-canvas')?.width || 0) + 'x' + (document.getElementById('grid-canvas')?.height || 0),
    back: document.querySelector('.hdr-back')?.textContent.trim(),
    titleText: document.querySelector('.hdr-title')?.textContent.trim(),
    startButton: document.querySelector('#bitmapWelcomeModal .m-ok')?.textContent.trim(),
    charButtons: document.querySelectorAll('.char-btn').length,
    exportPng: typeof window.exportPNG === 'function',
    exportJson: typeof window.exportJSON === 'function',
    exportXml: typeof window.exportXML === 'function',
    share: typeof window.copyFontShareLink === 'function',
    save: typeof window.saveFont === 'function',
    cleanText: !/[âÃï�]/.test(document.body.innerText),
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  check('title loads', initial.title.includes('Bitmap Font Maker'), initial.title);
  check('single skip link', initial.skipLinks === 1, String(initial.skipLinks));
  check('main target exists', initial.main);
  check('grid canvas exists', initial.gridCanvas);
  check('preview canvas exists', initial.previewCanvas);
  check('grid canvas initialized', initial.gridSize !== '0x0', initial.gridSize);
  check('header labels clean', initial.back === '← Tools' && initial.titleText === '🔤 Bitmap Font Maker', initial.back + ' / ' + initial.titleText);
  check('welcome action clean', initial.startButton === 'Start drawing ✓', initial.startButton);
  check('character picker renders', initial.charButtons >= 60, String(initial.charButtons));
  check('export/share/save functions exist', initial.exportPng && initial.exportJson && initial.exportXml && initial.share && initial.save);
  check('no visible mojibake', initial.cleanText);
  check('mobile does not overflow viewport', initial.scrollWidth <= initial.clientWidth + 2, initial.scrollWidth + '/' + initial.clientWidth);
  const drawing = await page.evaluate(() => {
    window.closeBitmapWelcome();
    window.getArr('A')[0] = 1;
    window.drawEditor();
    window.drawPreview();
    window.updateCharBtns();
    return {
      drawn: document.getElementById('sb-drawn')?.textContent || '',
      char: document.getElementById('curCharDisp')?.textContent || '',
      previewWidth: document.getElementById('pv-canvas')?.width || 0,
      snapshot: JSON.parse(window.snapshotFont()).chars[String('A'.charCodeAt(0))][0]
    };
  });
  check('drawing updates glyph data', drawing.snapshot === 1, JSON.stringify(drawing));
  check('status tracks drawn characters', /1 chars? drawn/.test(drawing.drawn), drawing.drawn);
  check('current character display clean', drawing.char === 'A', drawing.char);
  check('preview canvas draws text area', drawing.previewWidth > 0, String(drawing.previewWidth));
  check('zero runtime errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  server.close();
  if(failures){console.log('\n' + failures + ' FAILURE(S)');process.exit(1);}
  console.log('\nALL BITMAP FONT MAKER CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
