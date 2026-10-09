// Games catalogue (pages/games.html) HTTP + runtime check (A949).
// Guards the finished-vs-prototype distinction: every rendered card must carry a
// visible status badge (Studio Pick / Play Lab / Finished) and every Play Lab card
// must state what it is testing. Desktop and mobile, no overflow, no console errors.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = 'F:/Website/Jvdesign-Website-v2';
const port = 19249;
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon'};
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
    await page.goto(`http://127.0.0.1:${port}/pages/games.html`, {waitUntil:'networkidle0', timeout:30000});
    await new Promise(resolve => setTimeout(resolve, 900));

    const data = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.games-grid .game-card')];
      const labels = ['Studio Pick','Play Lab','Finished'];
      return {
        count: cards.length,
        noBadge: cards.filter(c=>!c.querySelector('.game-badge')).map(c=>(c.querySelector('.game-title')||{}).textContent),
        badLabel: cards.map(c=>{const b=c.querySelector('.game-badge');return b&&!labels.includes(b.textContent.trim())?c.querySelector('.game-title').textContent+':'+b.textContent:null}).filter(Boolean),
        picks: cards.filter(c=>c.getAttribute('data-status')==='featured').map(c=>(c.querySelector('.game-title')||{}).textContent),
        labsNoTest: cards.filter(c=>c.getAttribute('data-status')==='experimental'&&!c.querySelector('.game-testing')).map(c=>(c.querySelector('.game-title')||{}).textContent),
        labNotes: cards.filter(c=>c.getAttribute('data-status')==='experimental').map(c=>(c.querySelector('.game-testing')||{}).textContent).filter(Boolean),
        chips: [...document.querySelectorAll('.game-chip')].map(c=>c.textContent.trim()),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });

    check(vp.name+': catalogue renders cards', data.count >= 20, String(data.count));
    check(vp.name+': every card has a status badge', data.noBadge.length===0, data.noBadge.join(', '));
    check(vp.name+': every badge is Studio Pick / Play Lab / Finished', data.badLabel.length===0, data.badLabel.join(', '));
    check(vp.name+': exactly one Studio Pick', data.picks.length===1 && data.picks[0]==='Arcane Citadel', data.picks.join(', '));
    check(vp.name+': every Play Lab card states what it tests', data.labsNoTest.length===0, data.labsNoTest.join(', '));
    check(vp.name+': Play Lab notes all start with Testing:', data.labNotes.every(t=>/^Testing: /.test(t)) && data.labNotes.length>=20, String(data.labNotes.length));
    check(vp.name+': Studio Pick + Play Lab filters present', data.chips.some(c=>/Studio Pick/.test(c)) && data.chips.some(c=>/Play Labs/.test(c)), data.chips.join(' | '));
    check(vp.name+': no horizontal overflow', data.overflow<=2, String(data.overflow));
    check(vp.name+': zero runtime errors', errors.length===0, errors.join(' | '));
    await page.close();
  }
  await browser.close(); server.close();
  if(failures){ console.log(`\n${failures} FAILURE(S)`); process.exit(1); }
  console.log('\nALL GAMES CATALOGUE CHECKS PASSED');
})().catch(e=>{console.error(e); server.close(); process.exit(1);});
