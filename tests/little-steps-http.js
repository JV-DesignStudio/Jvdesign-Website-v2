// A1454: little_steps.html boots and, on a phone, gets on-screen controls from
// the shared engine runtime (rt.touch) that drive the game through real key
// events. Desktop must stay control-free. Run: node tests/little-steps-http.js
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19263;
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon'};
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
const sleep = ms => new Promise(r=>setTimeout(r,ms));
let failures = 0;
function check(name, ok, detail=''){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }
function wireErrors(page){
  const errors=[];
  page.on('pageerror', e=>errors.push('pageerror: '+e.message));
  page.on('console', msg=>{ if(msg.type()==='error' && !/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|ERR_ABORTED|ERR_FILE_NOT_FOUND|favicon/.test(msg.text())) errors.push('console: '+msg.text().slice(0,90)); });
  return errors;
}

(async()=>{
  await new Promise(resolve=>server.listen(port, resolve));
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});

  // 1. Desktop: loads, plays, and shows no touch controls.
  const d = await browser.newPage();
  const derr = wireErrors(d);
  await d.setViewport({width:1440,height:900});
  await d.goto(`http://127.0.0.1:${port}/games/little_steps.html`, {waitUntil:'domcontentloaded', timeout:20000});
  await sleep(800);
  const desk = await d.evaluate(()=>{
    const el = document.querySelector('.gs-touch');
    return {
      title: document.title,
      canvas: !!document.getElementById('game'),
      playBtn: !!document.getElementById('playBtn'),
      hasShell: !!el,
      shellDisplay: el ? getComputedStyle(el).display : null,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
  check('desktop: title loads', desk.title.includes('Little Steps'), desk.title);
  check('desktop: canvas + start button present', desk.canvas && desk.playBtn);
  check('desktop: touch shell exists but is hidden', desk.hasShell && desk.shellDisplay === 'none', String(desk.shellDisplay));
  check('desktop: no horizontal overflow', desk.overflow <= 2, String(desk.overflow));
  check('desktop: no runtime errors', derr.length === 0, derr[0] || '');
  await d.close();

  // 2. Phone: on-screen dpad appears and drives the game via key events.
  const m = await browser.newPage();
  const merr = wireErrors(m);
  await m.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  await m.goto(`http://127.0.0.1:${port}/games/little_steps.html`, {waitUntil:'domcontentloaded', timeout:20000});
  await sleep(800);
  await m.click('#playBtn');
  await sleep(300);
  const shape = await m.evaluate(()=>{
    const el = document.querySelector('.gs-touch');
    const dpad = el && el.querySelector('.gs-dpad');
    return {
      hasShell: !!el,
      display: el ? getComputedStyle(el).display : null,
      buttons: dpad ? dpad.querySelectorAll('button').length : 0,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
  check('phone: touch controls render', shape.hasShell && shape.buttons === 4, 'buttons=' + shape.buttons);
  check('phone: controls visible on a coarse pointer', shape.display === 'flex', String(shape.display));
  check('phone: no horizontal overflow', shape.overflow <= 2, String(shape.overflow));

  const press = await m.evaluate(()=>{
    const btn = document.querySelector('.gs-touch .gs-dpad .down');
    if (!btn) return { fired:false };
    const seen = [];
    document.addEventListener('keydown', e=>{ seen.push({ code: e.code, prevented: e.defaultPrevented }); });
    const fire = t => {
      let e;
      try { e = new PointerEvent(t, { clientX:0, clientY:0, pointerId:9, bubbles:true, cancelable:true }); }
      catch (x) { e = new MouseEvent(t, { bubbles:true, cancelable:true }); }
      btn.dispatchEvent(e);
    };
    fire('pointerdown'); fire('pointerup');
    const hit = seen.find(s => s.code === 'ArrowDown');
    return { fired:true, codes: seen.map(s=>s.code), hit: hit || null };
  });
  check('phone: dpad down emits ArrowDown', press.fired && press.hit !== null, JSON.stringify(press.codes));
  check('phone: the game handles the emitted key', !!(press.hit && press.hit.prevented === true));
  check('phone: no runtime errors', merr.length === 0, merr[0] || '');
  await m.close();

  await browser.close(); server.close();
  if(failures){ console.log(`\n${failures} FAILURE(S)`); process.exit(1); }
  console.log('\nALL LITTLE STEPS HTTP CHECKS PASSED');
})().catch(e=>{ console.error(e); server.close(); process.exit(1); });
