/* Check every 3D builder's export: is the shared module loaded, is installUI
   wired, does the Export control appear, and does clicking it actually produce
   a file for each format. Run: node tests/3d-export-live.js [builder ...] */
const http=require('http'),fs=require('fs'),path=require('path');
const puppeteer=require('F:/Website/Jvdesign-Website-v2/node_modules/puppeteer');
const root=path.resolve(__dirname,'..');

const ALL=['rocket-builder','robot-builder','pirate-ship-builder','pirate-cannon-builder',
  'steampunk-airship-builder','race-car-builder','submarine-builder','castle-builder',
  'space-station-builder','fairy-tale-builder','phone-stand-builder'];

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
  const list=want.length?ALL.filter(b=>want.some(w=>b.includes(w))):ALL;
  let bad=0;

  for(const name of list){
    const page=await browser.newPage();
    const errs=[];
    page.on('pageerror',e=>errs.push(e.message.split('\n')[0].slice(0,90)));
    await page.setRequestInterception(true);
    page.on('request',r=>r.url().startsWith(base)||r.url().startsWith('data:')||r.url().startsWith('blob:')?r.continue():r.abort());
    await page.setViewport({width:1440,height:900});
    await page.goto(base+'/workshops/'+name+'.html',{waitUntil:'load'});
    if(await page.$('#cookie-decline')){try{await page.click('#cookie-decline');}catch(e){}}
    await new Promise(r=>setTimeout(r,1300));
    await page.evaluate(()=>{
      const b=Array.from(document.querySelectorAll('button'))
        .find(x=>/^(Let's Build!|Accept|Got it)$/i.test(x.textContent.trim())&&x.offsetParent!==null);
      if(b)b.click();
    });
    await new Promise(r=>setTimeout(r,400));
    await page.evaluate(async()=>{
      const hit=re=>{const b=Array.from(document.querySelectorAll('button'))
        .find(x=>re.test(x.textContent)&&x.offsetParent!==null&&!x.disabled);
        if(b){b.click();return true;}return false;};
      if(!hit(/quick build/i)) for(let i=0;i<35&&hit(/^\s*(Next|Continue)\b/i);i++){}
      await new Promise(r=>setTimeout(r,900));
    });
    await new Promise(r=>setTimeout(r,1000));

    const r=await page.evaluate(async()=>{
      const out={loaded:typeof window.JVExporter!=='undefined',ver:window.JVExporter&&window.JVExporter.version};
      const btn=document.querySelector('[data-jv-export]');
      out.buttonMounted=!!btn;
      out.buttonVisible=!!btn&&btn.offsetParent!==null;
      if(!btn)return out;
      btn.click();
      await new Promise(x=>setTimeout(x,700));
      const sheet=document.getElementById('jvExportBackdrop');
      out.dialogOpen=!!sheet&&sheet.style.display!=='none';
      out.formats=sheet?[...sheet.querySelectorAll('.jv-fmt')].map(b=>b.dataset.fmt+(b.disabled?':off':'')):[];
      out.facts=sheet?(sheet.querySelector('#jvExportFacts')||{}).textContent:'';
      // try every enabled format for real
      const kept=new Map();
      const oc=URL.createObjectURL.bind(URL);
      URL.createObjectURL=function(b){const u=oc(b);kept.set(u,b);return u;};
      const ok=HTMLAnchorElement.prototype.click;
      const files=[];
      HTMLAnchorElement.prototype.click=function(){if(this.download){files.push(this.download);return;}return ok.apply(this,arguments);};
      if(sheet){
        for(const b of sheet.querySelectorAll('.jv-fmt')){
          if(b.disabled)continue;
          b.click();
          await new Promise(x=>setTimeout(x,1600));
        }
      }
      await new Promise(x=>setTimeout(x,1200));
      HTMLAnchorElement.prototype.click=ok;URL.createObjectURL=oc;
      out.files=files;
      return out;
    });

    const okAll=r.buttonMounted&&r.dialogOpen&&(r.files||[]).length>=2;
    if(!okAll)bad++;
    console.log((okAll?'ok   ':'FAIL ')+name.padEnd(26)+'exporter='+r.ver+'  files='+JSON.stringify(r.files||null));
    if(r.formats&&r.formats.length)console.log('       formats: '+r.formats.join(' ')+'   facts: '+(r.facts||'').replace(/\s+/g,' ').slice(0,110));
    if(errs.length){console.log('       ERR: '+errs[0]);bad++;}
    await page.close();
  }
  await browser.close();
  server.close();
  console.log('\n'+(bad?bad+' builder(s) not exporting properly':'all builders export from the page'));
  process.exit(bad?1:0);
})().catch(e=>{console.error(e);server.close();process.exit(1);});
