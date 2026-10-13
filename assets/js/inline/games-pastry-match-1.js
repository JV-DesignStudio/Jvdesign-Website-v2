const gameSystem = new GameSystem('pastry-match', 'Pastry Match', 'squirt');
const audioEffects = new AudioEffects(0.55);
if (localStorage.getItem('soundEnabled') === 'false') audioEffects.setMasterVolume(0);
const storyRun = window.__storyRun = new StoryRun({
  id: 'pastry-match',
  character: 'Pip',
  title: 'Pastry Match: One Order',
  open: 'Pip has one order on the counter today, and the box needs filling before it goes out.',
  objective: 'Swap the pastries into lines of three and fill the box in front of you.',
  cap: 300,
  beats: [
    { at: 0, text: 'The first order goes up on the counter.' },
    { at: 0.4, text: 'The box is half full and the matches get bigger.' },
    { at: 0.8, text: 'Last few pastries to fill the box and send it out.' }
  ],
  result: {
    success: 'The box is handed over with a star rating, and Pip asks if you want the next order.',
    partial: 'The box goes out nearly full, and Pip jots a note for the next order.',
    fail: 'The order waits on the counter, but Pip keeps the recipe ready for another go.'
  },
  onRestart: function(){ startGame(); }
});
const PASTRIES = [
  { id:'croissant', emoji:'🥐', name:'Croissant' },
  { id:'cupcake', emoji:'🧁', name:'Cupcake' },
  { id:'donut', emoji:'🍩', name:'Donut' },
  { id:'cookie', emoji:'🍪', name:'Cookie' },
  { id:'cake', emoji:'🍰', name:'Cake' },
  { id:'pie', emoji:'🥧', name:'Pie' }
];
const MODES = [
  { id:'easy', label:'Little Baker' },
  { id:'rush', label:'Bakery Rush' },
  { id:'chef', label:'Head Chef' }
];
const CUSTOMER_NAMES = ['Milo','Pip','Nia','Lumo','Echo','Dot','Jun','Bee','Roo'];
const BOARD = 7;
let modeId = 'rush', state = 'menu', board = [], selected = null, score = 0, combo = 1, order = null, best = gameSystem.state.highScore || 0, spoon = 1, tray = 1, busy = false, orderStart = 0;
const $ = id => document.getElementById(id);
const boardEl = $('board');
function mode(){ return MODES.find(m => m.id === modeId) || MODES[1]; }
function rand(max){ return Math.floor(Math.random() * max); }
function pastry(){ return PASTRIES[rand(PASTRIES.length)].id; }
function byId(id){ return PASTRIES.find(p => p.id === id) || PASTRIES[0]; }
function saveBest(){ if(score > best){ best = score; try{ if(window.GameSystem&&window.GameSystem.saveScore) window.GameSystem.saveScore('pastry-match', best); }catch(e){} } }
function toggleSound(){ const on = localStorage.getItem('soundEnabled') !== 'false'; localStorage.setItem('soundEnabled', on ? 'false' : 'true'); audioEffects.setMasterVolume(on ? 0 : 0.55); $('soundBtn').textContent = on ? '🔇' : '🔊'; }
function makeOrder(level){
  const picks = [...PASTRIES].sort(() => Math.random() - .5).slice(0, 3);
  const needs = {};
  picks.forEach(p => needs[p.id] = 3);
  const total = Object.values(needs).reduce((a,b)=>a+b,0);
  return { name:CUSTOMER_NAMES[level % CUSTOMER_NAMES.length], needs, total, mood:'🙂' };
}
function hasAnyMove(){
  for(let r=0;r<BOARD;r++) for(let c=0;c<BOARD;c++) for(const [dr,dc] of [[0,1],[1,0]]){ const r2=r+dr,c2=c+dc; if(r2>=BOARD||c2>=BOARD)continue; const a=board[r][c],b=board[r2][c2]; board[r][c]=b; board[r2][c2]=a; const m=findMatches().length>0; board[r][c]=a; board[r2][c2]=b; if(m) return true; }
  return false;
}
function resetBoard(){
  board = Array.from({length:BOARD}, () => Array.from({length:BOARD}, pastry));
  for(let guard=0; findMatches().length && guard<20; guard++) board = Array.from({length:BOARD}, () => Array.from({length:BOARD}, pastry));
  for(let guard=0; !hasAnyMove() && guard<20; guard++){ for(let r=0;r<BOARD;r++) for(let c=0;c<BOARD;c++) board[r][c]=pastry(); }
}
function startGame(){
  gameSystem.beginRun();
  if(window.__storyRun && !window.__storyRun.running) window.__storyRun.begin();
  state = 'playing'; score = 0; combo = 1; selected = null; busy = false; order = makeOrder(0); orderStart = Date.now(); resetBoard(); renderAll();
  $('startModal').classList.remove('show'); $('endModal').classList.remove('show');
}
function renderAll(){ renderHud(); renderCustomers(); renderOrder(); renderBoard(); renderTools(); }
function renderHud(){ $('scoreHud').textContent = score; if(window.__storyRun) window.__storyRun.setScore(score); $('timeHud').textContent = order ? (remaining(order)===0?'served':'1/1') : '1/1'; $('comboHud').textContent = 'x' + combo.toFixed(combo % 1 ? 1 : 0); $('starsHud').textContent = stars(); $('targetHud').textContent = '-'; }
function stars(){ return score >= 4200 ? 3 : score >= 2500 ? 2 : score >= 1000 ? 1 : 0; }
function renderCustomers(){
  if(!order) return;
  $('customers').innerHTML = '<button type="button" class="customer active"><span class="face">'+order.mood+'</span><b>'+order.name+'</b><small>'+remaining(order)+' left</small></button>';
}
function remaining(o){ return Object.values(o.needs).reduce((a,b) => a + Math.max(0,b), 0); }
function renderOrder(){
  if(!order) return;
  $('orderName').textContent = order.name + "'s pastry box";
  $('orderSlots').innerHTML = Object.entries(order.needs).map(([id,n]) => '<span class="slot '+(n<=0?'done':'')+'"><i>'+byId(id).emoji+'</i><b>'+Math.max(0,n)+'</b></span>').join('');
  const pct = 100 - Math.round(remaining(order)/order.total*100);
  $('patienceBar').style.width = pct + '%';
}
function renderTools(){ $('spoonBtn').querySelector('b').textContent = spoon; $('trayBtn').querySelector('b').textContent = tray; $('spoonBtn').disabled = state!=='playing'||spoon<1||busy; $('trayBtn').disabled = state!=='playing'||tray<1||busy; }
function renderBoard(){
  const el = $('board'); el.innerHTML = '';
  for(let r=0;r<BOARD;r++) for(let c=0;c<BOARD;c++){
    const tile = document.createElement('button'); const id = board[r][c]; const p = byId(id);
    tile.type = 'button'; tile.className = 'tile pastry-'+id+(selected && selected.r===r && selected.c===c ? ' selected' : ''); tile.dataset.r = r; tile.dataset.c = c; tile.textContent = p.emoji; tile.setAttribute('aria-label', p.name);
    tile.onclick = () => tapTile(r,c); el.appendChild(tile);
  }
}
function tapTile(r,c){
  if(state !== 'playing' || busy) return;
  if(!selected){ selected = {r,c}; renderBoard(); audioEffects.playTap(520); return; }
  if(selected.r === r && selected.c === c){ selected = null; renderBoard(); return; }
  const near = Math.abs(selected.r-r) + Math.abs(selected.c-c) === 1;
  if(!near){ selected = {r,c}; renderBoard(); audioEffects.playTap(520); return; }
  const first = { r:selected.r, c:selected.c }, second = { r, c };
  swap(first, second); selected = null; renderBoard();
  const matches = findMatches();
  if(matches.length){ resolveMatches(matches); } else { swap(first, second); combo = 1; audioEffects.playError(); renderAll(); }
}
function swap(a,b){ const t = board[a.r][a.c]; board[a.r][a.c] = board[b.r][b.c]; board[b.r][b.c] = t; }
function findMatches(){
  const found = new Set();
  for(let r=0;r<BOARD;r++){ let run=1; for(let c=1;c<=BOARD;c++){ if(c<BOARD && board[r][c]===board[r][c-1]) run++; else { if(run>=3) for(let k=c-run;k<c;k++) found.add(r+','+k); run=1; } } }
  for(let c=0;c<BOARD;c++){ let run=1; for(let r=1;r<=BOARD;r++){ if(r<BOARD && board[r][c]===board[r-1][c]) run++; else { if(run>=3) for(let k=r-run;k<r;k++) found.add(k+','+c); run=1; } } }
  return [...found].map(s => { const [r,c] = s.split(',').map(Number); return {r,c,id:board[r][c]}; });
}
function resolveMatches(matches){
  busy = true; const counts = {}; matches.forEach(m => counts[m.id] = (counts[m.id]||0)+1);
  const gained = feedOrders(counts, matches.length);
  matches.forEach(m => { const cell = document.querySelector('[data-r="'+m.r+'"][data-c="'+m.c+'"]'); if(cell) cell.classList.add('matched'); board[m.r][m.c] = null; });
  score += Math.round((matches.length * 45 + gained) * combo); combo = Math.min(5, combo + (matches.length >= 5 ? .8 : matches.length >= 4 ? .5 : .25));
  if(matches.length >= 4) score += makePower(matches);
  renderHud(); renderOrder(); renderCustomers(); showCombo(matches.length);
  setTimeout(dropTiles, 260);
}
function feedOrders(counts, matchSize){
  let bonus = 0;
  Object.entries(counts).forEach(([id,n]) => { if(order.needs[id] > 0){ const used = Math.min(order.needs[id], n); order.needs[id] -= used; bonus += used * 120; } });
  if(remaining(order) <= 0){ bonus += 650; floatText('Order served! +' + bonus, true); audioEffects.playSuccess(760); }
  else if(bonus){ floatText('Box filled +' + bonus); audioEffects.playSuccess(620); }
  return bonus + (matchSize >= 4 ? 180 : 0);
}
function makePower(matches){
  if(matches.length >= 5){ floatText('Rainbow macaron!'); return 350; }
  floatText('Jam bomb!'); return 220;
}
function dropTiles(){
  for(let c=0;c<BOARD;c++){
    const stack=[]; for(let r=BOARD-1;r>=0;r--) if(board[r][c]) stack.push(board[r][c]);
    for(let r=BOARD-1;r>=0;r--) board[r][c] = stack[BOARD-1-r] || pastry();
  }
  renderBoard(); const more = findMatches();
  if(more.length) setTimeout(() => resolveMatches(more), 180); else { busy=false; renderTools(); renderHud(); if(state==='playing' && remaining(order)===0) setTimeout(endGame, 100); }
}
function showCombo(size){ const banner = $('comboBanner'); banner.textContent = size >= 5 ? 'Rainbow order rush!' : size >= 4 ? 'Jam bomb combo!' : 'Sweet combo x' + combo.toFixed(1); banner.classList.add('show'); setTimeout(() => banner.classList.remove('show'), 650); }
function floatText(text,big){ const d=document.createElement('div'); d.className='float-text'+(big?' big':''); d.textContent=text; $('game').appendChild(d); setTimeout(()=>d.remove(),950); }
function useSpoon(){ if(state!=='playing'||spoon<1||busy)return; spoon--; const need=Object.keys(order.needs).find(id=>order.needs[id]>0) || pastry(); const spots=[]; for(let r=0;r<BOARD;r++)for(let c=0;c<BOARD;c++)if(board[r][c]===need)spots.push({r,c,id:need}); resolveMatches(spots.slice(0, Math.min(5, spots.length))); }
function useTray(){ if(state!=='playing'||tray<1||busy)return; tray--; resetBoard(); selected=null; combo=1; floatText('Fresh tray!'); renderAll(); }
function endGame(){
  if(state === 'ended') return; state='ended'; saveBest();
  gameSystem.addScore(score); gameSystem.addXP(Math.max(8, Math.floor(score/35))); gameSystem.unlockAchievement('firstPlay'); if(stars()>=2) gameSystem.unlockAchievement('goldBaker'); gameSystem.recordGamePlay(Date.now() - orderStart); gameSystem.saveState();
  if(window.__storyRun) window.__storyRun.finish('success', score); $('endTitle').textContent = 'Order served!'; $('endCopy').textContent = 'You served 1 order and earned '+stars()+' stars. Take the next order whenever you like.';
  $('finalScore').textContent = score; $('finalOrders').textContent = '1'; $('finalBest').textContent = Math.max(best, score); $('timeHud').textContent = 'served'; $('patienceBar').style.width = '100%'; $('endModal').classList.add('show'); if(stars()>=1) ParticleSystem.confetti(innerWidth/2, innerHeight/3, 20);
}
function renderModes(){ $('modeRow').innerHTML = MODES.map(m => '<button type="button" class="'+(m.id===modeId?'sel':'')+'" data-mode="'+m.id+'">'+m.label+'</button>').join(''); document.querySelectorAll('#modeRow button').forEach(b=>b.onclick=()=>{modeId=b.dataset.mode; renderModes();}); }

$('soundBtn').onclick = toggleSound; $('playBtn').onclick = startGame; $('againBtn').onclick = startGame; $('spoonBtn').onclick = useSpoon; $('trayBtn').onclick = useTray;
try{ best = Math.max(best, window.GameSystem?window.GameSystem.getBestScore('pastry-match'):0); }catch(e){}
renderModes(); renderHud();
