const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19254;
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
  await page.setViewport({width:390,height:844,isMobile:true});
  await page.goto('http://127.0.0.1:' + port + '/tools/sprite-animator.html', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(resolve=>setTimeout(resolve, 1000));
  const initial = await page.evaluate(()=>( {
    title: document.title,
    skipLinks: document.querySelectorAll('.skip-link').length,
    main: !!document.getElementById('main-content'),
    canvas: !!document.getElementById('preview-canvas'),
    play: document.getElementById('playBtn')?.textContent.trim(),
    back: document.querySelector('.hdr-back[href]')?.textContent.trim(),
    hint: document.querySelector('.kbd-hint')?.textContent.trim(),
    exportJson: typeof window.exportJSON === 'function',
    exportPng: typeof window.exportPNG === 'function',
    exportSheet: typeof window.exportSheet === 'function',
    share: typeof window.copySpriteShareLink === 'function',
    pixelImport: typeof window.importFromPixelStudio === 'function',
    cleanText: !/[âÃï�]/.test(document.body.innerText),
    openStartCount: Array.from(document.scripts).map(s => s.textContent || '').join('\n').match(/function openStart/g)?.length || 0,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  check('title loads', initial.title.includes('Sprite Animator'), initial.title);
  check('single skip link', initial.skipLinks === 1, String(initial.skipLinks));
  check('main target exists', initial.main);
  check('preview canvas exists', initial.canvas);
  check('play label clean', initial.play === '▶', initial.play);
  check('back label clean', initial.back === '← Tools', initial.back);
  check('keyboard hint clean', /←\/→ frame · \+\/− zoom/.test(initial.hint || ''), initial.hint);
  check('export/share/import functions exist', initial.exportJson && initial.exportPng && initial.exportSheet && initial.share && initial.pixelImport);
  check('only one openStart helper remains', initial.openStartCount === 1, String(initial.openStartCount));
  check('no visible mojibake', initial.cleanText);
  check('mobile does not overflow viewport', initial.scrollWidth <= initial.clientWidth + 2, initial.scrollWidth + '/' + initial.clientWidth);
  const loaded = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 32;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ff4f8b'; ctx.fillRect(0,0,32,32);
    ctx.fillStyle = '#22c55e'; ctx.fillRect(32,0,32,32);
    const blob = await new Promise(resolve => c.toBlob(resolve, 'image/png'));
    const file = new File([blob], 'two-frame.png', {type:'image/png'});
    await window.loadSheet({files:[file]});
    await new Promise(resolve => setTimeout(resolve, 350));
    return {
      total: document.getElementById('totalFrameNum')?.textContent.trim(),
      thumbs: document.querySelectorAll('.frame-thumb').length,
      sheetInfo: document.getElementById('sheetInfo')?.textContent || '',
      promptHidden: document.getElementById('uploadPrompt')?.classList.contains('hidden')
    };
  });
  check('generated test spritesheet loads two frames', loaded.total === '2' && loaded.thumbs === 2, JSON.stringify(loaded));
  check('upload prompt hides after load', loaded.promptHidden);
  await page.evaluate(() => window.closeStart());
  await page.click('#playBtn');
  await new Promise(resolve=>setTimeout(resolve, 250));
  const playing = await page.evaluate(()=>document.getElementById('playBtn')?.textContent.trim());
  check('play toggles cleanly', playing === '⏸', playing);
  await page.click('#playBtn');

  await page.goto('http://127.0.0.1:' + port + '/tools/sprite-sheet-animator.html', {waitUntil:'domcontentloaded', timeout:15000});
  const bridge = await page.evaluate(() => ({
    title: document.title,
    canonical: document.querySelector('link[rel="canonical"]')?.href || '',
    main: !!document.getElementById('main-content'),
    cta: document.querySelector('.actions .primary')?.getAttribute('href') || '',
    text: document.body.innerText,
    cleanText: !/[âÃï�]/.test(document.body.innerText),
    skipLinks: document.querySelectorAll('.skip-link').length
  }));
  check('legacy sprite sheet route is a merge bridge', bridge.title.includes('moved') && bridge.canonical.endsWith('/tools/sprite-animator.html') && bridge.cta === 'sprite-animator.html', JSON.stringify(bridge));
  check('legacy sprite sheet bridge has main target', bridge.main && bridge.skipLinks === 1);
  check('legacy sprite sheet bridge text is clean', bridge.cleanText);
  check('zero runtime errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  server.close();
  if(failures){console.log('\n' + failures + ' FAILURE(S)');process.exit(1);}
  console.log('\nALL SPRITE ANIMATOR CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
