'use strict';
// ---------------------------------------------------
//  GEM MATCH, Full Game  |  JVDesignStudio
// ---------------------------------------------------

// -- Constants --------------------------------------
const GRID = 8, TOTAL = GRID * GRID;
const COLORS = ['rose','teal','gold','forest','lavender'];
const EMOJI  = {rose:'❤️',teal:'💎',gold:'💎',forest:'💎',lavender:'💎',bomb:'💣',wild:'💎',empty:''};
const GEM_HEX = {rose:'#e05a5c',teal:'#70A3A7',gold:'#f5c842',forest:'#78a860',lavender:'#c0a8e0'};
const DURATION = 120;   // seconds
const CHAIN_BONUS = 3;  // seconds added per cascade
const FEVER_AT = 4;     // combo count that triggers fever
const HINT_WAIT = 3800; // ms idle before hint
const PTS = {3:300, 4:600, 5:1000};
const SWAP_CLASS = {right:'swap-r',left:'swap-l',down:'swap-d',up:'swap-u'};

// -- State -------------------------------------------
let board = [], score = 0, shownScore = 0;
let timeLeft = DURATION, timerID = null, scoreRafID = null;
let bestScore = window.GameSystem?window.GameSystem.getBestScore('gem-match'):0;
let sel = -1, busy = false, gameOn = false, arcadePaused = false;
let chain = 0, maxChain = 0, matchTally = 0, bombTally = 0, wildTally = 0;
let fever = false, hintID = null, soundOn = true;

// -- DOM ----------------------------------------------
const $ = id => document.getElementById(id);
const boardEl = $('board'), boardGlow = $('boardGlow');
const timerEl = $('timerEl'), timerBar = $('timerBar');
const scoreEl = $('scoreEl'), bestEl = $('bestEl'), scoreCard = $('scoreCard');
const comboPill = $('comboPill'), feverPill = $('feverPill');
const goOverlay = $('goOverlay'), goScore = $('goScore'), goBest = $('goBest');
const startScreen = $('startScreen');

// -- Audio --------------------------------------------
let AC = null;
function ac(){ if(!AC) AC=new(window.AudioContext||window.webkitAudioContext)(); return AC; }
function tone(f,type,dur,vol,delay=0,fEnd=null){
  if(!soundOn) return;
  try{
    const a=ac(),o=a.createOscillator(),g=a.createGain();
    o.connect(g);g.connect(a.destination);
    o.type=type;o.frequency.setValueAtTime(f,a.currentTime+delay);
    if(fEnd) o.frequency.exponentialRampToValueAtTime(fEnd,a.currentTime+delay+dur);
    g.gain.setValueAtTime(vol,a.currentTime+delay);
    g.gain.exponentialRampToValueAtTime(0.001,a.currentTime+delay+dur);
    o.start(a.currentTime+delay);o.stop(a.currentTime+delay+dur+.02);
  }catch(e){}
}
const SFX = {
  match:   ()=>{tone(520,'sine',.09,.14);tone(660,'sine',.07,.07,.07)},
  combo:   n=>{[1,1.26,1.5,2].slice(0,Math.min(n,4)).forEach((m,i)=>tone(330*m,'sine',.09,.12,i*.09))},
  fever:   ()=>{[1,1.5,2,3].forEach((m,i)=>tone(440*m,'triangle',.15,.09,i*.07));tone(880,'sine',.3,.13,.32)},
  bomb:    ()=>{tone(58,'sawtooth',.32,.26);tone(100,'square',.2,.1,.06);tone(170,'sine',.15,.08,.1)},
  wild:    ()=>{[1,1.2,1.5,2,2.5,3].forEach((m,i)=>tone(200*m,'sine',.12,.09,i*.05))},
  invalid: ()=>tone(140,'square',.06,.07),
  tick:    ()=>tone(880,'sine',.04,.05),
  over:    ()=>{[440,350,280,220].forEach((f,i)=>tone(f,'sine',.2,.14,i*.18))},
  newBest: ()=>{[523,659,784,1047].forEach((f,i)=>tone(f,'sine',.2,.16,i*.14))},
};

// -- Daily board (seeded by date so every day has a unique shared puzzle) --
const DAILY_KEY = 'gem_daily_v1';

