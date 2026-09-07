const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = 'F:/Website/Jvdesign-Website-v2';
const port = 19247;
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
function listen(){return new Promise(r=>server.listen(port, r));}
(async()=>{
  await listen();
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});
  const results=[];
  for (const vp of [{name:'desktop',width:1366,height:900},{name:'mobile',width:390,height:844,isMobile:true}]) {
    const page = await browser.newPage();
    await page.setViewport(vp);
    const errors=[];
    page.on('pageerror', e=>errors.push('pageerror: '+e.message));
    page.on('console', msg=>{ if(msg.type()==='error' && !/ERR_NETWORK_ACCESS_DENIED|Failed to load resource/.test(msg.text())) errors.push('console: '+msg.text()); });
    await page.goto(`http://127.0.0.1:${port}/tools/project-tracker.html`, {waitUntil:'domcontentloaded', timeout:15000});
    await new Promise(resolve => setTimeout(resolve, 1000));
    const data = await page.evaluate(() => ({
      title: document.title,
      bodyTextStart: document.body.innerText.slice(0, 300),
      authGate: !!document.getElementById('authGate'),
      activeView: document.querySelector('.view.active')?.id || '',
      mobileNav: getComputedStyle(document.getElementById('mobileNav') || document.body).display,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      hasScriptText: document.body.innerText.includes('const _MOTIVATIONS') || document.body.innerText.includes('new Blob([html]'),
      newQuest: !!document.querySelector('button[onclick="openCardModal()"]'),
      projectSheet: !!document.getElementById('projectSheet')
    }));
    results.push({vp:vp.name, errors, data});
    await page.close();
  }
  await browser.close(); server.close();
  console.log(JSON.stringify(results,null,2));
  const fail = results.some(r => r.errors.length || r.data.authGate || r.data.hasScriptText || !r.data.activeView || r.data.scrollWidth > r.data.clientWidth + 2);
  if(fail) process.exit(1);
})().catch(e=>{console.error(e); server.close(); process.exit(1);});

