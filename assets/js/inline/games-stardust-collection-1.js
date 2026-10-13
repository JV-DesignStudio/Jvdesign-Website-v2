(() => {
  const gs = new GameSystem('stardust_collection', 'Stardust Constellation Rescue', 'stardust');
  const FIELD_W = () => field.clientWidth;
  const FIELD_H = () => field.clientHeight;
  // Best score lives in the unified jvds_game_stardust_collection key.
  const MAPS = [
    { name:'Lantern of Lyra', pattern:['✦','◆','✦','☾'] },
    { name:'Compass of Orion', pattern:['☾','✧','◆','✧','✦'] },
    { name:'Crown of Cassiopeia', pattern:['◆','✦','✧','☾','◆'] },
    { name:'Dragon Trail', pattern:['✧','☾','✦','◆','✧','✦'] },
    { name:'Jubilee Star Gate', pattern:['✦','✧','◆','☾','✦','◆'] }
  ];
  const GLYPHS = ['✦','✧','◆','☾'];
  const HAZARDS = ['☄️','🪨','🌑'];
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const levelEl = document.getElementById('level');
  const chainsEl = document.getElementById('chains');
  const bestEl = document.getElementById('best');
  const missionName = document.getElementById('missionName');
  const feedback = document.getElementById('feedback');
  const patternEl = document.getElementById('pattern');
  const field = document.getElementById('playfield');
  const ship = document.getElementById('ship');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('startBtn');
  const practiceBtn = document.getElementById('practiceBtn');
  let best = window.GameSystem ? window.GameSystem.getBestScore('stardust_collection') : 0;
  let running = false, practice = false, raf = 0, last = 0, spawn = 0;
  let score = 0, lives = 3, mapIndex = 0, step = 0, chains = 0, speed = 105;
  let x = 0, targetX = 0, objects = [], keys = {};
  bestEl.textContent = best;

  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
  function renderHud(){ scoreEl.textContent = score; livesEl.textContent = practice ? '∞' : lives; levelEl.textContent = `${mapIndex+1}/${MAPS.length}`; chainsEl.textContent = chains; bestEl.textContent = best; }
  function renderPattern(){
    const map = MAPS[mapIndex];
    missionName.textContent = map.name;
    patternEl.innerHTML = map.pattern.map((g,i)=>`<span class="glyph ${i<step?'done':i===step?'next':''}">${g}</span>`).join('');
  }
  function resetShip(){ x = FIELD_W()/2 - 29; targetX = x; ship.style.left = `${x}px`; ship.style.top = `${FIELD_H()-78}px`; }
  function clearObjects(){ objects.forEach(o => o.el.remove()); objects = []; }
  function makeObject(){
    const wantTarget = Math.random() < 0.42;
    const makeHazard = !wantTarget && Math.random() < 0.28;
    const expected = MAPS[mapIndex].pattern[step];
    let symbol = expected, kind = 'target';
    if (makeHazard){ symbol = HAZARDS[Math.floor(Math.random()*HAZARDS.length)]; kind = 'hazard'; }
    else if (!wantTarget){ const wrong = GLYPHS.filter(g => g !== expected); symbol = wrong[Math.floor(Math.random()*wrong.length)]; kind = 'wrong'; }
    const el = document.createElement('div');
    el.className = `falling ${kind}`;
    el.textContent = symbol;
    const laneWidth = FIELD_W()/5;
    const lane = Math.floor(Math.random()*5);
    const ox = clamp(lane * laneWidth + Math.random()*(laneWidth-52), 6, FIELD_W()-56);
    el.style.left = `${ox}px`; el.style.top = '-58px';
    field.appendChild(el);
    objects.push({ el, x:ox, y:-58, size:48, symbol, kind, vy:speed + Math.random()*52 });
  }
  function startGame(isPractice=false){
    practice = isPractice; running = true; last = 0; spawn = 0; score = 0; lives = 3; mapIndex = 0; step = 0; chains = 0; speed = 105;
    clearObjects(); resetShip(); renderHud(); renderPattern(); feedback.textContent = 'Collect the highlighted symbol first.'; overlay.classList.add('off'); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    gs.beginRun();
  }
  function finish(win){
    running = false; cancelAnimationFrame(raf); clearObjects(); best = Math.max(best, score); if (window.GameSystem && window.GameSystem.saveScore) window.GameSystem.saveScore('stardust_collection', best); renderHud();
    overlay.querySelector('h2').textContent = win ? 'Constellation Rescue Complete!' : 'The sky map collapsed';
    overlay.querySelector('p').textContent = win ? `You restored all five constellations with ${score} points. That took pattern reading, timing, and lane planning.` : `Final score: ${score}. Try reading the next highlighted symbol before moving lanes.`;
    startBtn.textContent = 'Play again'; practiceBtn.textContent = 'Practice mode'; overlay.classList.remove('off');
    if (!practice) {
      gs.addScore(score);
      gs.addXP(Math.max(8, Math.floor(score / 40)));
      gs.recordGamePlay(90000);
      gs.saveState();
    }
    if (win) gs.unlockAchievement('firstPlay');
  }
  function nextMap(){
    score += 80 + chains * 10; mapIndex++; step = 0; speed += 18; clearObjects();
    if (mapIndex >= MAPS.length) return finish(true);
    feedback.textContent = 'Nice. New constellation: read the new sequence.'; renderPattern(); renderHud();
  }
  function collect(obj){
    obj.el.remove(); objects = objects.filter(o => o !== obj);
    if (obj.kind === 'hazard'){
      chains = 0; feedback.textContent = practice ? 'Meteor hit. In practice you keep going.' : 'Meteor hit. One life lost.'; window.JVDSAudio && window.JVDSAudio.error();
      if (!practice) lives--;
      if (lives <= 0) return finish(false);
      renderHud(); return;
    }
    const expected = MAPS[mapIndex].pattern[step];
    if (obj.symbol === expected){
      step++; chains++; score += 25 + chains * 5; feedback.textContent = `Correct: ${obj.symbol}. Keep the sequence going.`; window.JVDSAudio && window.JVDSAudio.success();
      if (step >= MAPS[mapIndex].pattern.length) nextMap();
    } else {
      chains = 0; score = Math.max(0, score - 10); feedback.textContent = `${obj.symbol} is out of order. Look for ${expected} next.`; window.JVDSAudio && window.JVDSAudio.error();
    }
    renderPattern(); renderHud();
  }
  function loop(t){
    if (!running) return;
    const dt = Math.min(0.033, (t-last || 16)/1000); last = t;
    if (keys.ArrowLeft || keys.a) targetX -= 360*dt;
    if (keys.ArrowRight || keys.d) targetX += 360*dt;
    targetX = clamp(targetX, 4, FIELD_W()-62); x += (targetX-x)*0.32; ship.style.left = `${x}px`;
    spawn -= dt; if (spawn <= 0){ makeObject(); spawn = Math.max(.42, 1.08 - mapIndex*.08 - chains*.01); }
    const shipBox = { x, y:FIELD_H()-78, w:58, h:58 };
    objects.slice().forEach(o => {
      o.y += o.vy*dt; o.el.style.top = `${o.y}px`;
      if (o.y > FIELD_H()+60){ o.el.remove(); objects = objects.filter(item => item !== o); if (o.kind === 'target'){ chains = 0; feedback.textContent = 'The needed symbol slipped past. Re-read the pattern.'; renderHud(); } return; }
      const hit = o.x < shipBox.x+shipBox.w-10 && o.x+o.size > shipBox.x+10 && o.y < shipBox.y+shipBox.h-10 && o.y+o.size > shipBox.y+10;
      if (hit) collect(o);
    });
    raf = requestAnimationFrame(loop);
  }
  startBtn.addEventListener('click', () => startGame(false));
  practiceBtn.addEventListener('click', () => startGame(true));
  window.addEventListener('keydown', e => { keys[e.key] = true; if (['ArrowLeft','ArrowRight','a','d'].includes(e.key)) e.preventDefault(); });
  window.addEventListener('keyup', e => { keys[e.key] = false; });
  field.addEventListener('pointermove', e => { if (!running) return; const r = field.getBoundingClientRect(); targetX = clamp(e.clientX - r.left - 29, 4, FIELD_W()-62); });
  [['touchLeft','ArrowLeft'],['touchRight','ArrowRight']].forEach(([id,key]) => {
    const btn = document.getElementById(id);
    btn.addEventListener('pointerdown', e => { e.preventDefault(); keys[key] = true; });
    ['pointerup','pointerleave','pointercancel'].forEach(evt => btn.addEventListener(evt, e => { e.preventDefault(); keys[key] = false; }));
  });
  window.addEventListener('resize', () => { targetX = clamp(targetX, 4, FIELD_W()-62); resetShip(); });
  resetShip(); renderPattern(); renderHud();
  window.startGame = startGame;
})();
