const http=require('http'),fs=require('fs'),path=require('path'),zlib=require('zlib');
const puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const PAGE='/workshops/pirate-ship-builder.html';
const ZIP='/pirate-ship-starter.zip';
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
    if(await page.$('#cookie-decline'))await page.click('#cookie-decline');
    await new Promise(r=>setTimeout(r,900));

    const info=await page.evaluate(()=>{
      const anchors=[...document.querySelectorAll('a')].map(a=>({href:a.getAttribute('href')||'',download:a.getAttribute('download'),text:a.textContent.trim()}));
      const zipLinks=anchors.filter(a=>a.href.includes('pirate-ship-starter.zip'));
      const app=document.getElementById('app');
      return {
        zipLinks,
        appChildren:app?[...app.children].map(c=>c.tagName.toLowerCase()+(c.id?'#'+c.id:'')):[],
        injected:app?!!app.querySelector('.starter-banner')+','+!!document.getElementById('refLoadBtn'):'no app',
        steps:STEPS.length,
        paramKeys:Object.keys(P).length,
        paramKeyList:Object.keys(P),
        dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length,
        scrollWidth:document.documentElement.scrollWidth
      };
    });
    check('one download link points at the starter zip',info.zipLinks.length===1,JSON.stringify(info.zipLinks.map(l=>l.text)));
    check('download link is relative and download enabled',info.zipLinks[0]&&info.zipLinks[0].href==='../pirate-ship-starter.zip'&&info.zipLinks[0].download==='');
    check('download link wording says Starter Template',/Starter Template/.test(info.zipLinks[0].text),info.zipLinks[0].text);
    check('nothing injected into the shipyard layout',info.injected==='false,false',info.injected);
    check('shipyard grid regions intact',info.appChildren[0]==='header'&&info.appChildren.some(c=>/sidebar/.test(c))&&info.appChildren.some(c=>/viewport/.test(c)),JSON.stringify(info.appChildren));
    check('shipyard still has 22 steps',info.steps===22,'steps '+info.steps);
    check('page has no em or en dashes',info.dashes===0,'dashes '+info.dashes);
    check('desktop no overflow',info.scrollWidth<=1442,info.scrollWidth+'');

    const zipRes=await fetch(base+ZIP);
    check('starter zip returns 200',zipRes.status===200,'status '+zipRes.status);
    const buf=Buffer.from(await zipRes.arrayBuffer());
    check('starter zip is a real zip over http',buf.length>2500&&buf[0]===0x50&&buf[1]===0x4b,'bytes '+buf.length);
    const entries=readEntries(buf);
    const names=Object.keys(entries);
    check('zip has the 4 starter files',names.length===4,JSON.stringify(names));
    check('zip uses one top level folder',new Set(names.map(n=>n.split('/')[0])).size===1&&names.every(n=>n.startsWith('PirateShipStarter/')));
    check('zip paths use forward slashes',names.every(n=>n.indexOf('\\')===-1));
    for(const n of ['PirateShipStarter/README.md','PirateShipStarter/CHECKLIST.md','PirateShipStarter/reference/parameters.json','PirateShipStarter/reference/reference-ship.json']){
      check('zip contains '+n.split('/').pop(),!!entries[n]);
    }
    const readme=inflate(entries['PirateShipStarter/README.md']).toString('utf8');
    const checklist=inflate(entries['PirateShipStarter/CHECKLIST.md']).toString('utf8');
    check('README points at the workshop and explains the reference ship',/jvdesignstudio\.co\.uk\/workshops\/pirate-ship-builder\.html/.test(readme)&&/reference-ship\.json/.test(readme));
    check('README mentions the export formats the shipyard offers',/OBJ/.test(readme)&&/GLB/.test(readme)&&/PNG/.test(readme));
    check('README has no em or en dashes',!/[\u2013\u2014]/.test(readme));
    check('checklist covers all 22 steps',(checklist.match(/^- \[ \] \d+ /gm)||[]).length===22,'items '+(checklist.match(/^- \[ \] \d+ /gm)||[]).length);
    check('checklist has no em or en dashes',!/[\u2013\u2014]/.test(checklist));

    const params=JSON.parse(inflate(entries['PirateShipStarter/reference/parameters.json']).toString('utf8'));
    const ref=JSON.parse(inflate(entries['PirateShipStarter/reference/reference-ship.json']).toString('utf8'));
    check('value table covers all 22 steps',params.steps.length===22,'steps '+params.steps.length);
    const controls=params.steps.flatMap(s=>s.controls.filter(c=>c.key).map(c=>({step:s.step,...c})));
    check('value table lists all 54 sliders and inputs',controls.length===54,'controls '+controls.length);
    check('every range slider states min and max',controls.filter(c=>c.type==='range').every(c=>c.range&&typeof c.range.min==='number'&&typeof c.range.max==='number'));
    check('every control has a reference value',controls.every(c=>c.reference!==null&&c.reference!==undefined));
    check('colour controls use hex values',controls.filter(c=>c.type==='color').every(c=>/^#[0-9a-f]{6}$/.test(c.reference)));
    check('toggle controls use booleans',controls.filter(c=>c.type==='toggle').every(c=>typeof c.reference==='boolean'));
    const hull=params.steps.find(s=>s.id==='hull').controls;
    check('step 2 reference hull is 16 m long',hull.find(c=>c.key==='hullLen').reference===16);
    check('reference ship is named',ref.params.shipName.length>=2&&ref.params.shipName==="Raven's Bane",ref.params.shipName);
    check('reference ship covers every parameter the shipyard keeps',Object.keys(ref.params).length===info.paramKeyList.length,Object.keys(ref.params).length+' vs '+info.paramKeyList.length);
    check('reference ship has no parameter the shipyard does not use',Object.keys(ref.params).filter(k=>!info.paramKeyList.includes(k)).length===0,JSON.stringify(Object.keys(ref.params).filter(k=>!info.paramKeyList.includes(k))));

    // every reference value must sit inside the range the page itself declares
    const pageControls=await page.evaluate(()=>{
      const out={};
      for(let i=0;i<STEPS.length;i++){
        for(const c of ctrlsFor(i)){
          if(!c.k) continue;
          out[c.k]={min:c.mn===undefined?null:c.mn,max:c.mx===undefined?null:c.mx,type:c.t};
        }
      }
      return out;
    });
    const outOfRange=controls.filter(c=>pageControls[c.key]&&pageControls[c.key].min!==null&&typeof c.reference==='number'&&(c.reference<pageControls[c.key].min||c.reference>pageControls[c.key].max));
    check('all reference values sit inside the page slider ranges',outOfRange.length===0,JSON.stringify(outOfRange.map(c=>c.key+':'+c.reference)));
    const typeMismatch=controls.filter(c=>pageControls[c.key]&&pageControls[c.key].type!==c.type);
    check('value table types match the page controls',typeMismatch.length===0,JSON.stringify(typeMismatch.map(c=>c.key)));
    const missing=Object.keys(pageControls).filter(k=>!controls.some(c=>c.key===k));
    check('no slider in the page is missing from the table',missing.length===0,JSON.stringify(missing));

    // the pack must describe the shipyard exactly, with no page code added
    const untouched=await page.evaluate(()=>({
      loader:typeof window.loadReferenceShip,
      ref:typeof window.PIRATE_SHIP_REFERENCE,
      step:curStep,
      hullLen:P.hullLen
    }));
    check('no loader code added to the shipyard',untouched.loader==='undefined'&&untouched.ref==='undefined',JSON.stringify([untouched.loader,untouched.ref]));
    check('shipyard starts on its own defaults',untouched.step===0&&untouched.hullLen===12,'step '+untouched.step+' hull '+untouched.hullLen);
    check('pack values match the zipped reference file',ref.params.hullLen===16&&ref.params.sailCount===3&&ref.params.hullColor==='#2b1410',JSON.stringify({hullLen:ref.params.hullLen,sails:ref.params.sailCount,col:ref.params.hullColor}));
    const canvases=await page.evaluate(()=>document.querySelectorAll('canvas').length);
    check('shipyard canvas still rendered',canvases>=1,'canvases '+canvases);

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
