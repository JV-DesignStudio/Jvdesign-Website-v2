(function(){
const $ = id => document.getElementById(id);
const audio = window.AudioEffects ? new AudioEffects(.5) : null;
const sys = window.GameSystem ? new GameSystem('stardust-ruins','Stardust Ruins','stardust') : null;
const storyRun = window.StoryRun ? new StoryRun({
  id:'stardust-ruins', gameSystem:sys, title:'Stardust Ruins', character:'Stardust',
  open:'Stardust found ancient ruins and the walls glow with symbol sequences.',
  objective:'Remember and repeat the glowing symbols to unlock each ruin.',
  beats:[{at:0,text:'The first symbols light up.'},{at:.45,text:'The sequences grow longer.'},{at:.82,text:'Deep ruins now. The patterns test your memory.'}],
  cap:300,
  result:{
    success:'Every ruin opens and Stardust walks through the ancient halls.',
    partial:'Most ruins cracked, the deep ones stay sealed.',
    fail:'The ruins seal shut, but Stardust remembers the patterns.'
  },
  onRestart:function(){ startGame(); }
}) : null;

const allSymbols = ['🌙','⭐','🌊','🔥','💎','🍃','⚡','❄️','☀️'];
const ruinNames = ['Moonlit Stair','Crystal Cavern','Sun Temple','Storm Spire','Frozen Vault','Ember Forge','Shadow Gate','Star Chamber','Void Throne','Eternal Archive'];
const tones = [261,293,329,349,392,440,493,523,587];

let symbols = [], sequence = [], playerSeq = [], showIdx = 0;
let score = 0, ruin = 0, lives = 3, seqLen = 3, showing = false, playerTurn = false;
let best = (sys ? GameSystem.getBestScore('stardust-ruins') : 0) || 0;

function playTone(idx) {
  try {
    const actx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.connect(gain);
    gain.connect(actx.destination);
    osc.frequency.value = tones[idx % tones.length];
    osc.type = 'sine';
    gain.gain.value = .15;
    gain.gain.exponentialRampToValueAtTime(.001, actx.currentTime + .4);
    osc.start();
    osc.stop(actx.currentTime + .4);
  } catch(e) {}
}

function buildGrid() {
  const count = Math.min(9, 6 + Math.floor(ruin / 3));
  symbols = allSymbols.slice(0, count);
  const grid = $('symbolGrid');
  const cols = count <= 4 ? 2 : 3;
  grid.style.gridTemplateColumns = 'repeat(' + cols + ',1fr)';
  grid.innerHTML = symbols.map((s, i) =>
    '<button class="sym locked" data-idx="' + i + '">' + s + '</button>'
  ).join('');
  grid.querySelectorAll('.sym').forEach(btn => {
    btn.onclick = () => {
      if (!playerTurn) return;
      handleTap(parseInt(btn.dataset.idx));
    };
  });
}

function generateSequence() {
  sequence = [];
  for (let i = 0; i < seqLen; i++) {
    sequence.push(Math.floor(Math.random() * symbols.length));
  }
}

function flashSymbol(idx, duration) {
  const btns = $('symbolGrid').querySelectorAll('.sym');
  if (btns[idx]) {
    btns[idx].classList.add('flash');
    playTone(idx);
    setTimeout(() => btns[idx].classList.remove('flash'), duration - 80);
  }
}

function showSequence() {
  showing = true;
  playerTurn = false;
  $('seqDisplay').textContent = 'Watch the sequence...';
  $('status').textContent = '';
  const btns = $('symbolGrid').querySelectorAll('.sym');
  btns.forEach(b => b.classList.add('locked'));

  let i = 0;
  const speed = Math.max(350, 650 - ruin * 25);
  const iv = setInterval(() => {
    flashSymbol(sequence[i], speed - 50);
    i++;
    if (i >= sequence.length) {
      clearInterval(iv);
      setTimeout(() => {
        showing = false;
        playerTurn = true;
        playerSeq = [];
        $('seqDisplay').textContent = 'Your turn! Repeat the sequence.';
        btns.forEach(b => b.classList.remove('locked'));
      }, 400);
    }
  }, speed);
}

function handleTap(idx) {
  if (!playerTurn) return;
  const expected = sequence[playerSeq.length];
  const btns = $('symbolGrid').querySelectorAll('.sym');

  if (idx === expected) {
    btns[idx].classList.add('correct');
    playTone(idx);
    setTimeout(() => btns[idx].classList.remove('correct'), 200);
    playerSeq.push(idx);
    $('seqDisplay').textContent = playerSeq.length + ' / ' + sequence.length;

    if (playerSeq.length === sequence.length) {
      playerTurn = false;
      const bonus = seqLen * 40 + ruin * 20;
      score += bonus;
      $('status').textContent = '✅ Ruin cleared! +' + bonus;
      try { audio?.playSuccess?.(); } catch(e) {}
      hud();
      setTimeout(nextRuin, 1400);
    }
  } else {
    btns[idx].classList.add('wrong');
    setTimeout(() => btns[idx].classList.remove('wrong'), 400);
    lives--;
    $('livesDisplay').textContent = '❤️'.repeat(Math.max(0, lives));
    $('status').textContent = '❌ Wrong symbol!';
    try { audio?.playError?.(); } catch(e) {}

    if (lives <= 0) {
      playerTurn = false;
      setTimeout(endGame, 800);
    } else {
      playerTurn = false;
      setTimeout(() => {
        playerSeq = [];
        showSequence();
      }, 1000);
    }
    hud();
  }
}

function nextRuin() {
  ruin++;
  seqLen = 3 + Math.floor(ruin * .7);
  $('ruinName').textContent = ruinNames[ruin % ruinNames.length];
  buildGrid();
  generateSequence();
  hud();
  setTimeout(showSequence, 600);
}

function hud() {
  $('scoreHud').textContent = score;
  $('ruinHud').textContent = ruin + 1;
  $('seqHud').textContent = seqLen;
  $('bestHud').textContent = best;
  if (storyRun) storyRun.setScore(score);
}

function startGame() {
  score = 0; ruin = 0; lives = 3; seqLen = 3;
  $('startScreen').classList.add('hidden');
  $('endScreen').classList.add('hidden');
  $('livesDisplay').textContent = '❤️❤️❤️';
  $('ruinName').textContent = ruinNames[0];
  sys?.beginRun?.();
  if (storyRun && !storyRun.running) storyRun.begin();
  buildGrid();
  generateSequence();
  hud();
  setTimeout(showSequence, 800);
}

function endGame() {
  if (score > best) { best = score; if (sys) GameSystem.saveScore('stardust-ruins', best); }
  sys?.saveState?.();
  if (storyRun) {
    storyRun.finish(ruin > 4 ? 'success' : 'fail', score);
  } else {
    $('endTitle').textContent = ruin > 6 ? 'Ruin Master!' : ruin > 3 ? 'Good Memory!' : 'Ruins Sealed';
    $('endStats').innerHTML = [['Score', score],['Ruins Cleared', ruin],['Longest Sequence', seqLen],['Best', best]].map(s => '<div><b>' + s[1] + '</b><small>' + s[0] + '</small></div>').join('');
    $('endScreen').classList.remove('hidden');
  }
}

$('playBtn').onclick = startGame;
$('againBtn').onclick = startGame;
$('soundBtn').onclick = function() {
  const on = localStorage.getItem('soundEnabled') !== 'false';
  localStorage.setItem('soundEnabled', on ? 'false' : 'true');
  if (audio) audio.setMasterVolume(on ? 0 : .5);
  $('soundBtn').textContent = on ? '🔇' : '🔊';
};

hud();
})();
