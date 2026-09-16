#!/usr/bin/env node
/*
 * Add/update the Today dashboard on the private Studio Board.
 * Run after board syncs so the daily command view stays strict and current.
 */
const fs = require('fs');

const BOARD = 'F:/Website/studio-workspace/board/index.html';

const STYLE_START = '/* Today dashboard - daily command view */';
const STYLE_END = '/* End Today dashboard */';
const SECTION_START = '<!-- Today dashboard start -->';
const SECTION_END = '<!-- Today dashboard end -->';
const SCRIPT_START = '// Today dashboard - generated from board arrays';
const SCRIPT_END = '// End Today dashboard';

const STYLE = `${STYLE_START}
.today-dashboard{margin:0 0 18px;padding:16px;border:2px solid #0f766e;border-radius:16px;background:#f8fffd;color:#12352f;box-shadow:0 8px 22px rgba(15,118,110,.12)}
.today-head{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px}
.today-head h2{font-size:1.15rem;margin:0;color:#12352f}.today-sub{font-size:.78rem;color:#38645d;font-weight:700}
.today-grid{display:grid;grid-template-columns:repeat(4,minmax(220px,1fr));gap:12px}.today-lane{background:#fff;border:1px solid #b7ddd6;border-radius:12px;min-height:130px;overflow:hidden}
.today-lane h3{margin:0;padding:10px 12px;font-size:.82rem;color:#0f172a;background:#e6f6f2;border-bottom:1px solid #b7ddd6;display:flex;justify-content:space-between;gap:8px}.today-limit{font-size:.66rem;color:#64748b;font-weight:800}
.today-list{display:flex;flex-direction:column;gap:8px;padding:10px}.today-card{background:#fffaf0;border:1px solid #ead7ad;border-left:4px solid #f59e0b;border-radius:10px;padding:9px;display:grid;gap:6px}
.today-card[data-priority="P1"]{border-left-color:#dc2626}.today-card[data-kind="comms"]{border-left-color:#f59e0b}.today-card[data-kind="review"]{border-left-color:#16a34a}.today-card[data-kind="audit"]{border-left-color:#2563eb}
.today-title{font-size:.78rem;font-weight:900;color:#172033;line-height:1.35}.today-meta{font-size:.66rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.04em}.today-line{font-size:.72rem;color:#475569;line-height:1.35}.today-line strong{color:#12352f}
.today-card button{justify-self:start;font-size:.68rem;font-weight:900;border:1px solid #b7ddd6;background:#effaf7;color:#0f766e;border-radius:999px;padding:5px 9px;cursor:pointer}.today-empty{font-size:.74rem;color:#64748b;padding:10px;line-height:1.4}
@media(max-width:1150px){.today-grid{grid-template-columns:repeat(2,minmax(220px,1fr))}}@media(max-width:620px){.today-grid{grid-template-columns:1fr}.today-dashboard{padding:12px}}
${STYLE_END}`;

const SECTION = `${SECTION_START}
    <section class="today-dashboard" id="todayDashboard" aria-label="Today's tasks dashboard">
      <div class="today-head">
        <h2>Today&apos;s Tasks</h2>
        <span class="today-sub" id="todaySummary">Loading daily command view...</span>
      </div>
      <div class="today-grid">
        <div class="today-lane"><h3>Must Do Today <span><span id="todayMustCount">0</span> <span class="today-limit">/ 3</span></span></h3><div class="today-list" id="todayMust"></div></div>
        <div class="today-lane"><h3>Ready To Approve <span><span id="todayShipCount">0</span> <span class="today-limit">/ 3</span></span></h3><div class="today-list" id="todayShip"></div></div>
        <div class="today-lane"><h3>Comms To Post <span><span id="todayCommsCount">0</span> <span class="today-limit">/ 3</span></span></h3><div class="today-list" id="todayComms"></div></div>
        <div class="today-lane"><h3>App Audit Next <span><span id="todayAuditCount">0</span> <span class="today-limit">/ 3</span></span></h3><div class="today-list" id="todayAudit"></div></div>
      </div>
    </section>
${SECTION_END}`;

