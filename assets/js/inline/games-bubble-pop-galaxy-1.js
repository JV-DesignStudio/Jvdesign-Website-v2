const gameSystem = new GameSystem('bubble-pop', 'Bubble Pop Galaxy', 'pip');
const audioEffects = new AudioEffects(0.7);
if (localStorage.getItem('soundEnabled') === 'false') audioEffects.setMasterVolume(0);

const storyRun = window.__storyRun = new StoryRun({
  id: 'bubble-pop',
  title: 'Light the Lanterns',
  character: 'Stardust',
  open: 'Stardust lit the way in, and the Lantern Nebula has gone dark.',
  objective: 'Pop the matching colours, reach the score target and light the nebula.',
  beats: [
    { at: 0, text: 'The first clusters pop and the lanterns start to glow.' },
    { at: 0.4, text: 'The chain builds and the nebula brightens.' },
    { at: 0.8, text: 'One last cluster to light the whole nebula.' }
  ],
  cap: 300,
  result: {
    success: 'The nebula lights up, you see your stars, then Stardust hands you the same mission to beat.',
    partial: 'The nebula glows part way and Stardust keeps the lanterns warm for another go.',
    fail: 'The moves run out with the nebula still dim, so Stardust points you to a better first cluster.'
  },
  onFinish: function(){ busy = true; },
  onRestart: function(){ startMission(); }
});

const COLS = 8, ROWS = 8;
const TYPES = ['red','teal','gold','violet','blue','green'];
const LABELS = { red:'Red', teal:'Teal', gold:'Gold', violet:'Violet', blue:'Blue', green:'Green' };
const ICONS = { bomb:'💣', rocketH:'🚀', rocketV:'↕️', wild:'🌈', rock:'🪨' };
const SAVE_KEY = 'bp_galaxy_combo_progress_v2';

// A591: one mission, finished in a few minutes. Stardust lit the way in; the
// lantern nebula just needs the colour goals met. No sector ladder, no unlocks.
const MISSION = {
  name:'Lantern Nebula',
  title:'Light the Lanterns',
  text:'Stardust lit the way in. Pop the matching colours and the nebula lanterns glow one by one.',
  colors:4,
  moves:14,
  target:12000,
  goals:{ score:12000, collect:{ red:12, teal:12 } }
};

let state = loadProgress();
let cells = [];
let nextId = 1;
let busy = false;
let run = {};

function loadProgress(){
  // A591: one mission, so only the stars for it and the best score are kept.
  try { return Object.assign({stars:{}, bestScore:0}, JSON.parse(localStorage.getItem(SAVE_KEY)||'{}')); }
  catch(e){ return {stars:{}, bestScore:0}; }
}
function saveProgress(){ try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch(e){} }
function starTotal(){ return Object.values(state.stars).reduce((a,b)=>a+b,0); }
function randType(max){ return TYPES[Math.floor(Math.random()*max)]; }

function startMission(){
  if (window.__storyRun && !window.__storyRun.running) window.__storyRun.begin();
  const cfg = MISSION;
  run = { score:0, moves:cfg.moves, combo:1, bestCombo:1, charge:0, specials:0, chainBest:0, collected:{}, rocksBroken:0, cleared:false, reported:0 };
  cells = [];
  nextId = 1;
  for(let r=0;r<ROWS;r++){
    cells[r]=[];
    for(let c=0;c<COLS;c++) cells[r][c] = makeBubble(randType(cfg.colors));
  }
  placeRocks(cfg.rocks||0);
  guaranteeMoves();
  busy = false;
  document.getElementById('modal').classList.remove('show');
  updateLevelStrip();
  render();
  updateHud();
  toast('Mission: ' + cfg.title);
}
function makeBubble(type, special=null){ return { id: nextId++, type, special, hp: special==='rock'?2:1 }; }
function placeRocks(count){
  let placed=0;
  while(placed<count){
    const r = 1 + Math.floor(Math.random()*(ROWS-2));
    const c = Math.floor(Math.random()*COLS);
    if(cells[r][c] && cells[r][c].special !== 'rock') { cells[r][c]=makeBubble('rock','rock'); placed++; }
  }
}
function guaranteeMoves(){
  if(hasMove()) return;
  cells[ROWS-1][0]=makeBubble('red'); cells[ROWS-1][1]=makeBubble('red');
}

