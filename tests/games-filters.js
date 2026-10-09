// games-filters.js (A950): every catalogue filter, count and empty state on
// pages/games.html. Guards that each chip shows the right number with no false
// empty state, that All equals the catalogue (marketing.json), that the discovery
// quick-play routes apply a filter, and that search and sort combine with filters.
// Desktop and mobile, no overflow, no console errors.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = 'F:/Website/Jvdesign-Website-v2';
const port = 19251;
const marketing = JSON.parse(fs.readFileSync(path.join(root, 'content/marketing.json'), 'utf8'));
const EXPECTED_ALL = parseInt(String(marketing.games.display).replace(/[^0-9]/g, ''), 10);
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon'};
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
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

(async()=>{
  await listen();
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});
  for (const vp of [{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844,isMobile:true}]) {
    const page = await browser.newPage();
    await page.setViewport(vp);
    const errors=[];
    page.on('pageerror', e=>errors.push('pageerror: '+e.message));
    page.on('console', msg=>{ if(msg.type()==='error' && !/ERR_NETWORK_ACCESS_DENIED|Failed to load resource/.test(msg.text())) errors.push('console: '+msg.text()); });
    await page.goto(`http://127.0.0.1:${port}/pages/games.html`, {waitUntil:'networkidle0', timeout:30000});
    await new Promise(resolve => setTimeout(resolve, 900));

    const chips = await page.evaluate(()=>[...document.querySelectorAll('.game-chip')].map(c=>c.getAttribute('data-filter')));
    check(vp.name+': catalogue has filters', chips.length>=4, chips.join(' | '));

    const seen = {};
    for (const f of chips) {
      const r = await page.evaluate((f)=>{
        document.querySelector('.game-chip[data-filter="'+f+'"]').click();
        const cards=[...document.querySelectorAll('.games-grid .game-card')];
        const shown=cards.filter(c=>!c.classList.contains('filter-hidden'));
        const empty=document.getElementById('gameFilterEmpty');
        return {result:document.getElementById('gameResultCount').textContent.trim(), shown:shown.length, emptyShown:!empty.hidden};
      }, f);
      seen[f] = r.shown;
      const n = parseInt(r.result, 10);
      check(`${vp.name}: filter "${f}" count ${r.result} matches ${r.shown} visible card(s)`, n === r.shown, r.result);
      check(`${vp.name}: filter "${f}" has no false empty state`, r.shown === 0 ? r.emptyShown : !r.emptyShown);
    }
    check(`${vp.name}: All equals the catalogue (${EXPECTED_ALL})`, seen['All'] === EXPECTED_ALL, String(seen['All']));

    // discovery quick-play routes must apply the matching filter
    const disc = await page.evaluate(()=>[...document.querySelectorAll('[data-discovery-filter]')].map(a=>a.getAttribute('data-discovery-filter')));
    check(vp.name+': discovery quick-play routes present', disc.length>=3, disc.join(' | '));
    for (const d of disc) {
      const r = await page.evaluate((d)=>{
        document.querySelector('[data-discovery-filter="'+d+'"]').click();
        const active=document.querySelector('.game-chip.active');
        return {active:active?active.getAttribute('data-filter'):null, result:document.getElementById('gameResultCount').textContent.trim()};
      }, d);
      check(`${vp.name}: quick-play "${d}" activates its filter`, norm(r.active) === norm(d), 'active=' + r.active);
      check(`${vp.name}: quick-play "${d}" result matches the filter count`, parseInt(r.result,10) === seen[r.active], r.result);
    }

    // search combines with a category filter
    const sr = await page.evaluate(()=>{
      document.querySelector('.game-chip[data-filter="All"]').click();
      const s=document.getElementById('gameSearch'); s.value='lumo'; s.dispatchEvent(new Event('input',{bubbles:true}));
      const cards=[...document.querySelectorAll('.games-grid .game-card')];
      const shown=cards.filter(c=>!c.classList.contains('filter-hidden'));
      return {result:parseInt(document.getElementById('gameResultCount').textContent,10), shown:shown.length, allMatch:shown.every(c=>/lumo/i.test(c.textContent))};
    });
    check(`${vp.name}: search "lumo" on All returns only matching games`, sr.result===sr.shown && sr.shown>0 && sr.allMatch, `result=${sr.result} shown=${sr.shown}`);

    // empty state and reset
    const er = await page.evaluate(()=>{
      const s=document.getElementById('gameSearch'); s.value='zzzznomatch'; s.dispatchEvent(new Event('input',{bubbles:true}));
      const empty=document.getElementById('gameFilterEmpty');
      const before={result:document.getElementById('gameResultCount').textContent.trim(), emptyShown:!empty.hidden};
      empty.querySelector('.game-filter-reset').click();
      const s2=document.getElementById('gameSearch'); s2.value=''; s2.dispatchEvent(new Event('input',{bubbles:true}));
      return {before, after:parseInt(document.getElementById('gameResultCount').textContent,10), emptyAfter:!empty.hidden};
    });
    check(`${vp.name}: no-match search shows the empty state`, er.before.result==='0 games' && er.before.emptyShown, er.before.result);
    check(`${vp.name}: reset returns to the full catalogue`, er.after===EXPECTED_ALL && !er.emptyAfter, String(er.after));

    // sort combines with a filter
    const so = await page.evaluate(()=>{
      document.querySelector('.game-chip[data-filter="Puzzle"]').click();
      const sort=document.getElementById('gameSort'); sort.value='az'; sort.dispatchEvent(new Event('change',{bubbles:true}));
      const titles=[...document.querySelectorAll('.games-grid .game-card')].filter(c=>!c.classList.contains('filter-hidden')).map(c=>c.querySelector('.game-title').textContent.trim());
      return {result:parseInt(document.getElementById('gameResultCount').textContent,10), titles, sorted:[...titles].sort((a,b)=>a.localeCompare(b))};
    });
    check(`${vp.name}: sort A-Z applies within a category filter`, so.result===so.titles.length && JSON.stringify(so.titles)===JSON.stringify(so.sorted), so.titles.join(' | '));

    check(vp.name+': zero runtime errors', errors.length===0, errors.join(' | '));
    await page.close();
  }
  await browser.close(); server.close();
  if(failures){ console.log(`\n${failures} FAILURE(S)`); process.exit(1); }
  console.log('\nALL GAMES FILTER CHECKS PASSED');
})().catch(e=>{console.error(e); server.close(); process.exit(1);});
