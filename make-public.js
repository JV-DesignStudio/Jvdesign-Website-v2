// make-public.js, generates quest-board.html (clean public version) from project-tracker.html
// Run: node make-public.js
'use strict';
const fs = require('fs');
const { spawnSync } = require('child_process');

console.log('\n⚔️  Building quest-board.html...\n');
let c = fs.readFileSync('project-tracker.html', 'utf8');
const errs = [], done = [];

function rep(from, to, label) {
  if (!c.includes(from)) { errs.push('MISS: ' + label); return; }
  c = c.replace(from, to);
  done.push(label);
}

// ── 1. Title & meta ──────────────────────────────────────────────────────────
rep('<title>RPG Quest Board, JVDesignStudio</title>',
    '<title>Quest Board RPG, Your Personal Adventure</title>', 'title');

// ── 2. localStorage keys (keep owner's data separate) ────────────────────────
rep("const SK='jvds-tracker-v2', RK='jvds-rpg-v1';",
    "const SK='qb-data-v1', RK='qb-rpg-v1';", 'localStorage keys');

// ── 3. nextId ─────────────────────────────────────────────────────────────────
rep('  nextId:400', '  nextId:10', 'nextId');

// ── 4. Columns array ─────────────────────────────────────────────────────────
// Strategy: find the section between  columns:[  and  ],  cards:[
// then replace just the content, keeping both delimiters intact.
{
  const S = '  columns:[\n', E = '\n  ],\n  cards:[';
  const si = c.indexOf(S), ei = c.indexOf(E);
  if (si === -1 || ei === -1) { errs.push('MISS: columns'); }
  else {
    // c.slice(ei) still starts with '\n  ],\n  cards:[' which we keep
    c = c.slice(0, si + S.length) +
      `    {id:'todo',  title:'📋 To Do',       colour:'#7c3aed'},\n` +
      `    {id:'doing', title:'⚡ In Progress',  colour:'#f59e0b'},\n` +
      `    {id:'review',title:'🔍 In Review',   colour:'#0284c7'},\n` +
      `    {id:'done',  title:'✅ Done',         colour:'#404040'},\n` +
      c.slice(ei);          // keeps '\n  ],\n  cards:['
    done.push('columns (4 generic)');
  }
}

// ── 5. Cards array ────────────────────────────────────────────────────────────
// After step 4 the columns close with  ],\n  cards:[  which is still there.
// The cards array ends with  ],\n  nextId:10  (we just set that).
{
  const S = '  cards:[\n', E = '\n  ],\n  nextId:10';
  const si = c.indexOf(S), ei = c.indexOf(E);
  if (si === -1 || ei === -1) { errs.push('MISS: cards'); }
  else {
    const ISO = new Date().toISOString();
    const mk = (id, col, title, desc, pri, boss, tag, tagCol) =>
      `    {id:'${id}',colId:'${col}',title:'${title}',desc:'${desc}',` +
      `tags:[{text:'${tag}',col:'${tagCol}'}],priority:'${pri}',date:'',` +
      `comments:[],isBoss:${boss},prereqId:'',repeat:'none',timeLogs:[],` +
      `flag:null,createdAt:'${ISO}'}`;

    c = c.slice(0, si + S.length) +
      mk('ex1','doing','👋 Welcome to Quest Board!',
         'Drag this card to Done once you have had a look around. Your whole life is a quest, this is where you track it.',
         'high', false, 'Start here','#7c3aed') + ',\n' +
      mk('ex2','doing','Try the Daily Bounties',
         'Open the 🏠 HQ Dashboard, complete daily bounties for bonus XP and gold. Hit 🔄 to reroll them.',
         'med', false, 'Tutorial','#0284c7') + ',\n' +
      mk('ex3','todo','Add your first real task',
         'Press + New Quest (or Ctrl+K). Type "fix", "urgent", or "video" and watch priority + column auto-assign.',
         'med', false, 'Try it','#16a34a') + ',\n' +
      mk('ex4','todo','Write a note',
         'Go to the 📝 Notes tab and capture an idea, meeting notes, or anything. Notes can link to quests.',
         'low', false, 'Try it','#d97706') + ',\n' +
      mk('ex5','todo','⚔️ Defeat a Boss Quest',
         'Create a quest, tick Boss Battle, add - [ ] checklist items. Boss quests have HP bars that fill as you tick!',
         'high', true, 'Boss','#dc2626') + ',\n' +
      c.slice(ei);          // keeps '\n  ],\n  nextId:10'
    done.push('cards (5 clean example cards)');
  }
}