function render(){
  const board = document.getElementById('board');
  const existing = new Map([...board.querySelectorAll('.bubble')].map(el=>[Number(el.dataset.id), el]));
  const live = new Set();
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const b = cells[r][c]; if(!b) continue;
    live.add(b.id);
    let el = existing.get(b.id);
    if(!el){
      el = document.createElement('button');
      el.type='button'; el.className='bubble'; el.dataset.id=b.id;
      el.innerHTML='<span class="shine"></span><span class="mark"></span>';
      el.addEventListener('click', ()=>handleTap(b.id));
      board.appendChild(el);
    }
    el.className = 'bubble ' + b.type + (b.special ? ' special ' + b.special : '');
    el.style.transform = 'translate('+(c*100)+'%, '+(r*100)+'%)';
    el.querySelector('.mark').textContent = ICONS[b.special] || '';
    el.setAttribute('aria-label', describeBubble(r,c,b));
  }
  board.querySelectorAll('.bubble').forEach(el=>{ if(!live.has(Number(el.dataset.id))) el.remove(); });
}
function describeBubble(r,c,b){
  if(b.special==='rock') return 'Rock bubble, crack with nearby pops';
  if(b.special) return (ICONS[b.special]||'Special') + ' special bubble';
  return LABELS[b.type] + ' bubble, cluster size ' + groupAt(r,c).length;
}
function findById(id){
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) if(cells[r][c] && cells[r][c].id===id) return {r,c,b:cells[r][c]};
  return null;
}
function neighbours(r,c){ return [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].filter(([rr,cc])=>rr>=0&&rr<ROWS&&cc>=0&&cc<COLS); }
function groupAt(r,c){
  const start = cells[r][c];
  if(!start || start.special==='rock') return [];
  if(start.special && start.special !== 'wild') return [[r,c]];
  const colour = start.type;
  const seen = new Set([r+','+c]);
  const stack = [[r,c]];
  const group=[];
  while(stack.length){
    const [cr,cc]=stack.pop(); group.push([cr,cc]);
    for(const [nr,nc] of neighbours(cr,cc)){
      const key=nr+','+nc, nb=cells[nr][nc];
      if(seen.has(key)||!nb||nb.special==='rock') continue;
      if(nb.type===colour || nb.special==='wild' || start.special==='wild') { seen.add(key); stack.push([nr,nc]); }
    }
  }
  return group;
}
function hasMove(){
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const b=cells[r][c]; if(!b) continue;
    if(b.special && b.special!=='rock') return true;
    if(groupAt(r,c).length>=2) return true;
  }
  return false;
}

function handleTap(id){
  if(busy || run.cleared) return;
  const found = findById(id); if(!found) return;
  const {r,c,b} = found;
  let hit = [];
  let specialUsed = false;
  if(b.special==='rock') { nudge(id); audioEffects.playError(); setStatus('Rocks crack when you pop beside them.'); return; }
  if(b.special==='bomb'){ hit = blast(r,c,1); specialUsed = true; }
  else if(b.special==='rocketH'){ hit = [...Array(COLS)].map((_,cc)=>[r,cc]); specialUsed = true; }
  else if(b.special==='rocketV'){ hit = [...Array(ROWS)].map((_,rr)=>[rr,c]); specialUsed = true; }
  else if(b.special==='wild'){ hit = wildGroup(r,c); specialUsed = true; }
  else { hit = groupAt(r,c); if(hit.length<2){ nudge(id); audioEffects.playError(); setStatus('Find a cluster of 2 or more matching bubbles.'); return; } }
  busy = true;
  run.moves--;
  resolveHit(hit, {r,c,b,specialUsed, manual:true});
}
function wildGroup(r,c){
  let best = [[r,c]];
  for(const [nr,nc] of neighbours(r,c)){
    const g = groupAt(nr,nc);
    if(g.length > best.length) best = [[r,c], ...g];
  }
  return uniqueCells(best);
}
function blast(r,c,rad){
  const out=[];
  for(let rr=r-rad;rr<=r+rad;rr++) for(let cc=c-rad;cc<=c+rad;cc++) if(rr>=0&&rr<ROWS&&cc>=0&&cc<COLS) out.push([rr,cc]);
  return out;
}
function uniqueCells(list){
  const seen=new Set(), out=[];
  for(const [r,c] of list){ const k=r+','+c; if(!seen.has(k)){ seen.add(k); out.push([r,c]); } }
  return out;
}

