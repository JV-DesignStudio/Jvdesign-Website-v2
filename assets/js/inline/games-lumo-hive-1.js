(function () {
  const C = document.getElementById('game');
  const x = C.getContext('2d');
  const $ = id => document.getElementById(id);
  const sys = window.GameSystem ? new GameSystem('lumo-hive', "Lumo's Hive Strike", 'lumo') : null;
  const audio = window.AudioEffects ? new AudioEffects(0.4) : null;

  // Virtual canvas (portrait, scaled to fill)
  const W = 360, H = 620;
  const IS_TOUCH = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  const REDUCED_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const PLAYER_Y = IS_TOUCH ? H - 100 : H - 55;
  const LUMO_MIN_X = 21, LUMO_MAX_X = W - 36;

  function fit() {
    const r = C.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    C.width = Math.round(r.width * dpr);
    C.height = Math.round(r.height * dpr);
    x.setTransform(C.width / W, 0, 0, C.height / H, 0, 0);
  }
  addEventListener('resize', fit);
  setTimeout(fit, 50);

  let soundMuted = false;

  function sfx(n, ...args) {
    if (soundMuted) return;
    try { audio?.[n]?.(...args); } catch (e) { }
  }

  const music = {
    timer: null, step: 0,
    start() {
      if (this.timer || soundMuted || !audio) return;
      const ctx = audio.getContext();
      if (!ctx) return;
      this.timer = setInterval(() => {
        if (soundMuted || !audio || !audio.getVolume()) return;
        const c = audio.getContext();
        if (!c) return;
        const notes = [220.00, 277.18, 329.63, 440.00, 523.25, 440.00, 329.63, 277.18, 246.94, 293.66, 349.23, 440.00, 349.23, 293.66, 246.94, 220.00];
        const t = c.currentTime;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'triangle';
        osc.frequency.value = notes[this.step % notes.length];
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.05 * audio.getVolume(), t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(t);
        osc.stop(t + 0.3);
        this.step++;
      }, 320);
    },
    stop() {
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
    }
  };

  function showToast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.className = 'toast show';
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => t.classList.remove('show'), 1200);
  }

  function announce(msg) {
    const el = $('srStatus');
    if (el) el.textContent = String(msg).slice(0, 200);
  }

  // ── STATE ─────────────────────────────────────────────────────────────────
  let gameState = 'idle'; // idle | playing | waveclear | dead
  let score = 0, wave = 1, lives = 3, combo = 1, comboTimer = 0;
  let shootCool = 0, waveClearT = 0;
  let rapidT = 0, multiT = 0;
  let won = false, wavePerfect = true, goldFlash = 0, shakeUntil = 0;
  let finalWaveT = 0, hitStopT = 0;
  let focus = 0, beamT = 0, beamX = 0;
  let paused = false, helpOrigin = 'start', tookHit = false;
  let bestCombo = 1, perfectWaves = 0, bossesKilled = 0;
  let waveSpeed = 1, waveDiveRate = 1, waveHpBonus = 0, waveDoubleDive = false, waveLabel = '';
  let best = parseInt(localStorage.getItem('jvds_lhs_best') || '0');

  // ── RUN MODES, HONEY BANK, RELICS, BOONS, TURRETS ─────────────────────────
  // The Hive is a tactical formation defence: linked formations, a honey
  // economy, boon drafting and buildable turrets. It shares nothing with the
  // Firefly puzzle beyond Lumo himself.
  const MODE_IDS = ['campaign', 'endless', 'daily', 'bossrush'];
  const MODE_LABEL = { campaign: 'Campaign', endless: 'Endless', daily: 'Daily', bossrush: 'Boss Rush' };
  const savedMode = (() => { try { return localStorage.getItem('jvds_lhs_mode'); } catch (e) { return null; } })();
  let mode = MODE_IDS.includes(savedMode) ? savedMode : 'campaign';
  const LS_BANK = 'jvds_lhs_bank', LS_RELICS = 'jvds_lhs_relics', LS_DAILY = 'jvds_lhs_daily';
  let bankedHoney = 0;
  try { bankedHoney = Math.max(0, parseInt(localStorage.getItem(LS_BANK) || '0', 10) || 0); } catch (e) { }
  let relics = {};
  try { relics = JSON.parse(localStorage.getItem(LS_RELICS) || '{}') || {}; } catch (e) { relics = {}; }
  let dailyBest = 0, dailyDate = '';
  try {
    const d = JSON.parse(localStorage.getItem(LS_DAILY) || '{}');
    dailyBest = (d && d.best) | 0; dailyDate = (d && d.date) || '';
  } catch (e) { }
  let honey = 0, runHoney = 0, turrets = [], boons = {}, boonPicks = [], turretSlots = 2, turretShots = 0;
  let forgeOpen = false, forgeChoices = [], forgePicked = false, forgeNext = null;
  let bossPhase = 1, bossRushKills = 0;
  let coachT = 0, coachStep = 0;
  let coachDone = false;
  try { coachDone = localStorage.getItem('jvds_lhs_coach') === '1'; } catch (e) { }
  const COACH_LINES = [
    'Move with A/D or the buttons. Space fires.',
    'The glowing ring is the anchor: kill it first.',
    'Perfect waves bank honey for the Garden Forge.'
  ];
  let seedRng = Math.random, runSeed = '';

  function hashSeed(text) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function todayKey() { return new Date().toISOString().slice(0, 10); }
  function rand() { return seedRng(); }
  function seedRun(value) {
    runSeed = value || '';
    seedRng = value ? mulberry32(hashSeed(value)) : Math.random;
  }

  const RELICS = [
    { id: 'shield', name: 'Extra Shield', icon: '🛡️', desc: 'Start each run with one more shield.', max: 3, base: 120 },
    { id: 'honey', name: 'Spring Stores', icon: '🍯', desc: 'Start each run with +20 honey.', max: 4, base: 80 },
    { id: 'focus', name: 'Quick Spark', icon: '🔮', desc: 'Charge the Logic Beam 10% faster.', max: 3, base: 100 },
    { id: 'turret', name: 'Turret Blueprint', icon: '🏹', desc: 'Unlock one more turret slot at the start.', max: 1, base: 220 },
    { id: 'reroll', name: 'Forge Reroll', icon: '🎲', desc: 'One free boon reroll each run.', max: 2, base: 150 },
    { id: 'combo', name: 'Long Chain', icon: '🔗', desc: 'Combos last a little longer.', max: 3, base: 90 }
  ];
  const BOONS = [
    { id: 'sting', name: 'Sharp Stinger', icon: '⚡', max: 5, rarity: 'common', desc: '+1 bullet damage.' },
    { id: 'rapid', name: 'Quickdraw', icon: '💨', max: 4, rarity: 'common', desc: 'Shoot faster.' },
    { id: 'twin', name: 'Twin Sting', icon: '✨', max: 4, rarity: 'rare', desc: '+1 shot per volley.' },
    { id: 'hull', name: 'Honey Wall', icon: '🛡️', max: 3, rarity: 'rare', desc: '+1 shield now and one more max.' },
    { id: 'focus', name: 'Deep Focus', icon: '🔮', max: 4, rarity: 'common', desc: 'Logic Beam charges faster.' },
    { id: 'slow', name: 'Sleepy Pollen', icon: '🌙', max: 3, rarity: 'common', desc: 'Dives and enemy shots slow down.' },
    { id: 'sweet', name: 'Sweet Tooth', icon: '🍯', max: 4, rarity: 'common', desc: '+25% honey from kills.' },
    { id: 'combo', name: 'Chain Keeper', icon: '🔗', max: 3, rarity: 'rare', desc: 'Combos last longer.' },
    { id: 'pierce', name: 'Barbed Shot', icon: '➡️', max: 3, rarity: 'epic', desc: 'Shots pierce +1 bee.' },
    { id: 'homing', name: 'Scent Trail', icon: '🎯', max: 3, rarity: 'epic', desc: 'Shots curve toward bees.' },
    { id: 'turret', name: 'Turret Nest', icon: '🏹', max: 2, rarity: 'rare', desc: 'Unlock another turret slot and build one free.' },
    { id: 'link', name: 'Link Breaker', icon: '💠', max: 3, rarity: 'rare', desc: 'Linked bees take full damage and pay bonus honey.' }
  ];
  const EVOLUTIONS = [
    { id: 'storm', name: 'Needle Storm', info: 'Shots pierce and hit much harder', need: () => boonLv('sting') >= 3 && boonLv('pierce') >= 1 },
    { id: 'guard', name: 'Hive Guard', info: 'Turrets fire twice as fast', need: () => boonLv('turret') >= 1 && turrets.length >= 2 },
    { id: 'swarm', name: 'Twin Swarm', info: 'Volleys fan out and gain a shot', need: () => boonLv('twin') >= 3 },
    { id: 'beam', name: 'Radiant Beam', info: 'The Logic Beam also restores a shield', need: () => boonLv('focus') >= 3 }
  ];

  function relicLv(id) { return Math.max(0, relics[id] | 0); }
  function boonLv(id) { return Math.max(0, boons[id] | 0); }
  function hasEvo(id) { return boonPicks.includes('evo:' + id); }
  function saveBank() {
    try { localStorage.setItem(LS_BANK, String(Math.max(0, Math.round(bankedHoney)))); } catch (e) { }
  }
  function saveRelics() {
    try { localStorage.setItem(LS_RELICS, JSON.stringify(relics)); } catch (e) { }
  }
  function saveDaily() {
    try { localStorage.setItem(LS_DAILY, JSON.stringify({ date: dailyDate, best: dailyBest })); } catch (e) { }
  }
  function relicCost(r) { return r.base + r.base * relicLv(r.id); }
  function honeyMult() { return 1 + 0.25 * boonLv('sweet'); }
  function bulletDamage() { return 1 + boonLv('sting') + (hasEvo('storm') ? 1 : 0); }
  function shotsPerVolley() { return 1 + boonLv('twin'); }
  function comboWindow() { return 2.2 + boonLv('combo') * 0.45 + relicLv('combo') * 0.2; }
  function focusRate() { return 1 + boonLv('focus') * 0.25 + relicLv('focus') * 0.1; }
  function slowFactor() { return Math.max(0.55, 1 - boonLv('slow') * 0.12); }
  function maxShields() { return 3 + relicLv('shield') + boonLv('hull'); }
  function turretSlotCount() { return Math.min(3, 2 + relicLv('turret') + boonLv('turret')); }
  function turretX(slot) { return 68 + slot * 112; }

  const lumo = { x: W / 2, y: PLAYER_Y, invT: 0, flash: 0 };
  let bullets = []; // {x,y,vy,owner,c}
  let enemies = [];
  let particles = [];
  let floaters = [];
  let powerups = [];
  let boss = null;

  // Idle start-screen formation
  let idleEnemies = [];
  let idleFormX = 0, idleFormVx = 12;

  // Formation geometry
  const ROWS = 5, COLS = 8;
  const FX0 = 24, FY0 = 70, FDX = 38, FDY = 40;
  let formX = 0, formVx = 28;

  // Dive timing
  let diveTimer = 0, nextDive = 2.8;

  // ── ENEMY TYPES ────────────────────────────────────────────────────────────
  function typeHP(t) { return { drone: 1, guard: 2, queen: 3 }[t]; }
  function typeScore(t) { return { drone: 10, guard: 25, queen: 50 }[t]; }
  function typeColor(t) { return { drone: '#fbbf24', guard: '#f97316', queen: '#7c3aed' }[t]; }
  function rowType(row) { return row === 0 ? 'queen' : row === 1 ? 'guard' : 'drone'; }

  function formPos(row, col) {
    const hex = (row % 2) * 0.5;
    return { fx: FX0 + (col + hex) * FDX, fy: FY0 + row * FDY };
  }

  function applyWaveMods() {
    waveSpeed = 1; waveDiveRate = 1; waveHpBonus = 0; waveDoubleDive = false; waveLabel = '';
    if (wave === 2) { waveSpeed = 1.15; waveLabel = 'Swift'; }
    else if (wave === 3) { waveDiveRate = 0.75; waveLabel = 'Swarm'; }
    else if (wave === 4) { waveDiveRate = 0.8; waveDoubleDive = true; waveLabel = 'Crossfire'; }
    else if (wave === 6) { waveHpBonus = 1; waveLabel = 'Armored'; }
    else if (wave === 7) { waveDiveRate = 0.7; waveLabel = 'Crossfire'; }
    else if (wave === 8) { waveSpeed = 1.25; waveDiveRate = 0.85; waveLabel = 'Rush'; }
    else if (wave === 9) { waveDiveRate = 0.65; waveDoubleDive = true; waveLabel = 'Onslaught'; }
  }

  // ── BUILD FORMATION ────────────────────────────────────────────────────────
  function buildFormation() {
    enemies = [];
    formX = 0;
    formVx = Math.min(72, (28 + wave * 2.5) * waveSpeed);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const type = rowType(r);
        const hp = typeHP(type) + (type === 'drone' ? 0 : waveHpBonus);
        const { fx, fy } = formPos(r, c);
        enemies.push({
          row: r, col: c, type, hp, maxHp: hp,
          x: fx, y: fy - 350,
          fx, fy, uid: r * COLS + c,
          state: 'enter',
          enterDelay: (r * COLS + c) * 0.038,
          divePath: null, angle: 0, shootCool: 0, warnT: 0,
          link: null, anchor: false
        });
      }
    }
    assignLinks();
  }

  // ── HIVE LINKS ─────────────────────────────────────────────────────────────
  // One or two bees per wave are anchors. Bees around an anchor share armour
  // while it lives, so the player has to read the formation and pick the
  // glowing target first. Breaking a link pays honey and opens the cluster.
  function assignLinks() {
    const pool = enemies.filter(e => e.state === 'enter');
    const anchors = [];
    const wanted = wave >= 6 ? 2 : 1;
    for (let i = 0; i < wanted && pool.length; i++) {
      const pick = pool[Math.floor(rand() * pool.length)];
      if (!pick || pick.anchor) continue;
      pick.anchor = true;
      pick.hp += 1; pick.maxHp += 1;
      anchors.push(pick);
    }
    if (!anchors.length) return;
    for (const e of enemies) {
      if (e.anchor) continue;
      let best = null, bestD = 1e9;
      for (const a of anchors) {
        if (!a) continue;
        const d = Math.abs(a.row - e.row) + Math.abs(a.col - e.col);
        if (d < bestD) { bestD = d; best = a; }
      }
      if (best && bestD <= 2) e.link = best;
    }
  }

  function breakLinks(anchor) {
    let freed = 0;
    for (const e of enemies) {
      if (e.link === anchor) { e.link = null; freed++; }
    }
    if (freed > 0) {
      burst(anchor.x, anchor.y, '#4cc9f0', '#fef08a', 14);
      spawnFloater(anchor.x, anchor.y - 18, 'LINK BROKEN', '#4cc9f0');
      addHoney(1 + Math.floor(freed / 2));
    }
    return freed;
  }

  // ── HONEY / TURRETS ────────────────────────────────────────────────────────
  function addHoney(n) {
    const amount = Math.max(0, Math.round(n * honeyMult()));
    if (!amount) return 0;
    honey += amount; runHoney += amount; hud();
    return amount;
  }

  function spendHoney(n) {
    if (honey < n) return false;
    honey -= n; hud();
    return true;
  }

  function buildTurret(slot, free) {
    if (slot < 0 || slot >= turretSlotCount()) return false;
    if (turrets.some(t => t.slot === slot)) return false;
    if (!free) { if (!spendHoney(25)) return false; }
    turrets.push({ slot, x: turretX(slot), y: PLAYER_Y - 4, level: 1, cool: 0.3 });
    showToast('🏹 Honey turret built');
    return true;
  }

  function upgradeTurret(slot) {
    const t = turrets.find(tu => tu.slot === slot);
    if (!t || t.level >= 3) return false;
    if (!spendHoney(30 * t.level)) return false;
    t.level++;
    showToast('🏹 Turret up to level ' + t.level);
    return true;
  }

  function turretDamage() { return 1 + (boonLv('turret') > 0 ? 1 : 0); }
  function turretRate(t) {
    const base = 1.25 - t.level * 0.22;
    return Math.max(0.18, hasEvo('guard') ? base * 0.5 : base);
  }

  function nearestEnemyTo(x, y) {
    let best = null, bd = 1e9;
    for (const e of enemies) {
      if (e.state === 'enter' && e.enterDelay > 0) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bd) { bd = d; best = e; }
    }
    if (boss) {
      const d = Math.hypot(boss.x - x, boss.y - y);
      if (d < bd) { bd = d; best = boss; }
    }
    return best;
  }

  // ── BOONS / EVOLUTIONS / FORGE ─────────────────────────────────────────────
  function boonDef(id) { return BOONS.find(b => b.id === id) || null; }

  function applyBoon(id) {
    const def = boonDef(id);
    if (!def) return false;
    boons[id] = Math.min(def.max, boonLv(id) + 1);
    if (id === 'hull') { lives = Math.min(maxShields(), lives + 1); }
    if (id === 'turret') {
      turretSlots = turretSlotCount();
      const empty = [];
      for (let s = 0; s < turretSlotCount(); s++) if (!turrets.some(t => t.slot === s)) empty.push(s);
      if (empty.length) buildTurret(empty[0], true);
    }
    checkEvolutions();
    hud();
    return true;
  }

  function checkEvolutions() {
    for (const evo of EVOLUTIONS) {
      if (hasEvo(evo.id)) continue;
      if (evo.need()) {
        boonPicks.push('evo:' + evo.id);
        if (evo.id === 'beam') lives = Math.min(maxShields(), lives + 1);
        showToast('Evolution: ' + evo.name);
        spawnFloater(W / 2, H * 0.4, evo.name.toUpperCase(), '#fbbf24');
        sfx('playLevelUp');
      }
    }
  }

  function boonChoices() {
    const pool = BOONS.filter(b => boonLv(b.id) < b.max);
    const out = [];
    const weights = { common: 6, rare: 3, epic: 1 };
    let guard = 0;
    while (out.length < 3 && pool.length && guard < 40) {
      guard++;
      let total = 0;
      for (const b of pool) total += weights[b.rarity] || 1;
      let roll = rand() * total, chosen = pool[0];
      for (const b of pool) { roll -= weights[b.rarity] || 1; if (roll <= 0) { chosen = b; break; } }
      if (!out.some(x => x.id === chosen.id)) out.push(chosen);
    }
    return out;
  }

  function openForge(next) {
    forgeOpen = true;
    forgeNext = next || null;
    forgePicked = false;
    forgeChoices = boonChoices();
    gameState = 'forge';
    for (const k in keys) keys[k] = false;
    leftHeld.v = false; rightHeld.v = false;
    renderForge();
    const el = $('forge'); if (el) el.classList.remove('hidden');
    announce('Garden Forge. Choose a boon or build a turret.');
  }

  function closeForge() {
    forgeOpen = false;
    $('forge')?.classList.add('hidden');
    const next = forgeNext; forgeNext = null;
    if (typeof next === 'function') next();
  }

  function renderForge() {
    const row = $('boonRow');
    if (row) {
      row.innerHTML = '';
      forgeChoices.forEach((b) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'boon ' + (b.rarity === 'epic' ? 'epic' : '');
        btn.disabled = forgePicked;
        btn.style.opacity = forgePicked ? '0.45' : '1';
        btn.innerHTML = '<span class="bicon">' + b.icon + '</span><b>' + b.name + '</b><small>' + b.desc + '</small><span class="rare">' + b.rarity + '</span>';
        btn.onclick = () => {
          if (forgePicked) return;
          forgePicked = true;
          applyBoon(b.id);
          renderForge();
          sfx('playSuccess');
        };
        row.appendChild(btn);
      });
    }
    const shop = $('turretShop');
    if (shop) {
      shop.innerHTML = '';
      for (let s = 0; s < turretSlotCount(); s++) {
        const t = turrets.find(tu => tu.slot === s);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'turret-btn';
        if (!t) {
          btn.textContent = '🏹 Build turret · 25 honey';
          btn.disabled = honey < 25;
          btn.onclick = () => { if (buildTurret(s)) { renderForge(); hud(); } };
        } else if (t.level < 3) {
          btn.textContent = '🏹 Turret Lv' + t.level + ' → ' + (t.level + 1) + ' · ' + (30 * t.level) + ' honey';
          btn.disabled = honey < 30 * t.level;
          btn.onclick = () => { if (upgradeTurret(s)) { renderForge(); hud(); } };
        } else {
          btn.textContent = '🏹 Turret Lv3 (max)';
          btn.disabled = true;
        }
        shop.appendChild(btn);
      }
    }
    const h = $('forgeHoney'); if (h) h.textContent = 'Honey: ' + honey;
    const sub = $('forgeSub');
    if (sub) sub.textContent = forgePicked ? 'Boon chosen. Spend honey on turrets, then return to the hive.' : 'Choose one garden boon, then spend honey on turrets.';
    const go = $('forgeGo'); if (go) go.textContent = forgePicked ? 'Back to the hive' : 'Skip the boon (+10 honey)';
  }

  function relicChoices() { return RELICS; }

  function renderLedger() {
    const list = $('relicList');
    if (list) {
      list.innerHTML = '';
      RELICS.forEach((r) => {
        const lvl = relicLv(r.id);
        const maxed = lvl >= r.max;
        const cost = relicCost(r);
        const row = document.createElement('div');
        row.className = 'relic' + (maxed ? ' maxed' : '');
        row.innerHTML = '<div><b>' + r.icon + ' ' + r.name + ' · ' + lvl + '/' + r.max + '</b><small>' + r.desc + '</small></div>';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = maxed ? 'MAX' : (cost + ' 🍯');
        btn.disabled = maxed || bankedHoney < cost;
        btn.onclick = () => {
          if (maxed || bankedHoney < cost) return;
          bankedHoney -= cost;
          relics[r.id] = lvl + 1;
          saveBank(); saveRelics();
          renderLedger(); updateBankLine(); hud();
          sfx('playLevelUp');
        };
        row.appendChild(btn);
        list.appendChild(row);
      });
    }
    const bank = $('ledgerBank'); if (bank) bank.textContent = 'Hive bank: ' + bankedHoney + ' honey';
  }

  function updateBankLine() {
    const el = $('bankLine');
    if (el) el.textContent = 'Hive bank: ' + bankedHoney + ' honey · Relics ' + RELICS.reduce((n, r) => n + relicLv(r.id), 0) + '/' + RELICS.reduce((n, r) => n + r.max, 0);
    const dh = $('dailyHint');
    if (dh) {
      const key = todayKey();
      const streak = typeof streakData !== 'undefined' && streakData ? streakData.streak : 0;
      const doneToday = typeof streakData !== 'undefined' && streakData && streakData.doneToday;
      dh.textContent = mode === 'daily'
        ? 'Daily hive ' + key + (dailyDate === key ? ' · best ' + dailyBest : ' · not played yet') + ' · streak ' + streak + (doneToday ? ' (done today)' : '')
        : (mode === 'bossrush' ? 'Five queens, no formations. Bring turrets.' : (mode === 'endless' ? 'Endless: the hive never stops.' : 'Campaign: ten waves, then the Logic Garden is safe.'));
    }
    document.querySelectorAll('#modeRow .mode-pill').forEach((b) => {
      const on = b.dataset.mode === mode;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function setMode(m) {
    if (!MODE_IDS.includes(m)) return;
    if (gameState === 'playing' || gameState === 'waveclear' || gameState === 'forge') { showToast('Finish this run first'); return; }
    mode = m;
    try { localStorage.setItem('jvds_lhs_mode', mode); } catch (e) { }
    updateBankLine();
    sfx('playTap');
  }

  // ── IDLE FORMATION ────────────────────────────────────────────────────────
  function buildIdleFormation() {
    idleEnemies = [];
    const rows = 4, cols = 7;
    const dx = 32, dy = 34;
    const x0 = (W - (cols - 1) * dx) / 2, y0 = 154;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const type = rowType(r);
        const hp = typeHP(type);
        idleEnemies.push({
          row: r, col: c, type, hp, maxHp: hp,
          x: x0 + (c + (r % 2) * 0.5) * dx, y: y0 + r * dy,
          fx: 0, fy: 0, state: 'form', enterDelay: 0,
          divePath: null, angle: 0, shootCool: 0, warnT: 0
        });
      }
    }
  }

  // ── BOSS ──────────────────────────────────────────────────────────────────
  function spawnBoss() {
    const hpBase = mode === 'bossrush' ? 14 + bossRushKills * 6 + wave * 2 : 10 + wave * 2;
    const maxHp = Math.round(hpBase * (1 + (mode === 'daily' ? 0.1 : 0)));
    bossPhase = 1;
    boss = { x: W / 2, y: 80, vx: 55 + wave * 3, hp: maxHp, maxHp, invT: 0, shootCool: 0, phase: 1, phaseFlash: 0 };
    enemies = [];
    announce('Queen boss. Watch for phase changes at two thirds and one third health.');
  }

  function phaseShift(n) {
    if (!boss) return;
    boss.phaseFlash = 0.6;
    shakeUntil = performance.now() + 260;
    showToast(n === 2 ? '👑 Queen phase 2' : '👑 Queen phase 3');
    burst(boss.x, boss.y, '#f97316', '#fef08a', 18);
    sfx('playLevelUp');
    announce('Queen phase ' + n + '.');
  }

  function beginCoach() {
    if (coachDone) { coachT = 0; return; }
    coachT = 13;
    coachStep = 0;
    announce('Coach: ' + COACH_LINES[0]);
  }
  function finishCoach() {
    coachT = 0;
    if (!coachDone) { coachDone = true; try { localStorage.setItem('jvds_lhs_coach', '1'); } catch (e) { } }
  }

  // ── START / END ────────────────────────────────────────────────────────────
  function startGame() {
    score = 0; wave = 1; combo = 1; comboTimer = 0;
    shootCool = 0; rapidT = 0; multiT = 0;
    won = false; wavePerfect = true; goldFlash = 0; shakeUntil = 0; finalWaveT = 0;
    hitStopT = 0; focus = 0; beamT = 0; paused = false;
    tookHit = false; bestCombo = 1; perfectWaves = 0; bossesKilled = 0;
    bullets = []; particles = []; floaters = []; powerups = [];
    lumo.x = W / 2; lumo.invT = 0; lumo.flash = 0;
    boss = null;
    boons = {}; boonPicks = []; turrets = []; honey = relicLv('honey') * 20; runHoney = 0; turretShots = 0;
    turretSlots = turretSlotCount();
    for (let s = 0; s < relicLv('turret'); s++) buildTurret(s, true);
    lives = maxShields();
    bossRushKills = 0; bossPhase = 1;
    forgeOpen = false; forgePicked = false; forgeChoices = []; forgeNext = null;
    $('forge')?.classList.add('hidden');
    $('ledger')?.classList.add('hidden');
    $('endScreen')?.classList.add('hidden');
    seedRun(mode === 'daily' ? 'lumo-hive-' + todayKey() : '');
    if (mode === 'bossrush') {
      spawnBoss();
    } else {
      applyWaveMods();
      buildFormation();
      diveTimer = 0; nextDive = 2.8;
    }
    gameState = 'playing';
    beginCoach();
    $('startScreen').classList.add('hidden');
    $('againBtn').textContent = 'Try Again';
    music.start();
    sys?.beginRun?.();
    hud();
    updateBankLine();
  }

  function endGame(victory) {
    gameState = 'dead';
    music.stop();
    if (score > best) { best = score; localStorage.setItem('jvds_lhs_best', best); }
    const banked = Math.floor(runHoney * 0.5) + (victory ? 25 : 0) + Math.floor(wave * 2);
    bankedHoney += Math.max(0, banked);
    saveBank();
    if (mode === 'daily') {
      const key = todayKey();
      if (dailyDate !== key) { dailyDate = key; dailyBest = 0; }
      if (score > dailyBest) dailyBest = score;
      saveDaily();
    }
    const bankEl = $('endBank');
    if (bankEl) bankEl.textContent = '+' + banked + ' honey banked · Hive bank ' + bankedHoney;
    hud();
    updateBankLine();
    checkDailyOnEnd(score);
    if (victory) {
      $('endTitle').textContent = 'You protected the Logic Garden!';
      $('endStats').innerHTML =
        `<div><b>${score}</b><small>Score</small></div>` +
        `<div><b>${best}</b><small>Best</small></div>` +
        `<div><b>W${wave}</b><small>Wave</small></div>` +
        `<div><b>${bossesKilled}</b><small>Queens</small></div>`;
      $('againBtn').textContent = 'Play Again';
    } else {
      const stars = score > 3000 ? '★★★' : score > 1200 ? '★★☆' : score > 400 ? '★☆☆' : '☆☆☆';
      $('endTitle').textContent = 'Hive Wins!';
      $('endStats').innerHTML =
        `<div><b>${score}</b><small>Score</small></div>` +
        `<div><b>W${wave}</b><small>Wave</small></div>` +
        `<div><b>${honey}</b><small>Honey</small></div>` +
        `<div><b>${stars}</b><small>Rating</small></div>`;
      $('againBtn').textContent = 'Try Again';
    }
    showMedals(buildMedals(victory));
    $('endScreen').classList.remove('hidden');
    sys?.addScore?.(score);
    sys?.saveState?.();
  }

  function makeRunCard() {
    const cw = 540, ch = 620;
    const c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, ch);
    grd.addColorStop(0, '#1b0b3a'); grd.addColorStop(0.55, '#2e1065'); grd.addColorStop(1, '#0d0620');
    g.fillStyle = grd; g.fillRect(0, 0, cw, ch);
    g.strokeStyle = 'rgba(196,132,252,.16)'; g.lineWidth = 1.5;
    const hr = 22, hw = Math.sqrt(3) * hr, vh = 1.5 * hr;
    for (let row = 0, cy = 10; cy < ch + hr; cy += vh, row++) {
      const off = row % 2 ? hw / 2 : 0;
      for (let cx = off; cx < cw + hw; cx += hw) {
        g.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = Math.PI / 3 * i - Math.PI / 6;
          const px = cx + hr * Math.cos(a), py = cy + hr * Math.sin(a);
          if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.closePath(); g.stroke();
      }
    }
    g.strokeStyle = '#7c3aed'; g.lineWidth = 3; g.strokeRect(18, 18, cw - 36, ch - 36);
    g.textAlign = 'center';
    g.fillStyle = '#e879f9'; g.font = '900 34px system-ui';
    g.fillText("LUMO'S", cw / 2, 78);
    g.fillText('HIVE STRIKE', cw / 2, 116);
    g.fillStyle = '#fbbf24'; g.font = '800 16px system-ui';
    g.fillText('RUN CARD', cw / 2, 150);
    g.fillStyle = '#f8fafc'; g.font = '900 58px system-ui';
    g.fillText(String(score), cw / 2, 232);
    g.fillStyle = '#c4b5fd'; g.font = '700 14px system-ui';
    g.fillText('SCORE', cw / 2, 258);
    g.fillStyle = '#e2e8f0'; g.font = '600 18px system-ui';
    g.fillText('Wave ' + wave + ' · ' + bossesKilled + ' queen' + (bossesKilled === 1 ? '' : 's') + ' · ' + honey + ' honey', cw / 2, 312);
    g.fillText((MODE_LABEL[mode] || mode) + ' · ' + lives + ' shield' + (lives === 1 ? '' : 's'), cw / 2, 340);
    const boonText = Object.keys(boons).filter(id => boons[id] > 0).map(id => {
      const def = BOONS.find(b => b.id === id);
      return (def ? def.name : id) + ' x' + boons[id];
    }).join(', ');
    g.fillStyle = '#fbbf24'; g.font = '600 14px system-ui';
    g.fillText('Boons: ' + (boonText || 'none'), cw / 2, 384, cw - 80);
    g.fillStyle = '#7dd3fc'; g.font = '600 14px system-ui';
    g.fillText('Turrets: ' + turrets.length + ' · Honey banked: ' + bankedHoney, cw / 2, 410, cw - 80);
    g.fillStyle = '#94a3b8'; g.font = '600 13px system-ui';
    g.fillText('JVDesignStudio · ' + new Date().toLocaleDateString(), cw / 2, ch - 40);
    return c;
  }

  function downloadRunCard() {
    try {
      const c = makeRunCard();
      const a = document.createElement('a');
      a.href = c.toDataURL('image/png');
      a.download = 'lumo-hive-run-' + score + '.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (e) { }
  }

  function buildMedals(victory) {
    const medals = [];
    if (victory) medals.push('Logic Garden Saved');
    if (victory && !tookHit) medals.push('Untouchable');
    if (bestCombo >= 5) medals.push('Chain x' + bestCombo);
    if (perfectWaves >= 3) medals.push(perfectWaves + ' Perfect Waves');
    if (bossesKilled >= 2) medals.push('Double Queen');
    else if (bossesKilled === 1) medals.push('Queen Slayer');
    if (!medals.length) medals.push('Keep going');
    return medals;
  }

  function showMedals(medals) {
    let el = $('endMedals');
    if (!el) {
      el = document.createElement('div');
      el.id = 'endMedals';
      el.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center;max-width:320px;';
      const stats = $('endStats');
      if (stats && stats.parentNode) stats.parentNode.insertBefore(el, stats.nextSibling);
    }
    el.innerHTML = medals.map(m =>
      '<span style="background:rgba(192,132,252,.18);border:1px solid rgba(192,132,252,.5);color:#e9d5ff;border-radius:999px;padding:4px 10px;font-size:11px;font-weight:700">' + m + '</span>'
    ).join('');
  }

  function hud() {
    $('scoreHud').textContent = score;
    $('waveHud').textContent = wave;
    $('comboHud').textContent = 'x' + combo;
    $('livesHud').textContent = '🛡️'.repeat(Math.max(0, lives)) || '💀';
    const honeyEl = $('honeyHud'); if (honeyEl) honeyEl.textContent = honey;
    $('bestHud').textContent = best;
  }

  function pauseGame() {
    paused = true;
    music.stop();
    for (const k in keys) keys[k] = false;
    leftHeld.v = false;
    rightHeld.v = false;
  }

  function resumeGame() {
    paused = false;
    if (gameState === 'playing' || gameState === 'waveclear') music.start();
  }

  // ── INPUT ──────────────────────────────────────────────────────────────────
  const keys = {};
  addEventListener('keydown', e => {
    if (paused) return;
    keys[e.code] = true;
    if (e.code === 'Space') { e.preventDefault(); tryShoot(); }
    if ((e.code === 'Enter' || e.code === 'Space') && gameState === 'idle') startGame();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });

  // Touch: drag to slide Lumo left/right; tap = shoot
  let pointerX = null;
  C.addEventListener('pointerdown', e => {
    pointerX = e.clientX;
    tryShoot();
  });
  C.addEventListener('pointermove', e => {
    if (e.buttons && pointerX !== null) {
      const canvasW = C.getBoundingClientRect().width;
      const dx = (e.clientX - pointerX) / canvasW * W;
      lumo.x = Math.max(LUMO_MIN_X, Math.min(LUMO_MAX_X, lumo.x + dx));
      pointerX = e.clientX;
    }
  });
  C.addEventListener('pointerup', () => { pointerX = null; });

  // On-screen buttons
  const leftHeld = { v: false }, rightHeld = { v: false };
  function bindBtn(id, obj) {
    const el = $(id);
    if (!el) return;
    el.addEventListener('pointerdown', e => { e.preventDefault(); obj.v = true; });
    el.addEventListener('pointerup', () => { obj.v = false; });
    el.addEventListener('pointercancel', () => { obj.v = false; });
  }
  bindBtn('ctrlLeft', leftHeld);
  bindBtn('ctrlRight', rightHeld);
  const ctrlShoot = $('ctrlShoot');
  if (ctrlShoot) ctrlShoot.addEventListener('pointerdown', e => { e.preventDefault(); tryShoot(); });

  function tryShoot() {
    if (paused || gameState !== 'playing' || shootCool > 0) return;
    if (focus >= 100) { fireLogicBeam(); return; }
    const rateBase = rapidT > 0 ? 0.11 : 0.26;
    shootCool = Math.max(0.055, rateBase - boonLv('rapid') * 0.03);
    lumo.flash = 0.18;
    const vy = -530;
    const dmg = bulletDamage();
    const pierce = boonLv('pierce') + (hasEvo('storm') ? 1 : 0);
    const shots = multiT > 0 ? 3 : shotsPerVolley();
    for (let i = 0; i < shots; i++) {
      const off = i === 0 ? 0 : (i % 2 ? -1 : 1) * Math.ceil(i / 2) * 10;
      bullets.push({
        x: lumo.x + off, y: lumo.y - 30 - Math.abs(off) * 0.2, vy,
        owner: 'player', c: off ? '#c084fc' : '#e879f9', dmg, pierce, hitUids: {}
      });
    }
    sfx('playTap');
  }

  function fireLogicBeam() {
    focus = 0;
    beamT = 0.4;
    beamX = lumo.x;
    shootCool = 0.5;
    lumo.flash = 0.3;
    hitStopT = 0.05;
    shakeUntil = performance.now() + 220;
    sfx('playLevelUp');
    if (hasEvo('beam')) lives = Math.min(maxShields(), lives + 1);
    for (let i = bullets.length - 1; i >= 0; i--) {
      if (bullets[i].owner === 'enemy') bullets.splice(i, 1);
    }
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (e.state === 'enter' && e.enterDelay > 0) continue;
      if (Math.abs(e.x - beamX) > 30) continue;
      if (damageEnemy(e, 3)) enemies.splice(j, 1);
    }
    if (boss && Math.abs(boss.x - beamX) < 55) {
      boss.hp -= 6;
      boss.invT = 0.15;
      addScore(180);
      spawnFloater(boss.x, boss.y, '+180');
      if (boss.hp <= 0) finishBoss();
    }
    hud();
  }

  // ── DIVE AI ────────────────────────────────────────────────────────────────
  function makeDivePath(e) {
    const p0 = { x: e.fx + formX, y: e.fy };
    const p1 = { x: p0.x + (rand() - 0.5) * 130, y: p0.y + 110 };
    const p2 = { x: lumo.x + (rand() - 0.5) * 90, y: H - 90 };
    const p3 = { x: lumo.x + (rand() - 0.5) * 25, y: H + 60 };
    return { p0, p1, p2, p3, t: 0, spd: 0.42 + wave * 0.018 + rand() * 0.18 };
  }

  function bezier(path, t) {
    const { p0, p1, p2, p3 } = path;
    const mt = 1 - t;
    return {
      x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
      y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y
    };
  }

  function triggerDive() {
    const pool = enemies.filter(e => e.state === 'form' && e.warnT <= 0);
    if (!pool.length) return;
    const lower = pool.filter(e => e.row >= 2);
    const e = (lower.length ? lower : pool)[Math.floor(rand() * (lower.length || pool.length))];
    e.warnT = 0.38;
  }

  // ── PARTICLES ──────────────────────────────────────────────────────────────
  function burst(px, py, c1, c2, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 55 + Math.random() * 130;
      particles.push({ x: px, y: py, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, a: 1, c: Math.random() < 0.5 ? c1 : c2, r: 2 + Math.random() * 3 });
    }
  }

  function hexBurst(px, py, c, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 150;
      particles.push({
        x: px, y: py, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        a: 1, decay: 2.5, c, r: 2.5 + Math.random() * 2.5,
        shape: 'hex', rot: Math.random() * Math.PI
      });
    }
  }

  function spawnFloater(px, py, text, color) {
    floaters.push({ x: px, y: py, text, a: 1, vy: -55, color: color || '#fef08a' });
  }

  // ── UPDATE ──────────────────────────────────────────────────────────────────
  let last = performance.now();

  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (paused) { requestAnimationFrame(loop); return; }
    if (hitStopT > 0) {
      hitStopT -= dt;
      draw();
      requestAnimationFrame(loop);
      return;
    }
    if (gameState === 'idle') updateIdle(dt);
    else if (gameState === 'playing' || gameState === 'waveclear') update(dt);
    else if (gameState === 'forge') { /* frozen while the forge is open */ }
    draw();
    requestAnimationFrame(loop);
  }

  function updateIdle(dt) {
    if (REDUCED_MOTION) return;
    idleFormX += idleFormVx * dt;
    if (idleFormX > 20 || idleFormX < -20) {
      idleFormX = Math.max(-20, Math.min(20, idleFormX));
      idleFormVx *= -1;
    }
  }

  function update(dt) {
    // Player movement
    const spd = 220;
    if (keys['ArrowLeft'] || keys['KeyA'] || leftHeld.v) lumo.x -= spd * dt;
    if (keys['ArrowRight'] || keys['KeyD'] || rightHeld.v) lumo.x += spd * dt;
    lumo.x = Math.max(LUMO_MIN_X, Math.min(LUMO_MAX_X, lumo.x));

    shootCool -= dt;
    if (lumo.invT > 0) lumo.invT -= dt;
    if (lumo.flash > 0) lumo.flash -= dt;
    if (beamT > 0) beamT = Math.max(0, beamT - dt);
    if (rapidT > 0) rapidT -= dt;
    if (multiT > 0) multiT -= dt;
    if (goldFlash > 0) goldFlash = Math.max(0, goldFlash - dt * 1.6);
    if (coachT > 0) {
      coachT -= dt;
      const before = coachStep;
      coachStep = Math.min(2, Math.floor((13 - Math.max(0, coachT)) / 4.1));
      if (coachStep !== before) announce('Coach: ' + COACH_LINES[coachStep]);
      if (coachT <= 0) finishCoach();
    }

    // Honey turrets auto-fire at the nearest bee
    for (const t of turrets) {
      t.cool -= dt;
      if (t.cool > 0) continue;
      const target = nearestEnemyTo(t.x, t.y);
      if (!target) { t.cool = 0.2; continue; }
      const ang = Math.atan2(target.y - t.y, target.x - t.x);
      const speed = 560;
      bullets.push({
        x: t.x, y: t.y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
        owner: 'player', dmg: turretDamage(), pierce: 0, hitUids: {}, c: '#fbbf24', turret: true
      });
      turretShots++;
      t.cool = turretRate(t);
    }
    // Combo decay
    if (combo > 1) {
      comboTimer -= dt;
      if (comboTimer <= 0) { combo = 1; hud(); }
    }

    // Final wave fanfare holds the wave before play resumes
    if (finalWaveT > 0) {
      finalWaveT -= dt;
      if (finalWaveT <= 0) { finalWaveT = 0; gameState = 'playing'; }
      return;
    }

    // Wave clear countdown, then the Garden Forge opens
    if (gameState === 'waveclear') {
      waveClearT -= dt;
      if (waveClearT <= 0) openForge(() => nextWave());
      return;
    }

    // ── Formation drift ────────────────────────────────────────────────────
    const allInPlace = !enemies.some(e => e.state === 'enter');
    if (allInPlace) {
      formX += formVx * dt;
      const maxDrift = W - (FX0 + COLS * FDX + 20) - FX0;
      if (formX > maxDrift || formX < 0) { formVx *= -1; formX = Math.max(0, Math.min(maxDrift, formX)); }

      diveTimer += dt;
      if (diveTimer >= nextDive) {
        diveTimer = 0;
        nextDive = (1.6 + rand() * 2.0) * waveDiveRate;
        triggerDive();
        if (waveDoubleDive && rand() < 0.6) triggerDive();
        else if (wave >= 3 && rand() < 0.35) triggerDive();
      }
    }

    // ── Enemy updates ───────────────────────────────────────────────────────
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];

      if (e.state === 'enter') {
        e.enterDelay -= dt;
        if (e.enterDelay <= 0) {
          const tx = e.fx, ty = e.fy; // formX=0 during entry
          const dist = Math.hypot(tx - e.x, ty - e.y);
          if (dist < 3) { e.x = tx; e.y = ty; e.state = 'form'; }
          else {
            const move = Math.min(240 * dt, dist);
            e.x += (tx - e.x) / dist * move;
            e.y += (ty - e.y) / dist * move;
          }
        }
      } else if (e.state === 'form') {
        e.x = e.fx + formX;
        e.y = e.fy;
        if (e.warnT > 0) {
          e.warnT -= dt;
          if (e.warnT <= 0) {
            e.warnT = 0;
            e.state = 'dive';
            e.divePath = makeDivePath(e);
            e.shootCool = 0.3 + Math.random() * 0.4;
          }
        }
      } else if (e.state === 'dive') {
        const p = e.divePath;
        p.t += p.spd * dt * slowFactor();
        const pos = bezier(p, Math.min(1, p.t));
        e.angle = Math.atan2(pos.y - e.y, pos.x - e.x);
        e.x = pos.x; e.y = pos.y;

        // Shoot during dive
        e.shootCool -= dt;
        if (e.shootCool <= 0 && e.y < H - 50) {
          bullets.push({ x: e.x, y: e.y + 10, vy: 250 + wave * 12, owner: 'enemy', c: '#fbbf24' });
          e.shootCool = 0.55;
        }

        if (p.t >= 1) {
          // Return to formation from top
          e.state = 'return';
          e.x = e.fx + formX; e.y = e.fy - 100;
        }
      } else if (e.state === 'return') {
        const tx = e.fx + formX, ty = e.fy;
        const dist = Math.hypot(tx - e.x, ty - e.y);
        if (dist < 4) { e.x = tx; e.y = ty; e.state = 'form'; }
        else { const m = Math.min(260 * dt, dist); e.x += (tx - e.x) / dist * m; e.y += (ty - e.y) / dist * m; }
      }
    }

    // ── Boss update: a three-phase queen ────────────────────────────────────
    if (boss) {
      if (boss.invT > 0) boss.invT -= dt;
      if (boss.phaseFlash > 0) boss.phaseFlash -= dt;
      const pct = boss.hp / boss.maxHp;
      if (pct <= 0.66 && boss.phase < 2) { boss.phase = 2; phaseShift(2); }
      if (pct <= 0.33 && boss.phase < 3) { boss.phase = 3; phaseShift(3); }
      boss.x += boss.vx * dt * (1 + (boss.phase - 1) * 0.3);
      if (boss.x < 45 || boss.x > W - 45) boss.vx *= -1;

      boss.shootCool -= dt * slowFactor();
      if (boss.shootCool <= 0) {
        if (boss.phase === 1) {
          boss.shootCool = 0.85;
          bullets.push({ x: boss.x, y: boss.y + 38, vy: 270 + wave * 10, owner: 'enemy', c: '#f97316' });
          bullets.push({ x: boss.x - 20, y: boss.y + 34, vx: -70, vy: 250 + wave * 10, owner: 'enemy', c: '#f97316' });
          bullets.push({ x: boss.x + 20, y: boss.y + 34, vx: 70, vy: 250 + wave * 10, owner: 'enemy', c: '#f97316' });
        } else if (boss.phase === 2) {
          boss.shootCool = 0.6;
          for (let k = -2; k <= 2; k++) bullets.push({ x: boss.x + k * 16, y: boss.y + 34, vx: k * 34, vy: 255 + wave * 10, owner: 'enemy', c: '#fb7185' });
          if (enemies.length < 10 && rand() < 0.5) {
            enemies.push({
              row: 4, col: 0, type: 'drone', hp: 1, maxHp: 1, x: boss.x - 30, y: boss.y,
              fx: boss.x - 30, fy: boss.y, uid: 900 + bossesKilled * 10 + enemies.length,
              state: 'dive', enterDelay: 0,
              divePath: { p0: { x: boss.x - 30, y: boss.y }, p1: { x: boss.x - 60, y: H * 0.3 }, p2: { x: lumo.x, y: H - 70 }, p3: { x: lumo.x, y: H + 60 }, t: 0, spd: 0.45 },
              angle: 0, shootCool: 0.4, warnT: 0, link: null, anchor: false
            });
          }
        } else {
          boss.shootCool = 0.42;
          const baseAng = Math.atan2(lumo.y - boss.y, lumo.x - boss.x);
          for (let k = -3; k <= 3; k++) {
            const a = baseAng + k * 0.18;
            bullets.push({ x: boss.x, y: boss.y + 30, vx: Math.cos(a) * 285, vy: Math.sin(a) * 285, owner: 'enemy', c: '#f43f5e' });
          }
        }
      }

      if (lumo.invT <= 0 && Math.hypot(boss.x - lumo.x, boss.y - lumo.y) < 38) hitPlayer();
    }

    // ── Bullet updates ──────────────────────────────────────────────────────
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (b.owner === 'player' && boonLv('homing') > 0) {
        const target = nearestEnemyTo(b.x, b.y);
        if (target) {
          const cur = Math.atan2(b.vy, b.vx || 0);
          const want = Math.atan2(target.y - b.y, target.x - b.x);
          const diff = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
          const turn = Math.min(Math.abs(diff), 0.09 * boonLv('homing') * dt);
          const a2 = cur + Math.sign(diff) * turn;
          const sp = Math.hypot(b.vx || 0, b.vy) || 530;
          b.vx = Math.cos(a2) * sp; b.vy = Math.sin(a2) * sp;
        }
      }
      b.x += (b.vx || 0) * dt;
      b.y += b.vy * dt * (b.owner === 'enemy' ? slowFactor() : 1);
      if (b.y < -12 || b.y > H + 12 || b.x < -20 || b.x > W + 20) { bullets.splice(i, 1); continue; }

      if (b.owner === 'player') {
        const dmg = b.dmg || 1;
        // Hit boss
        if (boss && boss.invT <= 0 && Math.hypot(b.x - boss.x, b.y - boss.y) < 34) {
          bullets.splice(i, 1);
          boss.hp -= dmg;
          boss.invT = 0.08;
          burst(boss.x, boss.y, '#f97316', '#fef08a', 6);
          sfx('playPop');
          addScore(30 * dmg);
          spawnFloater(boss.x, boss.y, '+' + (30 * dmg));
          addFocus(4);
          if (boss.hp <= 0) finishBoss();
          continue;
        }

        // Hit enemy. Linked bees share armour until their anchor falls.
        let hit = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
          const e = enemies[j];
          if (e.state === 'enter' && e.enterDelay > 0) continue;
          if (b.hitUids && b.hitUids[e.uid]) continue;
          const r = e.type === 'queen' ? 14 : e.type === 'guard' ? 12 : 10;
          if (Math.hypot(b.x - e.x, b.y - e.y) < r + 5) {
            if (b.hitUids) b.hitUids[e.uid] = 1;
            sfx('playPop');
            const dead = damageEnemy(e, dmg);
            if (dead) enemies.splice(j, 1);
            if (b.pierce > 0) b.pierce--;
            else bullets.splice(i, 1);
            hit = true;
            break;
          }
        }
        if (hit) continue;

      } else {
        // Enemy bullet hits player
        if (lumo.invT <= 0 && Math.hypot(b.x - lumo.x, b.y - lumo.y) < 16) {
          bullets.splice(i, 1);
          hitPlayer();
        }
      }
    }

    // ── Diver body vs player ────────────────────────────────────────────────
    if (lumo.invT <= 0) {
      for (const e of enemies) {
        if (e.state === 'dive' && Math.hypot(e.x - lumo.x, e.y - lumo.y) < 20) {
          hitPlayer(); break;
        }
      }
    }

    // ── Power-up collection ─────────────────────────────────────────────────
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.y += 75 * dt;
      if (p.y > H + 20) { powerups.splice(i, 1); continue; }
      if (Math.hypot(p.x - lumo.x, p.y - lumo.y) < 22) {
        applyPowerup(p.type);
        spawnFloater(p.x, p.y, { rapid: 'Rapid fire', shield: 'Shield', multi: 'Multi-shot' }[p.type] || 'Power-up');
        powerups.splice(i, 1);
      }
    }

    // ── Particles ───────────────────────────────────────────────────────────
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 70 * dt;
      if (p.shape === 'hex') p.rot += dt * 5;
      p.a -= dt * (p.decay || 1.9);
      if (p.a <= 0) particles.splice(i, 1);
    }

    // ── Floating score numbers ─────────────────────────────────────────────
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.y += f.vy * dt;
      f.a -= dt * 1.4;
      if (f.a <= 0) floaters.splice(i, 1);
    }

    // ── Wave clear check ────────────────────────────────────────────────────
    if (!won && !boss && enemies.length === 0 && gameState === 'playing') beginWaveClear();
  }

  function damageEnemy(e, dmg) {
    let amount = dmg;
    if (e.link && e.link.hp > 0) {
      if (boonLv('link') <= 0) amount = Math.max(1, Math.floor(amount / 2));
      burst(e.x, e.y, '#4cc9f0', '#fef08a', 2);
    }
    e.hp -= amount;
    burst(e.x, e.y, typeColor(e.type), '#fef08a', 4);
    if (e.hp > 0) return false;
    const wasAnchor = e.anchor;
    const gained = Math.round(typeScore(e.type) * combo);
    const prevCombo = combo;
    addScore(gained);
    spawnFloater(e.x, e.y, '+' + gained);
    bumpCombo();
    if (combo > 3 && combo > prevCombo) spawnFloater(e.x, e.y - 16, 'x' + combo, '#c084fc');
    hexBurst(e.x, e.y, typeColor(e.type), 6 + Math.floor(rand() * 3));
    addFocus(e.type === 'queen' ? 22 : e.type === 'guard' ? 14 : 8);
    addHoney(e.type === 'queen' ? 5 : e.type === 'guard' ? 2 : 1);
    if (wasAnchor) breakLinks(e);
    if (rand() < 0.15) dropPowerup(e.x, e.y);
    return true;
  }

  function addFocus(amount) {
    if (focus >= 100) return;
    focus = Math.min(100, focus + amount * focusRate());
    if (focus >= 100) sfx('playLevelUp');
  }

  function finishBoss() {
    const bx = boss.x, by = boss.y;
    burst(bx, by, '#a855f7', '#fef08a', 40);
    hexBurst(bx, by, '#a855f7', 16);
    sfx('playSuccess');
    addScore(600);
    spawnFloater(bx, by - 12, '+600');
    hitStopT = 0.09;
    bossesKilled++;
    boss = null;
    if (mode === 'bossrush') {
      bossRushKills++;
      if (bossRushKills >= 5) { winGame(); return; }
      showToast('Queen ' + bossRushKills + ' of 5 down. Forge opens.');
      beginWaveClear();
      return;
    }
    if ((mode === 'campaign' || mode === 'daily') && wave >= 10) {
      winGame();
    } else {
      showToast('Queen defeated! +600');
      beginWaveClear();
    }
  }

  function hitPlayer() {
    lives--;
    wavePerfect = false;
    tookHit = true;
    if (focus > 0) focus = Math.max(0, focus - 20);
    shakeUntil = performance.now() + 300;
    lumo.invT = 2.2;
    burst(lumo.x, lumo.y, '#c084fc', '#ffffff', 18);
    sfx('playError');
    hud();
    if (lives <= 0) { gameState = 'dead'; setTimeout(endGame, 700); }
    else showToast('Shield hit! ' + '🛡️'.repeat(lives));
  }

  function addScore(pts) { score += Math.round(pts); hud(); }

  function bumpCombo() {
    combo = Math.min(8, combo + 1);
    comboTimer = comboWindow();
    if (combo > bestCombo) bestCombo = combo;
    if (combo >= 2) sfx('playCombo', combo);
    hud();
  }

  function dropPowerup(px, py) {
    const types = ['rapid', 'shield', 'multi'];
    powerups.push({ x: px, y: py, type: types[Math.floor(rand() * 3)] });
  }

  function applyPowerup(type) {
    sfx('playSuccess');
    if (type === 'rapid') { rapidT = 7; showToast('⚡ Rapid fire!'); }
    else if (type === 'shield') { lives = Math.min(maxShields(), lives + 1); hud(); showToast('🛡️ Shield restored!'); }
    else if (type === 'multi') { multiT = 8; showToast('✨ Multi-shot!'); }
  }

  function beginWaveClear() {
    if (gameState !== 'playing') return;
    gameState = 'waveclear';
    waveClearT = 1.2;
    addScore(100 * wave);
    const perfect = wavePerfect;
    addHoney(perfect ? 4 : 1);
    if (perfect) {
      perfectWaves++;
      goldFlash = 1;
      addFocus(10);
      showToast('Perfect wave! +4 honey');
    } else {
      showToast('Wave ' + wave + ' cleared! +1 honey');
    }
    sfx('playSuccess');
  }

  function nextWave() {
    wave++;
    wavePerfect = true;
    applyWaveMods();
    bullets = bullets.filter(b => b.owner === 'player');
    powerups = [];
    boss = null;
    if (mode === 'bossrush') {
      spawnBoss();
      sfx('playLevelUp');
      showToast('👑 Queen ' + (bossRushKills + 1) + ' of 5');
      gameState = 'playing';
    } else if (wave % 5 === 0) {
      spawnBoss();
      sfx('playLevelUp');
      if ((mode === 'campaign' || mode === 'daily') && wave >= 10) {
        finalWaveT = 2.0;
        gameState = 'waveclear';
      } else {
        showToast('👑 Queen Boss!');
        gameState = 'playing';
      }
    } else {
      buildFormation();
      diveTimer = 0; nextDive = 2.2 * waveDiveRate;
      showToast('Wave ' + wave + (waveLabel ? ': ' + waveLabel : ''));
      gameState = 'playing';
    }
    hud();
    updateBankLine();
  }

  function winGame() {
    won = true;
    lumo.invT = 2.2;
    setTimeout(() => { bullets = bullets.filter(b => b.owner === 'player'); }, 0);
    showToast('You protected the Logic Garden!');
    sfx('playSuccess');
    setTimeout(() => { if (gameState !== 'dead') endGame(true); }, 1400);
  }

  // ── DRAW ────────────────────────────────────────────────────────────────────
  const STARS = Array.from({ length: 40 }, () => ({
    sx: Math.random() * W, sy: Math.random() * H,
    r: Math.random() * 1.2 + 0.4,
    baseA: 0.3 + Math.random() * 0.5,
    phase: Math.random() * Math.PI * 2,
    speed: 0.4 + Math.random() * 0.8
  }));

  function hexPath(cx, cy, r) {
    x.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 3 * i - Math.PI / 6;
      const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
      if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
    }
    x.closePath();
  }

  function draw() {
    const now = performance.now();
    let sx = 0, sy = 0;
    if (!REDUCED_MOTION && now < shakeUntil) {
      const m = 6 * ((shakeUntil - now) / 300);
      sx = (Math.random() * 2 - 1) * m;
      sy = (Math.random() * 2 - 1) * m;
    }

    x.clearRect(-12, -12, W + 24, H + 24);
    x.save();
    x.translate(sx, sy);

    // Deep space gradient
    const sky = x.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0f0c29');
    sky.addColorStop(1, '#1a1a2e');
    x.fillStyle = sky;
    x.fillRect(-12, -12, W + 24, H + 24);

    // Twinkling stars
    x.fillStyle = '#ffffff';
    for (const s of STARS) {
      const twinkle = REDUCED_MOTION ? 0 : Math.sin(now * 0.001 * s.speed + s.phase) * 0.18;
      x.globalAlpha = s.baseA + twinkle;
      x.beginPath(); x.arc(s.sx, s.sy, s.r, 0, Math.PI * 2); x.fill();
    }
    x.globalAlpha = 1;

    // Logic Garden floor
    drawGardenFloor();

    // Idle start-screen formation
    if (gameState === 'idle') {
      x.globalAlpha = 0.7;
      for (const e of idleEnemies) drawBee(e, idleFormX);
      x.globalAlpha = 1;
    }

    // Power-ups
    for (const p of powerups) {
      x.font = '18px system-ui';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText({ rapid: '⚡', shield: '🛡️', multi: '✨' }[p.type] || '?', p.x, p.y);
    }
    x.textBaseline = 'alphabetic';

    // Honey turrets sit on the garden floor
    for (const t of turrets) drawTurret(t);

    // Hive links: a cyan thread from each anchor to its linked bees
    for (const e of enemies) {
      if (!e.link || e.link.hp <= 0) continue;
      if (e.link.state === 'enter' && e.link.enterDelay > 0) continue;
      x.strokeStyle = 'rgba(76,201,240,0.45)';
      x.lineWidth = 1.5;
      x.setLineDash([4, 4]);
      x.beginPath(); x.moveTo(e.x, e.y); x.lineTo(e.link.x, e.link.y); x.stroke();
      x.setLineDash([]);
    }

    // Enemies
    for (const e of enemies) {
      if (e.state === 'enter' && e.enterDelay > 0) continue;
      drawBee(e);
    }

    // Boss
    if (boss) drawBoss();

    // Bullets
    for (const b of bullets) {
      if (b.owner === 'player') {
        const pc = b.turret ? '#fbbf24' : '#c084fc';
        x.strokeStyle = b.turret ? 'rgba(251,191,36,0.5)' : 'rgba(192,132,252,0.5)';
        x.lineWidth = 2.5;
        x.lineCap = 'round';
        x.beginPath(); x.moveTo(b.x, b.y + 10); x.lineTo(b.x, b.y); x.stroke();
        const g = x.createRadialGradient(b.x, b.y, 0, b.x, b.y, 6);
        g.addColorStop(0, '#fef9c3');
        g.addColorStop(0.45, pc);
        g.addColorStop(1, 'rgba(192,132,252,0)');
        x.fillStyle = g;
        x.beginPath(); x.arc(b.x, b.y, 6, 0, Math.PI * 2); x.fill();
      } else {
        x.beginPath(); x.arc(b.x, b.y, 5, 0, Math.PI * 2);
        x.fillStyle = b.c;
        x.shadowColor = b.c; x.shadowBlur = 8;
        x.fill(); x.shadowBlur = 0;
      }
    }

    // Particles
    for (const p of particles) {
      x.globalAlpha = Math.max(0, p.a);
      x.fillStyle = p.c;
      if (p.shape === 'hex') {
        x.save();
        x.translate(p.x, p.y);
        x.rotate(p.rot || 0);
        hexPath(0, 0, p.r);
        x.fill();
        x.restore();
      } else {
        x.beginPath(); x.arc(p.x, p.y, p.r, 0, Math.PI * 2); x.fill();
      }
    }
    x.globalAlpha = 1;

    // Floating score numbers
    x.font = 'bold 14px system-ui';
    x.textAlign = 'center';
    for (const f of floaters) {
      x.globalAlpha = Math.max(0, f.a);
      x.fillStyle = f.color;
      x.fillText(f.text, f.x, f.y);
    }
    x.globalAlpha = 1;

    // Logic Beam
    if (beamT > 0) {
      const a = Math.min(1, beamT * 3);
      const bw = 30 + (0.4 - beamT) * 60;
      const bg = x.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, 'rgba(232,121,249,0)');
      bg.addColorStop(0.15, 'rgba(192,132,252,' + (0.55 * a).toFixed(3) + ')');
      bg.addColorStop(0.85, 'rgba(192,132,252,' + (0.55 * a).toFixed(3) + ')');
      bg.addColorStop(1, 'rgba(232,121,249,0)');
      x.fillStyle = bg;
      x.fillRect(beamX - bw / 2, 0, bw, H);
      x.fillStyle = 'rgba(255,255,255,' + (0.7 * a).toFixed(3) + ')';
      x.fillRect(beamX - 3, 0, 6, H);
    }

    // Lumo (blink when invincible)
    if (gameState !== 'dead' && (lumo.invT <= 0 || Math.floor(lumo.invT * 8) % 2 === 0)) {
      drawLumo();
    }

    // Logic charge meter
    if ((gameState === 'playing' || gameState === 'waveclear') && focus > 0) {
      const fw = 58, fh = 5;
      const cx = Math.max(fw / 2 + 2, Math.min(W - fw / 2 - 2, lumo.x));
      const fx0 = cx - fw / 2, fy0 = lumo.y - 44;
      x.fillStyle = 'rgba(0,0,0,.5)';
      x.fillRect(fx0 - 1, fy0 - 1, fw + 2, fh + 2);
      x.fillStyle = focus >= 100 ? '#fef08a' : '#c084fc';
      x.fillRect(fx0, fy0, fw * (focus / 100), fh);
      if (focus >= 100) {
        x.font = 'bold 10px system-ui';
        x.textAlign = 'center';
        x.fillStyle = '#fef08a';
        x.fillText('LOGIC READY', cx, fy0 - 5);
      }
    }

    // Perfect wave gold flash
    if (goldFlash > 0) {
      const gf = x.createLinearGradient(0, 0, 0, 110);
      gf.addColorStop(0, 'rgba(250,204,21,' + (0.55 * goldFlash).toFixed(3) + ')');
      gf.addColorStop(1, 'rgba(250,204,21,0)');
      x.fillStyle = gf;
      x.fillRect(0, 0, W, 110);
    }

    // Wave-clear flash
    if (gameState === 'waveclear' && finalWaveT <= 0) {
      x.fillStyle = 'rgba(124,58,237,0.12)';
      x.fillRect(0, 0, W, H);
      x.fillStyle = '#e879f9';
      x.font = 'bold 26px system-ui';
      x.textAlign = 'center';
      x.fillText('Wave Cleared! ✨', W / 2, H / 2 - 12);
      x.font = '17px system-ui';
      x.fillStyle = '#c084fc';
      x.fillText('Score: ' + score, W / 2, H / 2 + 18);
    }

    // Final wave fanfare
    if (finalWaveT > 0) {
      let fa = 1;
      if (finalWaveT > 1.7) fa = (2.0 - finalWaveT) / 0.3;
      else if (finalWaveT < 0.5) fa = finalWaveT / 0.5;
      fa = Math.max(0, Math.min(1, fa));
      x.fillStyle = 'rgba(6,4,18,' + (0.78 * fa).toFixed(3) + ')';
      x.fillRect(0, 0, W, H);
      x.globalAlpha = fa;
      x.textAlign = 'center';
      x.fillStyle = '#fef08a';
      x.font = 'bold 38px system-ui';
      x.fillText('FINAL WAVE', W / 2, H / 2 - 10);
      x.fillStyle = '#e879f9';
      x.font = '18px system-ui';
      x.fillText('Defeat the Queen', W / 2, H / 2 + 28);
      x.globalAlpha = 1;
    }

    // Power-up status strip
    if (rapidT > 0 || multiT > 0) {
      x.font = '12px system-ui';
      x.textAlign = 'left';
      x.fillStyle = '#e879f9';
      let px2 = 8;
      if (rapidT > 0) { x.fillText('⚡ ' + rapidT.toFixed(1) + 's', px2, H - 8); px2 += 65; }
      if (multiT > 0) { x.fillText('✨ ' + multiT.toFixed(1) + 's', px2, H - 8); }
    }

    if (coachT > 0 && gameState === 'playing') drawCoach();

    x.restore();
  }

  function drawCoach() {
    const msg = COACH_LINES[Math.min(2, coachStep)];
    const boxW = W - 40;
    const y = H * 0.56;
    x.fillStyle = 'rgba(6,4,18,.84)';
    x.strokeStyle = 'rgba(192,132,252,.5)';
    x.lineWidth = 1.5;
    x.beginPath(); x.rect(W / 2 - boxW / 2, y - 26, boxW, 48); x.fill(); x.stroke();
    x.textAlign = 'center';
    x.fillStyle = '#fef08a';
    x.font = 'bold 11px system-ui';
    x.fillText('LUMO SAYS', W / 2, y - 9);
    x.fillStyle = '#e2e8f0';
    x.font = '12px system-ui';
    x.fillText(msg, W / 2, y + 11);
  }

  function drawGardenFloor() {
    const top = H * 0.75;
    const r = 20, hw = Math.sqrt(3) * r, vh = 1.5 * r;
    x.strokeStyle = 'rgba(124,58,237,0.12)';
    x.lineWidth = 0.8;
    let row = 0;
    for (let cy = top; cy < H + r; cy += vh, row++) {
      const off = (row % 2) ? hw / 2 : 0;
      for (let cx = off; cx < W + hw; cx += hw) {
        hexPath(cx, cy, r);
        x.stroke();
      }
    }
  }

  function drawTurret(t) {
    x.save();
    x.translate(t.x, t.y);
    x.fillStyle = 'rgba(74,45,8,.9)';
    x.beginPath(); x.ellipse(0, 7, 17, 6, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#c98a2e';
    x.strokeStyle = '#fde68a';
    x.lineWidth = 1.5;
    hexPath(0, 0, 10);
    x.fill(); x.stroke();
    x.fillStyle = '#fbbf24';
    x.fillRect(-2, -14 - t.level * 2, 4, 12 + t.level * 2);
    for (let i = 0; i < t.level; i++) {
      x.fillStyle = '#fef9c3';
      x.beginPath(); x.arc(-6 + i * 6, 12, 1.8, 0, Math.PI * 2); x.fill();
    }
    x.restore();
  }

  function drawBee(e, offsetX) {
    x.save();
    x.translate(e.x + (offsetX || 0), e.y);
    if (e.state === 'dive') x.rotate(e.angle + Math.PI / 2);

    const r = e.type === 'queen' ? 14 : e.type === 'guard' ? 12 : 9;
    const c = typeColor(e.type);
    const t = performance.now() * 0.003;
    const flap = Math.sin(t * 9 + e.col * 0.7) * 0.25;

    // Wings behind the body
    const wingA = e.type === 'queen' ? 0.2 : 0.32;
    x.fillStyle = 'rgba(255,255,255,' + wingA + ')';
    x.beginPath(); x.ellipse(-r * 0.85, -r * 0.1, r * 0.75 + flap * r * 0.4, r * 0.38, -0.5, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(r * 0.85, -r * 0.1, r * 0.75 + flap * r * 0.4, r * 0.38, 0.5, 0, Math.PI * 2); x.fill();

    // Antennae (drones)
    if (e.type === 'drone') {
      x.strokeStyle = '#fde68a';
      x.lineWidth = 1.4;
      x.lineCap = 'round';
      x.beginPath(); x.moveTo(-r * 0.35, -r * 0.8); x.quadraticCurveTo(-r * 0.7, -r * 1.5, -r * 0.4, -r * 1.7); x.stroke();
      x.beginPath(); x.moveTo(r * 0.35, -r * 0.8); x.quadraticCurveTo(r * 0.7, -r * 1.5, r * 0.4, -r * 1.7); x.stroke();
    }

    // Hex body
    if (e.type === 'queen') { x.shadowColor = c; x.shadowBlur = 14; }
    x.fillStyle = c;
    hexPath(0, 0, r);
    x.fill();
    x.shadowBlur = 0;

    // Glowing outline for the queen
    if (e.type === 'queen') {
      x.strokeStyle = 'rgba(216,180,254,0.9)';
      x.lineWidth = 1.5;
      hexPath(0, 0, r);
      x.stroke();
    }

    // Stripes
    x.strokeStyle = 'rgba(0,0,0,0.25)';
    x.lineWidth = 2;
    x.beginPath(); x.moveTo(-r * 0.62, -r * 0.22); x.lineTo(r * 0.62, -r * 0.22); x.stroke();
    x.beginPath(); x.moveTo(-r * 0.62, r * 0.22); x.lineTo(r * 0.62, r * 0.22); x.stroke();

    // Eyes
    x.fillStyle = '#1e0a2e';
    x.beginPath(); x.arc(-r * 0.3, -r * 0.45, r * 0.13, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(r * 0.3, -r * 0.45, r * 0.13, 0, Math.PI * 2); x.fill();

    // Guard stinger
    if (e.type === 'guard') {
      x.fillStyle = '#7c2d12';
      x.beginPath(); x.moveTo(-r * 0.18, r * 0.9); x.lineTo(0, r * 1.5); x.lineTo(r * 0.18, r * 0.9); x.closePath(); x.fill();
    }

    // Queen crown (3 triangles)
    if (e.type === 'queen') {
      x.fillStyle = '#fef08a';
      for (const ox of [-r * 0.55, 0, r * 0.55]) {
        x.beginPath(); x.moveTo(ox - 4, -r * 0.9); x.lineTo(ox, -r * 1.5); x.lineTo(ox + 4, -r * 0.9); x.closePath(); x.fill();
      }
      x.fillRect(-r * 0.75, -r * 0.98, r * 1.5, 2.5);
    }

    // HP pips (guards/queens with >1 hp)
    if (e.maxHp > 1) {
      for (let i = 0; i < e.maxHp; i++) {
        x.fillStyle = i < e.hp ? '#ffffff' : 'rgba(255,255,255,0.18)';
        x.beginPath(); x.arc(-3 + i * 5, r + 4, 2, 0, Math.PI * 2); x.fill();
      }
    }

    // Hive link marker: anchors pulse cyan, linked bees wear a thin ring
    if (e.anchor) {
      const pulse = 0.55 + Math.sin(performance.now() * 0.008) * 0.35;
      x.strokeStyle = 'rgba(76,201,240,' + pulse.toFixed(3) + ')';
      x.lineWidth = 2.5;
      x.beginPath(); x.arc(0, 0, r + 9, 0, Math.PI * 2); x.stroke();
      x.fillStyle = '#4cc9f0';
      x.beginPath(); x.arc(0, -r - 8, 2.5, 0, Math.PI * 2); x.fill();
    } else if (e.link && e.link.hp > 0) {
      x.strokeStyle = 'rgba(76,201,240,0.55)';
      x.lineWidth = 1.2;
      x.beginPath(); x.arc(0, 0, r + 4, 0, Math.PI * 2); x.stroke();
    }

    // Dive telegraph
    if (e.warnT > 0) {
      const pulse = 0.55 + Math.sin(performance.now() * 0.03) * 0.35;
      x.strokeStyle = 'rgba(254,240,138,' + pulse.toFixed(3) + ')';
      x.lineWidth = 2;
      x.beginPath(); x.arc(0, 0, r + 6, 0, Math.PI * 2); x.stroke();
      x.fillStyle = 'rgba(254,240,138,' + pulse.toFixed(3) + ')';
      x.beginPath(); x.moveTo(0, r + 6); x.lineTo(-4, r + 11); x.lineTo(4, r + 11); x.closePath(); x.fill();
    }

    x.restore();
  }

  function drawBoss() {
    const b = boss;
    x.save(); x.translate(b.x, b.y);

    const pulse = 0.7 + Math.sin(performance.now() * 0.004) * 0.3;

    // Wings
    x.fillStyle = 'rgba(196,132,252,0.35)';
    x.beginPath(); x.ellipse(-36, -6, 28, 16, -0.4, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(36, -6, 28, 16, 0.4, 0, Math.PI * 2); x.fill();

    // Body glow
    x.shadowColor = '#a855f7';
    x.shadowBlur = 22 * pulse;
    x.fillStyle = b.invT > 0 ? '#ffffff' : '#7c3aed';
    hexPath(0, 0, 34);
    x.fill();
    x.shadowBlur = 0;

    // Glowing outline
    x.strokeStyle = 'rgba(216,180,254,0.9)';
    x.lineWidth = 2.5;
    hexPath(0, 0, 34);
    x.stroke();

    // Stripes
    x.strokeStyle = 'rgba(0,0,0,0.25)';
    x.lineWidth = 3;
    x.beginPath(); x.moveTo(-26, -8); x.lineTo(26, -8); x.stroke();
    x.beginPath(); x.moveTo(-26, 8); x.lineTo(26, 8); x.stroke();

    // Eyes
    x.fillStyle = '#fef08a';
    x.beginPath(); x.arc(-11, -8, 5, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(11, -8, 5, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#1e0a2e';
    x.beginPath(); x.arc(-11, -8, 2, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(11, -8, 2, 0, Math.PI * 2); x.fill();

    // Crown (3 triangles)
    x.fillStyle = '#fef08a';
    for (const ox of [-18, 0, 18]) {
      x.beginPath(); x.moveTo(ox - 7, -32); x.lineTo(ox, -46); x.lineTo(ox + 7, -32); x.closePath(); x.fill();
    }
    x.fillRect(-26, -34, 52, 4);

    x.restore();

    // HP bar
    const bw = 110, bh = 7;
    const bx = b.x - bw / 2, by2 = b.y + 46;
    x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(bx - 1, by2 - 1, bw + 2, bh + 2);
    const hpPct = b.hp / b.maxHp;
    const barCol = hpPct > 0.33 ? '#a855f7' : '#ef4444';
    x.fillStyle = barCol; x.fillRect(bx, by2, bw * hpPct, bh);
    x.font = '10px system-ui'; x.textAlign = 'center'; x.fillStyle = '#fef08a';
    x.fillText('QUEEN  ' + b.hp + '/' + b.maxHp + '  ·  PHASE ' + (b.phase || 1), b.x, by2 + bh + 10);
    if (b.phaseFlash > 0) {
      x.globalAlpha = Math.min(1, b.phaseFlash * 2);
      x.strokeStyle = '#fbbf24';
      x.lineWidth = 3;
      x.beginPath(); x.arc(b.x, b.y, 52 + (0.6 - b.phaseFlash) * 60, 0, Math.PI * 2); x.stroke();
      x.globalAlpha = 1;
    }
  }

  function drawLumo() {
    const t = performance.now() * 0.001;
    const shot = lumo.flash > 0 ? 1 : 0;
    const ready = focus >= 100 ? 1 : 0;

    const FUR = '#a274b9';
    const FUR_DARK = '#5a3d58';
    const FUR_LIGHT = '#e7d0e9';
    const LINE = '#3a2745';
    const CLOAK = '#2a2430';
    const CLOAK_LIGHT = '#423a42';
    const PAW = '#4a2c38';
    const EYE = '#5b3a78';
    const PUPIL = '#231027';
    const NOSE = '#251427';

    x.save();
    x.translate(lumo.x, lumo.y);

    // Soft aura when charged or firing
    if (shot || ready) {
      x.fillStyle = ready ? 'rgba(254,240,138,.10)' : 'rgba(192,132,252,.10)';
      x.beginPath(); x.ellipse(0, -4, 29, 35, 0, 0, Math.PI * 2); x.fill();
    }

    // Bushy purple tail with cream tip, behind everything
    x.fillStyle = FUR;
    x.strokeStyle = LINE;
    x.lineWidth = 1.5;
    x.beginPath();
    x.moveTo(7, 8);
    x.bezierCurveTo(22, 18, 35, 6, 31, -10);
    x.bezierCurveTo(29, -21, 19, -25, 16, -15);
    x.bezierCurveTo(14, -7, 12, 2, 7, 8);
    x.closePath();
    x.fill(); x.stroke();
    x.fillStyle = FUR_LIGHT;
    x.beginPath();
    x.moveTo(16, -14);
    x.bezierCurveTo(18, -26, 30, -26, 33, -14);
    x.bezierCurveTo(35, -6, 30, -1, 25, -3);
    x.bezierCurveTo(21, -5, 18, -9, 16, -14);
    x.closePath();
    x.fill();
    x.beginPath(); x.moveTo(22, -23); x.lineTo(24, -30); x.lineTo(27, -23); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(28, -21); x.lineTo(32, -27); x.lineTo(33, -19); x.closePath(); x.fill();

    // Cloak, hood and shoulders
    x.fillStyle = CLOAK;
    x.strokeStyle = LINE;
    x.lineWidth = 1.5;
    x.beginPath();
    x.moveTo(-15, -2);
    x.quadraticCurveTo(-24, 12, -19, 23);
    x.lineTo(19, 23);
    x.quadraticCurveTo(24, 12, 15, -2);
    x.quadraticCurveTo(0, -10, -15, -2);
    x.closePath();
    x.fill(); x.stroke();
    x.beginPath();
    x.moveTo(-16, 2);
    x.quadraticCurveTo(-24, -14, -14, -26);
    x.quadraticCurveTo(0, -38, 14, -26);
    x.quadraticCurveTo(24, -14, 16, 2);
    x.quadraticCurveTo(0, -6, -16, 2);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(255,255,255,.08)';
    x.lineWidth = 1;
    x.beginPath(); x.moveTo(-16, 2); x.quadraticCurveTo(-24, -14, -14, -26); x.stroke();
    x.beginPath(); x.moveTo(16, 2); x.quadraticCurveTo(24, -14, 14, -26); x.stroke();

    // Feet peeking out below the cloak
    x.fillStyle = PAW;
    x.strokeStyle = LINE;
    x.lineWidth = 1;
    x.beginPath(); x.roundRect(-9, 18, 7, 6, 3); x.fill(); x.stroke();
    x.beginPath(); x.roundRect(2, 18, 7, 6, 3); x.fill(); x.stroke();

    // Big pointed ears, behind the head
    const ear = (s) => {
      x.save();
      x.scale(s, 1);
      x.fillStyle = FUR;
      x.strokeStyle = LINE;
      x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(12, -16); x.lineTo(21, -38); x.lineTo(2, -22); x.closePath();
      x.fill(); x.stroke();
      x.fillStyle = FUR_DARK;
      x.beginPath(); x.moveTo(21, -38); x.lineTo(16, -27); x.lineTo(11, -30); x.closePath(); x.fill();
      x.fillStyle = FUR_LIGHT;
      x.beginPath(); x.moveTo(16.5, -31); x.lineTo(12.5, -18.5); x.lineTo(6, -22); x.closePath(); x.fill();
      x.fillStyle = '#fff';
      x.globalAlpha = 0.55;
      x.beginPath(); x.moveTo(12, -21); x.quadraticCurveTo(14, -25, 16, -27); x.lineTo(13, -26); x.closePath(); x.fill();
      x.globalAlpha = 1;
      x.restore();
    };
    ear(-1); ear(1);

    // Body
    x.fillStyle = FUR;
    x.strokeStyle = LINE;
    x.lineWidth = 1.5;
    x.beginPath();
    x.moveTo(-11, 2);
    x.quadraticCurveTo(-14, 13, -8, 20);
    x.lineTo(8, 20);
    x.quadraticCurveTo(14, 13, 11, 2);
    x.closePath();
    x.fill(); x.stroke();

    // Cream chest
    x.fillStyle = FUR_LIGHT;
    x.beginPath(); x.ellipse(0, 12, 7.5, 8, 0, 0, Math.PI * 2); x.fill();

    // Head
    x.fillStyle = FUR;
    x.strokeStyle = LINE;
    x.lineWidth = 1.5;
    x.shadowColor = ready ? '#facc15' : '#c084fc';
    x.shadowBlur = 4 + shot * 10 + ready * 8;
    x.beginPath(); x.ellipse(0, -10, 14.5, 14, 0, 0, Math.PI * 2); x.fill();
    x.shadowBlur = 0;
    x.stroke();

    // Forehead tuft
    x.fillStyle = FUR;
    x.beginPath(); x.moveTo(-3.5, -22); x.lineTo(0, -27); x.lineTo(3.5, -22); x.closePath(); x.fill();

    // Cheek fur tufts
    x.fillStyle = FUR;
    x.beginPath(); x.moveTo(-13, -6); x.lineTo(-19, -2); x.lineTo(-13, 0); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(13, -6); x.lineTo(19, -2); x.lineTo(13, 0); x.closePath(); x.fill();

    // Cream muzzle and cheeks
    x.fillStyle = FUR_LIGHT;
    x.beginPath(); x.ellipse(0, -2, 10.5, 7.5, 0, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(-7, -3, 5, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(7, -3, 5, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.moveTo(-2.4, -8); x.lineTo(2.4, -8); x.lineTo(3.5, -1); x.lineTo(-3.5, -1); x.closePath(); x.fill();

    // Large purple eyes
    const eyeY = -9.5;
    for (const ex of [-5.5, 5.5]) {
      x.fillStyle = '#f6eef9';
      x.beginPath(); x.ellipse(ex, eyeY, 3.9, 4.7, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = ready ? '#7c3aed' : EYE;
      x.shadowColor = ready ? '#facc15' : '#c084fc';
      x.shadowBlur = 2 + shot * 6;
      x.beginPath(); x.ellipse(ex, eyeY, 3.2, 4, 0, 0, Math.PI * 2); x.fill();
      x.shadowBlur = 0;
      x.fillStyle = PUPIL;
      x.beginPath(); x.ellipse(ex, eyeY, 1.7, 2.7, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#fff';
      x.beginPath(); x.arc(ex + 1.2, eyeY - 1.6, 0.95, 0, Math.PI * 2); x.fill();
      x.fillStyle = 'rgba(255,255,255,.65)';
      x.beginPath(); x.arc(ex - 1.1, eyeY + 1.3, 0.6, 0, Math.PI * 2); x.fill();
      if (ready) {
        x.fillStyle = '#fef08a';
        x.beginPath(); x.arc(ex + 1.7, eyeY + 1.5, 0.85, 0, Math.PI * 2); x.fill();
      }
    }
    // Nose and smile
    x.fillStyle = NOSE;
    x.beginPath();
    x.moveTo(-2.3, -1.4); x.quadraticCurveTo(0, -3.2, 2.3, -1.4);
    x.quadraticCurveTo(1.2, 1.2, 0, 1.7); x.quadraticCurveTo(-1.2, 1.2, -2.3, -1.4);
    x.closePath(); x.fill();
    x.strokeStyle = '#4a3157';
    x.lineWidth = 0.9;
    x.beginPath(); x.moveTo(0, 1.7); x.quadraticCurveTo(-2, 4, -4.2, 2.6); x.stroke();
    x.beginPath(); x.moveTo(0, 1.7); x.quadraticCurveTo(2, 4, 4.2, 2.6); x.stroke();

    // Blush
    x.fillStyle = 'rgba(192,132,252,.22)';
    x.beginPath(); x.ellipse(-9.5, 0, 2.8, 1.6, 0, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(9.5, 0, 2.8, 1.6, 0, 0, Math.PI * 2); x.fill();

    // Cloak knot and ties
    x.fillStyle = CLOAK_LIGHT;
    x.strokeStyle = LINE;
    x.lineWidth = 1;
    x.beginPath(); x.arc(0, 6, 2.6, 0, Math.PI * 2); x.fill(); x.stroke();
    x.strokeStyle = CLOAK;
    x.lineWidth = 2.4;
    x.beginPath(); x.moveTo(-1, 8); x.lineTo(-3.5, 14); x.stroke();
    x.beginPath(); x.moveTo(1, 8); x.lineTo(3.5, 14); x.stroke();

    // Paws holding the cloak
    x.fillStyle = PAW;
    x.beginPath(); x.ellipse(-5.5, 13, 1.8, 2.3, -0.3, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(5.5, 13, 1.8, 2.3, 0.3, 0, Math.PI * 2); x.fill();

    // Focus spark between the ears while charging or firing
    if (shot || ready) {
      const sy = -32;
      x.fillStyle = ready ? '#fef08a' : '#e879f9';
      x.shadowColor = ready ? '#facc15' : '#c084fc';
      x.shadowBlur = 10 + shot * 8;
      x.beginPath();
      x.moveTo(0, sy - 5); x.lineTo(1.5, sy - 1.5); x.lineTo(5, sy); x.lineTo(1.5, sy + 1.5);
      x.lineTo(0, sy + 5); x.lineTo(-1.5, sy + 1.5); x.lineTo(-5, sy); x.lineTo(-1.5, sy - 1.5);
      x.closePath(); x.fill();
      x.shadowBlur = 0;
    }

    x.restore();
  }

  // ── DAILY CHALLENGE ─────────────────────────────────────────────────────────
  function getDayKey() { return new Date().toISOString().slice(0, 10); }
  function getDailyGoal() {
    const d = new Date();
    const doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
    return 350 + (doy % 18) * 50;
  }
  const dailyGoal = getDailyGoal();
  const LS_STREAK = 'jvds_lhs_streak';
  let streakData = (function () {
    try {
      const o = JSON.parse(localStorage.getItem(LS_STREAK) || '{}');
      const today = getDayKey();
      return { streak: o.streak | 0, lastDay: o.lastDay || '', doneToday: o.lastDay === today };
    } catch (e) { return { streak: 0, lastDay: '', doneToday: false }; }
  })();

  function saveStreakData(streak, day) {
    try { localStorage.setItem(LS_STREAK, JSON.stringify({ streak, lastDay: day })); } catch (e) { }
    streakData.streak = streak; streakData.lastDay = day; streakData.doneToday = true;
  }

  function updateDailyHint() {
    const el = $('dailyHint');
    if (!el) return;
    el.textContent = streakData.doneToday
      ? '✅ Daily done! Streak: ' + streakData.streak + ' 🔥'
      : '📅 Daily goal: score ' + dailyGoal + ' pts  ·  Streak: ' + streakData.streak;
  }

  function checkDailyOnEnd(runScore) {
    if (streakData.doneToday) return;
    const el = $('dailyLine');
    if (runScore >= dailyGoal) {
      const today = getDayKey();
      const yday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const ns = streakData.lastDay === yday ? streakData.streak + 1 : 1;
      saveStreakData(ns, today);
      if (el) el.textContent = '🎯 Daily goal hit! Streak: ' + ns + ' 🔥';
    } else {
      if (el) el.textContent = '📅 Daily goal: ' + dailyGoal + '  ·  Got: ' + runScore;
    }
  }

  // ── UI WIRING ───────────────────────────────────────────────────────────────
  $('playBtn').onclick = startGame;
  $('againBtn').onclick = startGame;
  $('runCardBtn').onclick = downloadRunCard;
  document.querySelectorAll('#modeRow .mode-pill').forEach(btn => {
    btn.onclick = () => setMode(btn.dataset.mode);
  });
  const ledgerBtn = $('ledgerBtn');
  if (ledgerBtn) ledgerBtn.onclick = () => { renderLedger(); $('ledger')?.classList.remove('hidden'); };
  const ledgerClose = $('ledgerClose');
  if (ledgerClose) ledgerClose.onclick = () => { $('ledger')?.classList.add('hidden'); updateBankLine(); };
  const forgeGo = $('forgeGo');
  if (forgeGo) forgeGo.onclick = () => {
    if (!forgePicked && forgeChoices.length) { forgePicked = true; addHoney(10); }
    closeForge();
  };
  $('htpLink').onclick = () => {
    helpOrigin = 'start';
    pauseGame();
    $('startScreen').classList.add('hidden');
    $('howToPlay').classList.remove('hidden');
  };
  $('gotItBtn').onclick = () => {
    $('howToPlay').classList.add('hidden');
    if (helpOrigin === 'play') {
      resumeGame();
    } else if (helpOrigin === 'forge') {
      paused = false;
    } else if (helpOrigin === 'end') {
      paused = false;
    } else {
      paused = false;
      $('startScreen').classList.remove('hidden');
    }
  };
  $('helpBtn').onclick = () => {
    helpOrigin = (gameState === 'playing' || gameState === 'waveclear') ? 'play' : gameState === 'forge' ? 'forge' : (gameState === 'dead' ? 'end' : 'start');
    pauseGame();
    $('howToPlay').classList.remove('hidden');
  };
  $('soundBtn').onclick = () => {
    soundMuted = !soundMuted;
    $('soundBtn').textContent = soundMuted ? '🔇' : '🔊';
    if (soundMuted) music.stop();
    else if (gameState === 'playing' || gameState === 'waveclear' || gameState === 'forge') music.start();
  };
  document.querySelectorAll('[data-go]').forEach(el => {
    el.addEventListener('click', () => { location.href = el.dataset.go; });
  });

  if (typeof GameUI !== 'undefined' && GameUI.autoPause) {
    GameUI.autoPause({
      pause: () => { pauseGame(); return true; },
      resume: () => {
        if (!$('howToPlay').classList.contains('hidden')) { paused = true; return; }
        resumeGame();
      }
    });
  }

  const titleH1 = document.querySelector('#startScreen h1');
  if (titleH1 && !titleH1.querySelector('.lumo-badge-icon')) {
    titleH1.textContent = "Lumo's Hive Strike";
    const icon = document.createElement('img');
    icon.className = 'lumo-badge-icon';
    icon.src = '../assets/mascots/lumo-badge.webp';
    icon.alt = '';
    icon.width = 38; icon.height = 38;
    icon.style.cssText = 'width:38px;height:38px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:8px;border:2px solid rgba(192,132,252,.5);background:#f3eef6;';
    titleH1.insertBefore(icon, titleH1.firstChild);
  }

  const hint = document.createElement('p');
  hint.id = 'logicHint';
  hint.style.cssText = 'font-size:12px;color:#c084fc;font-weight:700;max-width:300px;';
  hint.textContent = 'Break the glowing hive anchor first, then bank honey for boons and turrets.';
  if ($('startScreen') && $('playBtn')) $('startScreen').insertBefore(hint, $('playBtn'));

  const tipGrid = document.querySelector('#howToPlay .tip-grid');
  if (tipGrid && !tipGrid.querySelector('.tip-logic')) {
    const tip = document.createElement('div');
    tip.className = 'tip tip-logic';
    tip.innerHTML = '<span class="tip-icon">⚡</span><b>Logic Beam</b><small>Chain kills, then shoot to unleash</small>';
    tipGrid.appendChild(tip);
  }

  buildIdleFormation();
  updateBankLine();
  hud();
  requestAnimationFrame(loop);

  // Test + tooling hooks. The deep page test drives the run through these.
  window.__lumoHive = {
    state: () => ({
      gameState, mode, wave, score, lives, honey, bankedHoney, combo, best, focus,
      boons: Object.assign({}, boons), boonPicks: boonPicks.slice(),
      turrets: turrets.map(t => ({ slot: t.slot, level: t.level })),
      turretSlots: turretSlotCount(), bossPhase: boss ? boss.phase : 0, bossHp: boss ? boss.hp : 0,
      bossMax: boss ? boss.maxHp : 0, bullets: bullets.length, turretShots,
      bossAlive: !!boss, forgeOpen, forgePicked, enemies: enemies.length,
      anchors: enemies.filter(e => e.anchor).length, linked: enemies.filter(e => e.link && e.link.hp > 0).length,
      seed: runSeed, dailyBest, forgeChoices: forgeChoices.map(b => b.id), relics: Object.assign({}, relics),
      coachActive: coachT > 0, coachStep, coachDone
    }),
    start: startGame,
    setMode,
    chooseBoon: (id) => { const ok = applyBoon(id); if (ok) forgePicked = true; return ok; },
    clearWave: () => { enemies = []; boss = null; beginWaveClear(); return gameState; },
    forceForge: () => openForge(() => nextWave()),
    continueForge: () => { forgePicked = true; closeForge(); },
    addHoney: (n) => addHoney(n),
    buildTurret: (slot) => buildTurret(slot, false),
    upgradeTurret: (slot) => upgradeTurret(slot),
    addRelic: (id) => { relics[id] = (relics[id] | 0) + 1; saveRelics(); return relics[id]; },
    setBank: (n) => { bankedHoney = Math.max(0, n | 0); saveBank(); updateBankLine(); return bankedHoney; },
    damageEnemy: (dmg) => { const e = enemies.find(en => en.state !== 'enter' || en.enterDelay <= 0); if (!e) return null; const before = e.hp; const dead = damageEnemy(e, dmg); if (dead) enemies.splice(enemies.indexOf(e), 1); return { before, after: e.hp, dead }; },
    killAnchor: () => { const a = enemies.find(e => e.anchor); if (!a) return false; a.hp = 1; const dead = damageEnemy(a, 1); if (dead) enemies.splice(enemies.indexOf(a), 1); return true; },
    spawnBoss,
    damageBoss: (n) => { if (!boss) return 0; boss.hp -= n; if (boss.hp <= 0) finishBoss(); return boss ? boss.hp : 0; },
    hurt: () => hitPlayer(),
    addScore: (n) => addScore(n),
    win: () => winGame(),
    lose: () => endGame(false),
    makeRunCard: () => { try { return makeRunCard().toDataURL('image/png'); } catch (e) { return ''; } },
    forgeChoices: () => forgeChoices.map(b => b.id),
    endCoach: () => { finishCoach(); return coachDone; }
  };
})();