function mkSeededRng(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  return function() {
    h += 0x6D2B79F5 | 0;
    let t = Math.imul(h ^ h >>> 15, 1 | h);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function mkBoardSeeded(rng) {
  const b = [];
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      let col, t = 0;
      do {
        col = COLORS[Math.floor(rng() * COLORS.length)];
        t++;
      } while (t < 24 && (
        (c >= 2 && b[r*GRID+c-1] === col && b[r*GRID+c-2] === col) ||
        (r >= 2 && b[(r-1)*GRID+c] === col && b[(r-2)*GRID+c] === col)
      ));
      b.push(col);
    }
  }
  return b;
}

function getDailyBoard() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const saved = JSON.parse(localStorage.getItem(DAILY_KEY) || '{}');
    if (saved.date === today && Array.isArray(saved.board) && saved.board.length === TOTAL) {
      return saved.board;
    }
  } catch(e) {}
  const b = mkBoardSeeded(mkSeededRng(today));
  try { localStorage.setItem(DAILY_KEY, JSON.stringify({ date: today, board: b })); } catch(e) {}
  return b;
}

function getDailyDone() {
  const today = new Date().toISOString().slice(0, 10);
  try { return JSON.parse(localStorage.getItem(DAILY_KEY) || '{}').done === today; } catch(e) { return false; }
}

function markDailyDone() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const o = JSON.parse(localStorage.getItem(DAILY_KEY) || '{}');
    o.done = today;
    localStorage.setItem(DAILY_KEY, JSON.stringify(o));
  } catch(e) {}
}

// -- Board --------------------------------------------
function rnd(){ return COLORS[Math.floor(Math.random()*COLORS.length)]; }

function mkBoard(){
  board = getDailyBoard().slice();
  if(!anyMove()) forceMove();
}

function forceMove(){
  // guarantee at least one valid move by swapping until one exists
  for(let i=0;i<TOTAL-1;i++){
    [board[i],board[i+1]]=[board[i+1],board[i]];
    if(anyMove()) return;
    [board[i],board[i+1]]=[board[i+1],board[i]];
  }
}

function anyMatch(){
  for(let r=0;r<GRID;r++) for(let c=0;c<GRID-2;c++){
    const i=r*GRID+c,x=board[i];
    if(x==='empty'||x==='bomb'||x==='wild') continue;
    if(board[i+1]===x&&board[i+2]===x) return true;
  }
  for(let c=0;c<GRID;c++) for(let r=0;r<GRID-2;r++){
    const i=r*GRID+c,x=board[i];
    if(x==='empty'||x==='bomb'||x==='wild') continue;
    if(board[i+GRID]===x&&board[i+GRID*2]===x) return true;
  }
  return false;
}

function anyMove(){
  for(let i=0;i<TOTAL;i++){
    for(const j of nbrs(i)){
      [board[i],board[j]]=[board[j],board[i]];
      const ok=anyMatch();
      [board[i],board[j]]=[board[j],board[i]];
      if(ok) return true;
    }
  }
  return false;
}

function nbrs(i){
  const r=Math.floor(i/GRID),c=i%GRID,n=[];
  if(c>0) n.push(i-1); if(c<GRID-1) n.push(i+1);
  if(r>0) n.push(i-GRID); if(r<GRID-1) n.push(i+GRID);
  return n;
}

// -- Render -------------------------------------------
function mkGrid(){
  boardEl.innerHTML='';
  for(let i=0;i<TOTAL;i++){
    const d=document.createElement('div');
    const r=Math.floor(i/GRID), c=i%GRID;
    d.className='cell'; d.dataset.index=i; d.dataset.color=board[i];
    d.textContent=EMOJI[board[i]]||'';
    d.style.setProperty('--sd',(Math.random()*3.5).toFixed(2)+'s');
    d.style.animationDelay=(r*40+c*30)+'ms';
    d.style.animation='gemFallIn .4s cubic-bezier(.22,1,.36,1) both';
    // Void corruption visual: dark overlay on random gems
    if (window.VoidStory && Math.random() < VoidStory.getCorruption('gem-match') * 0.02) {
      d.style.filter = 'brightness(0.7) saturate(0.5)';
      d.style.boxShadow = '0 0 8px rgba(80,0,160,.4)';
    }
    boardEl.appendChild(d);
  }
  addInput();
}