function resolveHit(hit, ctx){
  hit = uniqueCells(hit).filter(([r,c])=>cells[r][c]);
  const size = hit.length;
  const specialName = ctx.specialUsed ? 'special blast' : size>=8 ? 'mega cluster' : size>=5 ? 'big cluster' : 'cluster';
  run.bestCombo = Math.max(run.bestCombo, run.combo);
  const gained = Math.round((size*size*12 + size*35) * run.combo);
  run.score += gained;
  run.charge = Math.min(100, run.charge + size * (ctx.specialUsed ? 5 : 3));
  if(ctx.specialUsed) run.specials++;
  collectAndRemove(hit, ctx);
  crackRocks(hit);
  spawnSpecial(ctx, size);
  popFx(ctx.r, ctx.c, '+'+gained+' · '+specialName);
  updateHud();
  setTimeout(()=>{
    collapse(); refill(); render();
    const cascades = findCascadeGroups();
    if(cascades.length){
      run.combo = Math.min(9, run.combo + 1);
      run.chainBest = Math.max(run.chainBest, run.combo);
      const best = cascades.sort((a,b)=>b.length-a.length)[0];
      toast('⚡ Chain x' + run.combo + '!');
      setTimeout(()=>resolveHit(best, {r:best[0][0], c:best[0][1], b:null, specialUsed:false, manual:false}), 210);
    } else {
      run.combo = 1;
      if(!hasMove()) shuffleBoard();
      updateHud();
      busy = false;
      checkEnd();
    }
  }, 240);
}
function collectAndRemove(hit, ctx){
  const keep = ctx.manual && !ctx.specialUsed && hit.length>=5 ? ctx.r+','+ctx.c : null;
  for(const [r,c] of hit){
    const b = cells[r][c]; if(!b) continue;
    const el = document.querySelector('[data-id="'+b.id+'"]'); if(el) el.classList.add('pop');
    if(b.special !== 'rock') run.collected[b.type] = (run.collected[b.type]||0)+1;
    if((r+','+c) !== keep) cells[r][c]=null;
  }
}
function crackRocks(hit){
  for(const [r,c] of hit){
    for(const [nr,nc] of neighbours(r,c)){
      const rock = cells[nr][nc];
      if(rock && rock.special==='rock'){
        rock.hp--;
        if(rock.hp<=0){ cells[nr][nc]=null; run.rocksBroken++; run.score += 120; }
      }
    }
  }
}
function spawnSpecial(ctx, size){
  if(!ctx.manual || ctx.specialUsed || size<5 || !cells[ctx.r][ctx.c]) return;
  const b = cells[ctx.r][ctx.c];
  if(size>=10) b.special='wild';
  else if(size>=8) b.special = Math.random()>.5 ? 'rocketH' : 'rocketV';
  else b.special='bomb';
  run.specials++;
  toast((ICONS[b.special]||'✨') + ' special made!');
}
function findCascadeGroups(){
  const visited=new Set(), groups=[];
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const b=cells[r][c]; const key=r+','+c;
    if(!b||b.special||visited.has(key)) continue;
    const g=groupAt(r,c); g.forEach(([rr,cc])=>visited.add(rr+','+cc));
    if(g.length>=4) groups.push(g);
  }
  return groups;
}
function collapse(){
  const cfg=MISSION;
  if(cfg.gravity==='left'){
    for(let r=0;r<ROWS;r++){ let w=0; for(let c=0;c<COLS;c++) if(cells[r][c]){ const b=cells[r][c]; cells[r][c]=null; cells[r][w++]=b; } }
    return;
  }
  for(let c=0;c<COLS;c++){ let w=ROWS-1; for(let r=ROWS-1;r>=0;r--) if(cells[r][c]){ const b=cells[r][c]; cells[r][c]=null; cells[w--][c]=b; } }
}
function refill(){
  const cfg=MISSION;
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) if(!cells[r][c]) cells[r][c]=makeBubble(randType(cfg.colors));
}
function shuffleBoard(){
  const cfg=MISSION;
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) if(cells[r][c] && cells[r][c].special!=='rock') cells[r][c]=makeBubble(randType(cfg.colors));
  guaranteeMoves(); render(); toast('Board reshuffled - new combo chance!');
}

function launchSuper(){
  if(run.charge<100 || busy) return;
  busy=true; run.charge=0; run.specials++;
  const centre=[Math.floor(ROWS/2), Math.floor(COLS/2)];
  toast('🌟 Super Nova!');
  resolveHit(blast(centre[0], centre[1], 2), {r:centre[0], c:centre[1], b:null, specialUsed:true, manual:true});
}

