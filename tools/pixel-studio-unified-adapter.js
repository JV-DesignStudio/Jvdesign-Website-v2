// Unified Pixel Studio adapter - Simple / Character / Draw / Animate modes
// Depends on: pixel-studio-unified-characters.js (defines CHARACTER_TEMPLATES, SKIN etc., charCanvasUnified, cctxUnified, charState etc.)
let studioMode='simple';
const EASY_PAL=['#000000','#ffffff','#f59e0b','#ef4444','#10b981','#3b82f6','#a855f7','#ec4899','#facc15','#84cc16','#06b6d4','#f43f5e','#6b7280','#92400e','#1e1b4b','#f5e6d3'];
let easyMode=false;

function setStudioMode(mode){
  studioMode=mode;
  document.querySelectorAll('#studioMode [data-mode]').forEach(b=>{
    const on=b.dataset.mode===mode;
    b.setAttribute('aria-selected', on?'true':'false');
    b.style.background=on?'var(--accent)':'transparent';
    b.style.color=on?'#fff':'var(--muted)';
  });
  const strip=document.getElementById('character-strip');
  if(strip) strip.style.display=(mode==='character'?'flex':'none');
  // Simple mode hides layers complexity
  const left=document.getElementById('left-panel'), right=document.getElementById('right-panel');
  if(mode==='simple'){
    // Simple keeps full toolbox visible for now (school-computer rule: big pixels via canvas size, not hidden tools)
    easyMode=true;
    // keep canvas at 32 for compatibility with mobile smoke test; only shrink if very large
    if(cW>64 || cH>64){ setCanvasSize(32,32,true); document.getElementById('custW').value=32; document.getElementById('custH').value=32; }
    showToast('Simple mode - start drawing, then try Character or Draw.');
  } else {
    easyMode=false;
  }
  if(mode==='character'){
    // ensure char canvas initialised
    initUnifiedCharIfNeeded();
    renderCharacterUnified();
    buildArchetypesUnified();
    buildPartsUnified();
    buildPoseUnified();
  }
  if(mode==='draw' || mode==='animate'){
    // ensure canvas visible
    renderAll();
  }
  localStorage.setItem('jvds_pixel_mode',mode);
  // push to analytics
  if(window.ToolAnalytics) try{ToolAnalytics.event('studio_mode_'+mode);}catch(e){}
}

// --- Character unified wrappers ---
let unifiedReady=false;
function initUnifiedCharIfNeeded(){
  if(unifiedReady) return;
  // bind charCanvasUnified once DOM ready
  const cc=document.getElementById('char-canvas-unified');
  if(!cc) return;
  if(typeof charCanvasUnified==='undefined' || charCanvasUnified!==cc){
    // reassign global vars from characters file (they were set to null at load since DOM not ready)
    window.charCanvasUnified=cc;
    window.cctxUnified=cc.getContext('2d');
    if(window.cctxUnified) window.cctxUnified.imageSmoothingEnabled=false;
  }
  if(typeof charState!=='undefined' && Object.keys(charState).length===0){
    initCharState();
  }
  unifiedReady=true;
}
function renderCharacterUnified(){
  initUnifiedCharIfNeeded();
  if(typeof renderCharacter==='function'){
    // hijack original renderCharacter to use unified canvas (already patched to cctxUnified)
    try{ renderCharacter(); }catch(e){ console.warn(e); }
  }
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
  // Use existing stampToCanvas from characters file, but ensure it operates on pixel-studio's frames/cW
  if(typeof stampToCanvas==='function'){
    try{
      stampToCanvas();
      showToast('Stamped to frame '+(currentFrame+1));
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
    const rx=192/cW, ry=192/cH;
    for(let y=0;y<cH;y++){
      const syi=Math.min(191,(y*ry)|0)*192;
      for(let x=0;x<cW;x++){
        const sxi=Math.min(191,(x*rx)|0);
        const si=(syi+sxi)*4, di=(y*cW+x)*4;
        if(src[si+3]>10){ id.data[di]=src[si]; id.data[di+1]=src[si+1]; id.data[di+2]=src[si+2]; id.data[di+3]=255; }
      }
    }
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

// Restore mode on load + handle Easy import
(function(){
  // hook into init
  const origInit=window.init;
  window.init= function(){
    if(origInit) origInit();
    // init char canvas after pixel init
    setTimeout(()=>{
      initUnifiedCharIfNeeded();
      // restore mode
      let m=null; try{m=localStorage.getItem('jvds_pixel_mode');}catch(e){}
      if(m && ['simple','character','draw','animate'].includes(m)) setStudioMode(m);
      else setStudioMode('simple');
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
