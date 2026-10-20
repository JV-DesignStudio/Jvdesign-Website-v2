// home-paths-http.js (A946, revised by A1534)
// The homepage "intent paths" after the b0795e38 redesign:
//   - the creative-journey strip: 4 steps, Imagine -> Learn -> Create -> Play,
//     linking into /books, /workshops, /tools and /games
//   - the "Explore the Studio" hub: 4 cards (Workshops / Tools / Games / Books)
//   - the "Start with a beginner guide" grid: 6 guide cards linking into /learn
// Desktop and mobile, no horizontal overflow, no runtime errors.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = 'F:/Website/Jvdesign-Website-v2';
let port;
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
function listen(){return new Promise(r=>server.listen(0, ()=>{ port = server.address().port; r(); }));}
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
    await page.goto(`http://127.0.0.1:${port}/index.html`, {waitUntil:'networkidle0', timeout:30000});
    await new Promise(resolve => setTimeout(resolve, 900));

    const data = await page.evaluate(() => {
      const steps = [...document.querySelectorAll('.journey-step')].map(s => ({
        guide: (s.querySelector('.journey-guide') || {}).textContent || '',
        strong: (s.querySelector('strong') || {}).textContent || '',
        href: s.getAttribute('href') || ''
      }));
      const hubs = [...document.querySelectorAll('.hub-card')].map(c => ({
        name: (c.querySelector('.hub-name') || {}).textContent || '',
        href: c.getAttribute('href') || ''
      }));
      const guides = [...document.querySelectorAll('.home-paths .path-card')].map(c => ({
        title: (c.querySelector('.path-title') || {}).textContent || '',
        cta: (c.querySelector('.path-cta') || {}).textContent || '',
        href: c.getAttribute('href') || ''
      }));
      return {
        journeyTitle: (document.getElementById('journey-title') || {}).textContent || '',
        steps, hubs, guides,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    const hrefs = arr => arr.map(x=>x.href).join(',');

    check(vp.name+': creative-journey section present', /What shall we make today\?/i.test(data.journeyTitle), data.journeyTitle);
    check(vp.name+': four journey steps', data.steps.length===4, String(data.steps.length));
    const stepGuides = data.steps.map(s=>s.guide.trim()).join(' | ');
    check(vp.name+': steps run Imagine / Learn / Create / Play',
      ['imagine with','learn with','create with','play with'].every(t=>stepGuides.toLowerCase().includes(t)), stepGuides);
    check(vp.name+': each step points into a studio area',
      ['/books','/workshops','/tools','/games'].every(t=>hrefs(data.steps).includes(t)), hrefs(data.steps));
    check(vp.name+': every step has a concrete activity', data.steps.every(s=>s.strong.trim().length>3 && s.href.length>0));

    check(vp.name+': hub shows four studio cards (Workshops / Tools / Games / Books)',
      data.hubs.length===4 && ['Workshops','Tools','Games','Books'].every(n=>data.hubs.map(h=>h.name.trim()).includes(n)),
      data.hubs.map(h=>h.name.trim()).join(' | '));
    check(vp.name+': hub links point at the four hubs',
      ['/workshop','/dev-tools','/arcade.html','/books'].every(t=>hrefs(data.hubs).includes(t)), hrefs(data.hubs));

    check(vp.name+': beginner-guide grid has six guides', data.guides.length===6, String(data.guides.length));
    check(vp.name+': guide cards end in a first read and link into /learn',
      data.guides.length===6 && data.guides.every(g=>/→/.test(g.cta) && g.href.includes('/learn')), hrefs(data.guides));

    check(vp.name+': no horizontal overflow', data.overflow<=2, String(data.overflow));
    check(vp.name+': zero runtime errors', errors.length===0, errors.join(' | '));
    await page.close();
  }
  await browser.close(); server.close();
  if(failures){ console.log(`\n${failures} FAILURE(S)`); process.exit(1); }
  console.log('\nALL HOME PATHS CHECKS PASSED');
})().catch(e=>{console.error(e); server.close(); process.exit(1);});
