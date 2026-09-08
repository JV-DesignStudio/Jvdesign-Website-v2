const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19248;
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
  await page.goto(`http://127.0.0.1:${port}/tools/sound-studio.html`, {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(resolve=>setTimeout(resolve, 1000));
  const initial = await page.evaluate(()=>({
    title: document.title,
    skipLinks: document.querySelectorAll('.skip-link').length,
    main: !!document.getElementById('main-content'),
    play: document.getElementById('playBtn')?.textContent.trim(),
    transport: document.getElementById('transport')?.innerText || '',
    welcome: document.querySelector('#start-modal .ss-title')?.textContent || '',
    tracks: document.querySelectorAll('.track-row').length,
    cells: document.querySelectorAll('.step-cell').length,
    exportFn: typeof window.exportWAV === 'function',
    gameMakerFn: typeof window.sendToGameMaker === 'function',
    shareFn: typeof window.copySoundShareLink === 'function',
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    badText: /⭐\?|\? Play|\? Help|\? Workshop|\? WAV|\? Back|\? Project|\? Stop|\? Undo|\? Redo|\?\?/.test(document.body.innerText)
  }));
  check('title loads', initial.title.includes('Audio Studio'), initial.title);
  check('single skip link', initial.skipLinks === 1, String(initial.skipLinks));
  check('main target exists', initial.main);
  check('play label clean', initial.play === '▶ Play', initial.play);
  check('transport labels clean', !/[?] Play|[?] WAV|[?] Back|[?] Project/.test(initial.transport), initial.transport.slice(0,120));
  check('welcome title clean', initial.welcome === '🎛️ Welcome to Audio Studio', initial.welcome);
  check('tracks render', initial.tracks >= 1, String(initial.tracks));
  check('sequencer cells render', initial.cells >= 8, String(initial.cells));
  check('export and handoff functions exist', initial.exportFn && initial.gameMakerFn && initial.shareFn);
  check('mobile does not overflow viewport', initial.scrollWidth <= initial.clientWidth + 2, `${initial.scrollWidth}/${initial.clientWidth}`);
  check('no known broken placeholder text', !initial.badText);
  await page.evaluate(() => closeStart());
  await page.click('#playBtn');
  await new Promise(resolve=>setTimeout(resolve, 400));
  const playing = await page.evaluate(()=>document.getElementById('playBtn')?.textContent.trim());
  check('play toggles to stop', playing === '■ Stop', playing);
  await page.click('#playBtn');
  const stopped = await page.evaluate(()=>document.getElementById('playBtn')?.textContent.trim());
  check('stop toggles back to play', stopped === '▶ Play', stopped);
  check('zero runtime errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  server.close();
  if(failures){console.log(`\n${failures} FAILURE(S)`);process.exit(1);}
  console.log('\nALL SOUND STUDIO CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