// ── 6. Player name, replace hardcoded "Josh" references ─────────────────────
// In JS templates
c = c.split('`Josh, ${rpg.title}`').join("`${localStorage.getItem('qb-player-name')||'Adventurer'}, ${rpg.title}`");
c = c.split('`Josh- ${rpg.title}`').join("`${localStorage.getItem('qb-player-name')||'Adventurer'}, ${rpg.title}`");
// In HTML default text
c = c.split('Josh, The Novice').join('Adventurer, The Novice');
c = c.split('Josh- the Novice').join('Adventurer, The Novice');
done.push('player name → dynamic');

// ── 7. Auth gate + auth script → Setup Wizard ─────────────────────────────────
// Everything from <!-- AUTH GATE --> to the end of the file gets replaced
// with the setup wizard HTML + its own <script> block + </body></html>.
const AUTH_MARKER = '\n<!-- AUTH GATE -->';
const authIdx = c.lastIndexOf(AUTH_MARKER);
if (authIdx === -1) { errs.push('MISS: auth gate position'); }
else {
  const SETUP_HTML = `
<!-- SETUP WIZARD (first-run, replaces auth gate) -->
<div id="setupGate" style="display:none;position:fixed;inset:0;z-index:99999;background:radial-gradient(ellipse at 50% 40%,#0f0a1e 0%,#000 100%);flex-direction:column;align-items:center;justify-content:center;gap:16px">
  <div id="setupStars" style="position:absolute;inset:0;overflow:hidden;pointer-events:none"></div>
  <div style="font-size:3.5rem;animation:authFloat 3s ease-in-out infinite;position:relative">⚔️</div>
  <div style="font-family:'Cinzel',serif;font-size:2rem;color:var(--gold);font-weight:900;text-shadow:0 0 30px rgba(245,200,66,.5);position:relative;text-align:center">Quest Board RPG</div>
  <div style="font-size:.78rem;color:rgba(255,255,255,.35);letter-spacing:.06em;text-transform:uppercase;position:relative;text-align:center">Create your adventurer, takes 10 seconds</div>
  <input id="setupName" type="text" placeholder="Your name…" maxlength="24"
    style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:13px 22px;color:#fff;font-size:1rem;width:280px;text-align:center;outline:none;font-family:'JetBrains Mono',monospace;position:relative;transition:border-color .2s"
    onfocus="this.style.borderColor='rgba(245,200,66,.5)'" onblur="this.style.borderColor='rgba(255,255,255,.15)'"
    onkeydown="if(event.key==='Enter')document.getElementById('setupClass').focus()">
  <select id="setupClass"
    style="background:#1a1030;border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:13px 22px;color:#fff;font-size:.9rem;width:280px;outline:none;cursor:pointer;position:relative">
    <option value="Code Conjurer">🧙‍♂️ Code Conjurer, builds things</option>
    <option value="Pixel Paladin">🗡️ Pixel Paladin, ships features</option>
    <option value="Design Druid">🦊 Design Druid, makes it beautiful</option>
    <option value="QA Ranger">🏹 QA Ranger, finds the bugs</option>
  </select>
  <button id="setupBtn" onclick="completeSetup()"
    style="background:linear-gradient(135deg,#7c3aed,#a855f7);border:none;border-radius:12px;padding:14px 44px;color:#fff;font-size:.95rem;font-weight:900;cursor:pointer;font-family:'Cinzel',serif;box-shadow:0 0 24px rgba(124,58,237,.45);position:relative;letter-spacing:.06em;transition:transform .15s,box-shadow .15s">
    ⚔️ BEGIN YOUR QUEST
  </button>
  <div style="font-size:.65rem;color:rgba(255,255,255,.2);position:relative">All data is saved locally on your device only, nothing is sent anywhere</div>
</div>`;

  const SETUP_JS = `
// ── SETUP WIZARD (public version, no password, first-run name/class picker) ──
const SETUP_KEY = 'qb-setup-v1';

(function initSetup(){
  if(localStorage.getItem(SETUP_KEY))return; // already set up on this device
  const gate=document.getElementById('setupGate');
  if(!gate)return;
  gate.style.display='flex';
  document.body.style.overflow='hidden';
  // Spawn twinkling stars
  const stars=document.getElementById('setupStars');
  for(let i=0;i<80;i++){
    const s=document.createElement('div');
    const x=Math.random()*100,y=Math.random()*100,r=Math.random()*.8+.2,d=Math.random()*4+2;
    s.style.cssText=\`position:absolute;left:\${x}%;top:\${y}%;width:\${r*2}px;height:\${r*2}px;border-radius:50%;background:#fff;opacity:\${Math.random()*.5+.1};animation:starTwinkle \${d}s \${Math.random()*3}s infinite\`;
    stars.appendChild(s);
  }
  // Inject keyframes (only once)
  if(!document.getElementById('starKf')){
    const st=document.createElement('style');st.id='starKf';
    st.textContent='@keyframes starTwinkle{0%,100%{opacity:.1}50%{opacity:.8}}@keyframes authFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}';
    document.head.appendChild(st);
  }
  setTimeout(()=>document.getElementById('setupName')?.focus(),150);
})();

function completeSetup(){
  const name=(document.getElementById('setupName').value.trim()||'Adventurer').slice(0,24);
  const cls=document.getElementById('setupClass').value;
  localStorage.setItem(SETUP_KEY,'1');
  localStorage.setItem('qb-player-name',name);
  // Apply to RPG state and save
  rpg.class=cls;
  if(!rpg.notes)rpg.notes=[];
  if(!rpg.selfCare)rpg.selfCare={items:[],checkInDate:'',mood:{},weeklyBoss:null};
  save();updateRpgWidgets();updateStreakDisplay();
  // Close gate
  const gate=document.getElementById('setupGate');
  if(gate){gate.style.transition='opacity .4s';gate.style.opacity='0';setTimeout(()=>{gate.style.display='none';document.body.style.overflow='';},420);}
  // Welcome
  try{playSfx('levelup');}catch(e){}
  setTimeout(()=>{
    showToast(\`⚔️ Welcome, \${name}! Your adventure begins now.\`,'success');
    renderDash();flashScreen();
  },250);
}
`;

  c = c.slice(0, authIdx) +
      SETUP_HTML +
      '\n\n<script>' + SETUP_JS + '</script>' +
      '\n</body>\n</html>';
  done.push('auth gate → setup wizard');
}

