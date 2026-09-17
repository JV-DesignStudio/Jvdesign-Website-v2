#!/usr/bin/env node
/* Add/update the Publishing Calendar on the private Studio Board. */
const fs = require('fs');

const BOARD = 'F:/Website/studio-workspace/board/index.html';
const SERVER = 'F:/Website/studio-workspace/board-server.cjs';

const STYLE_START = '/* Publishing calendar patch */';
const STYLE_END = '/* End publishing calendar patch */';
const SECTION_START = '<!-- Publishing calendar start -->';
const SECTION_END = '<!-- Publishing calendar end -->';
const SCRIPT_START = '// Publishing calendar - schedule reminders';
const SCRIPT_END = '// End publishing calendar';

const STYLE = `${STYLE_START}
.publish-calendar{margin:0 0 18px;padding:16px;border:2px solid #7c3aed;border-radius:16px;background:#fbf8ff;color:#21152f;box-shadow:0 8px 22px rgba(124,58,237,.12)}
.publish-head{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px}.publish-head h2{font-size:1.15rem;margin:0;color:#21152f}.publish-sub{font-size:.78rem;color:#5b4b72;font-weight:800}
.publish-alerts{display:grid;grid-template-columns:repeat(2,minmax(220px,1fr));gap:10px;margin-bottom:12px}.publish-alert{background:#fff;border:1px solid #dbcaf7;border-radius:12px;padding:10px}.publish-alert b{display:block;font-size:1.25rem;color:#21152f}.publish-alert span{font-size:.72rem;color:#64748b;font-weight:800}.publish-grid{display:grid;grid-template-columns:repeat(5,minmax(200px,1fr));gap:12px}.publish-lane{background:#fff;border:1px solid #dbcaf7;border-radius:12px;overflow:hidden;min-height:140px}.publish-lane h3{margin:0;padding:10px 12px;font-size:.82rem;color:#21152f;background:#efe7ff;border-bottom:1px solid #dbcaf7;display:flex;justify-content:space-between;gap:8px}
.publish-list{display:flex;flex-direction:column;gap:8px;padding:10px}.publish-card{background:#fffaf0;border:1px solid #ead7ad;border-left:4px solid var(--pub-accent,#7c3aed);border-radius:10px;padding:9px;display:grid;gap:6px}.publish-card[data-due="today"]{box-shadow:0 0 0 2px rgba(220,38,38,.18)}.publish-card[data-status="scheduled"]{--pub-accent:#2563eb}.publish-card[data-channel="newsletter"]{--pub-accent:#d97706}.publish-card[data-channel="devlog"]{--pub-accent:#0f766e}.publish-card[data-channel="video"]{--pub-accent:#dc2626}
.publish-meta{font-size:.66rem;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:.04em}.publish-title{font-size:.78rem;font-weight:900;color:#172033;line-height:1.35}.publish-line{font-size:.72rem;color:#475569;line-height:1.35}.publish-line strong{color:#21152f}.publish-actions{display:flex;gap:6px;flex-wrap:wrap}.publish-actions button{font-size:.67rem;font-weight:900;border:1px solid #dbcaf7;background:#fff;color:#5b21b6;border-radius:999px;padding:5px 8px;cursor:pointer}.publish-actions button.primary{background:#7c3aed;color:#fff;border-color:#7c3aed}.publish-empty{font-size:.74rem;color:#64748b;padding:10px;line-height:1.4}
@media(max-width:1250px){.publish-grid{grid-template-columns:repeat(2,minmax(220px,1fr))}.publish-alerts{grid-template-columns:1fr 1fr}}@media(max-width:620px){.publish-grid{grid-template-columns:1fr}.publish-calendar{padding:12px}}
${STYLE_END}`;

const SECTION = `${SECTION_START}
    <section class="publish-calendar" id="publishingCalendar" aria-label="Publishing calendar reminders">
      <div class="publish-head">
        <h2>Publishing Calendar</h2>
        <span class="publish-sub" id="publishSummary">Loading schedule reminders...</span>
      </div>
      <div class="publish-alerts"><div class="publish-alert"><b id="pubTodayCount">0</b><span>Scheduled today</span></div><div class="publish-alert"><b id="pubMissedCount">0</b><span>Missed uploads</span></div></div>\n      <div class="publish-grid">
        <div class="publish-lane"><h3>Missed Uploads <span id="pubMissedLaneCount">0</span></h3><div class="publish-list" id="pubMissed"></div></div>\n        <div class="publish-lane"><h3>Dev Logs <span id="pubDevlogCount">0</span></h3><div class="publish-list" id="pubDevlogs"></div></div>
        <div class="publish-lane"><h3>Friday Newsletter <span id="pubNewsletterCount">0</span></h3><div class="publish-list" id="pubNewsletter"></div></div>
        <div class="publish-lane"><h3>Social Schedule <span id="pubSocialCount">0</span></h3><div class="publish-list" id="pubSocial"></div></div>
        <div class="publish-lane"><h3>Reels / Video <span id="pubVideoCount">0</span></h3><div class="publish-list" id="pubVideo"></div></div>
      </div>
    </section>
${SECTION_END}`;

