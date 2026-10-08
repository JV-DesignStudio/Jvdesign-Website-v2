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
  const idempotent = await page.evaluate(() => {
    const count = () => ({
      t: document.querySelectorAll('.template-btn').length,
      y: document.querySelectorAll('.type-btn').length,
      c: document.querySelectorAll('.color-chip').length,
      r: document.querySelectorAll('.rarity-btn').length
    });
    const before = count();
    buildTemplateGrid(); buildTypeGrid(); buildColorRow(); buildRarity();
    return { before, after: count() };
  });
  check('controls are idempotent (no duplicates on re-init)', JSON.stringify(idempotent.before) === JSON.stringify(idempotent.after), JSON.stringify(idempotent.after));
  check('exactly 6 templates, 8 types, 6 rarities', idempotent.after.t === 6 && idempotent.after.y === 8 && idempotent.after.r === 6, JSON.stringify(idempotent.after));
  check('export/share/library functions exist', initial.exportFn && initial.sheetFn && initial.shareFn && initial.saveFn && initial.exportDeckFn && initial.importDeckFn && initial.newFn);
  check('no visible mojibake', initial.cleanText);
  check('mobile does not overflow viewport', initial.scrollWidth <= initial.clientWidth + 2, initial.scrollWidth + '/' + initial.clientWidth);
  const split = await page.evaluate(() => {
    const c = document.getElementById('card-canvas').getBoundingClientRect();
    const ctrl = document.getElementById('controls');
    return {
      canvasTop: Math.round(c.top), canvasH: Math.round(c.height),
      ctrlScrolls: ctrl.scrollHeight > ctrl.clientHeight + 2,
      bodyScroll: document.body.scrollHeight > document.body.clientHeight + 2,
      vh: window.innerHeight
    };
  });
  check('mobile preview visible without scrolling', split.canvasTop >= 0 && split.canvasTop < split.vh / 2 && split.canvasH < split.vh * 0.5, JSON.stringify(split));
  check('mobile controls scroll internally', split.ctrlScrolls, String(split.ctrlScrolls));
  check('mobile page itself does not scroll', !split.bodyScroll, String(split.bodyScroll));
  const coach = await page.evaluate(() => {
    const c = document.querySelector('.mascot-coach');
    return {
      coachExists: !!c,
      coachVisible: c ? getComputedStyle(c).display !== 'none' : false,
      companion: !!document.querySelector('.mascot-companion')
    };
  });
  check('mobile: Ember coach banner hidden on tool page', !coach.coachVisible, JSON.stringify(coach));
  check('mobile: Ember companion avatar present', coach.companion, JSON.stringify(coach));
  const overlap = await page.evaluate(async () => {
    for (let i = 0; i < 25; i++) {
      if (document.getElementById('jvfb-btn') && document.getElementById('jvds-keepsake-strip')) break;
      await new Promise(r => setTimeout(r, 100));
    }
    const rects = el => { if (!el) return null; const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
    return {
      strip: rects(document.getElementById('jvds-keepsake-strip')),
      fb: rects(document.getElementById('jvfb-btn')),
      share: rects(document.getElementById('jvds-share-btn'))
    };
  });
  const hits = (a, b) => a && b && !(a.r <= b.l || a.l >= b.r || a.b <= b.t || a.t >= b.b);
  check('keepsake strip present on the tool', !!overlap.strip, JSON.stringify(overlap.strip));
  check('keepsake strip does not overlap feedback button', !hits(overlap.strip, overlap.fb), JSON.stringify(overlap));
  check('keepsake strip does not overlap share button', !hits(overlap.strip, overlap.share), JSON.stringify(overlap));
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
  await page.setViewport({width:1440,height:900});
  await new Promise(resolve=>setTimeout(resolve, 300));
  const desktop = await page.evaluate(() => {
    const c = document.getElementById('card-canvas').getBoundingClientRect();
    const ctrl = document.getElementById('controls');
    return {
      top: Math.round(c.top), bottom: Math.round(c.bottom), vh: window.innerHeight,
      ctrlScrolls: ctrl.scrollHeight > ctrl.clientHeight + 2,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
    };
  });
  check('desktop preview fully visible', desktop.top >= 0 && desktop.bottom <= desktop.vh, JSON.stringify(desktop));
  check('desktop controls scroll internally', desktop.ctrlScrolls, String(desktop.ctrlScrolls));
  check('desktop no horizontal overflow', !desktop.overflow, String(desktop.overflow));
  check('zero runtime errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  server.close();
  if(failures){console.log('\n' + failures + ' FAILURE(S)');process.exit(1);}
  console.log('\nALL TRADING CARD DESIGNER CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
