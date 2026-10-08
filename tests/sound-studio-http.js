const fs = require('fs');
const http = require('http');
const path = require('path');
const puppeteer = require('puppeteer');

const root = path.join(__dirname, '..');
const port = 19248;
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
  await page.goto(`http://127.0.0.1:${port}/tools/sound-studio.html`, {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(resolve=>setTimeout(resolve, 1000));
  const initial = await page.evaluate(()=>({
    title: document.title,
    skipLinks: document.querySelectorAll('.skip-link').length,
    main: !!document.getElementById('main-content'),
    play: document.getElementById('playBtn')?.textContent.trim(),
    transport: document.getElementById('transport')?.innerText || '',
    welcome: document.querySelector('#start-modal .ss-title')?.textContent || '',
    tracks: document.querySelectorAll('.seq-track-row').length,
    cells: document.querySelectorAll('.step-cell').length,
    exportFn: typeof window.exportWAV === 'function',
    gameMakerFn: typeof window.sendToGameMaker === 'function',
    shareFn: typeof window.copySoundShareLink === 'function',
    sfxSendFn: typeof window.sendSfxToGameMaker === 'function',
    modes: document.querySelectorAll('.ss-mode').length,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    badText: /⭐\?|\? Play|\? Help|\? Workshop|\? WAV|\? Back|\? Project|\? Stop|\? Undo|\? Redo|\?\?/.test(document.body.innerText)
  }));
  check('title loads', initial.title.includes('Audio Studio'), initial.title);
  check('single skip link', initial.skipLinks === 1, String(initial.skipLinks));
  check('main target exists', initial.main);
  check('play label clean', initial.play === '▶ Play', initial.play);
  check('transport labels clean', !/[?] Play|[?] WAV|[?] Back|[?] Project/.test(initial.transport), initial.transport.slice(0,120));
  check('welcome title clean', initial.welcome === '🎛️ Welcome to Audio Studio', initial.welcome);
  check('tracks render', initial.tracks >= 1, String(initial.tracks));
  check('sequencer cells render', initial.cells >= 8, String(initial.cells));
  check('export and handoff functions exist', initial.exportFn && initial.gameMakerFn && initial.shareFn && initial.sfxSendFn);
  check('mode switcher renders', initial.modes === 3, String(initial.modes));
  check('mobile does not overflow viewport', initial.scrollWidth <= initial.clientWidth + 2, `${initial.scrollWidth}/${initial.clientWidth}`);
  check('no known broken placeholder text', !initial.badText);
  await page.evaluate(() => closeStart());
  await page.click('#playBtn');
  await new Promise(resolve=>setTimeout(resolve, 400));
  const playing = await page.evaluate(()=>document.getElementById('playBtn')?.textContent.trim());
  check('play toggles to stop', playing === '■ Stop', playing);
  await page.click('#playBtn');
  const stopped = await page.evaluate(()=>document.getElementById('playBtn')?.textContent.trim());
  check('stop toggles back to play', stopped === '▶ Play', stopped);

  // Music / Drums / SFX modes
  await page.evaluate(()=>setMode('drums'));
  await new Promise(resolve=>setTimeout(resolve, 150));
  const drums = await page.evaluate(()=>({
    body: document.body.className,
    kit: getComputedStyle(document.getElementById('drum-kit')).display,
    melodyRows: Array.from(document.querySelectorAll('.seq-track-row')).filter(r=>r.dataset.drum==='none'&&getComputedStyle(r).display!=='none').length,
    pads: document.querySelectorAll('#drum-kit .dk-pad').length
  }));
  check('drums mode active', /\bmode-drums\b/.test(drums.body), drums.body);
  check('drum kit strip visible', drums.kit !== 'none', drums.kit);
  check('melody rows hidden in drums mode', drums.melodyRows === 0, String(drums.melodyRows));
  check('drum pads render', drums.pads >= 4, String(drums.pads));

  await page.evaluate(()=>setMode('sfx'));
  await new Promise(resolve=>setTimeout(resolve, 150));
  const sfxMode = await page.evaluate(()=>({
    body: document.body.className,
    app: getComputedStyle(document.getElementById('app')).display,
    shelf: getComputedStyle(document.getElementById('sfxBody')).display,
    sounds: document.querySelectorAll('#sfxBody .sfx-vbtn').length
  }));
  check('sfx mode active', /\bmode-sfx\b/.test(sfxMode.body), sfxMode.body);
  check('sequencer hidden in sfx mode', sfxMode.app === 'none', sfxMode.app);
  check('sfx lab visible in sfx mode', sfxMode.shelf !== 'none', sfxMode.shelf);
  check('sfx sounds render', sfxMode.sounds >= 12, String(sfxMode.sounds));

  // Deep link applies the matching mode on load
  await page.goto(`http://127.0.0.1:${port}/tools/sound-studio.html?deeplink=1#drums`, {waitUntil:'domcontentloaded'});
  await new Promise(resolve=>setTimeout(resolve, 500));
  const deepLink = await page.evaluate(()=>document.body.className);
  check('deep link #drums applies drums mode', /\bmode-drums\b/.test(deepLink), deepLink);

  // A817: share link encodes the song, My Songs library
  const share = await page.evaluate(()=>{
    window.prompt=()=>{};
    try{ Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.resolve()},configurable:true}); }catch(e){}
    const b64=window.b64encode(window.songData());
    const dec=window.b64decode(b64);
    return {hashLen:b64.length, bpm:dec.bpm, tracks:dec.tracks.length};
  });
  check('share payload round-trips', share.tracks>=1 && share.bpm>0 && share.hashLen>20, JSON.stringify(share));
  await page.evaluate(()=>{ window.copySoundShareLink(); });
  const shareHash = await page.evaluate(()=>location.hash.slice(0,6));
  check('share link stores song in hash', shareHash==='#song=', shareHash);
  const lib = await page.evaluate(async()=>{
    document.getElementById('projName').value='Unit Test Song';
    await window.saveToLibrary();
    const list=await window.libAll();
    return {count:list.length, name:list[0]&&list[0].name};
  });
  check('My Songs library saves a named song', lib.count>=1 && lib.name==='Unit Test Song', JSON.stringify(lib));

  // A818: waveform canvas + per-track meters
  const viz = await page.evaluate(()=>{
    const c=document.getElementById('viz-canvas');
    return {has:!!c, w:c?c.width:0, h:c?c.height:0, meters:document.querySelectorAll('.sst-meter i').length, tracks:document.querySelectorAll('.seq-track-row').length};
  });
  check('waveform canvas present', viz.has && viz.w>0 && viz.h>0, JSON.stringify(viz));
  check('per-track meters render', viz.meters === viz.tracks && viz.meters>=1, JSON.stringify(viz));
  await page.evaluate(()=>{ try{closeStart&&closeStart();}catch(e){} document.querySelectorAll('.ss-overlay').forEach(o=>o.style.display='none'); togglePlay(); });
  await new Promise(resolve=>setTimeout(resolve, 700));
  const live = await page.evaluate(()=>({playing:isPlaying, level:trackLevel.reduce((a,b)=>Math.max(a,b||0),0)}));
  check('meters respond during playback', live.playing && live.level>0, JSON.stringify(live));
  await page.evaluate(()=>{ stopAll(); });

  // A819: patterns + arrangement
  const pat = await page.evaluate(()=>{
    const before=patterns.length;
    addPattern();
    const bIdx=currentPattern;
    patterns[bIdx].grid[0][1].on=true;
    switchPattern(0);
    const aHas=grid[0][1].on;
    const bHas=patterns[bIdx].grid[0][1].on;
    return {before, after:patterns.length, aHas, bHas, tabs:document.querySelectorAll('#patternTabs .ab-tab').length};
  });
  check('add pattern creates an independent pattern', pat.after===pat.before+1 && pat.aHas===false && pat.bHas===true && pat.tabs===pat.after, JSON.stringify(pat));
  const songList = await page.evaluate(()=>{
    songMode=true; document.body.classList.add('song-mode'); song=[{p:0,rep:2},{p:1,rep:1}];
    const list=buildPlayback();
    return {len:list.length, first:list[0]&&list[0].p, at32:list[32]&&list[32].p};
  });
  check('song arrangement chains sections', songList.len===48 && songList.first===0 && songList.at32===1, JSON.stringify(songList));
  const rendered = await page.evaluate(async()=>{ const b=await window.renderMixdown(); return {len:b.length, sr:b.sampleRate}; });
  check('song export renders the full arrangement', rendered.len>300000 && rendered.len<420000, JSON.stringify(rendered));
  await page.evaluate(()=>{ songMode=false; document.body.classList.remove('song-mode'); song=[{p:0,rep:1}]; });

  check('zero runtime errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  server.close();
  if(failures){console.log(`\n${failures} FAILURE(S)`);process.exit(1);}
  console.log('\nALL SOUND STUDIO CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
