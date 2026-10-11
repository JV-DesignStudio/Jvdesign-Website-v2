const http=require('http'),fs=require('fs'),path=require('path');
const puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const PAGE='/workshops/terraria-mod-studio.html';
let failures=0;
function check(name,ok,detail=''){console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:''));if(!ok)failures++;}
const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.zip':'application/zip','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
  const u=decodeURIComponent(new URL(req.url,'http://x').pathname);
  const f=path.join(root,u);
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end('missing '+u);}
  res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);
});
(async()=>{
  server.listen(0);
  await new Promise(r=>server.once('listening',r));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await puppeteer.launch({headless:true,args:['--no-sandbox']});
  try{
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request',r=>r.url().startsWith(base)||r.url().startsWith('data:')?r.continue():r.abort());
    await page.setViewport({width:1440,height:1400});
    await page.goto(base+PAGE,{waitUntil:'load'});
    if(await page.$('#cookie-decline'))await page.click('#cookie-decline');
    // dismiss the first-run tour if it appeared
    const tourVisible=await page.evaluate(()=>{const o=document.getElementById('tourOverlay');return !!(o&&!o.hidden);});
    check('first-run tour shows for new visitors',tourVisible);
    if(tourVisible)await page.click('#tourSkip');

    const info=await page.evaluate(()=>{
      const tabs=[...document.querySelectorAll('.twms-tab')];
      return {
        tabs:tabs.length,
        role:tabs.map(x=>x.getAttribute('role')),
        sel:tabs.map(x=>x.getAttribute('aria-selected')),
        ti:tabs.map(x=>x.getAttribute('tabindex')),
        canvas:!!document.getElementById('twmsMap'),
        walkBtn:!!document.getElementById('mapWalk'),
        dlBtn:!!document.getElementById('xDownload'),
        dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length,
        scrollWidth:document.documentElement.scrollWidth
      };
    });
    check('studio has 5 tabs',info.tabs===5,'tabs '+info.tabs);
    check('tabs expose role=tab',info.role.every(r=>r==='tab'));
    check('exactly one tab selected',info.sel.filter(s=>s==='true').length===1,JSON.stringify(info.sel));
    check('roving tabindex present',info.ti.filter(t=>t==='0').length===1&&info.ti.filter(t=>t==='-1').length===4,JSON.stringify(info.ti));
    check('map canvas present',info.canvas);
    check('walk test button present',info.walkBtn);
    check('download button present',info.dlBtn);
    check('no em or en dashes',info.dashes===0,'dashes '+info.dashes);
    check('desktop no overflow',info.scrollWidth<=1442,info.scrollWidth+'');

    // painting changes the map
    await page.click('.twms-tool[data-tile="water"]');
    const before=await page.$eval('#twmsMap',c=>c.toDataURL());
    const box=await page.$eval('#twmsMap',c=>{const r=c.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
    await page.mouse.click(box.x+box.w*0.5,box.y+box.h*0.5);
    const after=await page.$eval('#twmsMap',c=>c.toDataURL());
    check('painting a tile changes the map',before!==after);

    // walk test toggles the dpad
    await page.click('#mapWalk');
    const dpadShown=await page.$eval('#mapDpad',el=>getComputedStyle(el).display!=='none');
    check('walk test reveals the movement pad',dpadShown);

    // tab switching works
    await page.click('.twms-tab[data-tab="objects"]');
    const objActive=await page.$eval('#panel-objects',el=>el.classList.contains('is-active'));
    check('objects tab activates its panel',objActive);
    await page.click('#biomeTest');
    const biomeMsg=await page.$eval('#biomeMsg',el=>el.textContent.trim());
    check('biome check reports a biome',/forest|snow|desert|biome/i.test(biomeMsg),biomeMsg.slice(0,60));

    await page.click('.twms-tab[data-tab="files"]');
    await page.click('#filesBuild');
    const filesPreview=await page.$eval('#filesPreview',el=>el.textContent);
    check('file builders render a live preview',/world\.json/.test(filesPreview)&&/seed/.test(filesPreview));

    await page.click('.twms-tab[data-tab="export"]');
    const xPreview=await page.$eval('#xPreview',el=>el.textContent);
    check('export preview lists the world files',/world\.json/.test(xPreview)&&/\.png/.test(xPreview));
    await page.select('#xMode','share');
    const xPreviewShare=await page.$eval('#xPreview',el=>el.textContent);
    check('share export preview ships a preview page',/world-preview\.html/.test(xPreviewShare),xPreviewShare.split('\n')[0]);

    check('no browser errors',errors.length===0,errors.slice(0,2).join(' | '));

    // embed mode (used by episode iframes)
    errors.length=0;
    await page.goto(base+PAGE+'?embed=1&tab=objects',{waitUntil:'load'});
    const emb=await page.evaluate(()=>({
      header:document.querySelector('.site-header')?getComputedStyle(document.querySelector('.site-header')).display==='none':true,
      hero:getComputedStyle(document.querySelector('.hero')).display==='none',
      tabs:getComputedStyle(document.querySelector('.twms-tabs')).display==='none',
      objects:document.getElementById('panel-objects').classList.contains('is-active')
    }));
    check('embed hides the site chrome',emb.header&&emb.hero&&emb.tabs);
    check('embed opens the requested tab',emb.objects);
    check('embed has no browser errors',errors.length===0,errors.slice(0,2).join(' | '));

    for(const width of [390,320]){
      await page.setViewport({width,height:844,isMobile:true});
      await page.goto(base+PAGE,{waitUntil:'load'});
      const m=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length}));
      check(width+'px no horizontal overflow',m.sw<=width+2,'scrollWidth '+m.sw);
      check(width+'px no dashes',m.dashes===0,'dashes '+m.dashes);
    }
  } finally { await browser.close(); await new Promise(r=>server.close(r)); }
  console.log(failures?('\n'+failures+' FAILED'):'\nALL PASS');
  process.exit(failures?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
