const http=require('http'),fs=require('fs'),path=require('path');
const puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const EPISODES=[
  'mugen-world-ep1-setup.html','mugen-world-ep2-fighter-files.html','mugen-world-ep3-sprites-palette.html',
  'mugen-world-ep4-animations.html','mugen-world-ep5-commands.html','mugen-world-ep6-states.html',
  'mugen-world-ep7-hitboxes.html','mugen-world-ep8-stage.html','mugen-world-ep9-ai.html','mugen-world-ep10-game.html'
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
    await page.goto(base+'/workshops/mugen-world-workshop.html',{waitUntil:'load'});
    const hub=await page.evaluate(()=>({
      studioLinks:document.querySelectorAll('a[href*="mugen-mod-studio.html"]').length,
      cards:document.querySelectorAll('a.mgn-ep').length,
      episodeLinks:document.querySelectorAll('a[href*="mugen-world-ep"]').length,
      hero:!!document.getElementById('mgnHero'),
      prog:!!document.getElementById('mgnProgText'),
      dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length,
      sw:document.documentElement.scrollWidth
    }));
    check('hub links the Mod Studio',hub.studioLinks>=2,'links '+hub.studioLinks);
    check('hub lists all 10 episodes + cheat sheet',hub.cards>=11,'cards '+hub.cards);
    check('hub links every episode page',hub.episodeLinks>=10,'links '+hub.episodeLinks);
    check('hub has the living-fight hero',hub.hero);
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
      check(file+': engine key set',/^jvds-mugen-world-ep/.test(ep.key||''),ep.key);
      check(file+': shared engine hooks exposed',ep.engine);
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

    // Cheat sheet still fine
    errors.length=0;
    await page.goto(base+'/workshops/mugen-cheatsheet.html',{waitUntil:'load'});
    const cs=await page.evaluate(()=>({blocks:document.querySelectorAll('pre, .code-block, code').length,dashes:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length}));
    check('cheat sheet has code',cs.blocks>=6,'blocks '+cs.blocks);
    check('cheat sheet has no dashes',cs.dashes===0);
  } finally { await browser.close(); await new Promise(r=>server.close(r)); }
  console.log(failures?('\n'+failures+' FAILED'):'\nALL PASS');
  process.exit(failures?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
