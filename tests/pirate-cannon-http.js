const http=require('http'),fs=require('fs'),path=require('path'),zlib=require('zlib');
const puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const PAGE='/workshops/3d-builder.html?preset=pirate-cannon';
const ZIP='/pirate-cannon-starter.zip';
let failures=0;
function check(name,ok,detail=''){console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:''));if(!ok)failures++;}
const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.zip':'application/zip','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.min.js':'application/javascript'};
const server=http.createServer((req,res)=>{
  const u=decodeURIComponent(new URL(req.url,'http://x').pathname);
  const f=path.join(root,u);
  if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end('missing '+u);}
  res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);
});
function readEntries(buf){
  const out={};
  let off=0;
  while(off<buf.length-4&&buf.readUInt32LE(off)===0x04034b50){
    const method=buf.readUInt16LE(off+8);
    const csize=buf.readUInt32LE(off+18);
    const nlen=buf.readUInt16LE(off+26),elen=buf.readUInt16LE(off+28);
    const name=buf.toString('utf8',off+30,off+30+nlen);
    const start=off+30+nlen+elen;
    out[name]={method,csize,data:buf.slice(start,start+csize)};
    off=start+csize;
  }
  return out;
}
const inflate=e=>e.method===0?e.data:zlib.inflateRawSync(e.data);

