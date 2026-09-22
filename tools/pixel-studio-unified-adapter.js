// Unified Pixel Studio adapter - Draw / Character / Animate modes
// Depends on: pixel-studio-unified-characters.js (defines CHARACTER_TEMPLATES, SKIN etc., charCanvasUnified, cctxUnified, charState etc.)
let studioMode='draw';
const EASY_PAL=['#000000','#ffffff','#f59e0b','#ef4444','#10b981','#3b82f6','#a855f7','#ec4899','#facc15','#84cc16','#06b6d4','#f43f5e','#6b7280','#92400e','#1e1b4b','#f5e6d3'];
let easyMode=false;

function setStudioMode(mode){
  // 'simple' is a legacy alias for 'draw'
  if(mode==='simple') mode='draw';
  studioMode=mode;
  document.querySelectorAll('#studioMode [data-mode]').forEach(b=>{
    const on=b.dataset.mode===mode;
    b.setAttribute('aria-selected', on?'true':'false');
    b.style.background=on?'var(--accent)':'transparent';
    b.style.color=on?'#fff':'var(--muted)';
  });
  const strip=document.getElementById('character-strip');
  if(strip) strip.style.display=(mode==='character'?'flex':'none');
  easyMode=false;
  // Advanced disclosure: open in Animate and Character
  const adv=document.getElementById('advancedTools');
  if(adv) adv.open=(mode==='animate' || mode==='character');
  // Show/hide the Character shortcut chip in the left panel
  const chip=document.getElementById('char-chip');
  if(chip) chip.style.display=(mode==='character'?'none':'flex');
  if(mode==='character'){
    initUnifiedCharIfNeeded();
    renderCharacterUnified();
    buildArchetypesUnified();
    buildPartsUnified();
    buildPoseUnified();
    buildStampsTray();
    showToast('Design your character, then tap ⬇ Stamp to Canvas');
  }
  if(mode==='draw'){
    renderAll();
  }
  if(mode==='animate'){
    renderAll();
    showToast('Animate: +Frame to add frames, ▶️ Play to preview');
  }
  localStorage.setItem('jvds_pixel_mode',mode);
  if(window.ToolAnalytics) try{ToolAnalytics.event('studio_mode_'+mode);}catch(e){}
}

// ---- Stamps system ----
const STAMPS_KEY='jvds_char_stamps';
const MAX_STAMPS=8;

function getCharStamps(){
  try{return JSON.parse(localStorage.getItem(STAMPS_KEY)||'[]');}catch(e){return[];}
}

function saveCharStamp(){
  initUnifiedCharIfNeeded();
  const cc=document.getElementById('char-canvas-unified');
  if(!cc){showToast('Open Character mode first');return;}
  const stamps=getCharStamps();
  // thumbnail: 64x64 from 192x192 source
  const tmp=document.createElement('canvas');tmp.width=64;tmp.height=64;
  tmp.getContext('2d').drawImage(cc,0,0,64,64);
  const entry={
    state:JSON.parse(JSON.stringify(typeof charState!=='undefined'?charState:{})),
    template:typeof currentTemplate!=='undefined'?currentTemplate:'humanoid',
    pose:typeof currentPose!=='undefined'?currentPose:'idle',
    thumb:tmp.toDataURL('image/png'),
    ts:Date.now()
  };
  stamps.unshift(entry);
  if(stamps.length>MAX_STAMPS)stamps.length=MAX_STAMPS;
  try{localStorage.setItem(STAMPS_KEY,JSON.stringify(stamps));}catch(e){}
  buildStampsTray();
  if(typeof showToast==='function')showToast('Saved to My Stamps!');
}

function applyCharStamp(i){
  const stamps=getCharStamps();const s=stamps[i];if(!s)return;
  if(typeof charState!=='undefined')window.charState=JSON.parse(JSON.stringify(s.state));
  if(typeof currentTemplate!=='undefined')window.currentTemplate=s.template||'humanoid';
  if(typeof currentPose!=='undefined')window.currentPose=s.pose||'idle';
  renderCharacterUnified();buildArchetypesUnified();buildPartsUnified();buildPoseUnified();
  if(typeof showToast==='function')showToast('Character loaded - tap ⬇ Stamp to Canvas');
}

function buildStampsTray(){
  const stamps=getCharStamps();
  ['stampsTray','stampsTrayMobile'].forEach(id=>{
    const tray=document.getElementById(id);if(!tray)return;
    tray.innerHTML='';
    if(!stamps.length){
      tray.innerHTML='<span style="font-size:.58rem;color:var(--muted);font-style:italic;padding:4px 0;">Design a character then click + Save Stamp</span>';
      return;
    }
    stamps.forEach((s,i)=>{
      const wrap=document.createElement('div');
      wrap.className='stamp-thumb-wrap';
      const img=document.createElement('img');
      img.src=s.thumb;img.title='Load this character (tap Use to stamp it)';
      img.onclick=()=>applyCharStamp(i);
      const btn=document.createElement('button');
      btn.className='stamp-use-btn';btn.textContent='↓ Use';
      btn.onclick=e=>{e.stopPropagation();applyCharStamp(i);setTimeout(stampToCanvasUnified,120);};
      wrap.appendChild(img);wrap.appendChild(btn);tray.appendChild(wrap);
    });
  });
  // also sync the mobile canvas preview
  syncMobileCharCanvas();
}

