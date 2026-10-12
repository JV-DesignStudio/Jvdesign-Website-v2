const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19537;
const pagePath = '/games/rustfall.html';
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.woff':'font/woff','.mp3':'audio/mpeg','.ogg':'audio/ogg'};
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
const delay = ms => new Promise(r=>setTimeout(r, ms));

async function canvasSignature(page){
  return page.evaluate(()=>{
    const c=document.getElementById('game');
    if(!c) return null;
    const ctx=c.getContext('2d');
    let d;
    try{ d=ctx.getImageData(0,0,c.width,c.height).data; }catch(e){ return 'err:'+e.message; }
    let s=0; for(let i=0;i<d.length;i+=53) s=(s*31+d[i])>>>0;
    return s;
  });
}

async function probe(browser, width, height, label){
  const page = await browser.newPage();
  const errors=[];
  const bad=[];
  page.on('pageerror', e=>errors.push('pageerror: '+e.message));
  page.on('console', m=>{
    if(m.type() !== 'error') return;
    const text = m.text();
    errors.push('console: '+text);
  });
  page.on('requestfailed', r=>{
    const u=r.url();
    if(u.startsWith('http://127.0.0.1:'+port) || u.startsWith('http://localhost:'+port)) bad.push('failed: '+u+' '+(r.failure()&&r.failure().errorText));
  });
  page.on('response', r=>{ if(r.status()>=400 && r.url().startsWith('http://127.0.0.1:'+port)) bad.push('HTTP '+r.status()+' '+r.url()); });

  await page.setViewport({width, height, isMobile: width <= 480});
  await page.goto('http://127.0.0.1:' + port + pagePath, {waitUntil:'load', timeout:30000});
  await delay(1000);

  const initial = await page.evaluate(()=>({
    title: document.title,
    canvas: !!document.getElementById('game'),
    canvasW: document.getElementById('game')?.width || 0,
    start: !!document.querySelector('[data-jvds-play],#play-btn,#startBtn,#start'),
    buttons: document.querySelectorAll('button,[role="button"]').length,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  check(`[${label}] title loads`, initial.title.includes('Rustfall'), initial.title);
  check(`[${label}] canvas present and sized`, initial.canvas && initial.canvasW > 0, initial.canvasW + 'px');
  check(`[${label}] start control present`, initial.start, 'game-shell discoverable');
  check(`[${label}] interactive surface (canvas or >=5 buttons)`, initial.canvas || initial.buttons >= 5, 'buttons=' + initial.buttons);
  check(`[${label}] no sideways overflow`, initial.scrollWidth <= initial.clientWidth + 1, initial.scrollWidth + '/' + initial.clientWidth);

  // Dismiss the tap-to-start intro so menu controls are reachable.
  await page.evaluate(()=>{
    const i=document.getElementById('intro');
    if(i) i.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}));
  });
  await delay(900);

  // Start the game: PLAY -> CAMPAIGN -> ENTER THE WASTELAND -> pick a biome.
  const started = await page.evaluate(()=>{
    const q=id=>document.getElementById(id);
    const play=document.querySelector('[data-jvds-play]')||q('play-btn');
    if(play) play.click();
    const camp=q('ms-campaign-btn'); if(camp) camp.click();
    const start=q('start-btn'); if(start) start.click();
    const bio=q('biome-overlay');
    if(bio && !bio.classList.contains('hidden')){
      const card=bio.querySelector('.biome-card');
      if(card) card.click();
    }
    const hud=q('hud');
    return {
      hudVisible: !!hud && getComputedStyle(hud).display !== 'none',
      menuHidden: (()=>{ const m=q('menu-overlay'); return !m || getComputedStyle(m).display === 'none'; })()
    };
  });
  await delay(900);
  // First-run coach mark freezes the loop until dismissed.
  await page.evaluate(()=>{
    const c=document.getElementById('coach');
    if(c && !c.classList.contains('hidden')){
      const b=document.getElementById('coach-ok'); if(b) b.click();
    }
  });
  await delay(300);
  check(`[${label}] game started (HUD shown)`, started.hudVisible, JSON.stringify(started));

  // The canvas must visibly change frame-to-frame once playing.
  const sigA = await canvasSignature(page);
  await delay(500);
  const sigB = await canvasSignature(page);
  check(`[${label}] canvas animating`, typeof sigA === 'number' && typeof sigB === 'number' && sigA !== sigB, sigA + ' -> ' + sigB);

  // A tap on the canvas must not throw and must leave the page interactive.
  const box = await page.$eval('#game', el=>{ const r=el.getBoundingClientRect(); return {x:r.x, y:r.y, w:r.width, h:r.height}; });
  await page.mouse.move(box.x + box.w/2, box.y + box.h/2);
  await page.mouse.down();
  await delay(60);
  await page.mouse.up();
  await delay(500);
  const after = await page.evaluate(()=>({
    canvas: !!document.getElementById('game'),
    hud: (()=>{ const h=document.getElementById('hud'); return !!h && getComputedStyle(h).display !== 'none'; })(),
    interactive: typeof window.JVDSGameShell === 'object'
  }));
  check(`[${label}] still interactive after canvas tap`, after.canvas && after.interactive, JSON.stringify(after));
  check(`[${label}] zero runtime errors`, errors.length === 0, errors.join(' | '));
  check(`[${label}] no failed local requests`, bad.length === 0, bad.join(' | '));
  await page.close();
}

(async()=>{
  await listen();
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--autoplay-policy=no-user-gesture-required']});
  await probe(browser, 390, 844, '390x844');
  await probe(browser, 1440, 900, '1440x900');
  await browser.close();
  server.close();
  if(failures){console.log('\n' + failures + ' FAILURE(S)');process.exit(1);}
  console.log('\nALL RUSTFALL CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
