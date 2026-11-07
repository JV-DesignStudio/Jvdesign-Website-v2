const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19257;
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
function listen(){return new Promise(resolve=>server.listen(port, resolve));}
function check(name, ok, detail=''){
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if(!ok) failures++;
}
let failures = 0;
(async()=>{
  await listen();
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  const errors=[];
  page.on('pageerror', e=>errors.push('pageerror: '+e.message));
  page.on('console', m=>{
    if(m.type() !== 'error') return;
    const text = m.text();
    if(/ERR_NETWORK_ACCESS_DENIED|Failed to load resource/.test(text)) return;
    errors.push('console: '+text);
  });
  await page.setViewport({width:390,height:844,isMobile:true});
  await page.goto('http://127.0.0.1:' + port + '/tools/code-snippet-generator.html', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(resolve=>setTimeout(resolve, 900));
  const initial = await page.evaluate(()=>({
    title: document.title,
    skipLinks: document.querySelectorAll('.skip-link').length,
    main: !!document.getElementById('main-content'),
    h1: document.querySelector('h1')?.textContent.trim(),
    cats: document.querySelectorAll('.cat-btn').length,
    cards: document.querySelectorAll('.snippet-card').length,
    opts: document.querySelectorAll('.snippet-opts').length,
    count: document.getElementById('resultCount')?.textContent || '',
    copyAll: typeof window.copyAll === 'function',
    download: typeof window.downloadMD === 'function',
    noOptsCard: !document.querySelector('[data-sid="cs-state"] .snippet-opts'),
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  check('title loads', initial.title.includes('Code Snippet Generator'), initial.title);
  check('single skip link', initial.skipLinks === 1, String(initial.skipLinks));
  check('main target exists', initial.main);
  check('h1 present', initial.h1 === 'Code Snippet Generator', initial.h1);
  check('category buttons render', initial.cats >= 5, String(initial.cats));
  check('snippet cards render', initial.cards >= 20, String(initial.cards));
  check('options panels render', initial.opts >= 5, String(initial.opts));
  check('param-less snippet has no options', initial.noOptsCard);
  check('result count shows', /\d+ snippets?/.test(initial.count), initial.count);
  check('copy all and download exist', initial.copyAll && initial.download);
  check('mobile does not overflow viewport', initial.scrollWidth <= initial.clientWidth + 2, initial.scrollWidth + '/' + initial.clientWidth);

  // A828: option rewrites the code, copy uses adapted code, reset restores defaults
  const before = await page.evaluate(()=>document.getElementById('code-cs-move').textContent);
  await page.evaluate(()=>{
    const inp=document.querySelector('input[data-sid="cs-move"][data-key="speed"]');
    inp.value='12'; inp.dispatchEvent(new Event('input',{bubbles:true}));
  });
  const after = await page.evaluate(()=>document.getElementById('code-cs-move').textContent);
  check('defaults produce valid code', /speed = 6f/.test(before) && /class PlayerController/.test(before), before.split('\n')[1]);
  check('changing an option rewrites the code', /speed = 12f/.test(after), after.split('\n')[1]);
  const adapted = await page.evaluate(()=>adaptedCode['cs-move']);
  check('copy uses the adapted code', /speed = 12f/.test(adapted||''));
  await page.evaluate(()=>{ resetSnippet('cs-move'); });
  const reset = await page.evaluate(()=>document.getElementById('code-cs-move').textContent);
  check('reset restores defaults', /speed = 6f/.test(reset), reset.split('\n')[1]);

  // empty field does not break
  await page.evaluate(()=>{
    const inp=document.querySelector('input[data-sid="gd-ui"][data-key="scene"]');
    inp.value=''; inp.dispatchEvent(new Event('input',{bubbles:true}));
  });
  const emptyOk = await page.evaluate(()=>({ok:typeof document.getElementById('code-gd-ui').textContent==='string', err:false}));
  check('empty field does not break', emptyOk.ok);

  // A829: search, category counts, deep links, persistence
  await page.evaluate(()=>{ const s=document.getElementById('search'); s.value='pygame'; s.dispatchEvent(new Event('input',{bubbles:true})); });
  const searched = await page.evaluate(()=>({cards:document.querySelectorAll('.snippet-card').length, count:document.getElementById('resultCount').textContent, catCounts:document.querySelectorAll('.cat-count').length}));
  check('search narrows the list', searched.cards>=1 && searched.cards<31 && /snippets?/.test(searched.count) && searched.catCounts>=5, JSON.stringify(searched));
  await page.evaluate(()=>{ const s=document.getElementById('search'); s.value=''; s.dispatchEvent(new Event('input',{bubbles:true})); });
  await page.evaluate(()=>filterCat('Movement'));
  const catFiltered = await page.evaluate(()=>document.querySelectorAll('.snippet-card').length);
  check('category filter works', catFiltered>0 && catFiltered<31, String(catFiltered));
  await page.goto('http://127.0.0.1:'+port+'/tools/code-snippet-generator.html#lang=js', {waitUntil:'domcontentloaded'});
  await new Promise(resolve=>setTimeout(resolve, 600));
  const deep = await page.evaluate(()=>({lang:document.getElementById('langSel').value, langs:[...new Set(Array.from(document.querySelectorAll('.lang-badge')).map(b=>b.textContent))]}));
  check('deep link restores the language filter', deep.lang==='js' && deep.langs.length===1 && deep.langs[0]==='JS', JSON.stringify(deep));
  await page.goto('http://127.0.0.1:'+port+'/tools/code-snippet-generator.html#snippet=gd-collide', {waitUntil:'domcontentloaded'});
  const templateDeep = await page.evaluate(()=>({ids:[...document.querySelectorAll('.snippet-card')].map(c=>c.dataset.sid),lang:document.getElementById('langSel').value}));
  check('snippet deep link opens the named template', templateDeep.ids.includes('gd-collide'), JSON.stringify(templateDeep));
  await page.evaluate(()=>{ currentLang='all'; currentCat='all'; currentQuery=''; saveFilters(); buildCats(); renderSnippets(); });
  await page.evaluate(()=>{ document.getElementById('langSel').value='py'; filterLang(); });
  await page.goto('http://127.0.0.1:'+port+'/tools/code-snippet-generator.html', {waitUntil:'domcontentloaded'});
  await new Promise(resolve=>setTimeout(resolve, 600));
  const persisted = await page.evaluate(()=>document.getElementById('langSel').value);
  check('filters persist across reloads', persisted==='py', persisted);

  // A830: new languages and coverage
  const langs = await page.evaluate(()=>{
    const opts=[...document.querySelectorAll('#langSel option')].map(o=>o.value);
    const core=['movement','collision','score','saving'];
    const has=(lang)=> core.every(c=>SNIPPETS.some(s=>s.lang===lang&&s.cat.toLowerCase()===c));
    return {opts, java:has('java'), cpp:has('cpp'), gml:has('gml'), defold:has('defold'), godotcs:has('godotcs'), phaser:has('phaser'), maker:has('maker'), total:SNIPPETS.length};
  });
  check('language filter lists the new languages', ['java','cpp','gml','defold','godotcs','phaser','maker'].every(l=>langs.opts.includes(l)), JSON.stringify(langs.opts));
  check('each new language has movement/collision/score/save', langs.java&&langs.cpp&&langs.gml&&langs.defold&&langs.godotcs&&langs.phaser&&langs.maker, JSON.stringify(langs));
  const filteredJava = await page.evaluate(()=>{
    filterCat('all');
    document.getElementById('langSel').value='java'; filterLang();
    return {cards:document.querySelectorAll('.snippet-card').length, badges:[...new Set([...document.querySelectorAll('.lang-badge')].map(b=>b.textContent))]};
  });
  check('filtering by Java shows only Java', filteredJava.cards===4 && filteredJava.badges.length===1 && filteredJava.badges[0]==='JAVA', JSON.stringify(filteredJava));

  // A1602: Phaser 3 and Arcade Game Maker sets
  const pm = await page.evaluate(()=>{
    filterCat('all'); document.getElementById('langSel').value='phaser'; filterLang();
    const ph={cards:document.querySelectorAll('.snippet-card').length,badges:[...new Set([...document.querySelectorAll('.lang-badge')].map(b=>b.textContent))],ids:SNIPPETS.filter(s=>s.lang==='phaser').map(s=>s.id)};
    document.getElementById('langSel').value='maker'; filterLang();
    const mk={cards:document.querySelectorAll('.snippet-card').length,badges:[...new Set([...document.querySelectorAll('.lang-badge')].map(b=>b.textContent))],ids:SNIPPETS.filter(s=>s.lang==='maker').map(s=>s.id)};
    return {ph,mk,code:adaptedCode['maker-move']||''};
  });
  check('Phaser 3 set renders with the core snippets and a PHASER badge', pm.ph.cards>=4 && ['phaser-move','phaser-collide','phaser-score','phaser-save'].every(id=>pm.ph.ids.includes(id)) && pm.ph.badges.length===1 && pm.ph.badges[0]==='PHASER', JSON.stringify(pm.ph));
  check('Game Maker set renders (4 snippets, Maker badge)', pm.mk.cards===4 && pm.mk.badges.length===1 && pm.mk.badges[0]==='MAKER' && pm.mk.ids.includes('maker-move'), JSON.stringify(pm.mk));
  check('Game Maker snippet uses the maker API (onUpdate + globals)', /onUpdate\(scene\)/.test(pm.code) && /liveConfig/.test(pm.code), pm.code.split('\n')[1]||'');
  await page.evaluate(()=>{ document.getElementById('langSel').value='all'; filterLang(); });

  // A2774: offline check, the page uses its own tokenizer and loads nothing from a CDN
  const offline = await browser.newPage();
  const offlineErrors = [];
  offline.on('pageerror', e => offlineErrors.push('pageerror: ' + e.message));
  offline.on('console', m => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/ERR_NETWORK_ACCESS_DENIED|Failed to load resource|net::ERR|ERR_FAILED/i.test(text)) return;
    offlineErrors.push('console: ' + text);
  });
  await offline.setRequestInterception(true);
  offline.on('request', req => {
    const u = req.url();
    if (u.startsWith('http://127.0.0.1') || u.startsWith('http://localhost') || u.startsWith('data:') || u.startsWith('blob:')) req.continue();
    else req.abort();
  });
  await offline.setViewport({ width: 1280, height: 900 });
  await offline.goto('http://127.0.0.1:' + port + '/tools/code-snippet-generator.html', { waitUntil: 'load', timeout: 20000 });
  await new Promise(resolve => setTimeout(resolve, 900));
  const offlineChecks = await offline.evaluate(() => ({
    prismLoaded: typeof window.Prism !== 'undefined',
    prismScripts: Array.from(document.querySelectorAll('script[src]')).filter(s => /prism/i.test(s.getAttribute('src') || '')).length,
    tokens: document.querySelectorAll('code .tok').length,
    lines: document.querySelectorAll('code .code-line').length,
    cdnScript: Array.from(document.querySelectorAll('script[src]')).some(s => /cdnjs|jsdelivr|unpkg/.test(s.getAttribute('src') || '')),
    cdnCss: Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(l => /cdnjs|jsdelivr|unpkg/.test(l.getAttribute('href') || '')),
    timerBug: /clearInterval\(this\)/.test(document.body.innerHTML),
    timerFixed: /clearInterval\(countdown\)/.test(document.body.innerHTML)
  }));
  check('offline: no Prism scripts load', !offlineChecks.prismLoaded && offlineChecks.prismScripts === 0, 'loaded=' + offlineChecks.prismLoaded + ' scripts=' + offlineChecks.prismScripts);
  check('offline: code is highlighted with the network off', offlineChecks.tokens > 0, String(offlineChecks.tokens));
  check('offline: code is split into explainable lines', offlineChecks.lines > 0, String(offlineChecks.lines));
  check('offline: no CDN script or stylesheet tags remain', !offlineChecks.cdnScript && !offlineChecks.cdnCss, 'script=' + offlineChecks.cdnScript + ' css=' + offlineChecks.cdnCss);
  check('offline: timer snippet clears a real interval handle', !offlineChecks.timerBug && offlineChecks.timerFixed);
  check('offline: zero runtime errors', offlineErrors.length === 0, offlineErrors.join(' | '));
  await offline.close();

  // A832: workshop links
  const learn = await page.evaluate(()=>{
    filterCat('all');
    document.getElementById('langSel').value='all'; filterLang();
    const links=[...document.querySelectorAll('.snippet-learn a.learn-link')];
    const cards=document.querySelectorAll('.snippet-card').length;
    return {links:links.length, cards, hrefs:[...new Set(links.map(a=>a.getAttribute('href')))]};
  });
  check('every snippet has a workshop link', learn.links===learn.cards && learn.links>=50, JSON.stringify({links:learn.links,cards:learn.cards}));
  const missing = learn.hrefs.filter(h=>!fs.existsSync(path.join(root, h.replace(/^\//,''))));
  check('workshop links point to real pages', missing.length===0, JSON.stringify(missing));

  // A2768: sliders with live values
  const slider = await page.evaluate(()=>{
    filterCat('all');
    const input=document.querySelector('input[data-sid="cs-move"][data-key="speed"]');
    return {type:input?input.type:'', out:(document.querySelector('output[data-out="opt-cs-move-speed"]')||{}).textContent||''};
  });
  check('numeric options use sliders with live values', slider.type==='range' && slider.out.trim()!=='', JSON.stringify(slider));

  // A2767: Echo line explainer
  await new Promise(resolve=>setTimeout(resolve, 400));
  await page.evaluate(()=>{
    const line=document.querySelector('[data-sid="cs-move"] .code-line');
    if(line) line.click();
  });
  const explainer = await page.evaluate(()=>{
    const tip=document.getElementById('csgExplainTip');
    return {open:!!tip && getComputedStyle(tip).display!=='none', text:tip?tip.textContent:''};
  });
  check('Echo explains a line in plain English', explainer.open && /Echo|Ember/i.test(explainer.text) && explainer.text.length>30, explainer.text.slice(0,70));
  await page.keyboard.press('Escape');
  const closed = await page.evaluate(()=>{ const tip=document.getElementById('csgExplainTip'); return !tip || getComputedStyle(tip).display==='none'; });
  check('the line explainer closes on Escape', closed);

  // A2769: calm studio syntax theme
  const themeColour = await page.evaluate(()=>{
    const fn=document.querySelector('.tok-fn');
    return fn?getComputedStyle(fn).color:'';
  });
  check('studio syntax theme colours functions teal', themeColour==='rgb(112, 163, 167)', themeColour);

  // A2770: canvas image export
  const canvasCheck = await page.evaluate(()=>{
    const c=csgBuildCanvas('cs-move');
    if(!c) return null;
    return {w:c.width,h:c.height,bytes:c.toDataURL('image/png').length};
  });
  check('canvas export renders a shareable image', !!canvasCheck && canvasCheck.w>600 && canvasCheck.h>200 && canvasCheck.bytes>5000, JSON.stringify(canvasCheck));

  // A2771: send to the Game Planner
  const boardCheck = await page.evaluate(()=>{
    localStorage.removeItem('qb-data-v1');
    const ok=csgSendToBoard('cs-move');
    const data=JSON.parse(localStorage.getItem('qb-data-v1')||'null');
    const card=data&&data.cards&&data.cards[0];
    return {ok:!!ok,cards:data&&data.cards?data.cards.length:0,markdown:!!card&&/```/.test(card.desc),col:card?card.colId:''};
  });
  check('Send to Dev Board adds a markdown task', boardCheck.ok && boardCheck.cards===1 && boardCheck.markdown && boardCheck.col==='todo', JSON.stringify(boardCheck));

  // A2772: IndexedDB starter libraries
  await new Promise(resolve=>setTimeout(resolve, 700));
  const starterCheck = await page.evaluate(()=>({
    count:SNIPPETS.filter(s=>String(s.id).indexOf('starter-')===0).length,
    godot:SNIPPETS.some(s=>s.id==='starter-godot-controller'),
    phaser:SNIPPETS.some(s=>s.id==='starter-phaser-scene'),
    python:SNIPPETS.some(s=>s.id==='starter-python-adventure')
  }));
  check('starter libraries load and merge', starterCheck.count>=6 && starterCheck.godot && starterCheck.phaser && starterCheck.python, JSON.stringify(starterCheck));

  // A2776: Web Worker offload for large scripts
  const workerCheck = await page.evaluate(async ()=>{
    const big=Array.from({length:500},(_,i)=>'const value'+i+' = '+i+';').join('\n');
    const result=await csgHighlight(big,'js');
    return {lines:result.lines.length, transport:csgHighlightTransport()};
  });
  check('large scripts parse in a Web Worker', workerCheck.lines===500 && workerCheck.transport==='worker', JSON.stringify(workerCheck));

  // A2773: skill tree activity message shape
  const activity = await page.evaluate(()=>csgActivityMessage('copy','cs-move'));
  check('activity messages carry snippet id and language', !!activity && activity.type==='jvds:activity' && activity.snippetId==='cs-move' && activity.lang==='csharp', JSON.stringify(activity));

  // A2775: the service worker precaches the snippet engine
  const swCache = fs.readFileSync(path.join(root,'sw.js'),'utf8');
  check('service worker precaches the snippet engine', /csg-tokenizer\.js/.test(swCache) && /csg-worker\.js/.test(swCache) && /code-snippet-generator\.html/.test(swCache));

  check('zero runtime errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  server.close();
  if(failures){console.log('\n' + failures + ' FAILURE(S)');process.exit(1);}
  console.log('\nALL CODE SNIPPET GENERATOR CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