function syncMobileCharCanvas(){
  const src=document.getElementById('char-canvas-unified');
  const dst=document.getElementById('char-canvas-mobile');
  if(!src||!dst)return;
  dst.getContext('2d').clearRect(0,0,96,96);
  dst.getContext('2d').drawImage(src,0,0,96,96);
}

// --- Character unified wrappers ---
let unifiedReady=false;
function initUnifiedCharIfNeeded(){
  if(unifiedReady) return;
  // charCanvasUnified + cctxUnified are initialized in pixel-studio-unified-characters.js bottom IIFE.
  // Guard: if they somehow aren't set (e.g. canvas missing at load), try again now.
  if(typeof cctxUnified==='undefined' || !cctxUnified){
    const cc=document.getElementById('char-canvas-unified');
    if(!cc) return;
    charCanvasUnified=cc;
    cctxUnified=cc.getContext('2d');
    if(cctxUnified) cctxUnified.imageSmoothingEnabled=false;
  }
  if(typeof charState!=='undefined' && Object.keys(charState).length===0){
    initCharState();
  }
  unifiedReady=true;
}
function renderCharacterUnified(){
  initUnifiedCharIfNeeded();
  if(typeof renderCharacter==='function'){
    try{ renderCharacter(); }catch(e){ console.warn(e); }
  }
  // keep mobile preview in sync
  setTimeout(syncMobileCharCanvas,50);
}
function switchTemplateUnified(id,btn){
  document.querySelectorAll('#character-strip .tpl-btn').forEach(b=>b.classList.remove('on'));
  if(btn) btn.classList.add('on');
  if(typeof currentTemplate!=='undefined') currentTemplate=id;
  if(typeof initCharState==='function') initCharState();
  // after init, need to rebuild unified UI
  renderCharacterUnified();
  buildArchetypesUnified();
  buildPartsUnified();
  buildPoseUnified();
  if(typeof showToast==='function') showToast('Template: '+id);
}
function buildArchetypesUnified(){
  const g=document.getElementById('archetypeGridUnified');
  if(!g || typeof CHARACTER_TEMPLATES==='undefined') return;
  g.innerHTML='';
  const tplFn=()=>CHARACTER_TEMPLATES[currentTemplate];
  const tpl=tplFn();
  if(!tpl) return;
  tpl.arch.forEach(a=>{
    const btn=document.createElement('button');
    btn.className='arch-btn'+(typeof activeArchetype!=='undefined' && activeArchetype===a.id?' on':'');
    btn.innerHTML='<span>'+(a.icon||'')+'</span> '+a.label;
    btn.onclick=()=>{
      activeArchetype=a.id;
      tpl.parts.forEach(part=>{
        const p=a.parts[part.id];
        if(p){ charState[part.id].variant=p.v; charState[part.id].colour=p.c; }
      });
      renderCharacterUnified();
      buildArchetypesUnified();
      buildPartsUnified();
      if(typeof showToast==='function') showToast(a.label+' loaded');
    };
    g.appendChild(btn);
  });
}
function buildPartsUnified(){
  const c=document.getElementById('partsUnified');
  if(!c || typeof CHARACTER_TEMPLATES==='undefined') return;
  c.innerHTML='';
  const tpl=CHARACTER_TEMPLATES[currentTemplate];
  tpl.parts.forEach(part=>{
    const ps=charState[part.id];
    const vn=part.variants[ps.variant].name;
    const tab=document.createElement('button');
    tab.className='ptab'+(part.id===currentPart?' on':'');
    tab.innerHTML='<span>'+part.icon+'</span><strong>'+part.name+'</strong><span style="opacity:.6">'+vn+'</span><span style="width:10px;height:10px;border-radius:50%;background:'+ps.colour+';display:inline-block;margin-left:4px"></span>';
    tab.onclick=()=>{
      currentPart=part.id;
      buildPartsUnified();
      buildVariantsUnified(part);
    };
    c.appendChild(tab);
  });
  // also build colour swatches for current part
  const cur=tpl.parts.find(p=>p.id===currentPart)||tpl.parts[0];
  buildVariantsUnified(cur);
}
function buildVariantsUnified(part){
  const g=document.getElementById('variantUnified');
  if(!g || !part) return;
  g.innerHTML='';
  part.variants.forEach((v,i)=>{
    const btn=document.createElement('button');
    btn.className='var-btn'+(i===charState[part.id].variant?' on':'');
    btn.textContent=v.name;
    btn.onclick=()=>{
      charState[part.id].variant=i;
      renderCharacterUnified();
      buildPartsUnified();
      buildVariantsUnified(part);
      activeArchetype=null;
      buildArchetypesUnified();
    };
    g.appendChild(btn);
  });
  // colour row below variants
  const cr=document.createElement('div');
  cr.style.display='flex';
  cr.style.gap='4px';
  cr.style.flexWrap='wrap';
  cr.style.marginTop='6px';
  part.colours.forEach(col=>{
    const sw=document.createElement('button');
    sw.style.width='22px';sw.style.height='22px';sw.style.borderRadius='4px';sw.style.border='2px solid '+(col===charState[part.id].colour?'white':'transparent');sw.style.background=col;sw.style.cursor='pointer';
    sw.onclick=()=>{
      charState[part.id].colour=col;
      renderCharacterUnified();
      buildPartsUnified();
      activeArchetype=null;
      buildArchetypesUnified();
    };
    cr.appendChild(sw);
  });
  g.appendChild(cr);
}
function buildPoseUnified(){
  const row=document.getElementById('poseRowUnified');
  if(!row || typeof CHARACTER_TEMPLATES==='undefined') return;
  row.innerHTML='';
  const tpl=CHARACTER_TEMPLATES[currentTemplate];
  tpl.poses.forEach(p=>{
    const btn=document.createElement('button');
    btn.className='pose-btn'+(p.id===currentPose?' on':'');
    btn.innerHTML=p.label;
    btn.onclick=()=>{
      currentPose=p.id;
      document.querySelectorAll('#poseRowUnified .pose-btn').forEach(b=>b.classList.remove('on'));
      btn.classList.add('on');
      renderCharacterUnified();
    };
    row.appendChild(btn);
  });
}
function randomCharacterUnified(){
  if(typeof CHARACTER_TEMPLATES==='undefined') return;
  const tpl=CHARACTER_TEMPLATES[currentTemplate];
  tpl.parts.forEach(p=>{
    charState[p.id]={variant:Math.floor(Math.random()*p.variants.length),colour:p.colours[Math.floor(Math.random()*p.colours.length)]};
  });
  activeArchetype=null;
  renderCharacterUnified();
  buildArchetypesUnified();
  buildPartsUnified();
  buildPoseUnified();
}
function stampToCanvasUnified(){
  if(typeof stampToCanvas==='function'){
    try{
      stampToCanvas();
      showToast('Stamped to frame '+(currentFrame+1)+' - tap Draw to keep editing');
      syncMobileCharCanvas();
    }catch(e){ console.warn(e); showToast('Stamp failed'); }
  } else {
    // fallback: draw char canvas onto current layer
    const cc=document.getElementById('char-canvas-unified');
    if(!cc) return;
    pushUndo();
    const id=getID();
    const tmp=document.createElement('canvas');tmp.width=192;tmp.height=192;
    tmp.getContext('2d').drawImage(cc,0,0);
    const src=tmp.getContext('2d').getImageData(0,0,192,192).data;
    const offX=Math.floor((cW-192)/2), offY=Math.floor((cH-192)/2);
    for(let y=0;y<cH;y++){ for(let x=0;x<cW;x++){
      const sx=x-offX, sy=y-offY; if(sx<0||sy<0||sx>=192||sy>=192) continue;
      const si=(sy*192+sx)*4, di=(y*cW+x)*4; if(src[si+3]<10) continue;
      id.data[di]=src[si]; id.data[di+1]=src[si+1]; id.data[di+2]=src[si+2]; id.data[di+3]=255;
    }}
    renderAll();
    showToast('Stamped!');
  }
}
function stampAllPosesUnified(){
  if(typeof stampAllPoses==='function'){
    try{ stampAllPoses(); }catch(e){ console.warn(e); }
  } else if(typeof CHARACTER_TEMPLATES!=='undefined'){
    const poses=CHARACTER_TEMPLATES[currentTemplate].poses;
    while(frames.length<poses.length) addFrame();
    const sp=currentPose;
    poses.forEach((p,i)=>{
      currentPose=p.id; renderCharacterUnified(); stampToCanvas(i);
    });
    currentPose=sp; renderCharacterUnified();
    currentFrame=0; renderFrameList(); renderAll();
  }
}