(async()=>{
  server.listen(0);
  await new Promise(r=>server.once('listening',r));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await puppeteer.launch({headless:true,args:['--no-sandbox']});
  try{
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('dialog',async d=>errors.push('unexpected dialog: '+d.message()));
    await page.setRequestInterception(true);
    page.on('request',r=>r.url().startsWith(base)||r.url().startsWith('data:')?r.continue():r.abort());
    await page.setViewport({width:1440,height:900});
    await page.goto(base+PAGE,{waitUntil:'load'});
    await page.waitForFunction(()=>window.JVExporter&&window.JVExporter.currentGroup&&window.JVExporter.currentGroup(),{timeout:30000});
    await new Promise(r=>setTimeout(r,900));

    const info=await page.evaluate(()=>{
      const state=window._builderGetState().params;
      const stepList=document.querySelector('#sidebar .slist, #sidebar .step-list, #stepList, .step-list');
      return {
        paramKeys:Object.keys(state).length,
        paramKeyList:Object.keys(state),
        steps:stepList?stepList.children.length:0,
        dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length,
        scrollWidth:document.documentElement.scrollWidth,
        canvas:document.querySelectorAll('#viewport canvas').length
      };
    });
    check('shell mounts the pirate cannon preset',info.canvas>=1,'canvases '+info.canvas);
    check('forge still has 15 steps and 33 parameters',info.steps===15&&info.paramKeys===33,info.steps+' steps, '+info.paramKeys+' params');
    check('page has no em or en dashes',info.dashes===0,'dashes '+info.dashes);
    check('desktop no overflow',info.scrollWidth<=1442,info.scrollWidth+'');

    const zipRes=await fetch(base+ZIP);
    check('starter zip returns 200',zipRes.status===200,'status '+zipRes.status);
    const buf=Buffer.from(await zipRes.arrayBuffer());
    check('starter zip is a real zip over http',buf.length>2000&&buf[0]===0x50&&buf[1]===0x4b,'bytes '+buf.length);
    const entries=readEntries(buf);
    const names=Object.keys(entries);
    check('zip has the 4 starter files',names.length===4,JSON.stringify(names));
    check('zip uses one top level folder',new Set(names.map(n=>n.split('/')[0])).size===1&&names.every(n=>n.startsWith('PirateCannonStarter/')));
    check('zip paths use forward slashes',names.every(n=>n.indexOf('\\')===-1));
    for(const n of ['PirateCannonStarter/README.md','PirateCannonStarter/CHECKLIST.md','PirateCannonStarter/reference/parameters.json','PirateCannonStarter/reference/reference-cannon.json']){
      check('zip contains '+n.split('/').pop(),!!entries[n]);
    }
    const readme=inflate(entries['PirateCannonStarter/README.md']).toString('utf8');
    const checklist=inflate(entries['PirateCannonStarter/CHECKLIST.md']).toString('utf8');
    check('README points at the workshop and explains the reference cannon',/jvdesignstudio\.co\.uk\/workshops\/pirate-cannon-builder\.html/.test(readme)&&/reference-cannon\.json/.test(readme));
    check('README has no em or en dashes',!/[\u2013\u2014]/.test(readme));
    check('checklist covers all 15 steps',(checklist.match(/^- \[ \] \d+ /gm)||[]).length===15,'items '+(checklist.match(/^- \[ \] \d+ /gm)||[]).length);
    check('checklist has no em or en dashes',!/[\u2013\u2014]/.test(checklist));

    const params=JSON.parse(inflate(entries['PirateCannonStarter/reference/parameters.json']).toString('utf8'));
    const ref=JSON.parse(inflate(entries['PirateCannonStarter/reference/reference-cannon.json']).toString('utf8'));
    check('value table covers all 15 steps',params.steps.length===15,'steps '+params.steps.length);
    const controls=params.steps.flatMap(s=>s.controls.map(c=>({step:s.step,...c})));
    check('value table lists all 32 sliders',controls.length===32,'controls '+controls.length);
    check('every range slider states min and max',controls.filter(c=>c.type==='range').every(c=>c.range&&typeof c.range.min==='number'&&typeof c.range.max==='number'));
    check('every slider has a reference value',controls.every(c=>c.reference!==null&&c.reference!==undefined));
    check('colour sliders use hex values',controls.filter(c=>c.type==='color').every(c=>/^#[0-9a-f]{6}$/.test(c.reference)));
    check('toggle sliders use booleans',controls.filter(c=>c.type==='toggle').every(c=>typeof c.reference==='boolean'));
    const step2=params.steps.find(s=>s.step===2);
    check('step 2 reference barrel length is 1.6 m',step2.controls[0].reference===1.6,JSON.stringify(step2.controls[0]));
    check('step 11 reference has a 12 degree elevation',params.steps.find(s=>s.step===11).controls.find(c=>c.key==='carriageAngle').reference===12);
    check('reference cannon holds every forge parameter',Object.keys(ref.params).length===33,'params '+Object.keys(ref.params).length);
    check('reference cannon has no parameter the forge does not use',Object.keys(ref.params).filter(k=>!info.paramKeyList.includes(k)).length===0,JSON.stringify(Object.keys(ref.params).filter(k=>!info.paramKeyList.includes(k))));

    // the pack must describe the forge exactly, with no page code added
    const untouched=await page.evaluate(()=>({
      loader:typeof window.loadReferenceCannon,
      ref:typeof window.PIRATE_CANNON_REFERENCE,
      state:window._builderGetState().params
    }));
    check('no loader code added to the forge',untouched.loader==='undefined'&&untouched.ref==='undefined',JSON.stringify([untouched.loader,untouched.ref]));
    check('forge starts on its own defaults',untouched.state.barrelLen===1.2,'barrel '+untouched.state.barrelLen);
    check('pack values match the zipped reference file',ref.params.barrelLen===1.6&&ref.params.ringCount===4&&ref.params.barrelColor==='#2f3640',JSON.stringify({barrelLen:ref.params.barrelLen,rings:ref.params.ringCount,col:ref.params.barrelColor}));
    check('reference file holds every forge parameter',Object.keys(ref.params).filter(k=>!info.paramKeyList.includes(k)).length===0);
    const canvases=await page.evaluate(()=>document.querySelectorAll('#viewport canvas').length);
    check('forge canvas still rendered',canvases>=1,'canvases '+canvases);

    for(const vp of [{w:390,h:844,n:'mobile'},{w:320,h:720,n:'small'}]){
      await page.setViewport({width:vp.w,height:vp.h});
      await new Promise(r=>setTimeout(r,350));
      const sw=await page.evaluate(()=>document.documentElement.scrollWidth);
      check(vp.n+' no overflow',sw<=vp.w+2,vp.w+' -> '+sw);
    }
    check('no runtime errors',errors.length===0,errors.join(' | '));
  }finally{
    await browser.close();
    server.close();
  }
  console.log('\n'+(failures?failures+' FAILURES':'ALL PASS'));
  process.exit(failures?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
