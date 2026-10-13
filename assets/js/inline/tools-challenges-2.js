const DB='jvds-challenges-v1', STORE='progress';
const CHALLENGES=[
  {id:'c1',title:'Pixel Hero + Gem Match',desc:'Draw a 16×16 hero in Pixel Studio, then score 500 in Gem Match.',tools:['pixel-studio','gem-match'],xp:50,badge:'Hero Maker',period:'weekly'},
  {id:'c2',title:'Chiptune Sprint',desc:'Make a 4-bar loop in Audio Studio, then beat Level 2 in Lumo Dash.',tools:['sound-studio','lumo-dash'],xp:40,badge:'Beat Smith',period:'weekly'},
  {id:'c3',title:'World Seed',desc:'Build a 10×10 world in World Builder and export PNG.',tools:['level-designer'],xp:30,badge:'World Starter',period:'weekly'},
  {id:'c4',title:'Story Sprint',desc:'Write a 3-node branching story in Story Editor, play it in Story Player.',tools:['story-editor','story-player'],xp:35,badge:'Teller',period:'weekly'},
  {id:'c5',title:'Icon Forge',desc:'Design an app icon for your game, export 512 + 192.',tools:['icon-generator'],xp:25,badge:'Iconist',period:'weekly'},
  {id:'c6',title:'Monthly Epic: Mini Arcade',desc:'Ship a tiny arcade game: Pixel art + Level + Sound + Playtest. Monthly, bigger XP.',tools:['pixel-studio','level-designer','sound-studio','arcade-game-maker'],xp:150,badge:'Arcade Captain',period:'monthly'}
];
const $=id=>document.getElementById(id);
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=e=>{const db=e.target.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE);};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
async function getProgress(){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction(STORE,'readonly');const req=tx.objectStore(STORE).getAll();req.onsuccess=()=>{const map={};(req.result||[]).forEach(r=>map[r.id]=r);res(map);};req.onerror=()=>rej(req.error);tx.oncomplete=()=>db.close();});}
async function setDone(id,done){const db=await openDB();await new Promise((res,rej)=>{const tx=db.transaction(STORE,'readwrite');const st=tx.objectStore(STORE);if(done)st.put({id,ts:Date.now()}); else st.delete(id);tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});}
function announce(m){const a=document.getElementById('jvds-announce');if(a){a.textContent=m;setTimeout(()=>a.textContent='',1500);}}
let currentPeriod='weekly';
async function render(){
  const prog=await getProgress();const grid=$('grid');grid.innerHTML='';
  const list=CHALLENGES.filter(c=>c.period===currentPeriod);
  let doneCount=0, xp=0;
  list.forEach(ch=>{
    const done=!!prog[ch.id];
    if(done){doneCount++;xp+=ch.xp;}
    const pct=done?100:0;
    const el=document.createElement('article');el.className='card';
    el.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center"><span class="badge">${ch.period} • ${ch.xp} XP</span><span class="badge" style="${done?'background:rgba(16,185,129,.2)':''}">${done?'✓ Done':'To do'}</span></div><h2>${ch.title}</h2><p class="meta">${ch.desc}</p><div style="display:flex;gap:6px;flex-wrap:wrap">${ch.tools.map(t=>`<span class="badge">${t}</span>`).join('')}</div><div class="progress" aria-hidden="true"><div class="bar" style="width:${pct}%"></div></div><div style="display:flex;gap:8px"><button class="btn ${done?'':'primary'}" data-id="${ch.id}" type="button">${done?'Undo':'Complete (offline)'}</button><span style="align-self:center;font-size:.85rem;color:var(--muted)">${ch.badge}</span></div>`;
    grid.appendChild(el);
  });
  $('statDone').textContent=doneCount+' / '+list.length+' completed';
  $('statXP').textContent=xp+' XP';
  const streak=Object.keys(prog).length; $('statStreak').textContent='Streak '+streak;
  grid.querySelectorAll('button[data-id]').forEach(b=>b.onclick=async()=>{const id=b.dataset.id;const was=!!prog[id];await setDone(id,!was);if(!was){if(window.ToolXP)ToolXP.award('challenge-'+id,CHALLENGES.find(c=>c.id===id).xp);announce('Challenge complete! +'+CHALLENGES.find(c=>c.id===id).xp+' XP');} else announce('Challenge undone');render();});
}
document.getElementById('btnWeekly').onclick=()=>{currentPeriod='weekly';render();};
document.getElementById('btnMonthly').onclick=()=>{currentPeriod='monthly';render();};
document.getElementById('btnReset').onclick=async()=>{if(!confirm('Reset all challenge progress?'))return;const db=await openDB();await new Promise((res,rej)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).clear().onsuccess=res;tx.onerror=()=>rej(tx.error);tx.oncomplete=()=>db.close();});announce('Challenges reset');render();};
render();
document.addEventListener('DOMContentLoaded',()=>{if(window.EmberGuide)EmberGuide.init({id:'challenges',steps:[{target:'#grid',title:'Pick a challenge',text:'Pip picks a fun one, Echo tracks XP - all offline.'},{target:'.stats',title:'XP & streaks',text:'Leaderboard syncs when online, but you keep XP offline.'}]})});
