const DB='jvds-collab-v1', STORE='queue';
const $=id=>document.getElementById(id);
const ch=new BroadcastChannel('jvds-collab');
let avatar='ember';
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=e=>{const db=e.target.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id',autoIncrement:true});};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
function log(m){const el=$('log');el.textContent+='\n'+new Date().toLocaleTimeString()+' - '+m;el.scrollTop=el.scrollHeight;}
function announce(m){const a=document.getElementById('jvds-announce');if(a){a.textContent=m;setTimeout(()=>a.textContent='',1500);}}
document.querySelectorAll('.avatar').forEach(a=>a.onclick=()=>{document.querySelectorAll('.avatar').forEach(x=>{x.classList.remove('on');x.setAttribute('aria-checked','false')});a.classList.add('on');a.setAttribute('aria-checked','true');avatar=a.dataset.char;log('Avatar: '+avatar);});
async function pushEdit(){
  const nick=$('nick').value.trim()||'Anon';const text=$('edit').value.trim();if(!text){announce('Add an edit first');return;}
  const item={nick,avatar,text,ts:Date.now(),synced:false};
  const db=await openDB();await new Promise((res,rej)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).add(item).onsuccess=res;tx.onerror=()=>rej(tx.error);tx.oncomplete=()=>db.close();});
  log('Queued ('+avatar+') '+nick+': '+text);announce('Queued offline');
  ch.postMessage(item); $('edit').value=''; renderQueue();
  if(window.ToolXP)ToolXP.award('collab',10);
}
async function renderQueue(){
  const db=await openDB();const items=await new Promise((res,rej)=>{const tx=db.transaction(STORE,'readonly');const req=tx.objectStore(STORE).getAll();req.onsuccess=()=>res(req.result||[]);req.onerror=()=>rej(req.error);tx.oncomplete=()=>db.close();});
  const el=$('queue');if(!items.length){el.textContent='Queue empty - all synced or offline edits will appear here.';return;}
  el.innerHTML=items.slice().reverse().map(it=>`<div class="qitem"><span><strong>${it.avatar}</strong> ${it.nick}: ${it.text}</span><span style="color:${it.synced?'#10b981':'#f59e0b'}">${it.synced?'synced':'queued'}</span></div>`).join('');
}
async function syncNow(){
  if(!navigator.onLine){log('Offline - queue kept for later (sync-later)');announce('Offline - queued');return;}
  const db=await openDB();const tx=db.transaction(STORE,'readwrite');const st=tx.objectStore(STORE);const req=st.getAll();req.onsuccess=async()=>{
    const items=req.result||[];let n=0;for(const it of items) if(!it.synced){it.synced=true;st.put(it);n++;}
    log('Synced '+n+' queued edits (simulated server)');announce('Synced '+n);
  };tx.oncomplete=()=>{db.close();renderQueue();};
}
async function clearQ(){if(!confirm('Clear queue?'))return;const db=await openDB();await new Promise((res,rej)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).clear().onsuccess=res;tx.onerror=()=>rej(tx.error);tx.oncomplete=()=>db.close();});log('Queue cleared');renderQueue();}
function exportQ(){openDB().then(db=>{const tx=db.transaction(STORE,'readonly');const req=tx.objectStore(STORE).getAll();req.onsuccess=()=>{const blob=new Blob([JSON.stringify(req.result,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='jvds-collab-queue.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);};});}
ch.onmessage=e=>{log('Live from '+e.data.avatar+' ('+e.data.nick+'): '+e.data.text+' - tab sync');announce('Live edit from '+e.data.nick);};
$('btnPush').onclick=pushEdit;$('btnSync').onclick=syncNow;$('btnClearQ').onclick=clearQ;$('btnExportQ').onclick=exportQ;
function updateOnline(){$('online').textContent=navigator.onLine?'Online - Sync now will mark queued as synced.':'Offline - edits stay queued (offline-first) and sync later.'; $('online').style.color=navigator.onLine?'#10b981':'#f59e0b';}
window.addEventListener('online',updateOnline);window.addEventListener('offline',updateOnline);
updateOnline();renderQueue();
document.addEventListener('DOMContentLoaded',()=>{if(window.EmberGuide)EmberGuide.init({id:'collab',steps:[{target:'#avatars',title:'Avatar',text:'Pip invites you - pick a character, no account needed.'},{target:'#btnPush',title:'Offline-first',text:'Edits queue in IndexedDB when offline, sync later.'}]})});
