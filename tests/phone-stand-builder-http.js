const http=require('http'),fs=require('fs'),path=require('path'),os=require('os'),zlib=require('zlib');
const puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const PAGE='/workshops/phone-stand-builder.html';
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
    if(await page.$('#cookie-decline'))await page.click('#cookie-decline');
    await new Promise(r=>setTimeout(r,600));

    const info=await page.evaluate(()=>{
      const links=[...document.querySelectorAll('a')].filter(a=>(a.getAttribute('href')||'').includes('phone-stand-starter.zip'));
      const banner=document.querySelector('.starter-banner');
      return {
        links:links.map(a=>({href:a.getAttribute('href'),download:a.getAttribute('download'),text:a.textContent.trim()})),
        banner:!!banner,
        bannerText:banner?banner.textContent.replace(/\s+/g,' '):'',
        hasFileInput:!!document.getElementById('starterFile'),
        importLabel:[...document.querySelectorAll('button')].some(b=>/Import Design/.test(b.textContent)),
        dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length,
        scrollWidth:document.documentElement.scrollWidth,
        defaults:{style:P.standStyle,color:P.color,name:P.standName,brand:P.brandText}
      };
    });
    check('two links point at the starter zip',info.links.length===2,JSON.stringify(info.links.map(l=>l.text)));
    check('links are relative and download enabled',info.links.every(l=>l.href==='../phone-stand-starter.zip'&&l.download===''));
    check('link wording says Starter Template and Download Free',info.links.some(l=>/Starter Template/.test(l.text))&&info.links.some(l=>/Download Free/.test(l.text)));
    check('starter banner present with checklist wording',info.banner&&/checklist for all 14 steps/.test(info.bannerText));
    check('hidden file input and Import Design button exist',info.hasFileInput&&info.importLabel);
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

    // end to end import: drop the cradle JSON on the import input
    const tmp=path.join(os.tmpdir(),'starter-cradle-test.json');
    fs.writeFileSync(tmp,JSON.stringify({
      standName:'JVDS Cable Cradle',standStyle:'cradle',phoneWidth:72,phoneThickness:9,
      standWidth:110,standDepth:90,standHeight:55,angle:55,baseThickness:5,lipHeight:10,
      lipAngle:15,cableSlot:true,cableSlotWidth:14,gripTexture:'dots',color:'#38bdf8',
      roundedCorners:true,cornerRadius:4,brandText:'JVDS',brandFontSize:14
    },null,2));
    const input=await page.$('#starterFile');
    await input.uploadFile(tmp);
    await page.$eval('#starterFile',el=>el.dispatchEvent(new Event('change')));
    await page.waitForFunction(()=>P.standName==='JVDS Cable Cradle',{timeout:5000});
    const after=await page.evaluate(()=>({style:P.standStyle,color:P.color,brand:P.brandText,name:P.standName,group:(typeof standGroup!=='undefined'&&!!standGroup)}));
    check('import applied the cradle design',after.style==='cradle'&&after.color==='#38bdf8'&&after.brand==='JVDS',JSON.stringify(after));
    check('scene rebuilt after import',after.group===true);
    fs.unlinkSync(tmp);

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
