const http=require('http'),fs=require('fs'),path=require('path');
const puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const PAGE='/workshops/openrct2-mod-studio.html';
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
    page.on('request',r=>{const u=r.url();(u.startsWith(base)||u.startsWith('data:')||u.startsWith('blob:'))?r.continue():r.abort();});
    await page.setViewport({width:1440,height:1400});
    await page.goto(base+PAGE,{waitUntil:'load'});
    if(await page.$('#cookie-decline'))await page.click('#cookie-decline');

    const info=await page.evaluate(()=>{
      const tabs=[...document.querySelectorAll('.rctms-tab')];
      return {
        tabs:tabs.length,
        role:tabs.map(x=>x.getAttribute('role')),
        sel:tabs.map(x=>x.getAttribute('aria-selected')),
        ti:tabs.map(x=>x.getAttribute('tabindex')),
        dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length,
        scrollWidth:document.documentElement.scrollWidth
      };
    });
    check('studio has 5 tabs',info.tabs===5,'tabs '+info.tabs);
    check('tabs expose role=tab',info.role.every(r=>r==='tab'));
    check('exactly one tab selected',info.sel.filter(s=>s==='true').length===1,JSON.stringify(info.sel));
    check('roving tabindex present',info.ti.filter(t=>t==='0').length===1&&info.ti.filter(t=>t==='-1').length===4,JSON.stringify(info.ti));
    check('no em or en dashes',info.dashes===0,'dashes '+info.dashes);
    check('desktop no overflow',info.scrollWidth<=1442,info.scrollWidth+'');

    // plugin preview
    const js=await page.$eval('#pPreview',el=>el.textContent);
    check('plugin uses registerPlugin',/registerPlugin\(/.test(js));
    check('plugin subscribes to an event',/context\.subscribe\("interval\.day"/.test(js));
    check('plugin posts a message',/park\.postMessage\("A new day in the park!"\)/.test(js));

    // rename updates the plugin + folder
    await page.evaluate(()=>{const el=document.getElementById('pName');el.value='Day Greeter';el.dispatchEvent(new Event('input',{bubbles:true}));});
    const js2=await page.$eval('#pPreview',el=>el.textContent);
    check('renaming updates the plugin',/name: "Day Greeter"/.test(js2));

    // adding a park action updates the code
    await page.click('.rctms-tab[data-tab="does"]');
    const doesActive=await page.$eval('#panel-does',el=>el.classList.contains('is-active'));
    check('does tab activates its panel',doesActive);
    await page.evaluate(()=>{const boxes=[...document.querySelectorAll('#pActs input[type="checkbox"]')];boxes[3].click();});
    const js3=await page.$eval('#pPreview2',el=>el.textContent);
    check('ticking a park action adds its code',/map\.getAllEntities\("guest"\)/.test(js3),js3.slice(0,0));
    await page.select('#pEvent','interval.tick');
    const js4=await page.$eval('#pPreview2',el=>el.textContent);
    check('changing the event updates the code',/context\.subscribe\("interval\.tick"/.test(js4));

    // files tab
    await page.click('.rctms-tab[data-tab="files"]');
    const files=await page.$eval('#pFiles',el=>el.textContent);
    check('files preview shows the plugin and README',/\.js/.test(files)&&/README\.txt/.test(files));
    const checklist=await page.$$eval('#pChecklist li',ls=>ls.length);
    check('ready check lists the plugin rules',checklist>=3,'items '+checklist);

    // debug tab
    await page.click('.rctms-tab[data-tab="debug"]');
    await page.click('#dbgLog .err');
    const optCount=await page.$$eval('#dbgOptions .rctms-dbg-opt',o=>o.length);
    check('clicking the error reveals fixes',optCount>=3,'options '+optCount);
    await page.click('#dbgOptions .rctms-dbg-opt');
    const dbgOk=await page.$eval('#dbgMsg',el=>el.classList.contains('ok'));
    check('choosing the right fix is accepted',dbgOk);

    // export tab
    await page.click('.rctms-tab[data-tab="export"]');
    const tree=await page.$eval('#xTree',el=>el.textContent);
    check('export preview lists the plugin files',/\.js/.test(tree)&&/README/.test(tree));
    await page.click('#xDownload');
    const dlMsg=await page.$eval('#xMsg',el=>el.textContent);
    check('download builds a plugin zip',/Downloaded/.test(dlMsg)&&/\.zip/.test(dlMsg),dlMsg.slice(0,60));

    check('no browser errors',errors.length===0,errors.slice(0,2).join(' | '));

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
