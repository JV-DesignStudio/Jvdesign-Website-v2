#!/usr/bin/env node
/* Add/update visual platform buttons on the private board comms cards. */
const fs = require('fs');

const BOARD = 'F:/Website/studio-workspace/board/index.html';
const STYLE_START = '/* Comms visual card patch */';
const STYLE_END = '/* End comms visual card patch */';
const SCRIPT_START = '// Comms platform buttons patch';
const SCRIPT_END = '// End comms platform buttons patch';

const STYLE = `${STYLE_START}
.comms-card{position:relative;overflow:hidden}.comms-card:before{content:"";position:absolute;inset:0 0 auto 0;height:5px;background:var(--comms-accent,#0f766e)}.comms-brand-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.comms-loop-badge{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--border);border-radius:999px;padding:4px 8px;background:#fff;font-size:.67rem;font-weight:900;color:var(--charcoal)}.comms-platforms{display:flex;gap:6px;flex-wrap:wrap}.comms-chip{border:1px solid var(--border);border-radius:999px;background:#fff;color:var(--charcoal);font-size:.66rem;font-weight:900;padding:4px 8px}.comms-pack-link{display:inline-flex;align-items:center;gap:6px;background:var(--comms-accent,#0f766e);color:#fff!important;border-color:var(--comms-accent,#0f766e)!important}.comms-status-approved{--comms-accent:#16a34a}.comms-status-pending{--comms-accent:#f59e0b}.comms-status-declined{--comms-accent:#dc2626}.comms-status-posted{--comms-accent:#2563eb}
${STYLE_END}`;

const PATCH = `${SCRIPT_START}
(function(){
  const platformUrls={instagram:'https://www.instagram.com/',facebook:'https://www.facebook.com/',x:'https://x.com/compose/post',threads:'https://www.threads.net/',youtube:'https://www.youtube.com/',newsletter:'file:///F:/Website/Jvdesign-Website-v2/social-posts/ready/'};
  window.openCommsPlatform=function(name){ const u=platformUrls[name]; if(u) window.open(u,'_blank','noopener'); };
  window.commsSlug=function(title){ return String(title||'post').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').replace(/-+/g,'-').slice(0,60).replace(/-+$/,'')||'post'; };
  window.openReadyPack=function(id,title){ window.open('file:///F:/Website/Jvdesign-Website-v2/social-posts/ready/'+id+'-'+window.commsSlug(title)+'/','_blank','noopener'); };
  window.openReadyPreview=function(id,title){ window.open('file:///F:/Website/Jvdesign-Website-v2/social-posts/ready/'+id+'-'+window.commsSlug(title)+'/preview.html','_blank','noopener'); };
  window.commsLoop=function(t,p){ const hay=((t?.tag||'')+' '+(p?.devlog?.tag||'')+' '+(p?.title||t?.title||'')).toLowerCase(); if(/game|play|arcade|roblox|godot/.test(hay))return {name:'Pip',role:'Play',color:'#3b82f6'}; if(/workshop|learn|scratch|education|licens/.test(hay))return {name:'Lumo',role:'Learn',color:'#d97706'}; if(/tool|pixel|studio|create|maker|builder/.test(hay))return {name:'Ember',role:'Create',color:'#dc2626'}; if(/fix|repair|validation|cookie|privacy|audit|update|devlog/.test(hay))return {name:'Echo',role:'Improve',color:'#0f766e'}; return {name:'Stardust',role:'Imagine',color:'#7c3aed'}; };
})();

// Comms detail review controls patch
(function(){
  if(window.__commsDetailPatch) return; window.__commsDetailPatch=true;
  const token=()=>localStorage.getItem('studio_board_token')||'jvds2026';
  async function api(url,body){ const r=await fetch('http://localhost:8787'+url,{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':token()},body:JSON.stringify(body)}); const j=await r.json(); if(!j.ok) throw new Error(j.error||'Request failed'); return j; }
  window.renderCommsDetailActions=function(item,dmActions,closeDetail){
    if(!item || !item.commsPack) return false;
    const p=item.commsPack, isDev=p.kind==='devlog';
    dmActions.replaceChildren();
    const wrap=document.createElement('div'); wrap.style.cssText='display:grid;gap:10px;width:100%';
    const note=document.createElement('textarea'); note.placeholder='Decline note or posting note...'; note.value=p.declineNote||item.commsDeclineNote||''; note.style.cssText='width:100%;min-height:84px;border:1px solid #cbd5e1;border-radius:10px;padding:10px;font:inherit;resize:vertical';
    const info=document.createElement('div'); info.style.cssText='font-size:.78rem;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:9px'; info.textContent='Comms review: approve when the copy is ready, decline with a note if it needs changes, or mark posted/sent after manual publishing.';
    const row=document.createElement('div'); row.style.cssText='display:flex;gap:8px;flex-wrap:wrap';
    function btn(label,kind,fn){ const b=document.createElement('button'); b.type='button'; b.textContent=label; b.style.cssText='flex:1;min-width:140px;font-weight:900;border-radius:10px;padding:10px 12px;border:1px solid '+(kind==='bad'?'#fecaca':kind==='good'?'#86efac':'#cbd5e1')+';background:'+(kind==='bad'?'#fff1f2':kind==='good'?'#dcfce7':'#fff')+';color:'+(kind==='bad'?'#991b1b':kind==='good'?'#166534':'#0f766e')+';cursor:pointer'; b.onclick=fn; return b; }
    row.append(
      btn(isDev?'Approve + publish':'Approve copy','good',async()=>{ if(!confirm((isDev?'Publish Dev Log ':'Approve copy ')+item.id+'?')) return; await api('/api/comms-approve',{id:item.id}); location.reload(); }),
      btn('Decline with note','bad',async()=>{ const n=note.value.trim()||'Needs edit'; await api('/api/comms-decline',{id:item.id,note:n}); location.reload(); }),
      btn('Mark social posted','',async()=>{ const u=note.value.trim()||prompt('Social URL or note:')||new Date().toISOString(); await api('/api/comms-posted',{id:item.id,channel:'social',url:u}); location.reload(); }),
      btn('Mark newsletter sent','',async()=>{ const u=note.value.trim()||prompt('Newsletter sent note/date:')||new Date().toISOString(); await api('/api/comms-posted',{id:item.id,channel:'newsletter',url:u}); location.reload(); })
    );
    wrap.append(info,note,row); dmActions.append(wrap); return true;
  };
})();
${SCRIPT_END}`;

