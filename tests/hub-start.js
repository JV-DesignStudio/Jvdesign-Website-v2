// hub-start.js (A1695): each big hub must open with one recommended start,
// not a wall of options. This checks the recommendation is present, visible,
// points at a real page, and sits above the catalogue at 390 and 1440.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const port = 19261;
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};
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
const sleep = ms => new Promise(r=>setTimeout(r,ms));
let failures = 0;
function check(name, ok, detail='') {
  console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:''));
  if(!ok) failures++;
}

const HUBS = [
  {name:'Workshops', page:'/pages/workshop.html', band:'.ws-first-project', catalogue:'#workshop-finder'},
  {name:'Tools', page:'/pages/dev-tools.html', band:'.hub-start', catalogue:'#tools'},
  {name:'Arcade', page:'/arcade.html', band:'.hub-start', catalogue:'#grid'},
];

function localFileExists(pagePath, href){
  try {
    const u = new URL(href, 'http://site' + pagePath);
    if(!u.pathname || u.pathname === '/') return false;
    const f = path.join(root, decodeURIComponent(u.pathname));
    return fs.existsSync(f);
  } catch(e){ return false; }
}

(async()=>{
  await new Promise(r=>server.listen(port,r));
  const browser = await puppeteer.launch({headless:'new', args:['--no-sandbox','--disable-setuid-sandbox']});
  try {
    for(const hub of HUBS){
      for(const vp of [{n:'390',w:390,h:844,m:true},{n:'1440',w:1440,h:900,m:false}]){
        const page = await browser.newPage();
        await page.setViewport({width:vp.w,height:vp.h,isMobile:vp.m,hasTouch:vp.m,deviceScaleFactor:1});
        await page.evaluateOnNewDocument(()=>{ try{ document.cookie='jvds-cookie-consent=accepted;path=/;max-age=31536000'; }catch(e){} });
        await page.goto(`http://127.0.0.1:${port}${hub.page}`, {waitUntil:'networkidle2', timeout:60000});
        await sleep(900);
        const state = await page.evaluate(({bandSel,catalogueSel})=>{
          const shown = el=>{ if(!el) return false; const cs=getComputedStyle(el); const r=el.getBoundingClientRect(); return cs.display!=='none' && cs.visibility!=='hidden' && r.height>2; };
          const band = document.querySelector(bandSel);
          const rec = band ? (band.matches('a') ? band : (band.querySelector('a[href]') || band.querySelector('.hub-start-main'))) : null;
          const catalogue = document.querySelector(catalogueSel);
          const br = band ? band.getBoundingClientRect() : null;
          const cr = catalogue ? catalogue.getBoundingClientRect() : null;
          const links = band ? [...band.querySelectorAll('a[href]')] : [];
          return {
            bandShown: shown(band),
            recHref: rec ? rec.getAttribute('href') : null,
            recShown: shown(rec),
            links: links.map(a=>a.getAttribute('href')),
            bandTop: br ? Math.round(br.top) : null,
            catalogueFound: !!catalogue,
            catalogueTop: cr ? Math.round(cr.top) : null,
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          };
        }, {bandSel:hub.band, catalogueSel:hub.catalogue});

        check(`${hub.name} ${vp.n}: recommended start is present`, state.bandShown);
        check(`${hub.name} ${vp.n}: recommendation has one real link`, !!state.recHref, String(state.recHref));
        check(`${hub.name} ${vp.n}: recommendation link resolves to a real page`, localFileExists(hub.page, state.recHref||''), String(state.recHref));
        check(`${hub.name} ${vp.n}: recommendation is visible`, state.recShown);
        check(`${hub.name} ${vp.n}: catalogue still exists`, state.catalogueFound);
        check(`${hub.name} ${vp.n}: recommendation sits above the catalogue`,
          state.catalogueFound && state.bandTop!==null && state.catalogueTop!==null && state.bandTop < state.catalogueTop,
          `band ${state.bandTop}, catalogue ${state.catalogueTop}`);
        check(`${hub.name} ${vp.n}: no horizontal overflow`, state.overflow<=0, String(state.overflow));
        await page.close();
      }
    }
  } finally {
    await browser.close().catch(()=>{});
    await new Promise(r=>server.close(r));
  }
  if(failures){ console.log('\n'+failures+' FAILURE(S)'); process.exit(1); }
  console.log('\nALL HUB-START CHECKS PASSED');
})().catch(e=>{ console.error('Harness error:', e); try{server.close();}catch(_){} process.exit(1); });
