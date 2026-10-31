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
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--autoplay-policy=no-user-gesture-required']});
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
  const mobileChrome = await page.evaluate(()=>{
    const title=document.querySelector('.sfx-shelf-title');
    const shelfBar=document.querySelector('.sfx-shelf-bar');
    const hint=document.getElementById('modeHint');
    const modes=document.querySelector('.ss-modes');
    const tr=document.getElementById('transport');
    const trBox=tr?tr.getBoundingClientRect():null;
    const items=tr?[...tr.children].filter(el=>el.getBoundingClientRect().width>0):[];
    return {
      titleW: title?Math.round(title.getBoundingClientRect().width):0,
      shelfH: shelfBar?Math.round(shelfBar.getBoundingClientRect().height):0,
      modesOverflow: modes?Math.max(0,modes.scrollWidth-modes.clientWidth):0,
      hintBottom: hint?Math.round(hint.getBoundingClientRect().bottom):0,
      modesBottom: modes?Math.round(modes.getBoundingClientRect().bottom):0,
      trOverflow: tr?Math.max(0,tr.scrollWidth-tr.clientWidth):0,
      trBottom: trBox?Math.round(trBox.bottom):0,
      maxItemRight: items.length?Math.round(Math.max(...items.map(el=>el.getBoundingClientRect().right))):0,
      vw: document.documentElement.clientWidth
    };
  });
  check('mobile shelf header not crushed', mobileChrome.titleW>=120 && mobileChrome.shelfH<=64, JSON.stringify(mobileChrome));
  check('mobile mode hint wraps inside the mode bar', mobileChrome.modesOverflow<=1 && mobileChrome.hintBottom<=mobileChrome.modesBottom+1, JSON.stringify(mobileChrome));
  const trNav = await page.evaluate(()=>{
    const tr=document.getElementById('transport');
    const l=document.querySelector('.tr-nav-l'), r=document.querySelector('.tr-nav-r');
    const before=tr.scrollLeft;
    if(window.scrollTransport) window.scrollTransport(1);
    return {left:!!l,right:!!r,before,overflow:tr.scrollWidth-tr.clientWidth,
      rightBtnRight:r?Math.round(r.getBoundingClientRect().right):0,
      vw:document.documentElement.clientWidth};
  });
  await new Promise(resolve=>setTimeout(resolve, 450));
  const trScrolled = await page.evaluate(()=>document.getElementById('transport').scrollLeft);
  check('mobile transport has scroll controls', trNav.left && trNav.right && trNav.overflow>0 && trScrolled>trNav.before, JSON.stringify({...trNav,after:trScrolled}));
  check('mobile transport right control stays on screen', trNav.rightBtnRight>0 && trNav.rightBtnRight<=trNav.vw+1, JSON.stringify(trNav));
  await page.evaluate(()=>{ const tr=document.getElementById('transport'); tr.style.scrollBehavior='auto'; tr.scrollLeft=0; tr.style.scrollBehavior=''; });
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

  // A820: piano roll, add / resize / velocity / move
  const pr = await page.evaluate(()=>{
    selectTrack(4);
    openPianoRoll();
    const canvas=document.getElementById('piano-canvas');
    const r=canvas.getBoundingClientRect();
    const fire=(type,x,y)=>canvas.dispatchEvent(new PointerEvent(type,{clientX:r.left+x,clientY:r.top+y,bubbles:true,pointerId:1,buttons:1}));
    fire('pointerdown',1*26+5,11*16+8);
    fire('pointerup',1*26+5,11*16+8);
    const added={on:grid[4][1].on, note:grid[4][1].note, len:grid[4][1].len};
    fire('pointerdown',2*26-3,11*16+8);
    fire('pointermove',5*26,11*16+8);
    fire('pointerup',5*26,11*16+8);
    const resized=grid[4][1].len;
    const v=document.getElementById('pianoVel'); v.value=40; v.dispatchEvent(new Event('input'));
    const vel=grid[4][1].vel;
    fire('pointerdown',1*26+5,11*16+8);
    fire('pointermove',9*26+5,11*16+8);
    fire('pointerup',9*26+5,11*16+8);
    const moved={old:grid[4][1].on, at:grid[4][9].on};
    closePianoRoll();
    return {has:!!canvas, w:canvas.width, h:canvas.height, added, resized, vel, moved};
  });
  check('piano roll canvas opens', pr.has && pr.w>0 && pr.h>0, JSON.stringify({w:pr.w,h:pr.h}));
  check('piano roll adds a note', pr.added.on && pr.added.note==='C' && pr.added.len===1, JSON.stringify(pr.added));
  check('piano roll resizes note length', pr.resized>=3, String(pr.resized));
  check('piano roll sets velocity', Math.abs(pr.vel-40/127)<0.02, String(pr.vel));
  check('piano roll moves a note', pr.moved.old===false && pr.moved.at===true, JSON.stringify(pr.moved));

  // A822: SFX lab
  const lab = await page.evaluate(async()=>{
    const btns=document.querySelectorAll('#sfxRecipeBtns .sfx-vbtn').length;
    const cats=document.querySelectorAll('#sfxCatRows .sfx-cat-row').length;
    document.getElementById('sfxPitch').value=0.5;
    const b1=await labRender(0,_labParams());
    document.getElementById('sfxPitch').value=2;
    const b2=await labRender(0,_labParams());
    const sum=b=>{ const d=b.getChannelData(0); let s=0; for(let i=0;i<d.length;i+=97) s+=Math.abs(d[i]); return s; };
    const s1=sum(b1), s2=sum(b2);
    return {btns, cats, len:b1.length, differs:Math.abs(s1-s2)>1e-4};
  });
  check('SFX lab renders and responds to controls', lab.btns>=6 && lab.cats>=6 && lab.len>1000 && lab.differs, JSON.stringify(lab));
  const labPrev = await page.evaluate(async()=>{ labPreview(); await new Promise(r=>setTimeout(r,300)); return {buf:!!sfxLastBuf, name:sfxLastName}; });
  check('SFX lab preview stores a sound', labPrev.buf && !!labPrev.name, JSON.stringify(labPrev));
  const labRnd = await page.evaluate(()=>{
    const ids=['sfxPitch','sfxLen','sfxTone','sfxShape'];
    const before=ids.map(i=>document.getElementById(i).value);
    labRandomise();
    const after=ids.map(i=>document.getElementById(i).value);
    return {changed:after.some((v,i)=>v!==before[i])};
  });
  check('SFX lab randomise changes controls', labRnd.changed, JSON.stringify(labRnd));

  // A1589: inline on* handlers removed - mute + volume must work through delegated data-on under the real CSP
  for(const vp of [{width:390,height:844,isMobile:true},{width:1440,height:900,isMobile:false}]){
    await page.setViewport(vp);
    await new Promise(resolve=>setTimeout(resolve, 150));
    const label = vp.width+'px';
    const mute = await page.evaluate(()=>{
      try{closeStart&&closeStart();}catch(e){}
      document.querySelectorAll('.ss-overlay').forEach(o=>o.style.display='none');
      const btn=document.querySelector('.track-mute');
      const before=tracks[0].muted;
      btn.click();
      return {before, after:tracks[0].muted, aria:btn.getAttribute('aria-pressed')};
    });
    check('mute toggles via delegation at '+label, mute.after===!mute.before && String(mute.aria)===String(mute.after), JSON.stringify(mute));
    const vol = await page.evaluate(()=>{
      const inp=document.querySelector('.track-vol');
      inp.value='0.42';
      inp.dispatchEvent(new Event('input',{bubbles:true}));
      return {vol:tracks[0].vol};
    });
    check('volume updates via delegation at '+label, Math.abs(vol.vol-0.42)<0.001, JSON.stringify(vol));
  }

  // A1590: exact-length loop WAV + OGG exports (engine-friendly, no libraries)
  for(const vp of [{width:390,height:844,isMobile:true},{width:1440,height:900,isMobile:false}]){
    await page.setViewport(vp);
    await new Promise(resolve=>setTimeout(resolve, 100));
    const ctl = await page.evaluate(()=>{
      try{ openProject(); }catch(e){}
      const vis = el => !!(el && el.offsetParent !== null);
      return { loop: vis(document.querySelector('[data-on="exportLoopWAV"]')), ogg: vis(document.querySelector('[data-on="exportOGG"]')) };
    });
    check('loop + OGG export controls visible at '+vp.width+'px', ctl.loop && ctl.ogg, JSON.stringify(ctl));
  }
  await page.evaluate(()=>{ try{ closeProject(); }catch(e){} });

  const audioExports = await page.evaluate(async ()=>{
    const out = {};
    try {
      const sr = 44100;
      document.getElementById('loopsSelect').value = '1';
      const full = await renderMixdown(false);
      const trim = await renderMixdown(true);
      out.fullLen = full.length; out.loopLen = trim.length;
      out.tail = full.length - trim.length; out.expectedTail = 2 * sr;
      const realCreate = URL.createObjectURL, realRevoke = URL.revokeObjectURL, realClick = HTMLAnchorElement.prototype.click;
      const caps = [];
      URL.createObjectURL = (b)=>{ caps.push(b); return 'blob:test'; };
      URL.revokeObjectURL = ()=>{};
      HTMLAnchorElement.prototype.click = function(){};
      try {
        await exportLoopWAV();
        out.loopType = caps[0] && caps[0].type; out.loopSize = caps[0] && caps[0].size;
        out.oggSupported = _oggSupported();
        const before = caps.length;
        out.oggRes = await exportOGG();
        out.oggCaptured = caps.length > before;
        out.oggType = caps[before] && caps[before].type; out.oggSize = caps[before] && caps[before].size;
      } finally {
        URL.createObjectURL = realCreate; URL.revokeObjectURL = realRevoke; HTMLAnchorElement.prototype.click = realClick;
      }
    } catch(e){ out.error = e.message; }
    return out;
  });
  check('loop render trims the 2s tail', audioExports.loopLen > 0 && Math.abs(audioExports.tail - audioExports.expectedTail) <= 8, JSON.stringify({full:audioExports.fullLen,loop:audioExports.loopLen,tail:audioExports.tail}));
  check('Loop WAV export downloads a wav', audioExports.loopType === 'audio/wav' && audioExports.loopSize > 44, JSON.stringify({type:audioExports.loopType,size:audioExports.loopSize}));
  check('OGG export produces a file (or falls back to loop WAV)', audioExports.oggSupported ? (audioExports.oggCaptured && /ogg/.test(audioExports.oggType||'') && audioExports.oggSize > 0) : (audioExports.oggCaptured && audioExports.oggType === 'audio/wav'), JSON.stringify({supported:audioExports.oggSupported,type:audioExports.oggType,size:audioExports.oggSize,fallback:!audioExports.oggSupported,err:audioExports.error}));

  // A2103: sound kit export (song loop + every SFX + manifest in one zip)
  const kit = await page.evaluate(async()=>{
    const out={};
    const hasNeedle=(bytes,n)=>{ outer: for(let i=0;i<=bytes.length-n.length;i++){ for(let j=0;j<n.length;j++){ if(bytes[i+j]!==n[j]) continue outer; } return true; } return false; };
    try{
      const built=await buildSoundKit();
      out.sounds=built.manifest.sounds.length;
      out.builtins=SFX_CATS.reduce((n,c)=>n+c.sounds.length,0);
      out.extra=built.manifest.sounds.filter(s=>s.source!=='builtin').length;
      out.expected=out.builtins+out.extra;
      out.categories=[...new Set(built.manifest.sounds.map(s=>s.category))].length;
      out.hasSong=!!built.manifest.song&&/\.wav$/.test(built.manifest.song.file);
      out.songDuration=built.manifest.song&&built.manifest.song.duration;
      out.hasManifestFile=built.files.some(f=>f.name==='sounds.json');
      out.zipSize=built.zip.size;
      out.zipType=built.zip.type;
      const bytes=new Uint8Array(await built.zip.arrayBuffer());
      out.sig=Array.from(bytes.slice(0,4));
      out.hasManifestName=hasNeedle(bytes,new TextEncoder().encode('sounds.json'));
      out.hasSfxName=hasNeedle(bytes,new TextEncoder().encode('sfx/'));
      out.hasWav=hasNeedle(bytes,new TextEncoder().encode('RIFF'));
    }catch(e){ out.error=e.message; }
    return out;
  });
  check('sound kit covers every SFX and the song', !kit.error && kit.sounds===kit.expected && kit.categories>=6 && kit.hasSong && kit.songDuration>0, JSON.stringify({sounds:kit.sounds,expected:kit.expected,cats:kit.categories,song:kit.hasSong,dur:kit.songDuration,err:kit.error}));
  check('sound kit zip is valid and carries the manifest', kit.sig && kit.sig[0]===0x50 && kit.sig[1]===0x4B && kit.zipType==='application/zip' && kit.zipSize>1000 && kit.hasManifestFile && kit.hasManifestName && kit.hasSfxName && kit.hasWav, JSON.stringify({sig:kit.sig,size:kit.zipSize,type:kit.zipType,manifest:kit.hasManifestFile,name:kit.hasManifestName,sfx:kit.hasSfxName,wav:kit.hasWav}));

  // A2104: load your own audio + record a take
  const myAudio = await page.evaluate(async()=>{
    const out={};
    try{
      const off=new OfflineAudioContext(1,4410,44100);
      const o=off.createOscillator(); const g=off.createGain(); g.gain.value=0.2;
      o.connect(g); g.connect(off.destination); o.start(0); o.stop(0.1);
      const buf=await off.startRendering();
      const file=new File([bufferToWav(buf)],'unit_tone.wav',{type:'audio/wav'});
      const before=mySamples.length;
      await loadSfxFile(file);
      out.loadedBuf=!!sfxLastBuf && sfxLastName==='unit_tone';
      out.sampleAdded=mySamples.length===before+1;
      out.buttons=document.querySelectorAll('#mySampleBtns .sfx-vbtn').length;
      out.dlEnabled=!document.getElementById('sfxDlBtn').disabled;
      out.sendEnabled=!document.getElementById('sfxSendBtn').disabled;
      out.status=document.getElementById('mySfxStatus').textContent;
    }catch(e){ out.error=e.message; }
    return out;
  });
  check('load your own audio becomes a usable sound', !myAudio.error && myAudio.loadedBuf && myAudio.sampleAdded && myAudio.buttons>=1 && myAudio.dlEnabled && myAudio.sendEnabled, JSON.stringify(myAudio));

  const userKit = await page.evaluate(async()=>{
    const out={};
    const hasNeedle=(bytes,n)=>{ outer: for(let i=0;i<=bytes.length-n.length;i++){ for(let j=0;j<n.length;j++){ if(bytes[i+j]!==n[j]) continue outer; } return true; } return false; };
    try{
      const built=await buildSoundKit(null,{builtins:false});
      out.builtins=built.manifest.sounds.filter(s=>s.source==='builtin').length;
      const user=built.manifest.sounds.find(s=>s.source==='user'&&/unit_tone/i.test(s.name));
      const lab=built.manifest.sounds.find(s=>s.source==='lab');
      out.user=user?user.file:'';
      out.lab=lab?lab.file:'';
      out.hasUserFile=!!(user&&built.files.some(f=>f.name===user.file));
      out.hasLabFile=!!(lab&&built.files.some(f=>f.name===lab.file));
      out.hasSong=built.files.some(f=>/_loop\.wav$/.test(f.name));
      const bytes=new Uint8Array(await built.zip.arrayBuffer());
      out.zipHasUser=hasNeedle(bytes,new TextEncoder().encode('my/'));
      out.zipHasLab=hasNeedle(bytes,new TextEncoder().encode('lab/'));
    }catch(e){ out.error=e.message; }
    return out;
  });
  check('sound kit includes My Sounds and the Sound Lab sound', !userKit.error && userKit.builtins===0 && /^my\//.test(userKit.user) && /^lab\//.test(userKit.lab) && userKit.hasUserFile && userKit.hasLabFile && userKit.hasSong && userKit.zipHasUser && userKit.zipHasLab, JSON.stringify(userKit));

  const micDenied = await page.evaluate(async()=>{
    const out={};
    const orig=Object.getOwnPropertyDescriptor(navigator,'mediaDevices');
    if(typeof MediaRecorder==='undefined'){ window.MediaRecorder=function(){}; window.MediaRecorder.isTypeSupported=()=>false; }
    try{
      Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:()=>Promise.reject(Object.assign(new Error('blocked'),{name:'NotAllowedError'}))}});
      await toggleRecord();
      out.status=document.getElementById('mySfxStatus').textContent;
      out.errClass=document.getElementById('mySfxStatus').classList.contains('err');
      out.recording=document.getElementById('recBtn').classList.contains('recording');
    }catch(e){ out.error=e.message; }
    finally{ try{ if(orig) Object.defineProperty(navigator,'mediaDevices',orig); else delete navigator.mediaDevices; }catch(e){} }
    return out;
  });
  check('blocked microphone shows a readable message', !micDenied.error && /Microphone blocked/.test(micDenied.status||'') && micDenied.errClass && !micDenied.recording, JSON.stringify(micDenied));

  // A2105: swing, sequence length and quantize
  const swingTest = await page.evaluate(async()=>{
    const out={};
    try{
      songMode=false;
      document.body.classList.remove('song-mode');
      document.getElementById('loopsSelect').value='1';
      setSwing(0);
      const base=await renderMixdown(true);
      out.zero=swingOffset(0);
      setSwing(40);
      out.stepSec=(60/bpm)/4;
      out.on=swingOffset(1);
      out.slider=document.getElementById('swingSlider').value;
      out.label=document.getElementById('swingVal').textContent;
      out.model=JSON.parse(snapshotState()).swing;
      const swung=await renderMixdown(true);
      out.baseLen=base.length; out.swungLen=swung.length;
      const a=base.getChannelData(0), b=swung.getChannelData(0);
      let diff=0;
      for(let i=0;i<Math.min(a.length,b.length,40000);i+=37) diff+=Math.abs(a[i]-b[i]);
      out.diff=diff;
      setSwing(0);
    }catch(e){ out.error=e.message; }
    return out;
  });
  check('swing delays odd steps and keeps the loop length', !swingTest.error && swingTest.zero===0 && Math.abs(swingTest.on-swingTest.stepSec*0.4)<1e-6 && swingTest.baseLen===swingTest.swungLen && swingTest.diff>1e-4 && swingTest.slider==='40' && swingTest.label==='40%' && Math.abs(swingTest.model-0.4)<1e-9, JSON.stringify(swingTest));

  const quantTest = await page.evaluate(()=>{
    const out={};
    try{
      setSteps(16);
      openPianoRoll();
      const ti=activeTrack, oct=tracks[ti].oct;
      for(let s=0;s<steps;s++) grid[ti][s]={on:false,note:'C',len:1,vel:1,oct};
      grid[ti][0]={on:true,note:'C',len:3,vel:1,oct};
      quantizePattern();
      out.snapped=grid[ti][0].len;
      const last=steps-1;
      grid[ti][last]={on:true,note:'C',len:8,vel:1,oct};
      quantizePattern();
      out.clamped=grid[ti][last].len;
      closePianoRoll();
    }catch(e){ out.error=e.message; }
    return out;
  });
  check('quantize snaps and clamps note lengths', !quantTest.error && quantTest.snapped===4 && quantTest.clamped===1, JSON.stringify(quantTest));

  const lengthTest = await page.evaluate(async()=>{
    const out={};
    try{
      songMode=false;
      document.body.classList.remove('song-mode');
      document.getElementById('loopsSelect').value='1';
      setSteps(8);
      out.rows=grid.every(r=>r.length===8);
      out.patterns=patterns.every(p=>p.grid.every(r=>r.length===8));
      const buf=await renderMixdown(true);
      out.len=buf.length;
      out.expected=Math.round(8*((60/bpm)/4)*44100);
      setSteps(16);
      out.after=grid.every(r=>r.length===16);
      out.select=document.getElementById('stepsSelect').value;
    }catch(e){ out.error=e.message; }
    return out;
  });
  check('sequence length 8/16/32 resizes the grid and the render', !lengthTest.error && lengthTest.rows && lengthTest.patterns && Math.abs(lengthTest.len-lengthTest.expected)<=8 && lengthTest.after && lengthTest.select==='16', JSON.stringify(lengthTest));

  // A2106: per-track mixer (pan, solo, sends, limiter, normalize)
  const mixSolo = await page.evaluate(async()=>{
    const out={};
    try{
      songMode=false; document.body.classList.remove('song-mode');
      document.getElementById('loopsSelect').value='1';
      document.getElementById('stepsSelect').value='16';
      setSteps(16);
      tracks.forEach(t=>{ t.muted=false; t.solo=false; t.sendReverb=0; t.sendDelay=0; t.pan=0; });
      for(let ti=0;ti<tracks.length;ti++) for(let s=0;s<steps;s++) grid[ti][s]={on:false,note:'C',len:1,vel:1,oct:tracks[ti].oct};
      patterns[currentPattern].grid=grid;
      const ti=4;
      grid[ti][0]={on:true,note:'C',len:1,vel:1,oct:tracks[ti].oct};
      const energy=buf=>{ const d=buf.getChannelData(0); let e=0; for(let i=0;i<d.length;i+=13) e+=d[i]*d[i]; return e; };
      const noSolo=await renderMixdown(true);
      out.e1=energy(noSolo);
      tracks[3].solo=true;
      const solo=await renderMixdown(true);
      out.e2=energy(solo);
      tracks[3].solo=false;
    }catch(e){ out.error=e.message; }
    return out;
  });
  check('solo mutes the other tracks in the mix', !mixSolo.error && mixSolo.e1>0.001 && mixSolo.e2<1e-7, JSON.stringify(mixSolo));

  const mixPanSends = await page.evaluate(async()=>{
    const out={};
    try{
      songMode=false; document.body.classList.remove('song-mode');
      document.getElementById('loopsSelect').value='1';
      const ti=4;
      tracks.forEach(t=>{ t.muted=false; t.solo=false; t.sendReverb=0; t.sendDelay=0; t.pan=0; });
      for(let k=0;k<tracks.length;k++) for(let s=0;s<steps;s++) grid[k][s]={on:false,note:'C',len:1,vel:1,oct:tracks[k].oct};
      patterns[currentPattern].grid=grid;
      grid[ti][0]={on:true,note:'C',len:1,vel:1,oct:tracks[ti].oct};
      const chE=(buf,c)=>{ const d=buf.getChannelData(c); let e=0; for(let i=0;i<d.length;i+=13) e+=d[i]*d[i]; return e; };
      tracks[ti].pan=-1; const L=await renderMixdown(true);
      out.lL=chE(L,0); out.lR=chE(L,1);
      tracks[ti].pan=1; const R=await renderMixdown(true);
      out.rL=chE(R,0); out.rR=chE(R,1);
      tracks[ti].pan=0;
      const tailE=buf=>{ const d=buf.getChannelData(0), sr=44100; let e=0; for(let i=Math.floor(sr*0.5);i<Math.floor(sr*0.9);i+=7) e+=d[i]*d[i]; return e; };
      tracks[ti].sendReverb=0; tracks[ti].sendDelay=0;
      const dry=await renderMixdown(true);
      out.dryTail=tailE(dry);
      tracks[ti].sendReverb=0.9; const wet=await renderMixdown(true);
      out.revTail=tailE(wet);
      tracks[ti].sendReverb=0; tracks[ti].sendDelay=0.9; const echo=await renderMixdown(true);
      out.echoTail=tailE(echo);
      tracks[ti].sendDelay=0;
    }catch(e){ out.error=e.message; }
    return out;
  });
  check('pan moves a track left and right', !mixPanSends.error && mixPanSends.lL>0.001 && mixPanSends.lR<mixPanSends.lL*0.05 && mixPanSends.rR>0.001 && mixPanSends.rL<mixPanSends.rR*0.05, JSON.stringify(mixPanSends));
  check('reverb and echo sends add tail energy', !mixPanSends.error && mixPanSends.revTail>mixPanSends.dryTail*2 && mixPanSends.echoTail>mixPanSends.dryTail*2, JSON.stringify(mixPanSends));

  const mixNorm = await page.evaluate(async()=>{
    const out={};
    try{
      const ti=4;
      tracks.forEach(t=>{ t.muted=false; t.solo=false; t.sendReverb=0; t.sendDelay=0; t.pan=0; });
      tracks[ti].vol=0.2;
      const peak=buf=>{ let p=0; for(let c=0;c<buf.numberOfChannels;c++){ const d=buf.getChannelData(c); for(let i=0;i<d.length;i++){ const a=Math.abs(d[i]); if(a>p)p=a; } } return p; };
      normalizeExport=false; const dry=await renderMixdown(true);
      out.dry=peak(dry);
      normalizeExport=true; const norm=await renderMixdown(true);
      out.norm=peak(norm);
      normalizeExport=false;
      tracks[ti].vol=0.7;
    }catch(e){ out.error=e.message; }
    return out;
  });
  check('normalize lifts export peak near full scale', !mixNorm.error && mixNorm.dry<0.9 && mixNorm.norm>0.95 && mixNorm.norm<=1.0 && mixNorm.norm>mixNorm.dry, JSON.stringify(mixNorm));

  const mixUi = await page.evaluate(()=>{
    const t=tracks[activeTrack];
    t.pan=-0.5; t.solo=true; t.sendReverb=0.4; t.sendDelay=0.2;
    updateInstPanel();
    const out={
      pan:document.getElementById('panVal').textContent,
      solo:document.getElementById('soloBtn').getAttribute('aria-pressed'),
      rev:document.getElementById('sendRevVal').textContent,
      del:document.getElementById('sendDelVal').textContent,
      knob:document.getElementById('panKnob').value
    };
    t.pan=0; t.solo=false; t.sendReverb=0; t.sendDelay=0; updateInstPanel();
    return out;
  });
  check('mixer controls reflect the selected track', mixUi.pan==='L50' && String(mixUi.solo)==='true' && mixUi.rev==='40%' && mixUi.del==='20%' && mixUi.knob==='-50', JSON.stringify(mixUi));

  check('zero runtime errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  server.close();
  if(failures){console.log(`\n${failures} FAILURE(S)`);process.exit(1);}
  console.log('\nALL SOUND STUDIO CHECKS PASSED');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