function render(){
  const cells=boardEl.querySelectorAll('.cell');
  cells.forEach((c,i)=>{
    const col=board[i];
    if(c.dataset.color!==col){ c.dataset.color=col; c.textContent=EMOJI[col]||''; }
    c.classList.toggle('selected',i===sel);
  });
  updHUD();
}

function updHUD(){
  const m=Math.floor(timeLeft/60),s=timeLeft%60;
  timerEl.textContent=`${m}:${s.toString().padStart(2,'0')}`;
  timerEl.classList.toggle('low',timeLeft<=10);
  bestEl.textContent=bestScore.toLocaleString();
  const pct=Math.max(0,timeLeft/DURATION*100);
  timerBar.style.width=pct+'%';
  timerBar.classList.toggle('low',timeLeft<=10);
  updateMission();
}

// Live objective + coaching, refreshed on every HUD update.
function updateMission(){
  const mm=document.getElementById('matchMission'), cc=document.getElementById('matchCoach');
  if(!mm || !cc) return;
  const target=1500;
  let m;
  if(goOverlay.classList.contains('show')){
    m = score>=target
      ? 'Target reached with '+score.toLocaleString()+'. Play again to push your best.'
      : 'Time up at '+score.toLocaleString()+'. Reach Fever or '+target.toLocaleString()+' next run.';
  } else {
    m = fever
      ? 'Fever is running: every match is x2, keep the cascades alive.'
      : 'Mission: reach Fever or '+target.toLocaleString()+' before the timer ends. '+score.toLocaleString()+' / '+target.toLocaleString()+'.';
  }
  let c;
  if(fever) c='Fever is live, so bigger groups are worth more. Take the 4 and 5 matches.';
  else if(chain>=2) c='Chain '+chain+' of '+FEVER_AT+'. '+(FEVER_AT-chain)+' more in a row triggers Fever.';
  else if(timeLeft<=20) c='Under 20 seconds: take quick three-matches instead of setting up long chains.';
  else if(score>=target) c='Target already reached. Cascades add +3 seconds, so keep matching to raise your best.';
  else c='Match 4 for a bomb, 5 for a wild, and chain four in a row to trigger Fever.';
  if(mm.textContent!==m) mm.textContent=m;
  if(cc.textContent!==c) cc.textContent=c;
}

// Smooth score roll-up
function rollScore(target){
  if(scoreRafID){ cancelAnimationFrame(scoreRafID); scoreRafID=null; }
  const start=shownScore,diff=target-start,dur=280;
  let t0=null;
  function step(ts){
    if(!t0) t0=ts;
    const p=Math.min((ts-t0)/dur,1);
    const eased=p<.5?2*p*p:-1+(4-2*p)*p;
    shownScore=Math.round(start+diff*eased);
    scoreEl.textContent=shownScore.toLocaleString();
    if(p<1) scoreRafID=requestAnimationFrame(step);
    else{ scoreRafID=null; shownScore=target; scoreEl.textContent=target.toLocaleString(); }
  }
  scoreRafID=requestAnimationFrame(step);
  // bump animation
  scoreCard.classList.remove('bump'); void scoreCard.offsetWidth; scoreCard.classList.add('bump');
  scoreCard.addEventListener('animationend',()=>scoreCard.classList.remove('bump'),{once:true});
}

// -- Input --------------------------------------------
let inputWired=false;
function addInput(){
  if(inputWired) return;
  inputWired=true;
  boardEl.addEventListener('click',onClick);
  let tx,ty,ti;
  boardEl.addEventListener('touchstart',e=>{
    if(!gameOn||busy||arcadePaused) return;
    const t=e.touches[0],el=document.elementFromPoint(t.clientX,t.clientY);
    if(el?.classList.contains('cell')){ tx=t.clientX;ty=t.clientY;ti=+el.dataset.index; }
    e.preventDefault();
  },{passive:false});
  boardEl.addEventListener('touchend',e=>{
    if(!gameOn||busy||arcadePaused||ti==null) return;
    const t=e.changedTouches[0];
    const dx=t.clientX-tx,dy=t.clientY-ty;
    if(Math.max(Math.abs(dx),Math.abs(dy))<13){ pick(ti); }
    else{
      const tgt=Math.abs(dx)>Math.abs(dy)?(dx>0?ti+1:ti-1):(dy>0?ti+GRID:ti-GRID);
      if(tgt>=0&&tgt<TOTAL&&nbrs(ti).includes(tgt)){ sel=-1;swap(ti,tgt); }
    }
    ti=undefined; e.preventDefault();
  },{passive:false});
}

