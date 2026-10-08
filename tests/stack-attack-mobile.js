const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19262;
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'};
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
let failures = 0;
function check(name, ok, detail=''){
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if(!ok) failures++;
}
(async()=>{
  await new Promise(resolve=>server.listen(port, resolve));
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  const errors=[];
  page.on('pageerror', e=>errors.push('pageerror: '+e.message));
  page.on('console', m=>{
    if(m.type() !== 'error') return;
    const text = m.text();
    if(/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|ERR_ABORTED|ERR_FILE_NOT_FOUND|favicon/.test(text)) return;
    errors.push('console: '+text);
  });
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  await page.goto('http://127.0.0.1:' + port + '/games/stack-attack.html', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(resolve=>setTimeout(resolve, 900));
  const m = await page.evaluate(()=>({
    runtimeVersion: (window.JVDSEngine && window.JVDSEngine.runtime && window.JVDSEngine.runtime.version) || null,
    engineMarker: document.getElementById('game')?.dataset.engineRuntime || null,
    canvasVisible: (()=>{const c=document.getElementById('game');if(!c)return false;const r=c.getBoundingClientRect();return r.width>0&&r.height>0;})(),
    startBtn: !!document.getElementById('startBtn'),
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  check('runtime version 2.1.0 on mobile', m.runtimeVersion === '2.1.0', String(m.runtimeVersion));
  check('game runs on the shared runtime on mobile', m.engineMarker === '2.1.0', String(m.engineMarker));
  check('canvas visible on mobile', m.canvasVisible);
  check('start button present on mobile', m.startBtn);
  check('mobile does not overflow viewport', m.scrollWidth <= m.clientWidth + 2, m.scrollWidth + '/' + m.clientWidth);

  await page.click('#startBtn');
  await new Promise(resolve=>setTimeout(resolve, 600));
  const after = await page.evaluate(()=>document.getElementById('startScreen')?.classList.contains('hidden') || false);
  check('mobile start hides the start screen', after === true);
  check('no runtime errors on mobile', errors.length === 0, errors.join(' | '));
  await browser.close();
  server.close();
  if(failures){console.log('\n' + failures + ' FAILURE(S)');process.exit(1);}
  console.log('\nALL STACK ATTACK MOBILE CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
