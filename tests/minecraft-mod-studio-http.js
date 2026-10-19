const http=require('http'),fs=require('fs'),path=require('path');
const puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const PAGE='/workshops/minecraft-mod-studio.html';
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

    const tourOpen=await page.$eval('#tourOverlay',el=>!el.hidden);
    check('first visit opens the tour',tourOpen);
    check('Quick tour sits in the hero',await page.$eval('#mcTourBtn',el=>!!el.closest('.hero-btns')));
    if(tourOpen)await page.click('#tourSkip');
    check('Skip closes the tour',await page.$eval('#tourOverlay',el=>el.hidden));
    const starter=await page.$eval('#mcRecipePreview',el=>el.textContent);
    check('first visit starts with the sword example',/diamond_sword/.test(starter));

    const info=await page.evaluate(()=>{
      const tabs=[...document.querySelectorAll('.mcms-tab')];
      return {
        tabs:tabs.length,
        role:tabs.map(x=>x.getAttribute('role')),
        sel:tabs.map(x=>x.getAttribute('aria-selected')),
        ti:tabs.map(x=>x.getAttribute('tabindex')),
        cells:document.querySelectorAll('.mcms-cell').length,
        swatches:document.querySelectorAll('.mcms-swatch').length,
        dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length,
        scrollWidth:document.documentElement.scrollWidth
      };
    });
    check('studio has 5 tabs',info.tabs===5,'tabs '+info.tabs);
    check('tabs expose role=tab',info.role.every(r=>r==='tab'));
    check('exactly one tab selected',info.sel.filter(s=>s==='true').length===1,JSON.stringify(info.sel));
    check('roving tabindex present',info.ti.filter(t=>t==='0').length===1&&info.ti.filter(t=>t==='-1').length===4,JSON.stringify(info.ti));
    check('3x3 bench has 9 squares',info.cells===9,'cells '+info.cells);
    check('ingredient palette rendered',info.swatches>=20,'swatches '+info.swatches);
    check('no em or en dashes',info.dashes===0,'dashes '+info.dashes);
    check('desktop no overflow',info.scrollWidth<=1442,info.scrollWidth+'');

    // example recipe builds a shaped recipe
    await page.click('#mcExample');
    const recipe=await page.$eval('#mcRecipePreview',el=>el.textContent);
    check('example builds a shaped sword recipe',/crafting_shaped/.test(recipe)&&/minecraft:diamond_sword/.test(recipe));
    check('recipe has a pattern and key',/"pattern"/.test(recipe)&&/"key"/.test(recipe));

    // placing an ingredient updates the recipe
    await page.click('.mcms-swatch[aria-label="Emerald"]');
    await page.click('.mcms-cell');
    const recipe2=await page.$eval('#mcRecipePreview',el=>el.textContent);
    check('placing an ingredient updates the recipe',/minecraft:emerald/.test(recipe2));

    // result select updates the recipe
    await page.select('#mcResultSelect','minecraft:golden_apple');
    const recipe3=await page.$eval('#mcRecipePreview',el=>el.textContent);
    check('changing the result updates the recipe',/minecraft:golden_apple/.test(recipe3));

    // function tab
    await page.click('.mcms-tab[data-tab="func"]');
    const fnActive=await page.$eval('#panel-func',el=>el.classList.contains('is-active'));
    check('function tab activates its panel',fnActive);
    await page.evaluate(()=>{const cbs=document.querySelectorAll('#mcCmdList input[type="checkbox"]');cbs[1].click();});
    const fnPreview=await page.$eval('#mcFuncPreview',el=>el.textContent);
    check('ticking a command adds it to the function',/time set day/.test(fnPreview),fnPreview.split('\n')[0]);

    // files tab
    await page.click('.mcms-tab[data-tab="files"]');
    const filesPreview=await page.$eval('#mcFilesPreview',el=>el.textContent);
    check('file builder renders pack.mcmeta',/pack\.mcmeta/.test(filesPreview));
    check('file builder renders the recipe path',/data\/hello\/recipe\//.test(filesPreview));
    const checklist=await page.$$eval('#mcChecklist li',ls=>ls.map(l=>l.className));
    check('ready check lists datapack rules',checklist.length>=4,'items '+checklist.length);

    // debug tab
    await page.click('.mcms-tab[data-tab="debug"]');
    await page.click('#mcLog .err');
    const optCount=await page.$$eval('#mcOptions .mcms-dbg-opt',o=>o.length);
    check('clicking the error reveals fixes',optCount>=3,'options '+optCount);
    await page.click('#mcOptions .mcms-dbg-opt');
    const dbgOk=await page.$eval('#mcDebugMsg',el=>el.classList.contains('ok'));
    check('choosing the right fix is accepted',dbgOk);

    // export tab
    await page.click('.mcms-tab[data-tab="export"]');
    const tree=await page.$eval('#mcExportTree',el=>el.textContent);
    check('export preview lists the datapack files',/pack\.mcmeta/.test(tree)&&/recipe/.test(tree));
    const where=await page.$eval('#panel-export',el=>el.textContent);
    check('export says where the folder goes',/datapacks/.test(where)&&/\/reload/.test(where)&&/function/.test(where));
    await page.click('#mcDownload');
    const dlMsg=await page.$eval('#mcExportMsg',el=>el.textContent);
    check('download builds a datapack zip',/Downloaded/.test(dlMsg)&&/\.zip/.test(dlMsg),dlMsg.slice(0,60));

    check('no browser errors',errors.length===0,errors.slice(0,2).join(' | '));

    // mobile
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
