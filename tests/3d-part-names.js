/* Dump the part names a builder actually produces, so naming can be reviewed
   without reading every file. Reports unnamed meshes and duplicate names.
   Run: node tests/3d-part-names.js [builder ...] */
const http=require('http'),fs=require('fs'),path=require('path');
const puppeteer=require('F:/Website/Jvdesign-Website-v2/node_modules/puppeteer');
const root=path.resolve(__dirname,'..');

const TARGETS={
  'castle-builder':'castleGroup',
  'space-station-builder':'stationGroup',
  'robot-builder':'robotGroup',
  'rocket-builder':'rocketGroup',
  'pirate-ship-builder':'shipGroup',
  'pirate-cannon-builder':'cannonGroup',
  'steampunk-airship-builder':'shipGroup',
  'race-car-builder':'carGroup',
  'submarine-builder':'subGroup',
  'fairy-tale-builder':'cottageGroup',
  'phone-stand-builder':'standGroup'
};

const MIME={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json',
  '.zip':'application/zip','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
  const u=decodeURIComponent(new URL(req.url,'http://x').pathname);
  const f=path.resolve(root,'.'+u);
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end('missing '+u);}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);
});

(async()=>{
  server.listen(0);
  await new Promise(r=>server.once('listening',r));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
  const want=process.argv.slice(2);
  let problems=0;

  for(const [page,gv] of Object.entries(TARGETS)){
    if(want.length&&!want.some(w=>page.includes(w)))continue;
    if(!gv){console.log('\n### '+page+': SKIPPED (group variable not known yet)');continue;}
    const tab=await browser.newPage();
    const errs=[];
    tab.on('pageerror',e=>errs.push(e.message.split('\n')[0].slice(0,90)));
    await tab.setRequestInterception(true);
    tab.on('request',r=>r.url().startsWith(base)||r.url().startsWith('data:')||r.url().startsWith('blob:')?r.continue():r.abort());
    await tab.setViewport({width:1440,height:900});
    await tab.goto(base+'/workshops/'+page+'.html',{waitUntil:'load'});
    if(await tab.$('#cookie-decline')){try{await tab.click('#cookie-decline');}catch(e){}}
    await new Promise(r=>setTimeout(r,1200));
    await tab.evaluate(()=>{
      const b=Array.from(document.querySelectorAll('button'))
        .find(x=>/^(Let's Build!|Accept|Got it)$/i.test(x.textContent.trim())&&x.offsetParent!==null);
      if(b)b.click();
    });
    await new Promise(r=>setTimeout(r,400));
    await tab.evaluate(async()=>{
      const hit=re=>{const b=Array.from(document.querySelectorAll('button'))
        .find(x=>re.test(x.textContent)&&x.offsetParent!==null&&!x.disabled);
        if(b){b.click();return true;}return false;};
      if(!hit(/quick build/i)) for(let i=0;i<35&&hit(/^\s*(Next|Continue)\b/i);i++){}
      await new Promise(r=>setTimeout(r,900));
    });
    await new Promise(r=>setTimeout(r,1000));

    const info=await tab.evaluate((gv)=>{
      const g=(function(){ try{ return (new Function('return '+gv))(); }catch(e){ return null; } })();
      if(!g)return {err:'group '+gv+' not found'};
      const names=[];const unnamed=[];
      g.traverse(o=>{
        if(!o.isMesh||!o.geometry||!o.geometry.attributes||!o.geometry.attributes.position)return;
        if(o.userData&&o.userData.jvExcludeFromExport)return;
        const n=(o.name||'').trim();
        if(n)names.push(n); else unnamed.push(o.geometry.type||'geometry');
      });
      const counts={};
      names.forEach(n=>counts[n]=(counts[n]||0)+1);
      const dupes=Object.keys(counts).filter(k=>counts[k]>1);
      return {total:names.length+unnamed.length,named:names.length,unnamed:unnamed.length,
        sample:names.slice(0,14),dupes:dupes.slice(0,10),
        groupName:g.name||'(none)'};
    },gv);

    console.log('\n### '+page+'  group='+info.groupName);
    if(info.err){console.log('  '+info.err);problems++;await tab.close();continue;}
    const pct=info.total?Math.round(info.named/info.total*100):0;
    console.log('  parts='+info.total+'  named='+info.named+' ('+pct+'%)  unnamed='+info.unnamed);
    console.log('  sample: '+JSON.stringify(info.sample));
    if(info.dupes.length)console.log('  duplicate names (fine if the builder repeats a part, e.g. 4 fins): '+JSON.stringify(info.dupes));
    if(info.unnamed)problems++;
    if(errs.length){console.log('  ERRORS: '+errs.join(' | '));problems++;}
    await tab.close();
  }
  await browser.close();
  server.close();
  console.log('\n'+(problems?problems+' builder(s) still have unnamed parts or errors':'all checked builders fully named'));
  process.exit(problems?1:0);
})().catch(e=>{console.error(e);server.close();process.exit(1);});
