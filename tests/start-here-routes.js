// start-here-routes.js (A948): the Start Here page gives newcomers one obvious
// route. Start Here is reachable from the main navigation and the page offers the
// three intent routes (play / make a game / draw or create), each ending in a clear
// first activity. Desktop and mobile, no overflow, no console errors.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = 'F:/Website/Jvdesign-Website-v2';
const port = 19252;
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
    await page.goto(`http://127.0.0.1:${port}/workshops/start-here.html`, {waitUntil:'networkidle0', timeout:30000});
    await new Promise(resolve => setTimeout(resolve, 800));

    const data = await page.evaluate(() => {
      const navStart = [...document.querySelectorAll('nav.main-nav a')].map(a=>a.textContent.trim());
      const routes = [...document.querySelectorAll('.start-routes .start-route')].map(a => ({
        title:(a.querySelector('.start-route-title')||{}).textContent||'',
        cta:(a.querySelector('.start-route-cta')||{}).textContent||'',
        href:a.getAttribute('href')||''
      }));
      return { navStart, routes, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });

    check(vp.name+': Start Here is in the main navigation', data.navStart.includes('Start Here'), data.navStart.join(' | '));
    check(vp.name+': three intent routes present', data.routes.length===3, String(data.routes.length));
    const titles = data.routes.map(r=>r.title.trim());
    check(vp.name+': routes are Play / Make / Create',
      ['I want to play a game','I want to make a game','I want to draw or create'].every(t=>titles.includes(t)), titles.join(' | '));
    check(vp.name+': every route ends in a first activity', data.routes.every(r=>/→/.test(r.cta) && r.href.length>0), data.routes.map(r=>r.cta).join(' | '));
    check(vp.name+': routes point at a game, a workshop and a tool',
      data.routes.some(r=>/\/games\//.test(r.href)) && data.routes.some(r=>/workshop/.test(r.href)) && data.routes.some(r=>/pixel-studio/.test(r.href)),
      data.routes.map(r=>r.href).join(', '));
    check(vp.name+': no horizontal overflow', data.overflow<=2, String(data.overflow));
    check(vp.name+': zero runtime errors', errors.length===0, errors.join(' | '));
    await page.close();
  }
  await browser.close(); server.close();
  if(failures){ console.log(`\n${failures} FAILURE(S)`); process.exit(1); }
  console.log('\nALL START HERE ROUTE CHECKS PASSED');
})().catch(e=>{console.error(e); server.close(); process.exit(1);});