function onClick(e){
  if(!gameOn||busy||arcadePaused) return;
  const c=e.target.closest('.cell');
  if(c) pick(+c.dataset.index);
}

function pick(i){
  clrHint();
  if(board[i]==='empty') return;
  if(sel===-1){ sel=i;render();schHint();return; }
  if(sel===i){ sel=-1;render();schHint();return; }
  if(nbrs(sel).includes(i)){ const f=sel;sel=-1;swap(f,i); }
  else{ sel=i;render();schHint(); }
}

// -- Hint ---------------------------------------------
function schHint(){ clrHint(); hintID=setTimeout(showHint,HINT_WAIT); }
function clrHint(){
  clearTimeout(hintID);
  boardEl.querySelectorAll('.cell.hint').forEach(c=>c.classList.remove('hint'));
}
function showHint(){
  const cs=boardEl.querySelectorAll('.cell');
  for(let i=0;i<TOTAL;i++){
    for(const j of nbrs(i)){
      [board[i],board[j]]=[board[j],board[i]];
      const ok=anyMatch();
      [board[i],board[j]]=[board[j],board[i]];
      if(ok){
        cs[i].classList.add('hint'); cs[j].classList.add('hint');
        hintID=setTimeout(clrHint,3200);
        return;
      }
    }
  }
}

// -- Swap ---------------------------------------------
async function swap(i,j){
  if(busy) return;
  busy=true; clrHint();

  // Direction-aware swap animation
  const di=j-i;
  const [ai,aj]=
    di===1      ?[SWAP_CLASS.right,SWAP_CLASS.left]:
    di===-1     ?[SWAP_CLASS.left,SWAP_CLASS.right]:
    di===GRID   ?[SWAP_CLASS.down,SWAP_CLASS.up]:
                 [SWAP_CLASS.up,SWAP_CLASS.down];

  const cs=boardEl.querySelectorAll('.cell');
  cs[i].classList.add(ai); cs[j].classList.add(aj);
  [board[i],board[j]]=[board[j],board[i]];
  await wait(140);
  cs[i].classList.remove(ai); cs[j].classList.remove(aj);
  render();

  const m=findMatches();
  if(!m.cells.length){
    [board[i],board[j]]=[board[j],board[i]];
    render(); SFX.invalid();
    anim([i,j],'jiggle');
    await wait(300); busy=false; schHint(); return;
  }

  chain=0;
  await resolve(m);
  if(gameOn&&!anyMove()){ await wait(200); shuffle(); }
  busy=false; schHint();
}

