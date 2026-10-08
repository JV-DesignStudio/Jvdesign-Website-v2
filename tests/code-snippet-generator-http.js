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
    return {opts, java:has('java'), cpp:has('cpp'), gml:has('gml'), defold:has('defold'), godotcs:has('godotcs'), total:SNIPPETS.length};
  });
  check('language filter lists the new languages', ['java','cpp','gml','defold','godotcs'].every(l=>langs.opts.includes(l)), JSON.stringify(langs.opts));
  check('each new language has movement/collision/score/save', langs.java&&langs.cpp&&langs.gml&&langs.defold&&langs.godotcs, JSON.stringify(langs));
  const filteredJava = await page.evaluate(()=>{
    filterCat('all');
    document.getElementById('langSel').value='java'; filterLang();
    return {cards:document.querySelectorAll('.snippet-card').length, badges:[...new Set([...document.querySelectorAll('.lang-badge')].map(b=>b.textContent))]};
  });
  check('filtering by Java shows only Java', filteredJava.cards===4 && filteredJava.badges.length===1 && filteredJava.badges[0]==='JAVA', JSON.stringify(filteredJava));

  // A831: offline check, Prism is self-hosted and the timer snippet is correct
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
  const offlinePrism = await offline.evaluate(() => ({
    prismLoaded: typeof window.Prism !== 'undefined',
    tokens: document.querySelectorAll('code[class*="language-"] .token').length,
    langs: ['lua', 'python', 'csharp', 'java', 'cpp', 'javascript'].filter(l => window.Prism && window.Prism.languages[l]),
    cdnScript: Array.from(document.querySelectorAll('script[src]')).some(s => /cdnjs|jsdelivr|unpkg/.test(s.getAttribute('src') || '')),
    cdnCss: Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(l => /cdnjs|jsdelivr|unpkg/.test(l.getAttribute('href') || '')),
    timerBug: /clearInterval\(this\)/.test(document.body.innerHTML),
    timerFixed: /clearInterval\(countdown\)/.test(document.body.innerHTML)
  }));
  check('offline: self-hosted Prism loads', offlinePrism.prismLoaded);
  check('offline: code is highlighted with the network off', offlinePrism.tokens > 0, String(offlinePrism.tokens));
  check('offline: grammars available (lua/python/csharp/java/cpp)', offlinePrism.langs.length >= 5, offlinePrism.langs.join(','));
  check('offline: no CDN script or stylesheet tags remain', !offlinePrism.cdnScript && !offlinePrism.cdnCss, 'script=' + offlinePrism.cdnScript + ' css=' + offlinePrism.cdnCss);
  check('offline: timer snippet clears a real interval handle', !offlinePrism.timerBug && offlinePrism.timerFixed);
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

  check('zero runtime errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  server.close();
  if(failures){console.log('\n' + failures + ' FAILURE(S)');process.exit(1);}
  console.log('\nALL CODE SNIPPET GENERATOR CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
