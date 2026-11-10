// games-mobile-touch.js (A953): every game the catalogue lists must work on a phone.
// Sweeps all catalogue games at 390 and 1440 for a valid viewport, no horizontal
// overflow and no runtime errors, then deep-checks a flagship subset for touch input,
// resize survival and a restart/pause control. Also guards that the catalogue no
// longer claims tilt-to-play for games that steer by touch.
const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = 'F:/Website/Jvdesign-Website-v2';
const port = 19253;
const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon','.m4a':'audio/mp4','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav'};
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

const registry = fs.readFileSync(path.join(root,'games-registry.js'),'utf8');
const GAMES = [...new Set([...registry.matchAll(/"file"\s*:\s*"([^"]+\.html)"/g)].map(m=>m[1]))];
const arcadeHtml = fs.readFileSync(path.join(root,'arcade.html'),'utf8');
const FLAGSHIP = ['arcane_citadel.html','gem_match.html','nova-siege.html','sky_high_with_friends.html','echos-flight.html','highway-dodge.html','lumo-hive.html','lumo_firefly_night.html'];
// A2839: every catalogue game should own the screen like Nova Siege, so the page
// must not scroll vertically at phone portrait, phone landscape or desktop.
// These four predate the rule. They are tracked debt, not a silent exception:
// any new scroller fails immediately, and --strict / STRICT_FULLSCREEN=1 makes
// the debt fail too once it has been converted.
const FULLSCREEN_DEBT = new Set([
  // Empty since A2840: all catalogue games own the screen. Add a file here only
  // with a tracking card, and remove it once the game passes --strict.
]);
const STRICT_FULLSCREEN = process.env.STRICT_FULLSCREEN === '1' || process.argv.includes('--strict');
const debtSeen = new Set();

function wireErrors(page){
  const errors=[];
  page.on('pageerror', e=>errors.push('pageerror: '+e.message));
  page.on('console', msg=>{ if(msg.type()==='error' && !/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|ERR_ABORTED|ERR_FILE_NOT_FOUND/.test(msg.text())) errors.push('console: '+msg.text().slice(0,90)); });
  return errors;
}
const overflow = page => page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);

(async()=>{
  await listen();
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});

  // 1) Sweep every catalogue game at phone and desktop.
  check('line-up lists games to test', GAMES.length>=8, String(GAMES.length));
  for (const vp of [{name:'phone',width:390,height:844,isMobile:true,hasTouch:true},{name:'phone-landscape',width:844,height:390,isMobile:true,hasTouch:true},{name:'desktop',width:1440,height:900}]) {
    let bad=0;
    for (const f of GAMES) {
      const page = await browser.newPage();
      await page.setViewport(vp);
      const errors = wireErrors(page);
      try {
        await page.goto(`http://127.0.0.1:${port}/games/${f}`, {waitUntil:'domcontentloaded', timeout:20000});
        await new Promise(r=>setTimeout(r,700));
        const meta = await page.evaluate(()=>{ const v=document.querySelector('meta[name="viewport"]'); return v?v.getAttribute('content'):''; });
        const metrics = await page.evaluate(()=>({
          overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          scrollH: document.documentElement.scrollHeight,
          vh: window.innerHeight
        }));
        const ok = /width=device-width/.test(meta) && !/user-scalable\s*=\s*no|maxim(?:um)?-scale\s*=\s*1/i.test(meta) && metrics.overflowX<=2 && errors.length===0;
        if(!ok){ bad++; check(`${f} @ ${vp.name}`, false, `viewport="${meta}" overflowX=${metrics.overflowX} errors=${errors.slice(0,1).join('')}`); }
        const vertical = metrics.scrollH - metrics.vh;
        if (vertical > 2) {
          if (FULLSCREEN_DEBT.has(f) && !STRICT_FULLSCREEN) {
            debtSeen.add(`${f} @ ${vp.name}: ${vertical}px`);
          } else {
            bad++; check(`${f} @ ${vp.name}: playfield fits without vertical scroll`, false, `scrollH=${metrics.scrollH} vh=${metrics.vh}`);
          }
        }
      } catch(e){ bad++; check(`${f} @ ${vp.name}`, false, 'nav: '+e.message.slice(0,50)); }
      await page.close();
    }
    check(`${vp.name}: all ${GAMES.length} catalogue games load with a valid viewport, no horizontal overflow, no vertical scroll, no errors`, bad===0, bad+' failing');
  }

  if (debtSeen.size) {
    console.log('\n[DEBT] known non-fullscreen catalogue games (tracked, not failing):');
    [...debtSeen].forEach(line => console.log('  - ' + line));
    if (!STRICT_FULLSCREEN) console.log('  Convert these to the Nova Siege shell, then remove them from FULLSCREEN_DEBT.');
  }
  if (!STRICT_FULLSCREEN) {
    for (const f of FULLSCREEN_DEBT) {
      const stillDebt = [...debtSeen].some(line => line.startsWith(f + ' @ '));
      if (!stillDebt) console.log(`[DEBT-CLEARED] ${f} now fits the viewport; remove it from FULLSCREEN_DEBT.`);
    }
  }

  // 2) Deep checks on a flagship subset.
  for (const f of FLAGSHIP) {
    const page = await browser.newPage();
    await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
    const errors = wireErrors(page);
    await page.goto(`http://127.0.0.1:${port}/games/${f}`, {waitUntil:'domcontentloaded', timeout:20000});
    await new Promise(r=>setTimeout(r,900));

    // touch input on the play area
    try { await page.touchscreen.tap(195, 420); } catch(e){ errors.push('tap: '+e.message); }
    await page.evaluate(()=>{ for(const type of ['pointerdown','pointermove','pointerup']){ document.dispatchEvent(new PointerEvent(type,{clientX:195,clientY:420,bubbles:true})); } });
    await new Promise(r=>setTimeout(r,300));
    check(`${f}: survives touch input on a phone`, errors.length===0, errors.slice(0,1).join(''));

    // survives a resize (phone -> desktop -> phone)
    await page.setViewport({width:1440,height:900});
    await new Promise(r=>setTimeout(r,400));
    const ovWide = await overflow(page);
    await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
    await new Promise(r=>setTimeout(r,400));
    const ovBack = await overflow(page);
    check(`${f}: survives a browser resize`, errors.length===0 && ovWide<=2 && ovBack<=2, `wide=${ovWide} back=${ovBack}`);

    // restart / pause control (button text or the shared GameSystem overlay)
    const ctrl = await page.evaluate(()=>{
      const txt = [...document.querySelectorAll('button,a')].map(x=>((x.textContent||'')+' '+(x.getAttribute('aria-label')||'')).toLowerCase()).join(' | ');
      const src = [...document.querySelectorAll('script')].map(s=>s.src||'').join(' ');
      return { hasControl: /restart|replay|play again|new game|reset|pause/.test(txt), hasSystem: /game-system|game-score/.test(src) };
    });
    check(`${f}: has a restart or pause control`, ctrl.hasControl || ctrl.hasSystem, JSON.stringify(ctrl));
    await page.close();
  }

  // 3) The arcade must not claim tilt-to-play for games that steer by touch.
  check('arcade does not say "Tilt-to-play"', !/Tilt-to-play/i.test(arcadeHtml));
  check('arcade does not label a game "Tilt to Play"', !/Tilt to Play/i.test(arcadeHtml));

  await browser.close(); server.close();
  if(failures){ console.log(`\n${failures} FAILURE(S)`); process.exit(1); }
  console.log('\nALL GAMES MOBILE TOUCH CHECKS PASSED');
})().catch(e=>{console.error(e); server.close(); process.exit(1);});