function replaceBlock(html, start, end, chunk, fallback) { const s=html.indexOf(start); const e=html.indexOf(end,s+start.length); if(s!==-1&&e!==-1)return html.slice(0,s)+chunk+html.slice(e+end.length); return fallback(html,chunk); }
let html=fs.readFileSync(BOARD,'utf8');
html=replaceBlock(html, STYLE_START, STYLE_END, STYLE, (src,chunk)=>src.replace('</style>', chunk+'\n</style>'));
html=replaceBlock(html, SCRIPT_START, SCRIPT_END, PATCH, (src,chunk)=>src.replace('// Comms Publishing Desk - preview/copy/approve/post workflow', chunk+'\n// Comms Publishing Desk - preview/copy/approve/post workflow'));
html=html.replace("const el=document.createElement('div'); el.className='card comms-card';", "const el=document.createElement('div'); el.className='card comms-card comms-status-'+s;");
html=html.replace("    dmActions.replaceChildren();\n    if(isReview){", "    dmActions.replaceChildren();\n    if(window.renderCommsDetailActions?.(item,dmActions,closeDetail)){ modal.classList.add('open'); modal.style.display='flex'; document.body.style.overflow='hidden'; document.getElementById('dmClose').focus(); return; }\n    if(isReview){");
const marker="el.innerHTML=`<div style=\"display:flex;gap:8px;align-items:start\"><strong style=\"font-size:.82rem;flex:1\">${t.id} · ${p.title||t.title}</strong><span style=\"font-size:.65rem;background:${color};border:1px solid var(--border);border-radius:999px;padding:2px 7px;font-weight:800;white-space:nowrap\">${s}</span></div><div style=\"font-size:.74rem;color:var(--charcoal-lt)\">${isDev?'Dev Log draft':'Social / Newsletter pack'}${p.image?' · image ready':''}</div>`;";
const branded="const loop=window.commsLoop?.(t,p)||{name:'Echo',role:'Improve',color:'#0f766e'}; el.style.setProperty('--comms-accent',loop.color);\n    el.innerHTML=`<div style=\"display:flex;gap:8px;align-items:start\"><strong style=\"font-size:.82rem;flex:1\">${t.id} · ${p.title||t.title}</strong><span style=\"font-size:.65rem;background:${color};border:1px solid var(--border);border-radius:999px;padding:2px 7px;font-weight:800;white-space:nowrap\">${s}</span></div><div class=\"comms-brand-row\"><span class=\"comms-loop-badge\">${loop.name} · ${loop.role}</span><span style=\"font-size:.74rem;color:var(--charcoal-lt)\">${isDev?'Dev Log draft':'Social / Newsletter pack'}${p.image?' · image ready':''}</span></div><div class=\"comms-platforms\"><span class=\"comms-chip\">Instagram</span><span class=\"comms-chip\">Facebook</span><span class=\"comms-chip\">X</span><span class=\"comms-chip\">Threads</span><span class=\"comms-chip\">Newsletter</span></div>`;";
if(html.includes(marker)) html=html.replace(marker,branded);
const old="actions.append(b('Ready pack',()=>window.openReadyPack?.(t.id,p.title||t.title)));";
const repl="actions.append(b('Preview',()=>window.openReadyPreview?.(t.id,p.title||t.title),'good'));\n    actions.append(b('Ready pack',()=>window.openReadyPack?.(t.id,p.title||t.title)));";
if(html.includes(old)&&!html.includes("actions.append(b('Preview'")) html=html.replace(old,repl);
// Remove compact approve/decline buttons. Review decisions now live in the opened detail modal.
html=html.replace(/\n\s*actions\.append\(b\(isDev\?'Approve \+ publish':'Approve copy',[\s\S]*?\},'good'\)\);/g,'');
html=html.replace(/\n\s*actions\.append\(b\('Decline',[\s\S]*?\},'bad'\)\);/g,'');
fs.writeFileSync(BOARD,html,'utf8');
console.log('Updated private board comms visual cards');
