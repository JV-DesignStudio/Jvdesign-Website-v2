/* Shared HTTP/smoke runner for converted canvas build-along workshop pages.
   Each tests/<page>-http.js wrapper calls run(page, opts). */
const http=require('http'),fs=require('fs'),path=require('path');
const puppeteer=require('puppeteer');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon','.zip':'application/zip'};

async function run(pagePath, opts) {
  opts = opts || {};
  const minSteps = opts.steps || 6;
  let failures=0;
  function check(name,ok,detail=''){console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:''));if(!ok)failures++;}
  const server=http.createServer((req,res)=>{
    const u=decodeURIComponent(new URL(req.url,'http://x').pathname);
    const f=path.join(root,u);
    if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end('missing '+u);}
    res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});
    fs.createReadStream(f).pipe(res);
  });
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
    await page.goto(base+pagePath,{waitUntil:'load'});
    if(await page.$('#cookie-decline'))await page.click('#cookie-decline');
    await page.waitForFunction(()=>window.CW&&document.querySelectorAll('.cw-step').length>0,{timeout:8000});
    const info=await page.evaluate(()=>{
      const frame=document.getElementById('gameFrame');
      return {
        steps:document.querySelectorAll('.cw-step').length,
        activeSteps:document.querySelectorAll('.cw-step.active').length,
        editors:document.querySelectorAll('.cw-editor').length,
        hasFrame:!!frame,
        frameDoc:!!(frame&&frame.srcdoc&&frame.srcdoc.length>50),
        xpLabel:(document.getElementById('xpLabel')||{}).textContent||'',
        progressCount:(document.getElementById('progressCount')||{}).textContent||'',
        dashCount:(document.body.innerText.match(/[\u2013\u2014]/g)||[]).length,
        scrollWidth:document.documentElement.scrollWidth
      };
    });
    check('build steps render',info.steps>=minSteps,'steps '+info.steps);
    check('one active step',info.activeSteps===1,'active '+info.activeSteps);
    check('each step has an editor',info.editors===info.steps,'editors '+info.editors);
    check('live canvas iframe is present and rendered',info.hasFrame&&info.frameDoc);
    check('XP bar is wired',/XP/.test(info.xpLabel),info.xpLabel);
    check('shared progress counter reads the step total',new RegExp('\\/ '+info.steps+' steps').test(info.progressCount),info.progressCount);
    check('page has no em or en dashes',info.dashCount===0,'dashes '+info.dashCount);
    check('desktop no overflow',info.scrollWidth<=1440+2,info.scrollWidth+'');

    const before=await page.evaluate(()=>document.getElementById('xpLabel').textContent);
    await page.evaluate(()=>{
      const s=window.CW_CONFIG.steps[0];
      document.getElementById('editor-'+s.num).value=s.solution;
      CW.checkStep(s.num);
      if(s.quiz){CW.selectQuiz(s.num,s.quiz.correct);CW.checkQuiz(s.num);}
    });
    await new Promise(r=>setTimeout(r,300));
    const after=await page.evaluate(()=>({xp:document.getElementById('xpLabel').textContent,count:document.getElementById('progressCount').textContent}));
    check('completing a step awards XP through the shared engine',before!==after.xp,before+' -> '+after.xp);
    check('completing a step advances the shared progress bar',/1 \//.test(after.count),after.count);

    /* Drive EVERY step with its solution (and quiz) and confirm each rendered
       template runs without throwing inside the sandboxed preview iframe. */
    errors.length=0;
    const stepTotal=await page.evaluate(()=>window.CW_CONFIG.steps.length);
    await page.evaluate(()=>{window.__cwQuizDone={};});
    for(let guard=0;guard<stepTotal*3;guard++){
      const progressed=await page.evaluate(()=>{
        const active=document.querySelector('.cw-step.active');
        if(!active)return false;
        const num=Number(active.id.replace('card-',''));
        const step=window.CW_CONFIG.steps.find(s=>s.num===num);
        if(!step)return false;
        const ta=document.getElementById('editor-'+step.num);
        if(!ta)return false;
        ta.disabled=false; ta.readOnly=false;
        ta.value=step.solution;
        window.CW.checkStep(step.num);
        if(step.quiz&&!window.__cwQuizDone[step.num]){
          const opts=document.getElementById('quiz-opts-'+step.num);
          if(opts){
            const els=opts.querySelectorAll('.cw-quiz-opt');
            if(els[step.quiz.correct])els[step.quiz.correct].click();
            window.CW.checkQuiz(step.num);
            window.__cwQuizDone[step.num]=true;
          }
        }
        return true;
      });
      if(!progressed)break;
      await new Promise(r=>setTimeout(r,150));
    }
    await new Promise(r=>setTimeout(r,400));
    const done=await page.evaluate(()=>document.getElementById('progressCount').textContent);
    check('all steps complete when solved',new RegExp(stepTotal+' \\/ '+stepTotal+'|'+stepTotal+' / '+stepTotal).test(done),done);
    check('no runtime errors while running every step template',errors.length===0,errors.join(' | '));

    for(const width of [390,320]){
      await page.setViewport({width,height:844,isMobile:true});
      await page.goto(base+pagePath,{waitUntil:'load'});
      await page.waitForFunction(()=>window.CW,{timeout:8000});
      const over=await page.evaluate(()=>document.documentElement.scrollWidth);
      check('no overflow at '+width+'px',over<=width+2,over+'');
    }
    check('zero runtime errors',errors.length===0,errors.join(' | '));
  }finally{await browser.close();server.close();}
  if(failures){console.log('\n'+failures+' FAILURE(S)');process.exit(1);}
  console.log('\nPASS: '+pagePath+' canvas build-along');
}

module.exports={run};