// Mission + restore
let missionProgress=0;
function updateMissionProgress(){
  const el=document.getElementById('missionProgress');
  const banner=document.getElementById('mission-banner');
  if(!banner) return;
  let p=0;
  try{
    const hasDraw = frames[0] && frames[0][0] && frames[0][0].data.filter((v,i)=>i%4===3&&v>0).length>=3;
    if(hasDraw) p=1;
    const hasStamp = frames.some(f=>f.some(l=>l && l.data.some((v,i)=>i%4===3&&v>0)));
    if(p>=1 && hasStamp && (frames.length>1 || (frames[0]&& frames[0].some(l=>l && l.data.filter((v,i)=>i%4===3&&v>0).length>10)))) p=2;
    if(frames.length>=2) p=3;
    // export is manual, but we treat as 3 until export, then 4 will be set by export wrapper
    if(missionProgress>=4) p=4;
  }catch(e){}
  if(p>missionProgress) missionProgress=p;
  if(el) el.textContent=missionProgress+'/4';
  if(missionProgress>=4 && banner) banner.style.background='linear-gradient(135deg,rgba(16,185,129,.18),rgba(0,212,170,.12))';
}
function checkMissionParam(){
  const hasMission = location.search.includes('mission=first-pixel-character') || location.hash.includes('mission');
  const dismissed = localStorage.getItem('jvds_mission_dismiss')==='1';
  const banner=document.getElementById('mission-banner');
  if(!banner) return;
  if(hasMission && !dismissed){
    banner.style.display='flex';
    setCanvasSize(16,16,true); document.getElementById('custW').value=16; document.getElementById('custH').value=16;
    setStudioMode('draw');
    setTimeout(()=>showToast('Mission: draw 3 pixels → Character tab → Stamp → Animate → Export'),800);
    // poll progress
    setInterval(updateMissionProgress,800);
  } else if(!dismissed && !hasMission){
    // show banner collapsed? keep hidden unless mission
    banner.style.display='none';
  }
}
// Wrap export to mark mission complete
const origExportPNG = typeof exportPNG !== 'undefined' ? exportPNG : null;

