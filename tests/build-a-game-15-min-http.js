// Build a Game in 15 Minutes (workshops/build-a-game-15-min.html) HTTP + runtime check.
// The Dot Smash demo and editor run inside a CSP-clean preview host
// (assets/canvas-preview.html) so the game's inline scripts execute; a srcdoc frame
// would inherit the page CSP and stay blank. The game document is a nested sandboxed
// stage, so this reads it through puppeteer's frame API (which works cross-origin)
// rather than contentDocument. It guards against the game rendering as an unstyled,
// invisible block and against the game CSS leaking onto the parent body.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = 'F:/Website/Jvdesign-Website-v2';
const port = 19248;
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
function listen(){return new Promise(r=>server.listen(port, r));}
let failures = 0;
function check(name, ok, detail=''){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }
const info = (fr) => fr.evaluate(() => ({
  dot: !!document.getElementById('dot'),
  start: !!document.getElementById('startBtn'),
  css: !!document.querySelector('style')
})).catch(() => null);
async function findFrames(page){
  const found = { demo:null, editor:null };
  for (let i = 0; i < 20 && !(found.demo && found.editor); i++) {
    for (const fr of page.frames()) {
      const f = await info(fr);
      if (!f || !f.dot) continue;
      if (f.start) { if (!found.demo) found.demo = { fr, css:f.css }; }
      else if (!found.editor) found.editor = { fr, css:f.css };
    }
    if (!found.demo || !found.editor) await new Promise(r => setTimeout(r, 200));
  }
  return found;
}
(async()=>{
  await listen();
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});
  for (const vp of [{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844,isMobile:true}]) {
    const page = await browser.newPage();
    await page.setViewport(vp);
    const errors=[];
    page.on('pageerror', e=>errors.push('pageerror: '+e.message));
    page.on('console', msg=>{ if(msg.type()==='error' && !/ERR_NETWORK_ACCESS_DENIED|Failed to load resource/.test(msg.text())) errors.push('console: '+msg.text()); });
    await page.goto(`http://127.0.0.1:${port}/workshops/build-a-game-15-min.html`, {waitUntil:'networkidle0', timeout:30000});
    await new Promise(resolve => setTimeout(resolve, 800));

    const parent = await page.evaluate(() => {
      const out = {};
      const bodyCS = getComputedStyle(document.body);
      out.parentOverflowX = bodyCS.overflowX;
      out.parentLocked = bodyCS.overflowY === 'hidden' && parseFloat(bodyCS.height) <= window.innerHeight + 2;
      out.parentScrollable = document.documentElement.scrollHeight > document.documentElement.clientHeight + 2;
      out.overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      out.demoFramePresent = !!document.getElementById('gameDemo');
      out.editorFramePresent = !!document.getElementById('edPreview');
      out.finishedHasCss = typeof FINISHED_GAME !== 'undefined' && FINISHED_GAME.includes('<style>') && FINISHED_GAME.includes('#dot');
      out.starterHasCss = typeof STARTER_FILE !== 'undefined' && STARTER_FILE.includes('<style>') && STARTER_FILE.includes('#dot');
      return out;
    });

    const frames = await findFrames(page);
    const demoStart = frames.demo ? await frames.demo.fr.evaluate(() => {
      const dot = document.getElementById('dot');
      const cs = getComputedStyle(dot);
      const before = { position:cs.position, width:cs.width, background:cs.backgroundColor, startHidden: cs.display === 'none' };
      document.getElementById('startBtn').click();
      const after = getComputedStyle(dot).display;
      dot.click();
      return { ...before, after, score: document.getElementById('score').textContent };
    }) : {};
    const editor = frames.editor ? await frames.editor.fr.evaluate(() => {
      const dot = document.getElementById('dot');
      const cs = getComputedStyle(dot);
      return { position:cs.position, width:cs.width, background:cs.backgroundColor, visible: cs.display !== 'none' };
    }) : {};

    check(vp.name+': demo iframe present', parent.demoFramePresent);
    check(vp.name+': demo game CSS embedded', !!(frames.demo && frames.demo.css));
    check(vp.name+': demo dot is positioned + coloured', demoStart.position==='absolute' && /99, 102, 241/.test(demoStart.background||''), `${demoStart.position} ${demoStart.background}`);
    check(vp.name+': demo dot hidden on start screen', demoStart.startHidden === true);
    check(vp.name+': demo dot shows after Start', demoStart.after==='block', demoStart.after);
    check(vp.name+': clicking dot scores', demoStart.score==='1', demoStart.score);
    check(vp.name+': editor iframe present', parent.editorFramePresent);
    check(vp.name+': editor game CSS embedded', !!(frames.editor && frames.editor.css));
    check(vp.name+': editor dot is positioned, coloured + visible', editor.position==='absolute' && /99, 102, 241/.test(editor.background||'') && editor.visible===true, `${editor.position} ${editor.background}`);
    check(vp.name+': parent body is not locked to viewport', !parent.parentLocked, `overflowX=${parent.parentOverflowX}`);
    check(vp.name+': page scrolls', parent.parentScrollable, `scrollH=${parent.parentScrollable}`);
    check(vp.name+': no horizontal overflow', parent.overflow<=2, String(parent.overflow));
    check(vp.name+': download templates carry the game CSS', parent.finishedHasCss && parent.starterHasCss);
    check(vp.name+': zero runtime errors', errors.length===0, errors.join(' | '));
    await page.close();
  }
  await browser.close(); server.close();
  if(failures){ console.log(`\n${failures} FAILURE(S)`); process.exit(1); }
  console.log('\nALL BUILD-A-GAME-15-MIN CHECKS PASSED');
})().catch(e=>{console.error(e); server.close(); process.exit(1);});
