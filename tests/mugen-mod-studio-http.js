const http=require('http'),fs=require('fs'),path=require('path');
const puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const PAGE='/workshops/mugen-mod-studio.html';
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
      const tabs=[...document.querySelectorAll('.mgnms-tab')];
      return {
        tabs:tabs.length,
        role:tabs.map(x=>x.getAttribute('role')),
        sel:tabs.map(x=>x.getAttribute('aria-selected')),
        ti:tabs.map(x=>x.getAttribute('tabindex')),
        canvas:!!document.getElementById('sCanvas'),
        dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length,
        scrollWidth:document.documentElement.scrollWidth
      };
    });
    check('studio has 5 tabs',info.tabs===5,'tabs '+info.tabs);
    check('tabs expose role=tab',info.role.every(r=>r==='tab'));
    check('exactly one tab selected',info.sel.filter(s=>s==='true').length===1,JSON.stringify(info.sel));
    check('roving tabindex present',info.ti.filter(t=>t==='0').length===1&&info.ti.filter(t=>t==='-1').length===4,JSON.stringify(info.ti));
    check('stage preview canvas present',info.canvas);
    check('no em or en dashes',info.dashes===0,'dashes '+info.dashes);
    check('desktop no overflow',info.scrollWidth<=1442,info.scrollWidth+'');

    // fighter def preview
    const charDef=await page.$eval('#cDefPreview',el=>el.textContent);
    check('fighter def has [Info] and mugenversion',/\[Info\]/.test(charDef)&&/mugenversion = 1.1/.test(charDef));
    check('fighter def has [Files] pointing at the parts',/\[Files\]/.test(charDef)&&/cmd = MyFighter\.cmd/.test(charDef)&&/sprite = MyFighter\.sff/.test(charDef));

    // renaming the fighter rewrites the def and all its file references
    await page.evaluate(()=>{const el=document.getElementById('cName');el.value='DragonFighter';el.dispatchEvent(new Event('input',{bubbles:true}));});
    const charDef2=await page.$eval('#cDefPreview',el=>el.textContent);
    check('renaming the fighter rewrites its def',/cmd = DragonFighter\.cmd/.test(charDef2)&&/anim = DragonFighter\.air/.test(charDef2),charDef2.split('\n')[0]);

    // stage tab
    await page.click('.mgnms-tab[data-tab="stage"]');
    const stageActive=await page.$eval('#panel-stage',el=>el.classList.contains('is-active'));
    check('stage tab activates its panel',stageActive);
    const stageDef=await page.$eval('#sDefPreview',el=>el.textContent);
    check('stage def has [Camera] and [StageInfo]',/\[Camera\]/.test(stageDef)&&/\[StageInfo\]/.test(stageDef)&&/zoffset = 200/.test(stageDef));
    await page.evaluate(()=>{const el=document.getElementById('sZoffset');el.value='240';el.dispatchEvent(new Event('input',{bubbles:true}));});
    const stageDef2=await page.$eval('#sDefPreview',el=>el.textContent);
    check('changing the floor height updates the stage def',/zoffset = 240/.test(stageDef2));

    // files tab
    await page.click('.mgnms-tab[data-tab="files"]');
    const files=await page.$eval('#filesPreview',el=>el.textContent);
    check('files preview lists the character folder',/chars\/DragonFighter\/DragonFighter\.def/.test(files));
    check('files preview lists the stage folder',/stages\/MyStage\/MyStage\.def/.test(files));
    check('files preview includes starter cmd, cns and air',/\.cmd/.test(files)&&/\.cns/.test(files)&&/\.air/.test(files));
    const checklist=await page.$$eval('#mgnChecklist li',ls=>ls.length);
    check('ready check lists the mod rules',checklist>=3,'items '+checklist);

    // debug tab
    await page.click('.mgnms-tab[data-tab="debug"]');
    await page.click('#dbgLog .err');
    const optCount=await page.$$eval('#dbgOptions .mgnms-dbg-opt',o=>o.length);
    check('clicking the error reveals fixes',optCount>=3,'options '+optCount);
    await page.click('#dbgOptions .mgnms-dbg-opt');
    const dbgOk=await page.$eval('#dbgMsg',el=>el.classList.contains('ok'));
    check('choosing the right fix is accepted',dbgOk);

    // export tab
    await page.click('.mgnms-tab[data-tab="export"]');
    const tree=await page.$eval('#xTree',el=>el.textContent);
    check('export preview lists chars and stages',/chars\//.test(tree)&&/stages\//.test(tree));
    await page.click('#xDownload');
    const dlMsg=await page.$eval('#xMsg',el=>el.textContent);
    check('download builds a mod zip',/Downloaded/.test(dlMsg)&&/\.zip/.test(dlMsg),dlMsg.slice(0,60));

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
