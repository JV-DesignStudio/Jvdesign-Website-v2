/* Dump the part names a builder actually produces, so naming can be reviewed
   without reading every file. Reports unnamed meshes and duplicate names.
   Run: node tests/3d-part-names.js [builder ...] */
const http=require('http'),fs=require('fs'),path=require('path');
const puppeteer=require('F:/Website/Jvdesign-Website-v2/node_modules/puppeteer');
const root=path.resolve(__dirname,'..');

const TARGETS={
  'castle-builder':{preset:'castle'},
  'space-station-builder':{preset:'space-station'},
  'robot-builder':{preset:'robot'},
  'rocket-builder':{preset:'rocket'},
  'pirate-ship-builder':{preset:'pirate-ship'},
  'pirate-cannon-builder':{preset:'pirate-cannon'},
  'steampunk-airship-builder':{preset:'steampunk-airship'},
  'race-car-builder':{preset:'race-car'},
  'submarine-builder':{preset:'submarine'},
  'fairy-tale-builder':{preset:'fairy-tale'},
  'phone-stand-builder':{preset:'phone-stand'}
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

  for(const [page,t] of Object.entries(TARGETS)){
    if(want.length&&!want.some(w=>page.includes(w)))continue;
    if(!t||!t.preset){console.log('\n### '+page+': SKIPPED (preset not known yet)');continue;}
    const tab=await browser.newPage();
    const errs=[];
    tab.on('pageerror',e=>errs.push(e.message.split('\n')[0].slice(0,90)));
    await tab.setRequestInterception(true);
    tab.on('request',r=>r.url().startsWith(base)||r.url().startsWith('data:')||r.url().startsWith('blob:')?r.continue():r.abort());
    await tab.setViewport({width:1440,height:900});
    await tab.goto(base+'/workshops/3d-builder.html?preset='+t.preset,{waitUntil:'load'});
    await tab.waitForFunction(()=>window.JVExporter&&window.JVExporter.currentGroup&&window.JVExporter.currentGroup(),{timeout:30000});
    await new Promise(r=>setTimeout(r,1200));

    const info=await tab.evaluate(()=>{
      const g=window.JVExporter.currentGroup();
      if(!g)return {err:'no live group for this preset'};
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
    });

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
