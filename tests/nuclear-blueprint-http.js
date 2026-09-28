const http=require('http'),fs=require('fs'),path=require('path'),zlib=require('zlib');
const puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const PAGE='/workshops/nuclear-blueprint.html';
const ZIP='/nuclear-blueprint-starter.zip';
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

// walk local file headers so we can inflate stored entries without a zip library
function readEntries(buf){
  const out={};
  let off=0;
  while(off<buf.length-4&&buf.readUInt32LE(off)===0x04034b50){
    const method=buf.readUInt16LE(off+8);
    const csize=buf.readUInt32LE(off+18);
    const usize=buf.readUInt32LE(off+22);
    const nlen=buf.readUInt16LE(off+26),elen=buf.readUInt16LE(off+28);
    const name=buf.toString('utf8',off+30,off+30+nlen);
    const start=off+30+nlen+elen;
    out[name]={method,csize,usize,data:buf.slice(start,start+csize)};
    off=start+csize;
  }
  return out;
}
function inflateEntry(e){
  if(e.method===0)return e.data;
  return zlib.inflateRawSync(e.data);
}

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
      const anchors=[...document.querySelectorAll('a')].map(a=>({href:a.getAttribute('href')||'',download:a.getAttribute('download'),text:a.textContent.trim()}));
      const zipLinks=anchors.filter(a=>a.href.includes('nuclear-blueprint-starter.zip'));
      const runLinks=anchors.filter(a=>/#run=/.test(a.href));
      const banner=document.querySelector('.starter-banner');
      return {
        zipLinks,runLinks,
        banner:!!banner,
        bannerText:banner?banner.textContent.replace(/\s+/g,' '):'',
        dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length,
        scrollWidth:document.documentElement.scrollWidth,
        steps:STEPS.length
      };
    });
    check('two links point at the starter zip',info.zipLinks.length===2,JSON.stringify(info.zipLinks.map(l=>l.text)));
    check('zip links are relative and download enabled',info.zipLinks.every(l=>l.href==='../nuclear-blueprint-starter.zip'&&l.download===''));
    check('link wording says Starter Template and Download Free',info.zipLinks.some(l=>/Starter Template/.test(l.text))&&info.zipLinks.some(l=>/Download Free/.test(l.text)));
    check('one reference run link in the header',info.runLinks.length===1,'found '+info.runLinks.length);
    check('starter banner present with 37 step wording',info.banner&&/37 step checklist/.test(info.bannerText)&&/Reference Run/.test(info.bannerText));
    check('page still has 37 workshop steps',info.steps===37,'steps '+info.steps);
    check('page has no em or en dashes',info.dashes===0,'dashes '+info.dashes);
    check('desktop no overflow',info.scrollWidth<=1440+2,info.scrollWidth+'');

    const zipRes=await fetch(base+ZIP);
    check('starter zip returns 200',zipRes.status===200,'status '+zipRes.status);
    const buf=Buffer.from(await zipRes.arrayBuffer());
    check('starter zip is a real zip over http',buf.length>2500&&buf[0]===0x50&&buf[1]===0x4b,'bytes '+buf.length);
    const entries=readEntries(buf);
    const names=Object.keys(entries);
    check('zip has the 5 starter files',names.length===5,JSON.stringify(names));
    check('zip uses one top level folder',new Set(names.map(n=>n.split('/')[0])).size===1&&names[0].startsWith('NuclearBlueprintStarter/'));
    check('zip paths use forward slashes',names.every(n=>n.indexOf('\\')===-1));
    for(const n of ['NuclearBlueprintStarter/README.md','NuclearBlueprintStarter/CHECKLIST.md','NuclearBlueprintStarter/reference/build-values.json','NuclearBlueprintStarter/reference/reference-run.json','NuclearBlueprintStarter/reference/reference-run-link.txt']){
      check('zip contains '+n.split('/').pop(),!!entries[n]);
    }
    const readme=inflateEntry(entries['NuclearBlueprintStarter/README.md']).toString('utf8');
    const checklist=inflateEntry(entries['NuclearBlueprintStarter/CHECKLIST.md']).toString('utf8');
    check('README points at the workshop and explains the reference run',/jvdesignstudio\.co\.uk\/workshops\/nuclear-blueprint\.html/.test(readme)&&/reference-run-link\.txt/.test(readme));
    check('README has no em or en dashes',!/[\u2013\u2014]/.test(readme));
    check('checklist covers all 37 steps',(checklist.match(/^- \[ \] \d+ /gm)||[]).length===37,'items '+(checklist.match(/^- \[ \] \d+ /gm)||[]).length);
    check('checklist has no em or en dashes',!/[\u2013\u2014]/.test(checklist));

    const values=JSON.parse(inflateEntry(entries['NuclearBlueprintStarter/reference/build-values.json']).toString('utf8'));
    const run=JSON.parse(inflateEntry(entries['NuclearBlueprintStarter/reference/reference-run.json']).toString('utf8'));
    const stepsCovered=new Set(values.values.map(v=>v.step));
    check('build values cover all 37 steps',stepsCovered.size===37,'covered '+stepsCovered.size);
    check('build values carry a number for every field step',values.values.filter(v=>v.hint!==null).every(v=>v.value!==null&&v.value!==undefined));
    check('wiring only steps are marked with null',values.values.filter(v=>v.hint===null).every(v=>v.value===null));
    const step2=values.values.filter(v=>v.step===2);
    check('step 2 reference sets 140 HP and 350 speed',step2.length===2&&step2[0].value==='140'&&step2[1].value==='350',JSON.stringify(step2.map(v=>v.value)));
    check('step 37 reference names the weapon',values.values.some(v=>v.step===37&&v.value==='Nova Splinter'));
    check('reference run matches the share schema',run.v===1&&typeof run.score==='number'&&run.wpn0&&run.wpn1&&run.phase==='playing');
    check('reference run mutations are real card ids',run.mut1==='damage_up'&&['speed_boost','shield','lifesteal'].includes(run.mut2));
    check('reference run names both weapons',run.wpn0.name==='Nova Splinter'&&run.wpn1.name==='Ember Sidearm');

    const linkTxt=inflateEntry(entries['NuclearBlueprintStarter/reference/reference-run-link.txt']).toString('utf8').trim();
    const expectedB64=Buffer.from(JSON.stringify(run),'utf8').toString('base64');
    check('run link file holds the same run as the json',linkTxt.endsWith('#run='+expectedB64),linkTxt.slice(0,60));
    check('page reference run link matches the zipped run',info.runLinks[0].href==='#run='+expectedB64,'len '+info.runLinks[0].href.length);

    const runPage=await browser.newPage();
    const runErrors=[];
    runPage.on('pageerror',e=>runErrors.push(e.message));
    runPage.on('dialog',async d=>{errors.push('unexpected dialog: '+d.message());await d.dismiss();});
    await runPage.setRequestInterception(true);
    runPage.on('request',r=>r.url().startsWith(base)||r.url().startsWith('data:')?r.continue():r.abort());
    await runPage.setViewport({width:1440,height:900});
    await runPage.goto(base+PAGE+'#run='+expectedB64,{waitUntil:'load'});
    if(await runPage.$('#cookie-decline'))await runPage.click('#cookie-decline');
    await runPage.waitForFunction('document.getElementById("hudRoom").textContent==="2-3"',{timeout:15000});
    const applied=await runPage.evaluate(()=>({
      hp:parseInt(document.getElementById('hudHP').textContent,10),
      room:document.getElementById('hudRoom').textContent,
      score:parseInt(document.getElementById('hudScore').textContent,10),
      wpn:document.getElementById('hudWpn').textContent,
      toast:document.getElementById('nbToast').textContent
    }));
    check('reference run loads straight into play',/Shared run loaded, World 2/.test(applied.toast),applied.toast);
    check('HUD shows the run health',applied.hp>0&&applied.hp<=140,'hp '+applied.hp);
    check('HUD shows World 2-3',applied.room==='2-3',applied.room);
    check('HUD shows the run score',applied.score===1250,'score '+applied.score);
    check('HUD shows the named weapon',applied.wpn==='NS','weapon '+applied.wpn);
    const runDash=await runPage.evaluate(()=>(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length);
    check('reference run page has no em or en dashes',runDash===0,'dashes '+runDash);
    const runOverflow=await runPage.evaluate(()=>document.documentElement.scrollWidth);
    check('reference run page no overflow',runOverflow<=1442,String(runOverflow));
    check('reference run page has no runtime errors',runErrors.length===0,runErrors.join(' | '));
    await runPage.close();

    // the same link must work when clicked on the page you are already on
    const clickPage=await browser.newPage();
    const clickErrors=[];
    clickPage.on('pageerror',e=>clickErrors.push(e.message));
    await clickPage.setRequestInterception(true);
    clickPage.on('request',r=>r.url().startsWith(base)||r.url().startsWith('data:')?r.continue():r.abort());
    await clickPage.setViewport({width:1440,height:900});
    await clickPage.goto(base+PAGE,{waitUntil:'load'});
    if(await clickPage.$('#cookie-decline'))await clickPage.click('#cookie-decline');
    const beforeRoom=await clickPage.evaluate(()=>document.getElementById('hudRoom').textContent);
    await clickPage.click('#nbRunLink');
    await clickPage.waitForFunction('document.getElementById("hudRoom").textContent!=='+JSON.stringify(beforeRoom)+'&&/2-3/.test(document.getElementById("hudRoom").textContent)',{timeout:15000});
    const clicked=await clickPage.evaluate(()=>({room:document.getElementById('hudRoom').textContent,score:parseInt(document.getElementById('hudScore').textContent,10),hash:location.hash.slice(0,9)}));
    check('clicking Reference Run loads the run in place',clicked.room==='2-3'&&clicked.score===1250&&clicked.hash==='#run=eyJ2',JSON.stringify(clicked));
    check('in page reference run has no runtime errors',clickErrors.length===0,clickErrors.join(' | '));
    await clickPage.close();

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
