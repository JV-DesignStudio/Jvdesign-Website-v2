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
render();
document.addEventListener('DOMContentLoaded',()=>{if(window.EmberGuide)EmberGuide.init({id:'gallery',steps:[{target:'#btnAdd',title:'Add creation',text:'Echo saves in this browser - works offline, no account.'},{target:'.filters',title:'Filter',text:'Browse by tool or character.'}]})});