// -- Match detection -----------------------------------
// Step 1: find all horizontal runs =3 and vertical runs =3.
// Step 2: flood-fill from every matched cell, pick up any same-colour
//         neighbours that are also matched, ensuring L/T/+ shapes are
//         fully collected as one group.
// Bombs/wilds on the board are NOT matched by this function -
// they are triggered separately in resolve() when adjacent gems clear.
function findMatches(){
  const SPECIAL = new Set(['empty','bomb','wild']);

  // --- pass 1: tag every cell that's part of a run of =3 ---
  const inRun = new Set();
  const runLen = {}; // idx -> length of the run it anchors (for special creation)

  // horizontal runs
  for(let r=0;r<GRID;r++){
    let c=0;
    while(c<GRID){
      const col=board[r*GRID+c];
      if(SPECIAL.has(col)){c++;continue;}
      let l=1;
      while(c+l<GRID&&board[r*GRID+c+l]===col) l++;
      if(l>=3){
        for(let k=0;k<l;k++) inRun.add(r*GRID+c+k);
        // record run length at the anchor for special gem spawning
        const anchor=r*GRID+c;
        if(!runLen[anchor]||runLen[anchor]<l) runLen[anchor]=l;
      }
      c+=l;
    }
  }
  // vertical runs
  for(let c=0;c<GRID;c++){
    let r=0;
    while(r<GRID){
      const col=board[r*GRID+c];
      if(SPECIAL.has(col)){r++;continue;}
      let l=1;
      while(r+l<GRID&&board[(r+l)*GRID+c]===col) l++;
      if(l>=3){
        for(let k=0;k<l;k++) inRun.add((r+k)*GRID+c);
        const anchor=r*GRID+c;
        if(!runLen[anchor]||runLen[anchor]<l) runLen[anchor]=l;
      }
      r+=l;
    }
  }

  if(!inRun.size) return {cells:[],specials:[]};

  // --- pass 2: flood-fill to merge connected groups of same colour ---
  // This catches L, T, + shapes and any same-colour cell adjacent to a run cell.
  const visited = new Set();
  const groups  = [];   // array of arrays of indices

  for(const seed of inRun){
    if(visited.has(seed)) continue;
    const col = board[seed];
    const group = [];
    const stack = [seed];
    while(stack.length){
      const idx=stack.pop();
      if(visited.has(idx)) continue;
      visited.add(idx);
      group.push(idx);
      // spread to neighbours of same colour that are also in inRun
      const ri=Math.floor(idx/GRID), ci=idx%GRID;
      const candidates=[];
      if(ci>0)      candidates.push(idx-1);
      if(ci<GRID-1) candidates.push(idx+1);
      if(ri>0)      candidates.push(idx-GRID);
      if(ri<GRID-1) candidates.push(idx+GRID);
      for(const nb of candidates){
        if(!visited.has(nb) && board[nb]===col && inRun.has(nb))
          stack.push(nb);
      }
    }
    groups.push({col, group});
  }

  // --- pass 3: build remove set and decide special gem spawns ---
  const rm = new Set();
  const sp = [];

  for(const {group} of groups){
    group.forEach(i=>rm.add(i));
    const maxL = Math.max(...group.map(i=>runLen[i]||0).filter(Boolean), group.length);
    // find the centre-ish cell for spawning
    const mid = group[Math.floor(group.length/2)];
    if(maxL>=5) sp.push({idx:mid,type:'wild'});
    else if(maxL===4) sp.push({idx:mid,type:'bomb'});
  }

  return {cells:[...rm], specials:sp};
}

// -- Resolve / cascade ---------------------------------
async function resolve(m){
  const {cells,specials}=m;
  if(!cells.length) return;

  chain++; matchTally++;
  maxChain=Math.max(maxChain,chain);

  // Cascade time bonus
  if(chain>=2&&gameOn){
    timeLeft=Math.min(timeLeft+CHAIN_BONUS,DURATION);
    showTimePop();
  }

  // Fever trigger
  if(chain>=FEVER_AT&&!fever){
    fever=true; boardEl.classList.add('fever-active');
    boardEl.classList.add('fever-board');
    boardGlow.classList.add('fever');
    scoreCard.classList.add('fever');
    showPill(feverPill);
    SFX.fever();
  }

  const mult=fever?2:1;
  const pts=calcPts(cells,chain)*mult;
  score+=pts;

  // Sound + combo pill
  if(chain>=2){ showPill(comboPill,`🔥 ${chain}× Combo!`); SFX.combo(chain); }
  else SFX.match();

  // Visuals
  scorePop(cells,pts,fever||cells.length>=5);
  burst(cells);
  anim(cells,'matching');
  rollScore(score);
  await wait(340);

  // -- Collect bomb/wild positions BEFORE clearing -------
  // Trigger specials IN the matched set, and also adjacent ones
  const blastSet=new Set();
  const adjacentToCleared=new Set();
  for(const idx of cells) for(const nb of nbrs(idx)) adjacentToCleared.add(nb);

  for(const idx of cells){
    if(board[idx]==='bomb'){ bombBlast(idx).forEach(i=>blastSet.add(i)); bombTally++; SFX.bomb(); shakeboard(); }
    if(board[idx]==='wild'){ wildBlast(idx).forEach(i=>blastSet.add(i)); wildTally++; SFX.wild(); }
  }
  const cellSet=new Set(cells);
  for(const nb of adjacentToCleared){
    if(cellSet.has(nb)) continue;
    if(board[nb]==='bomb'){ bombBlast(nb).forEach(i=>blastSet.add(i)); blastSet.add(nb); bombTally++; SFX.bomb(); shakeboard(); }
    if(board[nb]==='wild'){ wildBlast(nb).forEach(i=>blastSet.add(i)); blastSet.add(nb); wildTally++; SFX.wild(); }
  }

  // Clear matched cells
  cells.forEach(i=>{ board[i]='empty'; });
  // Place new specials and animate them in
  for(const s of specials){
    if(board[s.idx]==='empty'){
      board[s.idx]=s.type;
      // flash the cell after next render
      setTimeout(()=>{
        const cellEls=boardEl.querySelectorAll('.cell');
        const cel=cellEls[s.idx];
        if(cel){ cel.classList.remove('spawn-special'); void cel.offsetWidth; cel.classList.add('spawn-special'); cel.addEventListener('animationend',()=>cel.classList.remove('spawn-special'),{once:true}); }
      }, 60);
    }
  }

  // Detonate blasted cells
  if(blastSet.size){
    const extra=[...blastSet].filter(i=>board[i]!=='empty');
    if(extra.length){
      anim(extra,'matching'); await wait(320);
      extra.forEach(i=>{ board[i]='empty'; });
      score+=extra.length*120*mult; rollScore(score);
    }
  }

  render();
  await gravity();

  const next=findMatches();
  if(next.cells.length) await resolve(next);
  else endChain();
}