const SCRIPT = `${SCRIPT_START}
(function(){
  const token=()=>localStorage.getItem('studio_board_token')||'jvds2026';
  const today=new Date(); today.setHours(0,0,0,0);
  const iso=d=>d.toISOString().slice(0,10);
  const add=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
  const nextDow=dow=>{const d=new Date(today);const delta=(dow-d.getDay()+7)%7;d.setDate(d.getDate()+delta);return d;};
  const friday=nextDow(5);
  const weekEnd=add(today,6);
  const all=[...DEVLOG_DRAFTS,...SOCIAL_DRAFTS].filter(t=>t.commsPack).map(t=>({...t,pack:t.commsPack}));
  const status=t=>{const p=t.pack||{}; if(p.posted?.social||p.posted?.newsletter)return'posted'; return p.schedule?.status||p.status||t.commsStatus||'pending';};
  const title=t=>t.pack?.title||t.title||'Untitled';
  const kind=t=>String(t.pack?.kind||'social').toLowerCase();
  function due(t,channel){const s=t.pack?.schedule||{}; if(s[channel]?.date)return s[channel].date; if(channel==='newsletter')return iso(friday); if(channel==='video')return iso(add(friday,2)); if(channel==='devlog')return iso(today); return iso(add(today,1));}
  function dateValue(date){const d=new Date(date+'T00:00:00');return Number.isFinite(d.getTime())?d:null;}\n  function isDueToday(date){return date===iso(today);}\n  function isMissed(date){const d=dateValue(date);return d&&d<today;}
  async function schedule(id,channel,date,time,type){
    const r=await fetch('http://localhost:8787/api/comms-schedule',{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':token()},body:JSON.stringify({id,channel,date,time,type})});
    const j=await r.json(); if(!j.ok) throw new Error(j.error||'Could not schedule'); location.reload();
  }
  window.scheduleCommsPrompt=async function(id,channel,defaultDate,type){
    const date=prompt('Schedule date (YYYY-MM-DD)',defaultDate||iso(today)); if(!date)return;
    const time=prompt('Time or slot (example: morning, lunch, 19:00)','morning')||'unspecified';
    await schedule(id,channel,date,time,type||channel);
  };
  function card(t,channel,type){
    const s=status(t), date=due(t,channel), sch=t.pack?.schedule?.[channel]||{};
    const el=document.createElement('div'); el.className='publish-card'; el.dataset.channel=channel; el.dataset.status=s; el.dataset.due=isDueToday(date)?'today':'later';
    el.innerHTML='<div class="publish-meta"></div><div class="publish-title"></div><div class="publish-line"><strong>Reminder:</strong> <span class="rem"></span></div><div class="publish-line"><strong>Slot:</strong> <span class="slot"></span></div><div class="publish-actions"></div>';
    el.querySelector('.publish-meta').textContent=(t.id||'')+' - '+channel+' - '+s;
    el.querySelector('.publish-title').textContent=title(t);
    el.querySelector('.rem').textContent=isDueToday(date)?'Upload today':'Prepare for '+date;
    el.querySelector('.slot').textContent=date+(sch.time?' - '+sch.time:'');
    const actions=el.querySelector('.publish-actions');
    const open=document.createElement('button'); open.textContent='Open'; open.onclick=()=>window.openDetail?.(t.id); actions.append(open);
    const sched=document.createElement('button'); sched.className='primary'; sched.textContent=s==='scheduled'?'Reschedule':'Schedule'; sched.onclick=()=>window.scheduleCommsPrompt(t.id,channel,date,type); actions.append(sched);
    if(channel==='social'||channel==='video'){const upload=document.createElement('button'); upload.textContent='Upload pack'; upload.onclick=()=>window.openUploadPack?.(t.id,title(t)); actions.append(upload); const pack=document.createElement('button'); pack.textContent='Ready pack'; pack.onclick=()=>window.openReadyPack?.(t.id,title(t)); actions.append(pack);}
    return el;
  }
  function fill(id,countId,items,channel,type,empty){
    const box=document.getElementById(id), count=document.getElementById(countId); if(!box)return; box.replaceChildren(); count.textContent=items.length;
    if(!items.length){const e=document.createElement('div');e.className='publish-empty';e.textContent=empty;box.append(e);return;}
    items.slice(0,5).forEach(t=>box.append(card(t,channel,type)));
  }
  const approved=all.filter(t=>['approved','scheduled'].includes(status(t)));
  const devlogs=all.filter(t=>kind(t)==='devlog'&&['approved','pending'].includes(status(t))).slice(0,5);
  const newsletter=approved.filter(t=>!t.pack?.posted?.newsletter).slice(0,5);
  const socials=approved.filter(t=>!t.pack?.posted?.social).slice(0,5);
  const video=socials.filter(t=>/video|reel|youtube|workshop|game|arcade|play/i.test([title(t),t.tag,t.desc].join(' '))).slice(0,5);
  const scheduledItems=[];\n  approved.forEach(t=>['social','newsletter','video','devlog'].forEach(channel=>{if(t.pack?.schedule?.[channel]?.date)scheduledItems.push({task:t,channel,date:t.pack.schedule[channel].date});}));\n  const missed=scheduledItems.filter(x=>isMissed(x.date)).map(x=>x.task);\n  fill('pubMissed','pubMissedLaneCount',missed,'social','social','No missed uploads.');\n  fill('pubDevlogs','pubDevlogCount',devlogs,'devlog','devlog','No Dev Log reminders right now.');
  fill('pubNewsletter','pubNewsletterCount',newsletter,'newsletter','newsletter','Friday newsletter has no approved items yet.');
  fill('pubSocial','pubSocialCount',socials,'social','social','No approved social posts waiting to schedule.');
  fill('pubVideo','pubVideoCount',video,'video','reel','No Reels/video candidates yet.');
  const total=devlogs.length+newsletter.length+socials.length+video.length;
  const dueToday=[...devlogs.map(t=>due(t,'devlog')),...newsletter.map(t=>due(t,'newsletter')),...socials.map(t=>due(t,'social')),...video.map(t=>due(t,'video'))].filter(isDueToday).length;
  const todayBox=document.getElementById('pubTodayCount'); if(todayBox) todayBox.textContent=dueToday;\n  const missedBox=document.getElementById('pubMissedCount'); if(missedBox) missedBox.textContent=missed.length;\n  const summary=document.getElementById('publishSummary'); if(summary) summary.textContent=total+' reminder(s), '+dueToday+' due today, '+missed.length+' missed, newsletter target '+iso(friday);
})();
${SCRIPT_END}`;

