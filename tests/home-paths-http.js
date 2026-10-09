// home-paths-http.js (A946): the homepage "What can I do here?" section.
// Three intent paths, each labelled with a project type (Finished game / Workshop /
// Experiment) and ending in a clear first activity. Desktop and mobile, no overflow.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = 'F:/Website/Jvdesign-Website-v2';
const port = 19250;
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
    await page.goto(`http://127.0.0.1:${port}/index.html`, {waitUntil:'networkidle0', timeout:30000});
    await new Promise(resolve => setTimeout(resolve, 900));

    const data = await page.evaluate(() => {
      const sec = document.querySelector('.home-paths');
      const cards = [...document.querySelectorAll('.home-paths .path-card')];
      return {
        exists: !!sec,
        heading: (document.getElementById('paths-title') || {}).textContent || '',
        cards: cards.map(c => ({
          badge: (c.querySelector('.path-badge') || {}).textContent || '',
          title: (c.querySelector('.path-title') || {}).textContent || '',
          cta: (c.querySelector('.path-cta') || {}).textContent || '',
          href: c.getAttribute('href') || ''
        })),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });

    check(vp.name+': "What can I do here?" section present', data.exists && /What can I do here\?/i.test(data.heading), data.heading);
    check(vp.name+': three intent paths', data.cards.length===3, String(data.cards.length));
    const titles = data.cards.map(c=>c.title.trim());
    check(vp.name+': paths are Play / Learn / Create', ['Play a game','Learn to make one','Use a creative tool'].every(t=>titles.includes(t)), titles.join(' | '));
    const badges = data.cards.map(c=>c.badge.trim());
    check(vp.name+': each path carries a project-type label', ['Finished game','Workshop','Experiment'].every(b=>badges.includes(b)), badges.join(' | '));
    check(vp.name+': every path ends in a first activity', data.cards.every(c=>/→/.test(c.cta) && c.href.length>0), data.cards.map(c=>c.href).join(', '));
    check(vp.name+': path links point at games / workshops / tools', data.cards.map(c=>c.href).join(',').includes('/games') && data.cards.map(c=>c.href).join(',').includes('/workshops/start-here.html') && data.cards.map(c=>c.href).join(',').includes('/dev-tools'));
    check(vp.name+': no horizontal overflow', data.overflow<=2, String(data.overflow));
    check(vp.name+': zero runtime errors', errors.length===0, errors.join(' | '));
    await page.close();
  }
  await browser.close(); server.close();
  if(failures){ console.log(`\n${failures} FAILURE(S)`); process.exit(1); }
  console.log('\nALL HOME PATHS CHECKS PASSED');
})().catch(e=>{console.error(e); server.close(); process.exit(1);});