// ── 8. Write output ───────────────────────────────────────────────────────────
fs.writeFileSync('quest-board.html', c);

// ── 9. Syntax check all inline scripts ───────────────────────────────────────
let idx = 0, scriptCount = 0, allOk = true;
while (true) {
  const s = c.indexOf('<script', idx); if (s === -1) break;
  const te = c.indexOf('>', s); const e = c.indexOf('</script>', te); if (e === -1) break;
  const src = c.slice(te + 1, e);
  if (src.trim() && !c.slice(s, te + 1).includes('src=')) {
    scriptCount++;
    fs.writeFileSync('_tmp.js', src);
    const r = spawnSync('node', ['--check', '_tmp.js'], { encoding: 'utf8' });
    if (r.status !== 0) {
      console.log('  ✗ SYNTAX ERROR in script', scriptCount);
      console.log('   ', r.stderr.split('\n').slice(0, 4).join('\n    '));
      allOk = false;
    }
  }
  idx = e + 9;
}
try { fs.unlinkSync('_tmp.js'); } catch(e) {}

// ── 10. Report ────────────────────────────────────────────────────────────────
console.log('Transformations:');
done.forEach(d => console.log('  ✓', d));
if (errs.length) { console.log('\nErrors:'); errs.forEach(e => console.log('  ✗', e)); }
console.log('\n─────────────────────────────────────────────');
console.log(`Scripts: ${scriptCount} | Syntax: ${allOk ? '✅ ALL OK' : '❌ HAS ERRORS'}`);
console.log(`Size: ${(fs.statSync('quest-board.html').size / 1024).toFixed(0)}KB`);
console.log('─────────────────────────────────────────────\n');
