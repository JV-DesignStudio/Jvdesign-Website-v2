const $=id=>document.getElementById(id);
function log(m){const el=$('log');el.textContent+=(el.textContent==='Ready.'?'':'\n')+new Date().toLocaleTimeString()+' - '+m;el.scrollTop=el.scrollHeight;}
function announce(m){const a=document.getElementById('jvds-announce');if(a){a.textContent=m;setTimeout(()=>a.textContent='',1500);}}
function collectLS(){
  const out={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('jvds')){try{out[k]=localStorage.getItem(k);}catch(e){out[k]='[error]';}}}
  return out;
}
function renderKV(){
  const data=collectLS();const keys=Object.keys(data);const el=$('kv');el.innerHTML='';if(!keys.length){el.textContent='No jvds_* keys found. Create something in Pixel Studio first.';return data;}
  el.innerHTML=keys.map(k=>`<span>${k}</span><span>${new Blob([data[k]||'']).size}B</span>`).join('');return data;
}
async function exportJSON(){
  const data=collectLS();const blob=new Blob([JSON.stringify({v:1,exported:Date.now(),data},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='jvds-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);log('Exported JSON '+Object.keys(data).length+' keys');announce('Backup JSON exported');if(window.ToolXP)ToolXP.award('backup',20);
}
async function exportZIP(){
  if(typeof JSZip==='undefined'){log('JSZip not loaded - falling back to JSON');return exportJSON();}
  const data=collectLS();const zip=new JSZip();Object.entries(data).forEach(([k,v])=>zip.file(k+'.json',v||''));zip.file('manifest.json',JSON.stringify({v:1,exported:Date.now(),count:Object.keys(data).length},null,2));
  const blob=await zip.generateAsync({type:'blob'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='jvds-backup-'+new Date().toISOString().slice(0,10)+'.zip';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);log('Exported ZIP '+Object.keys(data).length+' files');announce('Backup ZIP exported');
}
function exportPNG(){
  const c=document.createElement('canvas');c.width=512;c.height=512;const ctx=c.getContext('2d');ctx.fillStyle='#0a0514';ctx.fillRect(0,0,512,512);ctx.fillStyle='#f472b6';ctx.font='bold 32px Fredoka';ctx.fillText('JVDS Backup',24,48);ctx.fillStyle='#94a3b8';ctx.font='16px monospace';ctx.fillText(new Date().toLocaleString(),24,80);ctx.fillText(Object.keys(collectLS()).length+' keys backed up (see JSON/ZIP for data)',24,110);
  c.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='jvds-backup-cover.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);log('Exported PNG cover (metadata) - use JSON/ZIP for restore');});
}
async function previewFile(){
  const f=$('fileIn').files[0];if(!f){$('preview').textContent='No file.';return;}
  if(f.name.endsWith('.zip')){$('preview').textContent='ZIP selected: '+f.name+' ('+Math.round(f.size/1024)+'KB) - Import will extract JSON files.';return;}
  const txt=await f.text();$('preview').textContent=txt.slice(0,2000)+(txt.length>2000?'…':'');$('preview').scrollTop=0;
}
async function doImport(){
  const f=$('fileIn').files[0];if(!f){announce('Pick a file');return;}
  if(f.name.endsWith('.zip')){
    if(typeof JSZip==='undefined'){log('JSZip not loaded');return;}
    const zip=await JSZip.loadAsync(f);let n=0;for(const [name,entry] of Object.entries(zip.files)){if(entry.dir||name==='manifest.json')continue;const k=name.replace(/\.json$/,'');const v=await entry.async('string');if(!confirm('Restore '+k+'?'))continue;localStorage.setItem(k,v);n++;log('Restored '+k);}announce('Restored '+n+' from ZIP');renderKV();return;
  }
  const txt=await f.text();let parsed;try{parsed=JSON.parse(txt);}catch(e){log('Invalid JSON');return;}
  const data=parsed.data||parsed;let n=0;for(const [k,v] of Object.entries(data)){if(!k.startsWith('jvds'))continue;if(!confirm('Restore '+k+'?'))continue;localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v));n++;log('Restored '+k);}announce('Restored '+n);renderKV();
}
$('btnJSON').onclick=exportJSON;$('btnZIP').onclick=exportZIP;$('btnPNG').onclick=exportPNG;$('btnPreview').onclick=previewFile;$('btnImport').onclick=doImport;$('btnScan').onclick=()=>{renderKV();log('Re-scanned');};$('btnWipe').onclick=()=>{if(!confirm('Wipe all jvds_* localStorage? Backup first!'))return;Object.keys(collectLS()).forEach(k=>localStorage.removeItem(k));log('Wiped jvds_* localStorage');renderKV();};
renderKV();
document.addEventListener('DOMContentLoaded',()=>{if(window.EmberGuide)EmberGuide.init({id:'backup-restore',steps:[{target:'#btnJSON',title:'Export',text:'Echo saves JSON/ZIP/PNG - all offline, no account.'},{target:'#fileIn',title:'Import',text:'Restore on any school computer by importing the file.'}]})});
