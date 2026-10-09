// Build a Game in 15 Minutes (workshops/build-a-game-15-min.html) HTTP + runtime check.
// The Dot Smash demo and editor run inside srcdoc iframes, so their game CSS must be
// embedded in the frame document (A946). This guards against the game rendering as an
// unstyled 900px-wide invisible block, and against the game CSS leaking onto the parent body.
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

    const data = await page.evaluate(() => {
      const out = {};
      const bodyCS = getComputedStyle(document.body);
      out.parentOverflowX = bodyCS.overflowX;
      out.parentLocked = bodyCS.overflowY === 'hidden' && parseFloat(bodyCS.height) <= window.innerHeight + 2;
      out.parentScrollable = document.documentElement.scrollHeight > document.documentElement.clientHeight + 2;
      out.overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;

      const demo = document.getElementById('gameDemo');
      const ddoc = demo && demo.contentDocument;
      const dot = ddoc && ddoc.getElementById('dot');
      const dcs = dot ? getComputedStyle(dot) : null;
      out.demo = {
        framePresent: !!demo,
        hasCss: !!(ddoc && ddoc.querySelector('style')),
        dotPosition: dcs && dcs.position,
        dotWidth: dcs && dcs.width,
        dotBackground: dcs && dcs.backgroundColor,
        startHidden: dcs && dcs.display === 'none'
      };
      if (ddoc && ddoc.getElementById('startBtn')) {
        ddoc.getElementById('startBtn').click();
        out.demo.dotAfterStart = getComputedStyle(dot).display;
        dot.click();
        out.demo.scoreAfterClick = ddoc.getElementById('score').textContent;
      }

      const ed = document.getElementById('edPreview');
      const edoc = ed && ed.contentDocument;
      const edot = edoc && edoc.getElementById('dot');
      const ecs = edot ? getComputedStyle(edot) : null;
      out.editor = {
        framePresent: !!ed,
        hasCss: !!(edoc && edoc.querySelector('style')),
        dotPosition: ecs && ecs.position,
        dotWidth: ecs && ecs.width,
        dotBackground: ecs && ecs.backgroundColor,
        dotVisible: ecs && ecs.display !== 'none'
      };
      out.finishedHasCss = FINISHED_GAME.includes('<style>') && FINISHED_GAME.includes('#dot');
      out.starterHasCss = STARTER_FILE.includes('<style>') && STARTER_FILE.includes('#dot');
      return out;
    });

    check(vp.name+': demo iframe present', data.demo.framePresent);
    check(vp.name+': demo game CSS embedded', data.demo.hasCss);
    check(vp.name+': demo dot is positioned + coloured', data.demo.dotPosition==='absolute' && /99, 102, 241/.test(data.demo.dotBackground||''), `${data.demo.dotPosition} ${data.demo.dotBackground}`);
    check(vp.name+': demo dot hidden on start screen', data.demo.startHidden);
    check(vp.name+': demo dot shows after Start', data.demo.dotAfterStart==='block', data.demo.dotAfterStart);
    check(vp.name+': clicking dot scores', data.demo.scoreAfterClick==='1', data.demo.scoreAfterClick);
    check(vp.name+': editor iframe present', data.editor.framePresent);
    check(vp.name+': editor game CSS embedded', data.editor.hasCss);
    check(vp.name+': editor dot is positioned, coloured + visible', data.editor.dotPosition==='absolute' && /99, 102, 241/.test(data.editor.dotBackground||'') && data.editor.dotVisible, `${data.editor.dotPosition} ${data.editor.dotBackground}`);
    check(vp.name+': parent body is not locked to viewport', !data.parentLocked, `overflowX=${data.parentOverflowX}`);
    check(vp.name+': page scrolls', data.parentScrollable, `scrollH=${data.parentScrollable}`);
    check(vp.name+': no horizontal overflow', data.overflow<=2, String(data.overflow));
    check(vp.name+': download templates carry the game CSS', data.finishedHasCss && data.starterHasCss);
    check(vp.name+': zero runtime errors', errors.length===0, errors.join(' | '));
    await page.close();
  }
  await browser.close(); server.close();
  if(failures){ console.log(`\n${failures} FAILURE(S)`); process.exit(1); }
  console.log('\nALL BUILD-A-GAME-15-MIN CHECKS PASSED');
})().catch(e=>{console.error(e); server.close(); process.exit(1);});
