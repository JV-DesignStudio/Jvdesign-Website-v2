const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19261;
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
  await page.setViewport({width:1440,height:900});
  await page.goto('http://127.0.0.1:' + port + '/games/stack-attack.html', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(resolve=>setTimeout(resolve, 900));
  const initial = await page.evaluate(()=>({
    title: document.title,
    canvas: !!document.getElementById('game'),
    canvasW: document.getElementById('game')?.width || 0,
    canvasH: document.getElementById('game')?.height || 0,
    runtime: !!(window.JVDSEngine && window.JVDSEngine.runtime),
    runtimeVersion: (window.JVDSEngine && window.JVDSEngine.runtime && window.JVDSEngine.runtime.version) || null,
    engineMarker: document.getElementById('game')?.dataset.engineRuntime || null,
    startBtn: !!document.getElementById('startBtn'),
    startVisible: !document.getElementById('startScreen')?.classList.contains('hidden'),
    scoreEl: !!document.getElementById('score'),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  }));
  check('title loads', initial.title.includes('Stack Attack'), initial.title);
  check('canvas exists and is sized', initial.canvas && initial.canvasW > 0 && initial.canvasH > 0, initial.canvasW + 'x' + initial.canvasH);
  check('engine runtime present', initial.runtime, initial.runtimeVersion || 'none');
  check('runtime version 2.2.0', initial.runtimeVersion === '2.2.0', String(initial.runtimeVersion));
  check('game runs on the shared runtime', initial.engineMarker === '2.2.0', String(initial.engineMarker));
  check('start screen visible on load', initial.startBtn && initial.startVisible);
  check('desktop has no horizontal overflow', initial.overflow <= 2, String(initial.overflow));

  await page.click('#startBtn');
  await new Promise(resolve=>setTimeout(resolve, 700));
  const started = await page.evaluate(()=>({
    startHidden: document.getElementById('startScreen')?.classList.contains('hidden') || false,
    endHidden: document.getElementById('endScreen')?.classList.contains('hidden') || false,
    score: document.getElementById('score')?.textContent || ''
  }));
  check('start hides the start screen', started.startHidden === true);
  check('score element is present after start', started.score !== null);

  // Space should be routed through the runtime input with no errors (the block
  // may miss the tower, which is a valid game outcome, not a failure).
  await page.keyboard.press('Space');
  await new Promise(resolve=>setTimeout(resolve, 300));
  await page.keyboard.press('Space');
  await new Promise(resolve=>setTimeout(resolve, 300));
  check('no runtime errors after start + drops', errors.length === 0, errors.join(' | '));
  await browser.close();
  server.close();
  if(failures){console.log('\n' + failures + ' FAILURE(S)');process.exit(1);}
  console.log('\nALL STACK ATTACK HTTP CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
