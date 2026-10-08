// Game Planner (tools/quest-board.html) HTTP + runtime verification.
// Kept from the Project Tracker era (desktop + mobile, no auth gate, no overflow,
// no stray script text), plus the A935 fun RPG loop: per-move XP, a completion
// bonus, level-up celebration and achievements.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = 'F:/Website/Jvdesign-Website-v2';
const port = 19247;
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.json':'application/json','.svg':'image/svg+xml'};
const server = http.createServer((req,res)=>{
  let url = decodeURIComponent(req.url.split('?')[0]);
  if(url === '/') url = '/index.html';
  const file = path.normalize(path.join(root, url));
  if(!file.startsWith(path.normalize(root))){res.writeHead(403);res.end('Forbidden');return;}
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'});
    res.end(data);
  });
});
function listen(){return new Promise(r=>server.listen(port, r));}
let failures = 0;
function check(name, ok, detail=''){ console.log((ok?'PASS ':'FAIL ')+name+(detail?' , '+detail:'')); if(!ok) failures++; }
(async()=>{
  await listen();
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});
  for (const vp of [{name:'desktop',width:1366,height:900},{name:'mobile',width:390,height:844,isMobile:true}]) {
    const page = await browser.newPage();
    await page.setViewport(vp);
    const errors=[];
    page.on('pageerror', e=>errors.push('pageerror: '+e.message));
    page.on('console', msg=>{ if(msg.type()==='error' && !/ERR_NETWORK_ACCESS_DENIED|Failed to load resource/.test(msg.text())) errors.push('console: '+msg.text()); });
    await page.goto(`http://127.0.0.1:${port}/tools/quest-board.html`, {waitUntil:'domcontentloaded', timeout:15000});
    await new Promise(resolve => setTimeout(resolve, 1000));

    const data = await page.evaluate(() => ({
      title: document.title,
      authGate: !!document.getElementById('authGate'),
      activeView: document.querySelector('.view.active')?.id || '',
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      hasScriptText: document.body.innerText.includes('const _MOTIVATIONS') || document.body.innerText.includes('new Blob([html]'),
      newQuest: !!document.querySelector('button[onclick="openCardModal()"]'),
      projectSheet: !!document.getElementById('projectSheet')
    }));
    check(vp.name+': title loads', data.title.includes('Game Planner'), data.title);
    check(vp.name+': no auth gate', !data.authGate);
    check(vp.name+': a view is active', !!data.activeView, data.activeView);
    check(vp.name+': New Quest button', data.newQuest);
    check(vp.name+': no stray script text', !data.hasScriptText);
    check(vp.name+': no horizontal overflow', data.scrollWidth<=data.clientWidth+2, `${data.scrollWidth}/${data.clientWidth}`);

    const flow = await page.evaluate(() => {
      const out=[];
      const rec=(n,c,d='')=>out.push({n,c:!!c,d:String(d)});
      rec('rpg state present', rpg && typeof rpg.level==='number');
      rec('confetti canvas present', !!document.getElementById('confetti'));
      rec('level-up banner present', !!document.getElementById('levelUp'));
      rec('player rank shown', /The /.test(document.getElementById('playerName').textContent), document.getElementById('playerName').textContent);

      // Fresh, known board: one Main Quest in To Do.
      data={columns:structuredClone(seedColumns),cards:[{id:'q1',title:'Boss fight',desc:'',colId:'todo',priority:'high',createdAt:new Date().toISOString()}],nextId:2};
      rpg={level:1,xp:0,achievements:[]};
      save(); render();

      const xp0=rpg.xp;
      moveCard('q1');                                  // To Do -> In Progress
      rec('moving a quest earns XP', rpg.xp>xp0, rpg.xp+' vs '+xp0);
      const xp1=rpg.xp;
      moveCard('q1');                                  // In Progress -> Complete
      rec('completing a quest earns XP', (rpg.xp!==xp1)||rpg.level>1, 'xp='+rpg.xp+' lvl='+rpg.level);
      rec('completion fires confetti', _confParts.length>0, 'parts='+_confParts.length);
      rec('level-up banner shows', document.getElementById('levelUp').classList.contains('show'));
      rec('First Victory unlocked', (rpg.achievements||[]).includes('first_win'));
      rec('Main Quest Cleared unlocked', (rpg.achievements||[]).includes('main_win'));
      const stored=JSON.parse(localStorage.getItem('qb-rpg-v1')||'{}');
      rec('achievements persisted', (stored.achievements||[]).includes('first_win'));

      // Regression: completing via the edit form used to award nothing.
      data.cards.push({id:'q2',title:'Side task',desc:'',colId:'todo',priority:'med',createdAt:new Date().toISOString()});
      data.nextId=3; save(); render();
      const xp2=rpg.xp, lvl2=rpg.level;
      openCardModal('q2');
      document.getElementById('column').value='done';
      document.getElementById('questForm').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));
      rec('edit-form completion earns XP', (rpg.xp!==xp2)||(rpg.level>lvl2), 'xp='+rpg.xp+' lvl='+rpg.level);
      rec('quest reaches done via form', (data.cards.find(c=>c.id==='q2')||{}).colId==='done');

      switchView('settings');
      rec('settings lists every achievement', document.querySelectorAll('#view-settings .ach-list .pill').length===ACHIEVEMENTS.length, document.querySelectorAll('#view-settings .ach-list .pill').length);
      rec('unlocked achievements are marked', document.querySelectorAll('#view-settings .ach-list .pill.on').length>=1);
      switchView('board');
      return out;
    });
    flow.forEach(r=>check(vp.name+': '+r.n, r.c, r.d));
    check(vp.name+': zero runtime errors', errors.length===0, errors.join(' | '));
    await page.close();
  }
  await browser.close(); server.close();
  if(failures){ console.log(`\n${failures} FAILURE(S)`); process.exit(1); }
  console.log('\nALL GAME PLANNER CHECKS PASSED');
})().catch(e=>{console.error(e); server.close(); process.exit(1);});
