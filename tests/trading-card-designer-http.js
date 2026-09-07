const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19252;
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
  await page.goto('http://127.0.0.1:' + port + '/tools/trading-card-designer.html', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(resolve=>setTimeout(resolve, 1000));
  const initial = await page.evaluate(()=>( {
    title: document.title,
    skipLinks: document.querySelectorAll('.skip-link').length,
    main: !!document.getElementById('main-content'),
    canvas: !!document.getElementById('card-canvas'),
    canvasSize: (document.getElementById('card-canvas')?.width || 0) + 'x' + (document.getElementById('card-canvas')?.height || 0),
    artEmoji: document.getElementById('artEmoji')?.value,
    headerBack: document.querySelector('.hdr-back')?.textContent.trim(),
    newButton: document.querySelector('[onclick="newCard()"]')?.textContent.trim(),
    startButton: document.querySelector('#tradingWelcomeModal .m-ok')?.textContent.trim(),
    templates: document.querySelectorAll('.template-btn').length,
    typeButtons: document.querySelectorAll('.type-btn').length,
    exportFn: typeof window.exportPNG === 'function',
    sheetFn: typeof window.exportSheet === 'function',
    shareFn: typeof window.copyShareLink === 'function',
    saveFn: typeof window.saveToLibrary === 'function',
    exportDeckFn: typeof window.exportDeck === 'function',
    importDeckFn: typeof window.importDeck === 'function',
    newFn: typeof window.newCard === 'function',
    cleanText: !/[âÃï�]/.test(document.body.innerText),
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  check('title loads', initial.title.includes('Trading Card Designer'), initial.title);
  check('single skip link', initial.skipLinks === 1, String(initial.skipLinks));
  check('main target exists', initial.main);
  check('canvas exists', initial.canvas);
  check('canvas dimensions are usable', initial.canvasSize === '400x560', initial.canvasSize);
  check('default art emoji is clean', initial.artEmoji === '⚔️', initial.artEmoji);
  check('header back label is clean', initial.headerBack === '← Tools', initial.headerBack);
  check('new button label is clean', initial.newButton === '✨ New', initial.newButton);
  check('welcome action is clean', initial.startButton === 'Start Designing ✓', initial.startButton);
  check('template buttons render', initial.templates >= 3, String(initial.templates));
  check('type buttons render', initial.typeButtons >= 3, String(initial.typeButtons));
  check('export/share/library functions exist', initial.exportFn && initial.sheetFn && initial.shareFn && initial.saveFn && initial.exportDeckFn && initial.importDeckFn && initial.newFn);
  check('no visible mojibake', initial.cleanText);
  check('mobile does not overflow viewport', initial.scrollWidth <= initial.clientWidth + 2, initial.scrollWidth + '/' + initial.clientWidth);
  const library = await page.evaluate(() => {
    const data = window.collectCardData();
    localStorage.setItem('jvds_trading_card_library', JSON.stringify([{id:'xss-test', ts: Date.now(), name:'<img src=x onerror=alert(1)>', data, thumb:null}]));
    window.renderLibrary();
    return {
      text: document.getElementById('libraryList').innerText,
      strayImages: document.querySelectorAll('#libraryList img').length,
      rows: document.querySelectorAll('.lib-item').length
    };
  });
  check('saved library rows render', library.rows === 1, String(library.rows));
  check('saved card name is text, not markup', library.text.includes('<img src=x onerror=alert(1)>') && library.strayImages === 0, library.text + ' / images ' + library.strayImages);
  check('zero runtime errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  server.close();
  if(failures){console.log('\n' + failures + ' FAILURE(S)');process.exit(1);}
  console.log('\nALL TRADING CARD DESIGNER CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