function replaceBlock(html,start,end,chunk,fallback){const s=html.indexOf(start);const e=html.indexOf(end,s+start.length);if(s!==-1&&e!==-1)return html.slice(0,s)+chunk+html.slice(e+end.length);return fallback(html,chunk);}
function patchBoard(){
  let html=fs.readFileSync(BOARD,'utf8');
  html=replaceBlock(html,STYLE_START,STYLE_END,STYLE,(src,chunk)=>src.replace('</style>',chunk+'\n</style>'));
  html=replaceBlock(html,SECTION_START,SECTION_END,SECTION,(src,chunk)=>src.replace('<!-- Today dashboard start -->',chunk+'\n<!-- Today dashboard start -->'));
  html=replaceBlock(html,SCRIPT_START,SCRIPT_END,SCRIPT,(src,chunk)=>src.replace('// Today dashboard - generated from board arrays',chunk+'\n// Today dashboard - generated from board arrays'));
  fs.writeFileSync(BOARD,html,'utf8');
}
function patchServer(){
  let s=fs.readFileSync(SERVER,'utf8');
  s=s.replace("'/api/comms-approve','/api/comms-decline','/api/comms-posted'","'/api/comms-approve','/api/comms-decline','/api/comms-posted','/api/comms-schedule'");
  if(!s.includes("if(req.url==='/api/comms-schedule')")){
    const block=`\n      if(req.url==='/api/comms-schedule'){\n        const cid=data.id; if(!cid || !isValidId(cid)) throw new Error('missing or invalid id');\n        const channel=(data.channel||'social').trim();\n        if(!['social','newsletter','devlog','video'].includes(channel)) throw new Error('invalid channel');\n        const date=String(data.date||'').slice(0,10); if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) throw new Error('date must be YYYY-MM-DD');\n        const tasks=loadTasks(); const t=tasks.find(x=>x.id===cid); if(!t) throw new Error('No task '+cid);\n        if(!t.commsPack) t.commsPack={version:1,status:t.commsStatus||'pending'};\n        if(!t.commsPack.schedule) t.commsPack.schedule={};\n        t.commsPack.schedule[channel]={date,time:String(data.time||'unspecified').slice(0,80),type:String(data.type||channel).slice(0,40),status:'scheduled',at:new Date().toISOString()};\n        if(t.commsPack.status==='approved') t.commsPack.status='scheduled';\n        t.commsStatus=t.commsPack.status;\n        t.evidence=(t.evidence||'')+'\\n['+new Date().toISOString().slice(0,10)+' josh] Scheduled '+channel+' for '+date+' '+t.commsPack.schedule[channel].time;\n        withFileLock(()=> saveTasks(tasks));\n        execFileSync(process.execPath, [path.join(ROOT,'board-keeper.cjs'),'--sync'], {stdio:'inherit'});\n        res.writeHead(200,{'Content-Type':'application/json'}); return res.end(JSON.stringify({ok:true,schedule:t.commsPack.schedule[channel]}));\n      }\n`;
    s=s.replace("      if(req.url==='/api/comms-posted'){",block+"\n      if(req.url==='/api/comms-posted'){");
  }
  fs.writeFileSync(SERVER,s,'utf8');
}
patchBoard();
patchServer();
console.log('Updated private board Publishing Calendar and schedule API');




