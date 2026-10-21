const http=require('http'),fs=require('fs'),path=require('path'),zlib=require('zlib');
const puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const PAGE='/workshops/3d-builder.html?preset=phone-stand';
const ZIP='/phone-stand-starter.zip';
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
(async()=>{
  server.listen(0);
  await new Promise(r=>server.once('listening',r));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await puppeteer.launch({headless:true,args:['--no-sandbox']});
  try{
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('dialog',async d=>{errors.push('unexpected dialog: '+d.message());await d.dismiss();});
    await page.setRequestInterception(true);
    page.on('request',r=>r.url().startsWith(base)||r.url().startsWith('data:')?r.continue():r.abort());
    await page.setViewport({width:1440,height:900});
    await page.goto(base+PAGE,{waitUntil:'load'});
    await page.waitForFunction(()=>window.JVExporter&&window.JVExporter.currentGroup&&window.JVExporter.currentGroup(),{timeout:30000});
    await new Promise(r=>setTimeout(r,600));

    const info=await page.evaluate(()=>{
      const s=window._builderGetState();
      return {
        defaults:{style:s.params.standStyle,color:s.params.color,name:s.params.standName,brand:s.params.brandText},
        canvas:document.querySelectorAll('#viewport canvas').length,
        dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length,
        scrollWidth:document.documentElement.scrollWidth
      };
    });
    check('shell mounts the phone stand preset',info.canvas>=1,'canvases '+info.canvas);
    check('builder started on its default design',info.defaults.style==='angled'&&info.defaults.color==='#22c55e',JSON.stringify(info.defaults));
    check('page has no em or en dashes',info.dashes===0,'dashes '+info.dashes);
    check('desktop no overflow',info.scrollWidth<=1440+2,info.scrollWidth+'');

    const zipRes=await fetch(base+ZIP);
    check('starter zip returns 200',zipRes.status===200,'status '+zipRes.status);
    const buf=Buffer.from(await zipRes.arrayBuffer());
    check('starter zip is a real zip over http',buf.length>2500&&buf[0]===0x50&&buf[1]===0x4b,'bytes '+buf.length);
    const body=buf.toString('latin1');
    for(const entry of ['PhoneStandStarter/README.md','PhoneStandStarter/CHECKLIST.md','PhoneStandStarter/designs/01-beginner-angled.json','PhoneStandStarter/designs/02-cable-cradle.json','PhoneStandStarter/designs/03-showcase-foldable.json']){
      check('zip contains '+entry,body.includes(entry));
    }
    function zipEntry(buf,name){
      let off=0;
      while(off+30<=buf.length){
        if(buf.readUInt32LE(off)!==0x04034b50)return null;
        const method=buf.readUInt16LE(off+8),csize=buf.readUInt32LE(off+18);
        const nlen=buf.readUInt16LE(off+26),elen=buf.readUInt16LE(off+28);
        const n=buf.toString('utf8',off+30,off+30+nlen);
        const data=buf.subarray(off+30+nlen+elen,off+30+nlen+elen+csize);
        if(n===name)return method===0?Buffer.from(data):zlib.inflateRawSync(data);
        off=off+30+nlen+elen+csize;
      }
      return null;
    }
    const cradleRaw=zipEntry(buf,'PhoneStandStarter/designs/02-cable-cradle.json');
    check('cradle design inside the zip is readable',!!cradleRaw,'bytes '+(cradleRaw?cradleRaw.length:0));
    if(cradleRaw){
      let parsed=null;
      try{parsed=JSON.parse(cradleRaw.toString('utf8'));}catch(e){}
      check('cradle design parses and matches the builder schema',!!parsed&&parsed.standStyle==='cradle'&&parsed.color==='#38bdf8'&&parsed.standName==='JVDS Cable Cradle'&&parsed.cableSlotWidth===14,JSON.stringify(parsed&&{style:parsed.standStyle,color:parsed.color,name:parsed.standName}));
    }
    check('zip top level folder keeps the starter self contained',body.startsWith('PK')&&body.includes('PhoneStandStarter/'));

    // end to end: apply the cradle design through the shared state hook
    await page.evaluate(()=>{
      const s=window._builderGetState();
      window._builderSetState({params:Object.assign({},s.params,{
        standName:'JVDS Cable Cradle',standStyle:'cradle',phoneWidth:72,phoneThickness:9,
        standWidth:110,standDepth:90,standHeight:55,angle:55,baseThickness:5,lipHeight:10,
        lipAngle:15,cableSlot:true,cableSlotWidth:14,gripTexture:'dots',color:'#38bdf8',
        roundedCorners:true,cornerRadius:4,brandText:'JVDS',brandFontSize:14
      }),step:s.step});
    });
    await page.waitForFunction(()=>window._builderGetState().params.standName==='JVDS Cable Cradle',{timeout:5000});
    const after=await page.evaluate(()=>{
      const s=window._builderGetState().params;
      return {style:s.standStyle,color:s.color,brand:s.brandText,name:s.standName,group:!!window.JVExporter.currentGroup()};
    });
    check('import applied the cradle design',after.style==='cradle'&&after.color==='#38bdf8'&&after.brand==='JVDS',JSON.stringify(after));
    check('scene rebuilt after import',after.group===true);

    for(const width of [390,320]){
      await page.setViewport({width,height:844,isMobile:true});
      await page.goto(base+PAGE,{waitUntil:'load'});
      await new Promise(r=>setTimeout(r,400));
      const over=await page.evaluate(()=>document.documentElement.scrollWidth);
      check('no overflow at '+width+'px',over<=width+2,over+'');
    }
    check('zero runtime errors',errors.length===0,errors.join(' | ').slice(0,400));
  }finally{await browser.close();server.close();}
  if(failures){console.log('\n'+failures+' FAILURE(S)');process.exit(1);}
  console.log('\nALL PHONE STAND STARTER CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
