// catalogue-empty-state.js (A1423): the catalogue must not show a "no results"
// message in its default page content. The empty state only appears for a real
// zero-match search or filter.
//
// Run: node tests/catalogue-empty-state.js
const http=require('http'),fs=require('fs'),path=require('path');
const puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
let failures=0;
function check(name,ok,detail=''){console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:''));if(!ok)failures++;}
const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2'};
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
    await page.setViewport({width:1440,height:1000});

    // Content catalogue: default load shows no empty state
    await page.goto(base+'/pages/content_hub.html',{waitUntil:'load'});
    await new Promise(r=>setTimeout(r,700));
    const def=await page.evaluate(()=>({
      empty:getComputedStyle(document.getElementById('emptyState')).display,
      result:(document.getElementById('resultCount')||{}).textContent||''
    }));
    check('catalogue default load: empty state hidden',def.empty==='none',def.empty);
    check('catalogue default load: results counted',/\d+\s+items?/.test(def.result),def.result);

    // A real zero-match search shows the empty state
    await page.type('#searchInput','zzzznomatchzzz');
    await new Promise(r=>setTimeout(r,400));
    const miss=await page.evaluate(()=>({
      empty:getComputedStyle(document.getElementById('emptyState')).display,
      q:(document.getElementById('emptyQuery')||{}).textContent||''
    }));
    check('zero-match search: empty state shows',miss.empty!=='none',miss.empty);
    check('zero-match search: names the query',/zzzznomatchzzz/.test(miss.q),miss.q);

    // Clearing the search hides it again
    await page.evaluate(()=>{document.getElementById('searchInput').value='';document.getElementById('searchInput').dispatchEvent(new Event('input'));});
    await new Promise(r=>setTimeout(r,400));
    const cleared=await page.evaluate(()=>getComputedStyle(document.getElementById('emptyState')).display);
    check('cleared search: empty state hidden again',cleared==='none',cleared);
    check('catalogue no browser errors',errors.length===0,errors.slice(0,2).join(' | '));

    // Games catalogue (arcade): no "no results" text visible by default
    errors.length=0;
    await page.goto(base+'/arcade.html',{waitUntil:'load'});
    await new Promise(r=>setTimeout(r,700));
    const arc=await page.evaluate(()=>({
      cabinets:document.querySelectorAll('#grid .cab').length,
      badText:/no results|nothing matched|no games found/i.test(document.body.innerText),
      sw:document.documentElement.scrollWidth
    }));
    check('arcade catalogue shows cabinets',arc.cabinets>0,'cabinets '+arc.cabinets);
    check('arcade has no default "no results" text',!arc.badText);
    check('arcade desktop no overflow',arc.sw<=1442,arc.sw+'');

    await page.setViewport({width:390,height:844,isMobile:true});
    await page.goto(base+'/pages/content_hub.html',{waitUntil:'load'});
    await new Promise(r=>setTimeout(r,500));
    const mob=await page.evaluate(()=>document.documentElement.scrollWidth);
    check('catalogue 390px no overflow',mob<=392,'scrollWidth '+mob);
  } finally { await browser.close(); await new Promise(r=>server.close(r)); }
  console.log(failures?('\n'+failures+' FAILED'):'\nALL PASS');
  process.exit(failures?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