function endChain(){
  if(fever){ fever=false; boardEl.classList.remove('fever-board','fever-active'); boardGlow.classList.remove('fever'); scoreCard.classList.remove('fever'); setTimeout(()=>feverPill.classList.remove('show'),900); }
  chain=0; setTimeout(()=>comboPill.classList.remove('show'),1000);
}

function calcPts(cells,c){
  const l=cells.length;
  const base=l>=5?PTS[5]:l===4?PTS[4]:PTS[3];
  return base+Math.max(0,l-3)*100+(c>1?Math.floor(base*(c-1)*.5):0);
}

function bombBlast(idx){
  const r=Math.floor(idx/GRID),c=idx%GRID,a=[];
  for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
    const nr=r+dr,nc=c+dc;
    if(nr>=0&&nr<GRID&&nc>=0&&nc<GRID) a.push(nr*GRID+nc);
  }
  return a;
}

function wildBlast(idx){
  const counts={};COLORS.forEach(c=>counts[c]=0);
  board.forEach(c=>{if(counts[c]!==undefined) counts[c]++;});
  const dom=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
  return board.reduce((a,c,i)=>{if(c===dom)a.push(i);return a;},[]);
}

function shakeboard(){
  boardEl.classList.remove('shake'); void boardEl.offsetWidth; boardEl.classList.add('shake');
  boardEl.addEventListener('animationend',()=>boardEl.classList.remove('shake'),{once:true});
}

// -- Gravity -------------------------------------------
async function gravity(){
  for(let c=0;c<GRID;c++){
    const gems=[];
    for(let r=GRID-1;r>=0;r--) if(board[r*GRID+c]!=='empty') gems.push(board[r*GRID+c]);
    for(let r=GRID-1;r>=0;r--) board[r*GRID+c]=gems.length?gems.shift():rnd();
  }
  render();
  // Staggered column fall
  const cs=boardEl.querySelectorAll('.cell');
  for(let c=0;c<GRID;c++){
    setTimeout(()=>{
      for(let r=0;r<3;r++){
        const cell=cs[r*GRID+c];
        if(cell){ cell.classList.remove('falling'); void cell.offsetWidth; cell.classList.add('falling'); }
      }
    }, c*16);
  }
  await wait(270);
}

// -- Animations ----------------------------------------
function anim(indices,cls){
  const cs=boardEl.querySelectorAll('.cell');
  indices.forEach(i=>{
    if(!cs[i]) return;
    cs[i].classList.remove(cls); void cs[i].offsetWidth; cs[i].classList.add(cls);
    cs[i].addEventListener('animationend',()=>cs[i].classList.remove(cls),{once:true});
  });
}

function scorePop(cells,pts,big=false){
  if(!cells.length) return;
  const br=boardEl.getBoundingClientRect(),cs=boardEl.querySelectorAll('.cell');
  const mi=cells[Math.floor(cells.length/2)],cell=cs[mi]; if(!cell) return;
  const r=cell.getBoundingClientRect();
  const d=document.createElement('div');
  d.className='score-pop'+(big?' big':'');
  d.textContent='+'+pts.toLocaleString();
  d.style.left=(r.left-br.left+r.width/2-22)+'px';
  d.style.top=(r.top-br.top+r.height/2-10)+'px';
  boardEl.parentElement.appendChild(d);
  d.addEventListener('animationend',()=>d.remove());
}

