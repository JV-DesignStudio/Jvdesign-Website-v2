const $=id=>document.getElementById(id);
const MAX_BACKUP_BYTES=8*1024*1024;
function log(m){const el=$('log');el.textContent+=(el.textContent==='Ready.'?'':'\n')+new Date().toLocaleTimeString()+' - '+m;el.scrollTop=el.scrollHeight;}
function announce(m){const a=document.getElementById('jvds-announce');if(a){a.textContent=m;setTimeout(()=>a.textContent='',1500);}}
// A1588: back up every JVDS key family, not just jvds_*.
// jvds_* / jvds-* (tools, profile, XP), jv_* (Arcade slots, prefs, best scores), qb-* (Game Planner).
function isBackupKey(k){return !!k&&(k.startsWith('jvds')||k.startsWith('jv_')||k.startsWith('qb-'));}
function isJvdsKey(k){return window.JVDSManifest?window.JVDSManifest.isKey(k):isBackupKey(k);}
function collectLS(){
  if(window.JVDSManifest) return window.JVDSManifest.collect();
  const out={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('jvds')){try{out[k]=localStorage.getItem(k);}catch(e){out[k]='[error]';}}}
  return out;
}
function renderKV(){
  const data=collectLS();const keys=Object.keys(data).sort();const el=$('kv');el.textContent='';
  if(!keys.length){el.textContent='No JVDS saves found yet. Create something in Pixel Studio, the Arcade or the Game Planner first.';return data;}
  keys.forEach(k=>{
    const name=document.createElement('span');name.textContent=k;
    const size=document.createElement('span');size.textContent=new Blob([data[k]||'']).size+'B';
    el.appendChild(name);el.appendChild(size);
  });
  return data;
}
// A1811: check a file before writing anything. Accepts a backup bundle
// ({v,exported,data}), a full backpack ({format:'jvds-backpack',keys}) or a
// plain {key:value} map. Non-JVDS entries are skipped, never restored.
function normaliseValue(v){
  if(v==null||typeof v==='function'||typeof v==='symbol')return null;
  return typeof v==='string'?v:JSON.stringify(v);
}
function readBackupObject(obj){
  if(!obj||typeof obj!=='object'||Array.isArray(obj))throw new Error('That file is not a JVDS backup.');
  const root=(obj.data&&typeof obj.data==='object'&&!Array.isArray(obj.data))?obj.data
    :(obj.keys&&typeof obj.keys==='object'&&!Array.isArray(obj.keys))?obj.keys
    :obj;
  const data={};let skipped=0;
  Object.keys(root).forEach(k=>{
    if(!isJvdsKey(k)){skipped++;return;}
    const v=normaliseValue(root[k]);
    if(v===null){skipped++;return;}
    data[k]=v;
  });
  if(!Object.keys(data).length)throw new Error('That file has no JVDS saves in it. Pick a backup you made on this site.');
  return {data,skipped};
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
  if(/\.zip$/i.test(f.name)){$('preview').textContent='ZIP selected: '+f.name+' ('+Math.round(f.size/1024)+'KB). Import checks every JSON file inside and only restores JVDS saves.';return;}
  const txt=await f.text();let parsed;
  try{parsed=JSON.parse(txt);}catch(e){$('preview').textContent='That file does not look like a JVDS backup: it is not readable as JSON. Nothing has been changed.';return;}
  try{
    const bundle=readBackupObject(parsed);
    const names=Object.keys(bundle.data).sort();
    $('preview').textContent='Looks like a JVDS backup.\n'+names.length+' save(s) can be restored:\n'+names.slice(0,20).join('\n')+(names.length>20?'\n...':'')+(bundle.skipped?'\n('+bundle.skipped+' entry that is not a JVDS save will be skipped)':'');
  }catch(e){
    $('preview').textContent=e.message+' Nothing has been changed.';
  }
  $('preview').scrollTop=0;
}
async function importZip(f){
  if(typeof JSZip==='undefined'){log('ZIP support did not load, so nothing was changed. Try the JSON backup instead.');return;}
  let zip;try{zip=await JSZip.loadAsync(f);}catch(e){log('Import stopped: that ZIP could not be opened, so nothing was changed.');announce('Not a backup file');return;}
  let n=0,skipped=0;
  for(const [name,entry] of Object.entries(zip.files)){
    if(entry.dir||/^manifest\.json$/i.test(name))continue;
    if(!/\.json$/i.test(name)){skipped++;continue;}
    const k=name.replace(/\.json$/i,'').split('/').pop();
    if(!isJvdsKey(k)){skipped++;continue;}
    let v='';try{v=await entry.async('string');}catch(e){skipped++;continue;}
    if(!v||v.length>MAX_BACKUP_BYTES){skipped++;continue;}
    if(!confirm('Restore '+k+'?'))continue;
    try{localStorage.setItem(k,v);n++;log('Restored '+k);}catch(e){log('Could not restore '+k+' (storage is full or blocked)');}
  }
  if(!n){log('No JVDS saves found in that ZIP, so nothing was changed.');announce('No saves found');return;}
  log('Imported '+n+' save(s) from ZIP'+(skipped?', skipped '+skipped+' other file(s)':'')+'.');
  announce('Restored '+n+' save(s)');renderKV();
}
async function doImport(){
  const f=$('fileIn').files[0];if(!f){announce('Pick a file');return;}
  if(f.size>MAX_BACKUP_BYTES){log('That file is too big to be a JVDS backup (over 8 MB). Nothing was changed.');announce('File too big');return;}
  if(/\.zip$/i.test(f.name))return importZip(f);
  const txt=await f.text();let parsed;
  try{parsed=JSON.parse(txt);}catch(e){log('Import stopped: that file is not valid JSON, so nothing was changed.');announce('Not a backup file');return;}
  let bundle;
  try{bundle=readBackupObject(parsed);}catch(e){log('Import stopped: '+e.message+' Nothing was changed.');$('preview').textContent=e.message;announce('Not a backup file');renderKV();return;}
  const names=Object.keys(bundle.data);let n=0;
  names.forEach(k=>{
    if(!confirm('Restore '+k+'?'))return;
    try{localStorage.setItem(k,bundle.data[k]);n++;log('Restored '+k);}catch(e){log('Could not restore '+k+' (storage is full or blocked)');}
  });
  log('Imported '+n+' of '+names.length+' save(s)'+(bundle.skipped?', skipped '+bundle.skipped+' entry that is not a JVDS save':'')+'.');
  announce(n?'Restored '+n+' save(s)':'Nothing restored');renderKV();
}
$('btnJSON').onclick=exportJSON;$('btnZIP').onclick=exportZIP;$('btnPNG').onclick=exportPNG;$('btnPreview').onclick=previewFile;$('btnImport').onclick=doImport;$('btnScan').onclick=()=>{renderKV();log('Re-scanned');};$('btnWipe').onclick=()=>{if(!confirm('Wipe every JVDS save (jvds_*, jv_*, qb-*)? This cannot be undone. Export a backup first!'))return;Object.keys(collectLS()).forEach(k=>localStorage.removeItem(k));log('Wiped JVDS localStorage (jvds_*, jv_*, qb-*)');renderKV();};
{const _bm=$('btnManifest');if(_bm)_bm.onclick=()=>{if(window.JVDSManifest){window.JVDSManifest.download();log('Manifest exported');}};const _bom=$('btnOpenManifest');if(_bom)_bom.onclick=()=>{if(window.JVDSManifest)window.JVDSManifest.openManifest();};}
renderKV();
document.addEventListener('DOMContentLoaded',()=>{if(window.EmberGuide)EmberGuide.init({id:'backup-restore',steps:[{target:'#btnJSON',title:'Export',text:'Echo saves JSON/ZIP/PNG - all offline, no account.'},{target:'#fileIn',title:'Import',text:'Restore on any school computer by importing the file.'}]})});
