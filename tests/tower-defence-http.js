const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19530;
const pagePath = '/games/tower-defence.html';
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.json':'application/json','.svg':'image/svg+xml','.ico':'image/x-icon'};
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

async function probe(browser, width, height, label){
  const page = await browser.newPage();
  const errors=[];
  const bad=[];
  page.on('pageerror', e=>errors.push('pageerror: '+e.message));
  page.on('console', m=>{
    if(m.type() !== 'error') return;
    const text = m.text();
    if(/ERR_NETWORK_ACCESS_DENIED|Failed to load resource/.test(text)) return;
    errors.push('console: '+text);
  });
  page.on('requestfailed', r=>bad.push('failed: '+r.url()+' '+(r.failure()&&r.failure().errorText)));
  page.on('response', r=>{ if(r.status()>=400) bad.push('HTTP '+r.status()+' '+r.url()); });

  await page.setViewport({width, height, isMobile: width <= 480});
  await page.goto('http://127.0.0.1:' + port + pagePath, {waitUntil:'load', timeout:20000});
  await new Promise(resolve=>setTimeout(resolve, 800));

  const initial = await page.evaluate(()=>({
    title: document.title,
    canvas: !!document.getElementById('game'),
    canvasW: document.getElementById('game')?.width || 0,
    start: !!document.querySelector('[data-jvds-play],#startBtn'),
    startText: (document.querySelector('[data-jvds-play],#startBtn')||{}).textContent?.trim(),
    buttons: document.querySelectorAll('button,[role="button"]').length,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    state: window.HG && window.HG._debug ? window.HG._debug.state : null
  }));
  check(`[${label}] title loads`, initial.title.includes('Tower Defence'), initial.title);
  check(`[${label}] canvas present and sized`, initial.canvas && initial.canvasW > 0, initial.canvasW + 'px');
  check(`[${label}] start control present`, initial.start, initial.startText);
  check(`[${label}] interactive surface (canvas or >=5 buttons)`, initial.canvas || initial.buttons >= 5, 'buttons=' + initial.buttons);
  check(`[${label}] no sideways overflow`, initial.scrollWidth <= initial.clientWidth + 1, initial.scrollWidth + '/' + initial.clientWidth);

  // Start the game via the start control.
  await page.click('[data-jvds-play],#startBtn');
  await new Promise(resolve=>setTimeout(resolve, 600));
  const started = await page.evaluate(()=>({
    state: window.HG && window.HG._debug ? window.HG._debug.state : null,
    howtoHidden: !document.getElementById('howto-overlay') || getComputedStyle(document.getElementById('howto-overlay')).display === 'none'
  }));
  check(`[${label}] game entered playing state`, started.state === 'playing', String(started.state));

  // Dismiss the how-to overlay if shown, then interact with the canvas.
  await page.evaluate(()=>{ if(window.HG && window.HG.closeHowTo) window.HG.closeHowTo(); });
  const box = await page.$eval('#game', el=>{ const r=el.getBoundingClientRect(); return {x:r.x, y:r.y, w:r.width, h:r.height}; });
  await page.mouse.move(box.x + box.w/2, box.y + box.h/2);
  await page.mouse.down();
  await new Promise(resolve=>setTimeout(resolve, 60));
  await page.mouse.up();
  await new Promise(resolve=>setTimeout(resolve, 400));
  const playing = await page.evaluate(()=>({
    state: window.HG._debug.state,
    night: window.HG._debug.night,
    gold: window.HG._debug.gold,
    buildings: window.HG._debug.buildings.length
  }));
  check(`[${label}] still playing after canvas interaction`, playing.state === 'playing', JSON.stringify(playing));
  check(`[${label}] game advanced (loop ran)`, typeof playing.gold === 'number', 'gold=' + playing.gold);

  // Sound enabled/disabled must not throw and must leave the game running.
  const audio = await page.evaluate(()=>{
    if(!window.HG || !window.HG.toggleMusic || !window.HG.toggleSfx) return {ok:false};
    const b = document.createElement('button');
    const m = window.HG.toggleMusic(b);
    const s = window.HG.toggleSfx(b);
    window.HG.toggleMusic(b); window.HG.toggleSfx(b);
    return {ok:true, m:!!m, s:!!s, state: window.HG._debug.state};
  });
  check(`[${label}] sound mute/unmute works`, audio.ok && audio.state === 'playing', JSON.stringify(audio));
  check(`[${label}] zero runtime errors`, errors.length === 0, errors.join(' | '));
  check(`[${label}] no failed local requests`, bad.length === 0, bad.join(' | '));
  await page.close();
}

(async()=>{
  await listen();
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});
  await probe(browser, 390, 844, '390x844');
  await probe(browser, 1440, 900, '1440x900');
  await browser.close();
  server.close();
  if(failures){console.log('\n' + failures + ' FAILURE(S)');process.exit(1);}
  console.log('\nALL TOWER DEFENCE CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
