const DB='jvds-gallery-v1', STORE='creations';
const $=s=>document.getElementById(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=e=>{const db=e.target.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id',autoIncrement:true});};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
let filter='all';
async function getAll(){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction(STORE,'readonly');const st=tx.objectStore(STORE);const req=st.getAll();req.onsuccess=()=>res(req.result||[]);req.onerror=()=>rej(req.error);tx.oncomplete=()=>db.close();});}
async function add(item){const db=await openDB();await new Promise((res,rej)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).add(item).onsuccess=res;tx.onerror=()=>rej(tx.onerror);tx.oncomplete=()=>db.close();});}
async function clearAll(){const db=await openDB();await new Promise((res,rej)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).clear().onsuccess=res;tx.onerror=()=>rej(tx.onerror);tx.oncomplete=()=>db.close();});}
async function remove(id){const db=await openDB();await new Promise((res,rej)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(id).onsuccess=res;tx.onerror=()=>rej(tx.onerror);tx.oncomplete=()=>db.close();});}
function fileToDataURL(f){return new Promise(res=>{if(!f)res('');else{const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(f);}});}
async function render(){
  const items=await getAll();const grid=$('grid');const empty=$('empty');grid.innerHTML='';
  const filtered=filter==='all'?items:items.filter(i=>i.tool===filter);
  empty.hidden=filtered.length!==0||items.length!==0;
  if(!items.length){$('empty').hidden=false;document.getElementById('grid').innerHTML='';return;}
  if(!filtered.length){grid.innerHTML='<div class="empty">No '+filter+' creations. Try All.</div>';return;}
  filtered.sort((a,b)=>b.created-a.created).forEach(it=>{
    const el=document.createElement('article');el.className='card';
    el.innerHTML=`<div class="thumb">${it.image?`<img src="${esc(it.image)}" alt="${esc(it.title)}" loading="lazy">`:`<span style="color:var(--muted);font-size:2rem">🎨</span>`}</div><div class="meta"><strong>${esc(it.title)}</strong><span>${esc(it.tool)} • ${esc(it.character)} • ${new Date(it.created).toLocaleDateString()}</span><p style="margin:6px 0 0;color:var(--muted);font-size:.85rem">${esc(it.notes||'')}</p><div style="margin-top:8px;display:flex;gap:8px"><button class="btn" data-del="${it.id}" style="min-height:32px;padding:0 10px">Delete</button><button class="btn" data-view="${it.id}" style="min-height:32px;padding:0 10px">View</button></div></div>`;
    grid.appendChild(el);
  });
  grid.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(confirm('Delete?')){await remove(+b.dataset.del);render();}});
  grid.querySelectorAll('[data-view]').forEach(b=>b.onclick=async()=>{const db=await openDB();const tx=db.transaction(STORE,'readonly');const req=tx.objectStore(STORE).get(+b.dataset.view);req.onsuccess=()=>{const it=req.result;if(it&&it.image){const w=window.open();if(w&&w.document){const img=w.document.createElement('img');img.src=it.image;img.alt=it.title||'Creation';img.style.maxWidth='100%';w.document.body.appendChild(img);}}}});
}
document.querySelectorAll('.chip').forEach(c=>c.onclick=()=>{document.querySelectorAll('.chip').forEach(x=>{x.classList.remove('on');x.setAttribute('aria-selected','false')});c.classList.add('on');c.setAttribute('aria-selected','true');filter=c.dataset.filter;render();});
$('btnAdd').onclick=()=>$('dlg').showModal();
$('dlg').addEventListener('close',async()=>{
  if($('dlg').returnValue==='cancel')return;
  const title=$('fTitle').value.trim()||'Untitled';const tool=$('fTool').value;const character=$('fChar').value;const notes=$('fNotes').value.trim();
  const file=$('fFile').files[0];const image=await fileToDataURL(file);
  await add({title,tool,character,notes,image,created:Date.now()});$('dlg').querySelector('form').reset();if(window.ToolXP)ToolXP.award('gallery',15);render();
});
$('btnExport').onclick=async()=>{const items=await getAll();const blob=new Blob([JSON.stringify(items,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='jvds-gallery.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);};
$('btnClear').onclick=async()=>{if(confirm('Clear whole gallery?')){await clearAll();render();}};
$('btnImport').onclick=()=>$('importFile').click();
$('importFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;const txt=await f.text();try{const arr=JSON.parse(txt);for(const it of arr){delete it.id;it.created=it.created||Date.now();await add(it);}render();}catch(err){alert('Invalid JSON');}};
// ── Auto-collect the saves the tools already produce (A1598) ──
// Reads the localStorage keys the tools write and turns them into gallery items,
// de-duplicated by a `src` marker so re-opening the page does not duplicate.
function pixelToDataURL(d){
  try{
    const cW=Math.max(2,Math.min(128,+d.cW||0)), cH=Math.max(2,Math.min(128,+d.cH||0));
    const cvs=document.createElement('canvas');cvs.width=cW;cvs.height=cH;
    const ctx=cvs.getContext('2d');
    const f0=Array.isArray(d.frames)?d.frames[0]:null;
    if(!Array.isArray(f0)) return '';
    f0.forEach((ld,li)=>{
      if(!ld) return;
      if(Array.isArray(d.layers)&&d.layers[li]&&d.layers[li].visible===false) return;
      try{const t=document.createElement('canvas');t.width=cW;t.height=cH;t.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(ld),cW,cH),0,0);ctx.drawImage(t,0,0);}catch(e){}
    });
    return cvs.toDataURL('image/png');
  }catch(e){ return ''; }
}
function collectToolItems(){
  const out=[];
  const get=k=>{try{return localStorage.getItem(k);}catch(e){return null;}};
  const isImg=v=>typeof v==='string'&&/^data:image\//.test(v);
  const px=get('jvds_pixel');
  if(px){ try{ const d=JSON.parse(px); out.push({title:'Pixel Studio art',tool:'pixel',character:'ember',notes:'Saved in Pixel Studio',image:pixelToDataURL(d),created:Date.now(),src:'jvds_pixel'}); }catch(e){} }
  const pxa=get('jvds_pixel_auto');
  if(pxa){ try{ const d=JSON.parse(pxa); out.push({title:'Pixel Studio (autosave)',tool:'pixel',character:'ember',notes:'Autosaved draft',image:pixelToDataURL(d),created:Date.now(),src:'jvds_pixel_auto'}); }catch(e){} }
  const sp=get('jvds_sprite_player');
  if(isImg(sp)) out.push({title:'Sprite for the Game Maker',tool:'pixel',character:'ember',notes:'Sent from Pixel Studio',image:sp,created:Date.now(),src:'jvds_sprite_player'});
  const sa=get('jvds_sprite_anim');
  if(sa){ try{ const d=JSON.parse(sa); if(d&&isImg(d.sheet)) out.push({title:d.sheetName||'Sprite Animator sheet',tool:'pixel',character:'ember',notes:'Sprite Animator project',image:d.sheet,created:Date.now(),src:'jvds_sprite_anim'}); }catch(e){} }
  const ks=get('jvds_pixel_keepsake');
  if(ks){ try{ const arr=JSON.parse(ks); if(Array.isArray(arr)) arr.forEach((k,i)=>{ if(k&&isImg(k.thumb)) out.push({title:k.title||('Keepsake '+(i+1)),tool:'pixel',character:'ember',notes:'Keepsake',image:k.thumb,created:Date.now(),src:'jvds_pixel_keepsake:'+(k.id||i)}); }); }catch(e){} }
  for(let i=0;i<5;i++){ const raw=get('jv_arcade_slot_'+i); if(!raw) continue; try{ const d=JSON.parse(raw); if(d&&isImg(d.thumbnail)) out.push({title:d.title||('Arcade game '+(i+1)),tool:'other',character:'pip',notes:(d.genre?d.genre+' ':'')+'arcade game',image:d.thumbnail,created:Date.now(),src:'jv_arcade_slot_'+i}); }catch(e){} }
  const aa=get('jv_arcade_autosave');
  if(aa){ try{ const d=JSON.parse(aa); if(d&&isImg(d.thumbnail)) out.push({title:d.title||'Arcade autosave',tool:'other',character:'pip',notes:'Arcade autosave',image:d.thumbnail,created:Date.now(),src:'jv_arcade_autosave'}); }catch(e){} }
  return out;
}
async function syncFromTools(){
  const found=collectToolItems();
  if(!found.length) return 0;
  const existing=await getAll();
  const have=new Set(existing.map(i=>i.src).filter(Boolean));
  let added=0;
  for(const it of found){ if(it.src&&have.has(it.src)) continue; await add(it); if(it.src) have.add(it.src); added++; }
  return added;
}
$('btnSync').onclick=async()=>{ const n=await syncFromTools(); await render(); const note=$('syncNote'); if(note) note.textContent=n?('Collected '+n+' creation'+(n>1?'s':'')+' from your tools'):'No new creations found in your tools yet.'; };

syncFromTools().then(()=>render()).catch(()=>render());
document.addEventListener('DOMContentLoaded',()=>{if(window.EmberGuide)EmberGuide.init({id:'gallery',steps:[{target:'#btnAdd',title:'Add creation',text:'Echo saves in this browser - works offline, no account.'},{target:'.filters',title:'Filter',text:'Browse by tool or character.'}]})});
