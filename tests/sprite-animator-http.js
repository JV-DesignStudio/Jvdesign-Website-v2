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
    ctx.fillStyle = '#ff4f8b'; ctx.fillRect(4,4,16,16);
    ctx.fillStyle = '#22c55e'; ctx.fillRect(36,4,16,16);
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
  await page.evaluate(()=>document.getElementById('playBtn')?.click());
  await new Promise(resolve=>setTimeout(resolve, 250));
  const playing = await page.evaluate(()=>document.getElementById('playBtn')?.textContent.trim());
  check('play toggles cleanly', playing === '⏸', playing);
  await page.evaluate(()=>document.getElementById('playBtn')?.click());

  const ui = await page.evaluate(()=>({
    handoffs:['openInPixelStudio','openInGameMaker','downloadProjectBundle'].every(n=>!!document.querySelector('[data-on="'+n+'"]')),
    unlabeled:Array.from(document.querySelectorAll('button')).filter(b=>{
      const text=(b.textContent||'').trim();
      const label=b.getAttribute('aria-label')||b.getAttribute('title');
      return !text&&!label;
    }).length,
    clipList:!!document.getElementById('clipList'),
    exportOptions:!!document.getElementById('exportTrim')&&!!document.getElementById('exportPadding')&&!!document.getElementById('exportScale'),
    scrubber:!!document.getElementById('scrubber')
  }));
  check('hand-off actions are visible buttons', ui.handoffs);
  check('every button has an accessible name', ui.unlabeled===0, String(ui.unlabeled));
  check('clip, export and timeline controls exist', ui.clipList && ui.exportOptions && ui.scrubber);

  const shareUrl = await page.evaluate(async()=>await window.copySpriteShareLink());
  check('share link carries the sprite payload', typeof shareUrl==='string' && /#sprite=[gu]\./.test(shareUrl), String(shareUrl).slice(0,70));
  const warnCancel = await page.$('#jvds-share-warn .jvds-share-warn-cancel');
  if(warnCancel) await warnCancel.click();
  await page.goto(shareUrl,{waitUntil:'domcontentloaded',timeout:15000});
  await page.waitForFunction('(typeof activeFrames!=="undefined") && activeFrames.length===2',{timeout:15000});
  const shared = await page.evaluate(()=>({
    frames:activeFrames.length,
    promptHidden:document.getElementById('uploadPrompt').classList.contains('hidden'),
    hash:location.hash.startsWith('#sprite=')
  }));
  check('shared link reopens the animation', shared.frames===2 && shared.promptHidden && shared.hash, JSON.stringify(shared));

  const ops = await page.evaluate(()=>{
    const before=frames.length;
    toggleFrame(1);
    selectedFrames=new Set([0]);
    deleteSelected();
    const afterDelete=frames.length;
    const keptHidden=frames.some(f=>!f.enabled);
    undo();
    const afterUndo=frames.length;
    selectedFrames=new Set([0]);
    moveFrameRight();
    const moved=frames[0].x>frames[1].x;
    undo();
    selectAll();
    id('clipName').value='walk';
    id('clipFrom').value='1';
    id('clipTo').value='2';
    addClip();
    const manifest=manifestJSON(
      activeFrames.map(fi=>({x:frames[fi].x,y:frames[fi].y})),sheetW,sheetH,
      {cellW:frameW,cellH:frameH,sourceW:frameW,sourceH:frameH,scale:1,crop:{x:0,y:0,w:frameW,h:frameH,trimmed:false}});
    id('exportTrim').checked=true;
    id('exportPadding').value='1';
    id('exportExtrude').checked=true;
    const rep=buildRepacked();
    return {before,afterDelete,keptHidden,afterUndo,moved,clip:manifest.animations[0]&&manifest.animations[0].name,cellW:rep.metrics.cellW,cellH:rep.metrics.cellH,atlasW:rep.canvas.width};
  });
  check('per-frame delete leaves hidden frames alone', ops.before===2 && ops.afterDelete===1 && ops.keptHidden, JSON.stringify(ops));
  check('undo restores a deleted frame', ops.afterUndo===2, JSON.stringify(ops));
  check('frames can be reordered', ops.moved, JSON.stringify(ops));
  check('clips export as animation tags', ops.clip==='walk', JSON.stringify(ops));
  check('trim removes transparent edges and padding adds a border', ops.cellW===16 && ops.cellH===16 && ops.atlasW>32, JSON.stringify(ops));

  await page.setViewport({width:1440,height:900});
  await page.goto('http://127.0.0.1:' + port + '/tools/sprite-animator.html', {waitUntil:'domcontentloaded', timeout:15000});
  await page.waitForFunction('typeof loadSheet==="function"', {timeout:15000});
  const wide = await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth}));
  check('desktop does not overflow viewport', wide.scrollWidth <= wide.clientWidth + 2, wide.scrollWidth + '/' + wide.clientWidth);

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