const SCRIPT = `${SCRIPT_START}
(function(){
  const LIMIT=3;
  const all=[...HUMAN_REVIEW.map(t=>({...t,laneStatus:t.status||'human_review'})),...IN_PROGRESS.map(t=>({...t,laneStatus:'in_progress'})),...BACKLOG.map(t=>({...t,laneStatus:t.status||'backlog'}))];
  const allComms=[...DEVLOG_DRAFTS,...SOCIAL_DRAFTS].filter(t=>t.commsPack).map(t=>({...t,pack:t.commsPack}));
  const text=t=>[t.id,t.title,t.tag,t.priority,t.desc,t.done,t.evidence].join(' ').toLowerCase();
  const urgentRe=/broken|crash|blocker|urgent|fail|drift|security|privacy|validation|release|store|dead|blank|overflow/i;
  const appAuditRe=/app|android|aab|play store|native|device|bundle|store-ready|release verification/i;
  function ageDays(t){const d=t.claimedAt||t.updated||t.approvedAt||t.date;const ts=Date.parse(d);return Number.isFinite(ts)?(Date.now()-ts)/86400000:0;}
  function commsStatus(t){const p=t.pack||{};if(p.posted?.social||p.posted?.newsletter)return'posted';return p.status||t.commsStatus||'pending';}
  function nextAction(t,kind){
    if(kind==='comms'){const s=commsStatus(t),p=t.pack||{};if(s==='approved')return p.kind==='devlog'?'Publish Dev Log or prep social copy':'Post/send approved copy';if(s==='declined')return'Rewrite from decline note';return'Review and approve copy';}
    if(kind==='review')return'Approve or reject';
    if(kind==='audit')return t.laneStatus==='in_progress'?'Finish app audit':'Claim app audit';
    if(t.laneStatus==='in_progress')return'Check progress or unblock';
    if(urgentRe.test(text(t)))return'Claim and fix';
    return'Claim next';
  }
  function whyToday(t,kind){
    if(kind==='comms'){const s=commsStatus(t);if(s==='approved')return'Approved copy should leave the action pile after posting.';if(s==='declined')return'Needs edits before it can be used publicly.';return'It is active comms work with a board link.';}
    if(kind==='review')return'Finished work is waiting for Josh and may unlock shipping.';
    if(kind==='audit')return'App audits feed reliable release tickets into the board.';
    if(t.laneStatus==='in_progress'&&ageDays(t)>5)return'In progress for several days, so it may need a nudge.';
    if(t.laneStatus==='in_progress')return'Already started, so finishing beats starting more work.';
    if(urgentRe.test(text(t)))return'Tagged as broken, failing, release, privacy, security or validation work.';
    return'High priority and relevant to the current studio push.';
  }
  function score(t,kind){let n=t.priority==='P1'?60:t.priority==='P2'?30:10;const hay=text(t);if(kind==='review')n+=70;if(kind==='comms'&&commsStatus(t)==='approved')n+=70;if(kind==='comms')n+=35;if(t.laneStatus==='in_progress')n+=35;if(urgentRe.test(hay))n+=35;if(t.tag==='apps'||appAuditRe.test(hay))n+=20;if(ageDays(t)>5)n+=10;return n;}
  const byScore=(kind)=>(a,b)=>score(b,kind)-score(a,kind)||String(a.id).localeCompare(String(b.id));
  const must=all.filter(t=>t.priority==='P1'&&(t.laneStatus==='in_progress'||urgentRe.test(text(t)))).sort(byScore('task')).slice(0,LIMIT);
  const ship=HUMAN_REVIEW.slice().sort(byScore('review')).slice(0,LIMIT);
  const comms=allComms.filter(t=>['approved','pending','declined'].includes(commsStatus(t))).sort((a,b)=>score(b,'comms')-score(a,'comms')||String(a.id).localeCompare(String(b.id))).slice(0,LIMIT);
  const audit=all.filter(t=>t.tag==='apps'||appAuditRe.test(text(t))).sort(byScore('audit')).slice(0,LIMIT);
  function render(list,id,countId,kind){
    const box=document.getElementById(id),count=document.getElementById(countId);if(!box)return;count.textContent=list.length;box.replaceChildren();
    if(!list.length){const e=document.createElement('div');e.className='today-empty';e.textContent='Nothing here right now.';box.append(e);return;}
    list.forEach(t=>{const card=document.createElement('div');card.className='today-card';card.dataset.priority=t.priority||'P2';card.dataset.kind=kind||'task';const s=kind==='comms'?commsStatus(t):(t.laneStatus||t.status||'task');
      card.innerHTML='<div class="today-meta">'+(t.id||'')+' · '+(t.priority||'')+' · '+(t.tag||t.pack?.kind||'comms')+' · '+s+'</div><div class="today-title"></div><div class="today-line"><strong>Next:</strong> <span class="next"></span></div><div class="today-line"><strong>Why today:</strong> <span class="why"></span></div>';
      card.querySelector('.today-title').textContent=(t.pack?.title||t.title||'Untitled');card.querySelector('.next').textContent=nextAction(t,kind);card.querySelector('.why').textContent=whyToday(t,kind);
      const btn=document.createElement('button');btn.type='button';btn.textContent=kind==='comms'?'Open comms':'Open task';btn.onclick=()=>window.openDetail?.(t.id);card.append(btn);box.append(card);});
  }
  render(must,'todayMust','todayMustCount','task');render(ship,'todayShip','todayShipCount','review');render(comms,'todayComms','todayCommsCount','comms');render(audit,'todayAudit','todayAuditCount','audit');
  const total=must.length+ship.length+comms.length+audit.length;const summary=document.getElementById('todaySummary');if(summary)summary.textContent=total?total+' focused item(s), capped at 3 per lane':'No urgent action items showing right now';
})();
${SCRIPT_END}`;

function replaceBlock(html, start, end, chunk, fallback) {
  const s = html.indexOf(start);
  const e = html.indexOf(end, s + start.length);
  if (s !== -1 && e !== -1) return html.slice(0, s) + chunk + html.slice(e + end.length);
  return fallback(html, chunk);
}

let html = fs.readFileSync(BOARD, 'utf8');
html = replaceBlock(html, STYLE_START, STYLE_END, STYLE, (src, chunk) => src.replace('</style>', chunk + '\n</style>'));
html = replaceBlock(html, SECTION_START, SECTION_END, SECTION, (src, chunk) => {
  if (src.includes('id="todayDashboard"')) return src.replace(/\s*<section class="today-dashboard" id="todayDashboard"[\s\S]*?<\/section>\s*/, '\n' + chunk + '\n');
  return src.replace('<div id="addCardPanel"', chunk + '\n<div id="addCardPanel"');
});
html = replaceBlock(html, SCRIPT_START, SCRIPT_END, SCRIPT, (src, chunk) => {
  const old=/\/\/ Today dashboard - generated from board arrays[\s\S]*?\}\)\(\);\s*(?=\/\/ Health strip)/;
  if (old.test(src)) return src.replace(old, chunk + '\n');
  return src.replace('// Health strip', chunk + '\n// Health strip');
});
fs.writeFileSync(BOARD, html, 'utf8');
console.log('Updated private board Today dashboard');