document.getElementById('superBtn').addEventListener('click', launchSuper);
document.getElementById('helpBtn').addEventListener('click', showHelp);
document.getElementById('modalPrimary').addEventListener('click', ()=>{
  const action = document.getElementById('modalPrimary').dataset.action || 'start';
  if(action==='next') startMission(); else if(action==='retry') startMission(); else startMission();
});

function updateHud(){
  const cfg=MISSION, goals=cfg.goals;
  document.getElementById('sectorName').textContent = cfg.name;
  document.getElementById('starBank').textContent = '⭐ ' + starTotal();
  document.getElementById('missionTitle').textContent = cfg.title;
  document.getElementById('missionText').textContent = cfg.text;
  document.getElementById('levelVal').textContent = '1/1';
  document.getElementById('scoreVal').textContent = run.score;
  if (window.__storyRun) window.__storyRun.setScore(run.score);
  document.getElementById('movesVal').textContent = run.moves;
  document.getElementById('comboVal').textContent = 'x' + run.combo;
  document.getElementById('chargeText').textContent = Math.floor(run.charge) + '%';
  document.getElementById('chargeFill').style.width = run.charge + '%';
  document.getElementById('superBtn').disabled = run.charge < 100 || busy;
  const goalBox=document.getElementById('missionGoals'); goalBox.innerHTML='';
  addGoal(goalBox, 'Score', run.score, goals.score, '🌟');
  if(goals.chain) addGoal(goalBox, 'Best chain', run.chainBest, goals.chain, '⚡');
  if(goals.specials) addGoal(goalBox, 'Specials', run.specials, goals.specials, '💥');
  if(goals.collect) for(const [type, need] of Object.entries(goals.collect)) addGoal(goalBox, LABELS[type], run.collected[type]||0, need, '●', type);
  updateComboMeter();
  const complete = missionComplete();
  setStatus(complete ? 'Mission ready! Finish this move to bank your stars.' : 'Build clusters, make specials, then chain them together.');
  updateCoach(complete);
}
function updateCoach(complete){
  const el=document.getElementById('coachText'); if(!el) return;
  const g=MISSION.goals;
  const missing=Object.entries(g.collect||{}).map(([t,n])=>[LABELS[t],Math.max(0,n-(run.collected[t]||0))]).filter(([,n])=>n>0);
  let adv;
  if(complete) adv='Mission is ready. Make one more move to bank your stars.';
  else if(run.moves<=3) adv='Only '+run.moves+' move'+(run.moves===1?'':'s')+' left. Pop the biggest cluster on screen right now.';
  else if(missing.length) adv='Still needed: '+missing.map(([l,n])=>n+' '+l).join(' and ')+'. Hunt those colours before spending specials.';
  else if(run.charge>=100) adv='Super Nova is charged. Save it for a turn when no big cluster is showing.';
  else if(run.chainBest>=4) adv='Strong chain already. Keep chaining clusters to push your best.';
  else adv='Set up a cluster of 5 or more to make a bomb, then chain the cascade it starts.';
  if(el.textContent!==adv) el.textContent=adv;
}
function addGoal(box,label,now,need,icon,type){
  const row=document.createElement('div'); row.className='goal' + (now>=need?' done':'') + (type?' '+type:'');
  row.innerHTML='<span>'+icon+' '+label+'</span><b>'+Math.min(now,need)+'/'+need+'</b><i style="width:'+Math.min(100,now/need*100)+'%"></i>';
  box.appendChild(row);
}
function updateComboMeter(){
  const box=document.getElementById('comboMeter'); box.innerHTML='';
  for(let i=1;i<=9;i++){ const dot=document.createElement('span'); dot.className=i<=run.combo?'lit':''; box.appendChild(dot); }
}
function updateLevelStrip(){
  const strip=document.getElementById('levelStrip'); strip.innerHTML='';
  const node=document.createElement('div');
  node.className='planet active unlocked';
  node.textContent=state.stars[0]?'⭐'.repeat(state.stars[0]):'1';
  strip.appendChild(node);
}
function missionComplete(){
  const g=MISSION.goals;
  if(run.score < g.score) return false;
  if(g.chain && run.chainBest < g.chain) return false;
  if(g.specials && run.specials < g.specials) return false;
  if(g.collect) for(const [t,n] of Object.entries(g.collect)) if((run.collected[t]||0)<n) return false;
  return true;
}
function checkEnd(){
  if(missionComplete()) return finishLevel();
  if(run.moves<=0) return failLevel();
}
function finishLevel(){
  run.cleared=true; busy=true;
  const spare=Math.max(0,run.moves);
  // A591: one star for finishing, one for a real chain, one for using a special.
  // Spare moves used to hand out 3 stars every run, which made the rating and
  // the replay pointless.
  const chainStar = run.chainBest>=4;
  const specialStar = run.specials>0;
  const stars = 1 + (chainStar?1:0) + (specialStar?1:0);
  state.stars[0]=Math.max(state.stars[0]||0, stars);
  state.bestScore=Math.max(state.bestScore, run.score);
  saveProgress();
  reportScore();
  if (window.__storyRun) window.__storyRun.finish('success', run.score);
  gameSystem.addXP(Math.floor(run.score/35)+stars*25);
  gameSystem.unlockAchievement('firstPop');
  if(stars===3) gameSystem.unlockAchievement('threeStarClear');
  gameSystem.unlockAchievement('galaxyClear');
  gameSystem.saveState();
  audioEffects.playLevelUp();
  showModal('🎉','Mission Complete',
    'The nebula is lit. ' + '⭐'.repeat(stars) + ' of 3 - one for finishing, one for a chain of 4, one for using a special. ' + spare + ' move' + (spare===1?'':'s') + ' spare.', [
    ['Score', run.score], ['Best combo', 'x'+run.bestCombo], ['Best chain', 'x'+run.chainBest]
  ], 'Play the mission again', 'retry');
}
function failLevel(){
  busy=true; reportScore(); if (window.__storyRun) window.__storyRun.finish('fail', run.score); gameSystem.addXP(Math.floor(run.score/50)); gameSystem.saveState(); audioEffects.playError();
  showModal('🌌','Out of Moves','You were close. Aim for bigger clusters early, then spend specials together.', [
    ['Score', run.score], ['Target', MISSION.goals.score], ['Best combo', 'x'+run.bestCombo]
  ], 'Retry Mission', 'retry');
}
function reportScore(){ const delta=run.score-(run.reported||0); if(delta>0){ gameSystem.addScore(delta); run.reported=run.score; } }
function showModal(emoji,title,sub,stats,button,action){
  document.getElementById('modalEmoji').textContent=emoji;
  document.getElementById('modalTitle').textContent=title;
  document.getElementById('modalSub').textContent=sub;
  document.getElementById('modalStats').innerHTML=stats.map(([a,b])=>'<div><span>'+a+'</span><b>'+b+'</b></div>').join('');
  const btn=document.getElementById('modalPrimary'); btn.textContent=button; btn.dataset.action=action;
  document.getElementById('modal').classList.add('show');
}
function showHelp(){
  showModal('🫧','How to Play','Tap 2+ matching bubbles. Groups of 5+ become specials. Chain specials and cascades to finish the mission before moves run out.', [
    ['5+ cluster','💣 Bomb'], ['8+ cluster','🚀 Rocket'], ['10+ cluster','🌈 Wild']
  ], 'Play', 'start');
}
function setStatus(text){ document.getElementById('statusLine').textContent=text; document.getElementById('tipBox').textContent=text; }
function toast(text){ const t=document.getElementById('toast'); t.textContent=text; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); }
function nudge(id){ const el=document.querySelector('[data-id="'+id+'"]'); if(el){ el.classList.add('wrong'); setTimeout(()=>el.classList.remove('wrong'),260); } }
function popFx(r,c,text){
  const board=document.getElementById('board').getBoundingClientRect();
  const fx=document.createElement('div'); fx.className='float-score'; fx.textContent=text;
  fx.style.left=(board.left + (c+.5)*board.width/COLS)+'px'; fx.style.top=(board.top + (r+.5)*board.height/ROWS)+'px';
  document.body.appendChild(fx); setTimeout(()=>fx.remove(),900);
  if(text.includes('mega') || text.includes('blast')) ScreenShake.shake(document.querySelector('.board-frame'), 8, 180);
  audioEffects.playPop();
}

showModal('🫧','Bubble Pop Galaxy','One small mission: light the Lantern Nebula by popping the matching colours, then beat your own score.', [
  ['Best score', state.bestScore||0], ['Stars earned', state.stars[0] ? '⭐'.repeat(state.stars[0]) : 'not yet']
], 'Start the mission', 'start');
updateLevelStrip();