function showTimePop(){
  const d=document.createElement('div');
  d.className='time-bonus-pop';d.textContent=`+${CHAIN_BONUS}s \u23f0`;
  boardEl.parentElement.appendChild(d);
  d.addEventListener('animationend',()=>d.remove());
}

function burst(cells){
  const br=boardEl.getBoundingClientRect(),cs=boardEl.querySelectorAll('.cell');
  cells.slice(0,10).forEach(idx=>{
    const cell=cs[idx]; if(!cell) return;
    const col=board[idx];
    const hex=GEM_HEX[col]||'#ffffff';
    const r=cell.getBoundingClientRect();
    const cx=r.left-br.left+r.width/2,cy=r.top-br.top+r.height/2;
    for(let p=0;p<5;p++){
      const dot=document.createElement('div');
      dot.className='burst-dot';
      const ang=(Math.PI*2/5)*p+Math.random()*.6;
      const dist=18+Math.random()*22;
      dot.style.cssText=`left:${cx}px;top:${cy}px;background:${hex};--bx:${Math.cos(ang)*dist}px;--by:${Math.sin(ang)*dist}px;animation-duration:${.4+Math.random()*.25}s`;
      boardEl.parentElement.appendChild(dot);
      dot.addEventListener('animationend',()=>dot.remove());
    }
  });
}

function showPill(el,text){
  if(text) el.textContent=text;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}

// -- Timer ---------------------------------------------
function startTimer(){
  if(timerID) clearInterval(timerID);
  timerID=setInterval(()=>{
    if(!gameOn) return;
    timeLeft--;
    updHUD();
    if(timeLeft<=10) SFX.tick();
    if(timeLeft<=0){
      clearInterval(timerID);timerID=null;gameOn=false;
      // Don't read score until any in-flight cascade (which can run
      // longer than a fixed delay) has actually finished scoring.
      const waitForCascade=()=>{ busy ? setTimeout(waitForCascade,100) : setTimeout(endGame,300); };
      waitForCascade();
    }
  },1000);
}

// -- Game over ------------------------------------------
function endGame(){
  if(timerID){clearInterval(timerID);timerID=null;}
  window.__gsScore=(window.__gsScore||0)+score;
  window.__gsBestRun=Math.max(window.__gsBestRun||0,score);
  if(typeof gameSystem!=='undefined'){gameSystem.addScore(score);gameSystem.recordGamePlay(Date.now());}
  const isNew=score>bestScore&&score>0;
  if(isNew){bestScore=score;SFX.newBest();}
  else SFX.over();
  if(score>=1500 && !getDailyDone()) markDailyDone();
  updateDailyBadge();

  GameUI.countUp(goScore, score);
  GameUI.showMedal(goScore, score, [[1500,'🥉','Gem Fiddler'],[4000,'🥈','Gem Roller'],[8000,'🥇','Gem Sovereign']]);
  goBest.textContent=isNew?'🏆 New Best Score!':(score>0?`Best: ${bestScore.toLocaleString()}`:'');
  $('stMatches').textContent=matchTally;
  $('stCombo').textContent=maxChain+'×';
  $('stBombs').textContent=bombTally;
  $('stWilds').textContent=wildTally;

  if(isNew) confetti();
  goOverlay.classList.add('show');
  updateMission();

  // Save to both leaderboards then refresh
  if(score>0){
    saveMyScore(score);
    renderLB();
  }
}

function confetti(){
  const cols=['#BC4749','#70A3A7','#f5c842','#78a860','#c0a8e0','#ffffff'];
  for(let i=0;i<45;i++){
    const c=document.createElement('div');
    c.className='conf';
    c.style.cssText=`left:${8+Math.random()*84}%;background:${cols[i%cols.length]};animation-duration:${1.1+Math.random()*.9}s;animation-delay:${Math.random()*.5}s;--cx:${(Math.random()-.5)*130}px`;
    goOverlay.appendChild(c);
    c.addEventListener('animationend',()=>c.remove());
  }
}