// Restore mode on load + handle Easy import
(function(){
  // hook into init
  const origInit=window.init;
  window.init= function(){
    if(origInit) origInit();
    // wrap export for mission
    if(typeof exportPNG==='function' && !exportPNG._wrapped){
      const orig=exportPNG;
      window.exportPNG=function(){ const r=orig.apply(this,arguments); missionProgress=4; updateMissionProgress(); try{ localStorage.setItem('jvds_mission_done','1')}catch(e){}; showToast('Mission complete! PNG exported ✓'); return r; };
      window.exportPNG._wrapped=true;
    }
    // also wrap stamp to update progress
    if(typeof stampToCanvas==='function' && !stampToCanvas._wrapped){
      const origS=stampToCanvas;
      window.stampToCanvas=function(){ const r=origS.apply(this,arguments); setTimeout(updateMissionProgress,200); if(typeof setStudioMode==='function') setTimeout(()=>setStudioMode('draw'),600); return r; };
      window.stampToCanvas._wrapped=true;
    }
    // init char canvas after pixel init
    setTimeout(()=>{
      initUnifiedCharIfNeeded();
      buildStampsTray();
      // restore mode ('simple' legacy alias -> 'draw')
      let m=null; try{m=localStorage.getItem('jvds_pixel_mode');}catch(e){}
      if(m==='simple') m='draw';
      if(m && ['draw','character','animate'].includes(m)) setStudioMode(m);
      else setStudioMode('draw');
      checkMissionParam();
      // handle import from easy
      if(location.search.includes('import=easy') || location.hash.includes('import')){
        try{
          const raw=localStorage.getItem('jvds_easy_pixel_to_character') || localStorage.getItem('jvds_easy_pixel');
          if(raw){
            const d=JSON.parse(raw);
            if(d && d.grid && d.N){
              // Resize canvas to N and paint grid
              setCanvasSize(d.N,d.N,true);
              const id=getID();
              for(let y=0;y<d.N;y++) for(let x=0;x<d.N;x++){
                const col=d.grid[y*d.N+x];
                if(col){
                  const r=parseInt(col.slice(1,3),16),g=parseInt(col.slice(3,5),16),b=parseInt(col.slice(5,7),16);
                  const pi=(y*cW+x)*4;
                  if(pi<id.data.length){ id.data[pi]=r; id.data[pi+1]=g; id.data[pi+2]=b; id.data[pi+3]=255; }
                }
              }
              renderAll();
              showToast('Imported Easy art ✓');
            }
          }
        }catch(e){}
      }
      // handle #char share import (character designer share)
      if(location.hash.includes('#char=')){
        try{
          const m=location.hash.match(/#char=([^&]+)/);
          if(m){
            const json=JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g,'+').replace(/_/g,'/')))));
            if(json && json.charState){ charState=json.charState; currentTemplate=json.template||'humanoid'; currentPose=json.pose||'idle'; renderCharacterUnified(); buildArchetypesUnified(); buildPartsUnified(); }
          }
        }catch(e){}
      }
    },120);
  };
})();
