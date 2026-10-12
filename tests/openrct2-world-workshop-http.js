const http=require('http'),fs=require('fs'),path=require('path');
const puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const EPISODES=[
  'openrct2-world-ep1-setup.html','openrct2-world-ep2-first-plugin.html','openrct2-world-ep3-events.html',
  'openrct2-world-ep4-read-the-park.html','openrct2-world-ep5-guests.html','openrct2-world-ep6-swim-rescue.html',
  'openrct2-world-ep7-test-debug.html','openrct2-world-ep8-design-share.html'
];
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
    page.on('request',r=>r.url().startsWith(base)||r.url().startsWith('data:')?r.continue():r.abort());
    await page.setViewport({width:1440,height:900});

    // Hub
    await page.goto(base+'/workshops/openrct2-world-workshop.html',{waitUntil:'load'});
    const hub=await page.evaluate(()=>({
      studioLinks:document.querySelectorAll('a[href*="openrct2-mod-studio.html"]').length,
      deepLinks:document.querySelectorAll('a[href*="openrct2-modding-builder.html"]').length,
      cards:document.querySelectorAll('a.rct-ep').length,
      episodeLinks:document.querySelectorAll('a[href*="openrct2-world-ep"]').length,
      hero:!!document.getElementById('rctHero'),
      prog:!!document.getElementById('rctProgText'),
      dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length,
      sw:document.documentElement.scrollWidth
    }));
    check('hub links the OpenRCT2 Mod Studio',hub.studioLinks>=2,'links '+hub.studioLinks);
    check('hub keeps the Python builder as a deep dive',hub.deepLinks>=1,'links '+hub.deepLinks);
    check('hub lists all 8 episodes + cheat sheet',hub.cards>=9,'cards '+hub.cards);
    check('hub links every episode page',hub.episodeLinks>=8,'links '+hub.episodeLinks);
    check('hub has the living-park hero',hub.hero);
    check('hub has the progress dashboard',hub.prog);
    check('hub has no dashes',hub.dashes===0);
    check('hub desktop no overflow',hub.sw<=1442,hub.sw+'');
    check('hub no browser errors',errors.length===0,errors.slice(0,2).join(' | '));

    // Every episode uses the shared engine and is complete
    for(const file of EPISODES){
      errors.length=0;
      await page.goto(base+'/workshops/'+file,{waitUntil:'load'});
      if(await page.$('#cookie-decline'))await page.click('#cookie-decline');
      const ep=await page.evaluate(()=>({
        steps:document.querySelectorAll('.step-card').length,
        quizzes:document.querySelectorAll('.quiz-gate').length,
        fills:document.querySelectorAll('.concept-fill').length,
        studio:document.querySelectorAll('a[href*="openrct2-mod-studio.html"]').length,
        firstOpen:!!document.querySelector('.step-card.open'),
        total:window.WORKSHOP_TOTAL,
        key:window.WORKSHOP_KEY,
        engine:typeof window.checkQuiz==='function'&&typeof window.completeStep==='function',
        finish:!!document.getElementById('finishBanner'),
        dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length,
        sw:document.documentElement.scrollWidth
      }));
      check(file+': 4+ steps',ep.steps>=4,'steps '+ep.steps);
      check(file+': every step has a quiz',ep.quizzes===ep.steps && ep.quizzes>=4,'quizzes '+ep.quizzes+' steps '+ep.steps);
      check(file+': has fill-in-the-blanks',ep.fills>=2,'fills '+ep.fills);
      check(file+': total matches steps',ep.total===ep.steps,ep.total+' vs '+ep.steps);
      check(file+': engine key set',/^jvds-openrct2-world-ep/.test(ep.key||''),ep.key);
      check(file+': shared engine hooks exposed',ep.engine);
      check(file+': hands off to the Mod Studio',ep.studio>=1,'links '+ep.studio);
      check(file+': finish banner present',ep.finish);
      check(file+': first step open',ep.firstOpen);
      check(file+': no dashes',ep.dashes===0,'dashes '+ep.dashes);
      check(file+': no browser errors',errors.length===0,errors.slice(0,2).join(' | '));
      check(file+': desktop no overflow',ep.sw<=1442,ep.sw+'');
      await page.setViewport({width:390,height:844,isMobile:true});
      await page.reload({waitUntil:'load'});
      const mob=await page.evaluate(()=>document.documentElement.scrollWidth);
      check(file+': 390px no overflow',mob<=392,'scrollWidth '+mob);
      await page.setViewport({width:1440,height:900});
    }

    // Every OpenRCT2 lesson page hands off to the browser Mod Studio
    const MOD_PAGES=['openrct2-modding-builder.html','openrct2-swim-rescue.html'];
    for(const file of MOD_PAGES){
      const html=fs.readFileSync(path.join(root,'workshops',file),'utf8');
      check(file+': hands off to the Mod Studio',/openrct2-mod-studio\.html/.test(html));
    }

    // answering the first quiz on ep1 advances
    await page.goto(base+'/workshops/openrct2-world-ep1-setup.html',{waitUntil:'load'});
    await page.evaluate(()=>{const o=document.querySelector('#quiz-1 .quiz-opt[data-idx="1"]');if(o)o.click();document.querySelector('#quiz-1 .quiz-submit').click();});
    const nextShown=await page.$eval('#quiz-1 .quiz-next-btn',el=>getComputedStyle(el).display!=='none'||el.classList.contains('show'));
    check('correct quiz answer unlocks the next-step button',nextShown);
  } finally { await browser.close(); await new Promise(r=>server.close(r)); }
  console.log(failures?('\n'+failures+' FAILED'):'\nALL PASS');
  process.exit(failures?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