// -- Shuffle --------------------------------------------
function shuffle(){
  let n=0;
  do{
    for(let i=board.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[board[i],board[j]]=[board[j],board[i]];}
    n++;
  }while(!anyMove()&&n<60);
  render();
}

// -- Init -----------------------------------------------
function init(){
  if(timerID){clearInterval(timerID);timerID=null;}
  if(scoreRafID){cancelAnimationFrame(scoreRafID);scoreRafID=null;}
  score=0;shownScore=0;timeLeft=DURATION;
  chain=0;maxChain=0;matchTally=0;bombTally=0;wildTally=0;
  sel=-1;busy=false;fever=false;arcadePaused=false;gameOn=true;
  boardEl.classList.remove('fever-board','shake');
  boardGlow.classList.remove('fever');
  scoreCard.classList.remove('fever');
  comboPill.classList.remove('show');
  feverPill.classList.remove('show');
  goOverlay.classList.remove('show');
  goOverlay.querySelectorAll('.conf').forEach(c=>c.remove());
  scoreEl.textContent='0'; updHUD();
  mkBoard(); mkGrid(); render(); startTimer(); schHint();
}

// -- Events ---------------------------------------------
$('btnStart').addEventListener('click',()=>{
  startScreen.classList.add('gone');
  setTimeout(()=>startScreen.style.display='none',450);
  init();
});
$('btnAgain').addEventListener('click',init);
$('sndBtn').addEventListener('click',()=>{soundOn=!soundOn;$('sndBtn').textContent=soundOn?'🔊':'🔇';});
$('navToggle').addEventListener('click',()=>$('mainNav').classList.toggle('open'));
$('howToHeader').addEventListener('click',()=>$('howTo').classList.toggle('open'));

// -- Leaderboard ----------------------------------------
const LB_MINE  = 'gmMyScores';       // localStorage key for personal history
const LB_MAX   = 5;
function lbRankIcon(n){
  return n===1?'🥇':n===2?'🥈':n===3?'🥉':`${n}.`;
}
function lbRankCls(n){
  return n===1?'lb-rank-1':n===2?'lb-rank-2':n===3?'lb-rank-3':'lb-rank-n';
}
function fmtDate(ts){
  if(!ts) return '';
  const d=new Date(ts);
  return `${d.getDate()}/${d.getMonth()+1}`;
}

function loadMyScores(){
  try{ return JSON.parse(localStorage.getItem(LB_MINE)||'[]'); }
  catch(e){ return []; }
}

function saveMyScore(sc){
  if(sc<=0) return;
  let scores=loadMyScores();
  scores.push({score:sc,date:Date.now()});
  scores.sort((a,b)=>b.score-a.score);
  scores=scores.slice(0,LB_MAX);
  localStorage.setItem(LB_MINE,JSON.stringify(scores));
}

async function renderLB(){
  const body=document.getElementById('lbBody');
  const note=document.getElementById('lbNote');
  body.innerHTML='<div class="lb-empty">Loading...</div>';

  const rows=loadMyScores();
  note.textContent='Your personal top 5 on this device.';

  if(!rows.length){
    body.innerHTML='<div class="lb-empty">No scores yet, play a game!</div>';
    return;
  }

  body.innerHTML=rows.map((r,i)=>{
    const rank=i+1;
    return `<div class="lb-row">
      <div class="lb-rank ${lbRankCls(rank)}">${lbRankIcon(rank)}</div>
      <div class="lb-name you">You</div>
      <div class="lb-score you">${r.score.toLocaleString()}</div>
      <div class="lb-date">${fmtDate(r.date)}</div>
    </div>`;
  }).join('');
}

// -- Daily badge helpers --------------------------------
function updateDailyBadge(){
  const done = getDailyDone();
  const msg = done ? '✅ Daily puzzle done!' : '🎯 Today\'s daily puzzle';
  const ssEl = $('ssDailyLine'), goEl = $('goDailyLine');
  if(ssEl) ssEl.textContent = msg;
  if(goEl) goEl.textContent = done ? '✅ Daily puzzle complete!' : '🎯 Daily: reach 1,500 to complete';
}

// -- Boot -----------------------------------------------
$('ssBest').textContent=bestScore.toLocaleString();
bestEl.textContent=bestScore.toLocaleString();
updateDailyBadge();
renderLB();

function wait(ms){return new Promise(r=>setTimeout(r,ms));}
