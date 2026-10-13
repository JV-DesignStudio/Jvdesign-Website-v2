/* Unreal Studio, a browser Blueprint builder for the My First Unreal Game series.
   Learners arrange Blueprint nodes, set the variables that drive the logic, play a
   live top-down sketch of the result, then export a real Blueprint recipe they can
   follow in Unreal Engine 5. No install to start. */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function num(id, d) { var e = $(id); var v = e ? parseFloat(e.value) : d; return isNaN(v) ? d : v; }

  /* ==========================================================================
     ZIP writer (no libraries)
     ========================================================================== */
  var CRC = (function () { var t = [], n, k, c; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function u16(v) { return [v & 255, (v >> 8) & 255]; }
  function u32(v) { return [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]; }
  function makeZip(files) {
    var enc = new TextEncoder(), chunks = [], central = [], offset = 0;
    files.forEach(function (f) {
      var nb = enc.encode(f.name), data = f.data, crc = crc32(data);
      var local = [].concat(u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(nb.length), u16(0));
      var h = new Uint8Array(local.length + nb.length); h.set(local, 0); h.set(nb, local.length);
      chunks.push(h, data);
      var cd = new Uint8Array([].concat(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(nb.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset)).concat(Array.prototype.slice.call(nb)));
      central.push(cd); offset += h.length + data.length;
    });
    var cdSize = central.reduce(function (s, c) { return s + c.length; }, 0);
    var eocd = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdSize), u32(offset), u16(0)));
    var total = chunks.reduce(function (s, c) { return s + c.length; }, 0) + cdSize + eocd.length;
    var out = new Uint8Array(total), p = 0;
    chunks.forEach(function (c) { out.set(c, p); p += c.length; });
    central.forEach(function (c) { out.set(c, p); p += c.length; });
    out.set(eocd, p); return out;
  }

  /* ==========================================================================
     Blueprint node catalogue
     ========================================================================== */
  var NODE = {
    SpawnPlayer: { label: 'Spawn Player Pawn', desc: 'Create the actor the player controls.' },
    BindInput: { label: 'Bind Enhanced Input', desc: 'Map keys to Input Actions so WASD and Space work.' },
    SpawnEnemy: { label: 'Spawn Enemy', desc: 'Create enemies on a timer.' },
    AISeek: { label: 'AI MoveTo Player', desc: 'Make enemies path toward the player.' },
    ShootOnInput: { label: 'Fire On Input', desc: 'Spawn a projectile when Space is pressed.' },
    MeleeOnInput: { label: 'Melee On Input', desc: 'Damage enemies close by when Space is pressed.' },
    PunchOnInput: { label: 'Punch On Input', desc: 'Throw a punch at the opponent.' },
    ApplyGravity: { label: 'Apply Gravity', desc: 'Pull the player down every frame.' },
    JumpOnInput: { label: 'Jump On Input', desc: 'Add upward velocity when Space is pressed.' },
    SpawnCoins: { label: 'Spawn Pickups', desc: 'Place collectables in the level.' },
    AddIncome: { label: 'Idle Income', desc: 'Add coins automatically over time.' },
    TrackScore: { label: 'Add To Score', desc: 'Increase the score variable on a hit.' },
    AddHUD: { label: 'Draw HUD', desc: 'Show health, score and round on screen.' },
    PlaySound: { label: 'Play Sound', desc: 'Fire a sound cue on the event.' }
  };

  /* ==========================================================================
     Games. Each has a Blueprint graph, variables, a live sim and an export.
     ========================================================================== */
  var W = 960, H = 384;

  function arenaSim(v, flags, dt, s, input) {
    var sp = (v.speed || 180) / 60;
    s.player.cool -= dt;
    s.player.hurt -= dt;
    if (input.left) s.player.x -= sp;
    if (input.right) s.player.x += sp;
    if (input.up) s.player.y -= sp;
    if (input.down) s.player.y += sp;
    s.player.x = clamp(s.player.x, 16, W - 16); s.player.y = clamp(s.player.y, 16, H - 16);

    if (flags.ShootOnInput && input.jump && s.player.cool <= 0) {
      s.player.cool = 1 / (v.fireRate || 6);
      var near = nearest(s.enemies, s.player); var ang = near ? Math.atan2(near.y - s.player.y, near.x - s.player.x) : -Math.PI / 2;
      s.bullets.push({ x: s.player.x, y: s.player.y, vx: Math.cos(ang) * 8, vy: Math.sin(ang) * 8, life: 1.4 });
    }
    if (flags.MeleeOnInput && input.jump && s.player.cool <= 0) {
      s.player.cool = 0.35;
      s.enemies.forEach(function (e) { if (dist(e, s.player) < 40) hitEnemy(e, v, flags, s); });
    }
    s.bullets.forEach(function (b) { b.x += b.vx; b.y += b.vy; b.life -= dt; });
    s.bullets = s.bullets.filter(function (b) { return b.life > 0 && b.x > 0 && b.x < W && b.y > 0 && b.y < H; });

    if (flags.SpawnEnemy) {
      s.spawn -= dt;
      if (s.spawn <= 0 && s.enemies.length < (v.enemyCount || 6)) {
        s.spawn = 1 / (v.spawnRate || 1.2);
        var edge = Math.floor(Math.random() * 4), e = { x: 0, y: 0, r: 13, health: v.enemyHealth || 3, max: v.enemyHealth || 3, flash: 0 };
        if (edge === 0) { e.x = Math.random() * W; e.y = 6; }
        else if (edge === 1) { e.x = W - 6; e.y = Math.random() * H; }
        else if (edge === 2) { e.x = Math.random() * W; e.y = H - 6; }
        else { e.x = 6; e.y = Math.random() * H; }
        s.enemies.push(e);
      }
    }
    var esp = (v.enemySpeed || 110) / 60;
    s.enemies.forEach(function (e) {
      if (flags.AISeek) { var a = Math.atan2(s.player.y - e.y, s.player.x - e.x); e.x += Math.cos(a) * esp; e.y += Math.sin(a) * esp; }
      if (e.flash > 0) e.flash -= dt;
      if (dist(e, s.player) < e.r + 12 && s.player.hurt <= 0) { s.player.health -= 8; s.player.hurt = 0.6; }
    });
    s.bullets.forEach(function (b) { s.enemies.forEach(function (e) { if (b.life > 0 && dist(b, e) < e.r + 4) { b.life = 0; hitEnemy(e, v, flags, s); } }); });
    s.enemies = s.enemies.filter(function (e) { return !e.dead; });
    if (s.player.health <= 0) s.over = true;
    s.score = s.kills;
    s.round = 1 + Math.floor(s.kills / 5);
  }
  function hitEnemy(e, v, flags, s) { e.flash = 0.12; e.health -= 1; if (e.health <= 0) { e.dead = true; s.kills++; } }

  function arenaDraw(ctx, s) {
    ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(232,132,26,.16)';
    for (var x = 0; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (var y = 0; y < H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.fillStyle = '#f5c518';
    s.bullets.forEach(function (b) { ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, 6.283); ctx.fill(); });
    s.enemies.forEach(function (e) {
      ctx.fillStyle = e.flash > 0 ? '#fff' : '#e8841a';
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(e.x - 12, e.y - e.r - 8, 24 * (e.health / e.max), 3);
    });
    ctx.fillStyle = '#5bc0f8'; ctx.beginPath(); ctx.arc(s.player.x, s.player.y, 13, 0, 6.283); ctx.fill();
  }

  function platformerSim(v, flags, dt, s, input) {
    var sp = (v.speed || 200) / 60;
    s.player.vx = 0;
    if (input.left) s.player.vx = -sp;
    if (input.right) s.player.vx = sp;
    if (flags.ApplyGravity) { s.player.vy += 0.5; } else { s.player.grounded = true; }
    if (flags.JumpOnInput && input.jump && s.player.grounded) { s.player.vy = -9.2; s.player.grounded = false; }
    s.player.x = clamp(s.player.x + s.player.vx, 12, W - 12);
    s.player.y += s.player.vy;
    s.player.vy = Math.min(s.player.vy, 12);
    if (flags.ApplyGravity) {
      var gy = H - 40;
      if (s.player.y > gy) { s.player.y = gy; s.player.vy = 0; s.player.grounded = true; }
      s.platforms.forEach(function (p) {
        if (s.player.x > p.x - 10 && s.player.x < p.x + p.w + 10 && s.player.vy > 0 && s.player.y > p.y - 8 && s.player.y < p.y + 14) {
          s.player.y = p.y - 8; s.player.vy = 0; s.player.grounded = true;
        }
      });
    }
    if (flags.SpawnCoins) {
      s.coins.forEach(function (c) { if (!c.got && dist(c, s.player) < 18) { c.got = true; s.score += 10; } });
      if (s.coins.every(function (c) { return c.got; })) s.won = true;
    } else { s.won = false; }
  }
  function platformerDraw(ctx, s) {
    ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2b3a2b'; ctx.fillRect(0, H - 40, W, 40);
    s.platforms.forEach(function (p) { ctx.fillStyle = '#3a4a3a'; ctx.fillRect(p.x, p.y, p.w, 14); });
    ctx.fillStyle = '#f5c518';
    s.coins.forEach(function (c) { if (!c.got) { ctx.beginPath(); ctx.arc(c.x, c.y, 7, 0, 6.283); ctx.fill(); } });
    ctx.fillStyle = '#5bc0f8'; ctx.fillRect(s.player.x - 10, s.player.y - 10, 20, 20);
  }

  function clickerSim(v, flags, dt, s, input) {
    if (flags.AddIncome) s.idle += dt * (v.idleRate || 1);
    s.coins = Math.floor(s.manual + s.idle);
    if (input.jump && s.player.cool <= 0) { s.player.cool = 0.08; s.manual += (v.perClick || 1); s.clicks++; }
    s.player.cool -= dt;
  }
  function clickerDraw(ctx, s, v) {
    ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f5c518';
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 74, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#1b1b1b'; ctx.font = 'bold 40px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('+' + (v.perClick || 1), W / 2, H / 2);
    ctx.fillStyle = '#e8841a'; ctx.font = 'bold 22px Inter, sans-serif';
    ctx.fillText('Coins: ' + s.coins, W / 2, H - 40);
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
  }

  function fighterSim(v, flags, dt, s, input) {
    var sp = (v.speed || 240) / 60;
    s.player.cool -= dt;
    if (input.left) s.player.x -= sp;
    if (input.right) s.player.x += sp;
    s.player.x = clamp(s.player.x, 30, W - 30);
    var ax = s.ai.x, tx = s.player.x > ax + 40 ? ax + sp : (s.player.x < ax - 40 ? ax - sp : ax);
    s.ai.x = clamp(tx, 30, W - 30);
    s.ai.cool -= dt;
    if (s.ai.cool <= 0 && Math.abs(s.player.x - s.ai.x) < 70) { s.ai.cool = 1.2; s.player.health -= 6; }
    if (flags.PunchOnInput && input.jump && s.player.cool <= 0) { s.player.cool = 0.5; if (Math.abs(s.player.x - s.ai.x) < 74) s.ai.health -= 9; }
    if (s.ai.health <= 0) s.won = true;
    if (s.player.health <= 0) s.over = true;
    s.score = Math.max(0, s.ai.health);
  }
  function fighterDraw(ctx, s) {
    ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2b2418'; ctx.fillRect(0, H - 50, W, 50);
    function body(x, col, cool) { ctx.fillStyle = col; ctx.fillRect(x - 16, H - 120, 32, 70); ctx.beginPath(); ctx.arc(x, H - 132, 16, 0, 6.283); ctx.fill(); if (cool <= 0.25) { ctx.fillStyle = '#fff'; ctx.fillRect(x > s.player.x ? x - 48 : x + 16, H - 100, 32, 12); } }
    body(s.player.x, '#5bc0f8', s.player.cool);
    body(s.ai.x, '#e8312b', s.ai.cool);
  }

  function nearest(list, p) { var b = null, bd = 1e9; list.forEach(function (e) { var d = dist(e, p); if (d < bd) { bd = d; b = e; } }); return b; }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  var GAMES = {
    shooter: {
      label: 'Blueprint Shooter', icon: '🔫',
      blurb: 'Top-down shooter in pure Blueprints. The event fires, the pawn spawns, input is bound, then enemies spawn and seek. Add the Fire node so Space shoots.',
      chain: ['SpawnPlayer', 'BindInput', 'SpawnEnemy', 'AISeek', 'ShootOnInput', 'TrackScore', 'AddHUD'],
      palette: ['SpawnPlayer', 'BindInput', 'SpawnEnemy', 'AISeek', 'ShootOnInput', 'TrackScore', 'AddHUD', 'PlaySound'],
      required: ['SpawnPlayer', 'BindInput'],
      vars: [
        { id: 'speed', label: 'Player speed', min: 60, max: 360, val: 180 },
        { id: 'fireRate', label: 'Fire rate (per sec)', min: 1, max: 12, val: 6 },
        { id: 'enemySpeed', label: 'Enemy speed', min: 30, max: 260, val: 110 },
        { id: 'spawnRate', label: 'Spawn rate (per sec)', min: 0.2, max: 4, val: 1.2 },
        { id: 'enemyHealth', label: 'Enemy health', min: 1, max: 8, val: 3 }
      ],
      make: function () { return { t: 0, player: { x: W / 2, y: H - 60, health: 100, cool: 0, hurt: 0 }, bullets: [], enemies: [], spawn: 1, kills: 0, score: 0, over: false, won: false, round: 1 }; },
      sim: arenaSim, draw: arenaDraw,
      hud: function (s) { return ['Kills: ' + s.kills, 'Health: ' + Math.max(0, s.player.health), s.over ? 'Game over, press reset' : 'WASD move, Space shoot']; },
      files: function (v, chain) { return recipe('Blueprint Shooter', 'A top-down shooter built with Blueprints only.', v, chain); }
    },
    topdown: {
      label: 'C++ Top-Down', icon: '💻',
      blurb: 'The C++ episode. Same arena, but written in C++ classes in Unreal. Faster bullets, tougher enemies. The Blueprint graph shows the same flow you implement in C++.',
      chain: ['SpawnPlayer', 'BindInput', 'SpawnEnemy', 'AISeek', 'ShootOnInput', 'TrackScore', 'AddHUD'],
      palette: ['SpawnPlayer', 'BindInput', 'SpawnEnemy', 'AISeek', 'ShootOnInput', 'TrackScore', 'AddHUD', 'PlaySound'],
      required: ['SpawnPlayer', 'BindInput'],
      vars: [
        { id: 'speed', label: 'Player speed', min: 60, max: 360, val: 210 },
        { id: 'fireRate', label: 'Fire rate (per sec)', min: 1, max: 14, val: 9 },
        { id: 'enemySpeed', label: 'Enemy speed', min: 30, max: 260, val: 120 },
        { id: 'spawnRate', label: 'Spawn rate (per sec)', min: 0.2, max: 4, val: 1.6 },
        { id: 'enemyHealth', label: 'Enemy health', min: 1, max: 8, val: 2 }
      ],
      make: function () { return { t: 0, player: { x: W / 2, y: H - 60, health: 100, cool: 0, hurt: 0 }, bullets: [], enemies: [], spawn: 1, kills: 0, score: 0, over: false, won: false, round: 1 }; },
      sim: arenaSim, draw: arenaDraw,
      hud: function (s) { return ['Kills: ' + s.kills, 'Health: ' + Math.max(0, s.player.health), s.over ? 'Game over, press reset' : 'WASD move, Space shoot']; },
      files: function (v, chain) { return recipe('CppTopDownShooter', 'A top-down shooter written in C++ in Unreal Engine 5.', v, chain); }
    },
    zombie: {
      label: 'Zombie Survivor', icon: '🧟',
      blurb: 'Wave survival. Zombies shuffle in and claw at you. Add Melee so Space swings. Track Score and Draw HUD to keep the round info on screen.',
      chain: ['SpawnPlayer', 'BindInput', 'SpawnEnemy', 'AISeek', 'MeleeOnInput', 'TrackScore', 'AddHUD'],
      palette: ['SpawnPlayer', 'BindInput', 'SpawnEnemy', 'AISeek', 'MeleeOnInput', 'TrackScore', 'AddHUD', 'PlaySound'],
      required: ['SpawnPlayer', 'BindInput'],
      vars: [
        { id: 'speed', label: 'Player speed', min: 60, max: 360, val: 170 },
        { id: 'enemySpeed', label: 'Zombie speed', min: 20, max: 200, val: 70 },
        { id: 'spawnRate', label: 'Spawn rate (per sec)', min: 0.2, max: 4, val: 1.0 },
        { id: 'enemyHealth', label: 'Zombie health', min: 1, max: 10, val: 4 },
        { id: 'enemyCount', label: 'Max zombies', min: 2, max: 14, val: 8 }
      ],
      make: function () { return { t: 0, player: { x: W / 2, y: H / 2, health: 100, cool: 0, hurt: 0 }, bullets: [], enemies: [], spawn: 1, kills: 0, score: 0, over: false, won: false, round: 1 }; },
      sim: arenaSim, draw: arenaDraw,
      hud: function (s) { return ['Kills: ' + s.kills, 'Round: ' + s.round, 'Health: ' + Math.max(0, s.player.health), s.over ? 'Game over, press reset' : 'WASD move, Space swing']; },
      files: function (v, chain) { return recipe('BlueprintZombies', 'A COD Zombies style wave survival game in Blueprints.', v, chain); }
    },
    platformer: {
      label: '2D Platformer', icon: '🎮',
      blurb: 'Gravity, jumping and pickups. Apply Gravity pulls the pawn down, Jump On Input gives it a boost, Spawn Pickups drops the coins.',
      chain: ['SpawnPlayer', 'BindInput', 'ApplyGravity', 'JumpOnInput', 'SpawnCoins', 'TrackScore', 'AddHUD'],
      palette: ['SpawnPlayer', 'BindInput', 'ApplyGravity', 'JumpOnInput', 'SpawnCoins', 'TrackScore', 'AddHUD', 'PlaySound'],
      required: ['SpawnPlayer', 'BindInput'],
      vars: [
        { id: 'speed', label: 'Run speed', min: 80, max: 400, val: 220 },
        { id: 'jumpPower', label: 'Jump power', min: 6, max: 16, val: 9 }
      ],
      make: function () {
        return {
          t: 0, player: { x: 120, y: H - 120, vx: 0, vy: 0, grounded: false, cool: 0 },
          platforms: [{ x: 300, y: H - 130, w: 160 }, { x: 560, y: H - 200, w: 140 }, { x: 780, y: H - 260, w: 120 }],
          coins: [{ x: 360, y: H - 160 }, { x: 620, y: H - 230 }, { x: 830, y: H - 290 }],
          score: 0, over: false, won: false
        };
      },
      sim: platformerSim, draw: platformerDraw,
      hud: function (s) { return ['Coins: ' + s.score, s.won ? 'All coins collected!' : 'A / D move, Space jump']; },
      files: function (v, chain) { return recipe('BlueprintPlatformer', 'A 2D platformer with gravity, jumping and pickups.', v, chain); }
    },
    clicker: {
      label: 'Blueprint Clicker', icon: '💰',
      blurb: 'The gentlest Blueprint project. Fire On Input adds coins per press, Idle Income ticks up on its own. Great for practising variables and events.',
      chain: ['SpawnPlayer', 'ShootOnInput', 'AddIncome', 'TrackScore', 'AddHUD'],
      palette: ['SpawnPlayer', 'ShootOnInput', 'AddIncome', 'TrackScore', 'AddHUD', 'PlaySound'],
      required: ['SpawnPlayer'],
      vars: [
        { id: 'perClick', label: 'Coins per click', min: 1, max: 50, val: 3 },
        { id: 'idleRate', label: 'Idle coins per sec', min: 0, max: 20, val: 1 }
      ],
      make: function () { return { t: 0, player: { cool: 0 }, manual: 0, idle: 0, coins: 0, clicks: 0, score: 0, over: false, won: false }; },
      sim: clickerSim, draw: clickerDraw,
      hud: function (s) { return ['Coins: ' + s.coins, 'Clicks: ' + s.clicks, 'Press Space (or the action button) to earn']; },
      files: function (v, chain) { return recipe('BlueprintClicker', 'A clicker game with coins, idle income and upgrades.', v, chain); }
    },
    fighter: {
      label: 'Arena Fighter', icon: '🥋',
      blurb: 'Two fighters, one AI opponent. Move with A and D, punch with Space. Add the Punch node or you will be the only one standing still.',
      chain: ['SpawnPlayer', 'BindInput', 'AISeek', 'PunchOnInput', 'TrackScore', 'AddHUD'],
      palette: ['SpawnPlayer', 'BindInput', 'AISeek', 'PunchOnInput', 'TrackScore', 'AddHUD', 'PlaySound'],
      required: ['SpawnPlayer', 'BindInput'],
      vars: [
        { id: 'speed', label: 'Move speed', min: 80, max: 400, val: 240 },
        { id: 'playerHealth', label: 'Your health', min: 40, max: 200, val: 100 },
        { id: 'aiHealth', label: 'Opponent health', min: 40, max: 200, val: 90 }
      ],
      make: function (v) { return { t: 0, player: { x: 300, health: v.playerHealth || 100, cool: 0 }, ai: { x: 660, health: v.aiHealth || 90, cool: 0.6 }, score: 0, over: false, won: false }; },
      sim: fighterSim, draw: fighterDraw,
      hud: function (s) { return ['You: ' + Math.max(0, s.player.health), 'Opponent: ' + Math.max(0, s.ai.health), s.won ? 'You win!' : (s.over ? 'Game over, press reset' : 'A / D move, Space punch')]; },
      files: function (v, chain) { return recipe('ArenaFighter', 'A 2-player style arena fighter with an AI opponent.', v, chain); }
    }
  };

  function recipe(project, summary, v, chain) {
    var lines = [];
    lines.push('# ' + project + ' Blueprint recipe');
    lines.push('');
    lines.push(summary);
    lines.push('');
    lines.push('## How to follow this in Unreal Engine 5');
    lines.push('1. Install Epic Games Launcher and Unreal Engine 5 (free), with a grown-up the first time.');
    lines.push('2. New Project, Games, Blank, Blueprint, no starter content.');
    lines.push('3. Open the Blueprint graph and wire the nodes below in order.');
    lines.push('4. Set the variables to the values listed. Press Play.');
    lines.push('');
    lines.push('## Variables');
    Object.keys(v).forEach(function (k) { lines.push('- ' + k + ' = ' + v[k]); });
    lines.push('');
    lines.push('## Node chain');
    chain.forEach(function (n, i) { lines.push((i + 1) + '. ' + (NODE[n] ? NODE[n].label : n) + '  (' + (NODE[n] ? NODE[n].desc : '') + ')'); });
    lines.push('');
    var files = {};
    files['README.md'] = lines.join('\n');
    files[project + '.blueprint.txt'] = 'Begin Object Class=/Script/BlueprintGraph.K2Node_Event\n  EventName=BeginPlay\nEnd Object\n\n' + chain.map(function (n) { return 'Node: ' + n; }).join('\n') + '\n';
    files['Variables.json'] = JSON.stringify(v, null, 2);
    return files;
  }

  /* ==========================================================================
     State + render
     ========================================================================== */
  var state = { game: 'shooter', vars: {}, enabled: {}, order: [], screen: 'graph', sim: null, raf: 0, input: { left: false, right: false, up: false, down: false, jump: false } };

  function defaultsFor(g) { var o = {}; g.vars.forEach(function (v) { o[v.id] = v.val; }); return o; }
  function enabledFor(g) { var o = {}; g.chain.forEach(function (n) { o[n] = true; }); g.required.forEach(function (n) { o[n] = true; }); return o; }

  function switchGame(id) {
    var g = GAMES[id]; if (!g) g = GAMES.shooter;
    state.game = id in GAMES ? id : 'shooter';
    state.vars = defaultsFor(g);
    state.enabled = enabledFor(g);
    state.order = g.chain.slice();
    state.sim = null;
    [].forEach.call(document.querySelectorAll('.us-game-btn'), function (b) { b.classList.toggle('is-active', b.getAttribute('data-game') === state.game); });
    var bl = $('usGameBlurb'); if (bl) bl.textContent = g.blurb;
    renderGraph(); renderInspector();
    if (state.screen === 'play') startPlay(); else stopPlay();
    refreshTree();
  }

  function moveNode(from, to) {
    var fi = state.order.indexOf(from), ti = state.order.indexOf(to);
    if (fi < 0 || ti < 0) return;
    state.order.splice(fi, 1);
    state.order.splice(state.order.indexOf(to), 0, from);
    renderGraph(); refreshTree(); syncCodeBox();
  }

  function renderGraph() {
    var g = GAMES[state.game], pal = $('usGraphPalette'), chainEl = $('usGraphChain'), note = $('usGraphNote');
    if (!pal || !chainEl) return;
    pal.innerHTML = '';
    g.palette.forEach(function (n) {
      var on = !!state.enabled[n];
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'us-node-btn' + (on ? ' is-on' : '');
      b.setAttribute('data-node', n);
      b.innerHTML = '<strong>' + NODE[n].label + '</strong><span>' + (on ? 'In graph' : 'Add to graph') + '</span>';
      b.addEventListener('click', function () {
        if (g.required.indexOf(n) >= 0) { if (note) note.textContent = 'This node is required for the game to run.'; return; }
        state.enabled[n] = !state.enabled[n]; renderGraph(); refreshTree();
      });
      pal.appendChild(b);
    });
    chainEl.innerHTML = '';
    var ev = document.createElement('div'); ev.className = 'us-node us-node--event';
    ev.innerHTML = '<div class="us-node-head">&#9654; Event BeginPlay</div><div class="us-node-body">Fires once when the game starts. This is the entry point.</div>';
    chainEl.appendChild(ev);
    (state.order.length ? state.order : g.chain).forEach(function (n) {
      if (!state.enabled[n]) return;
      var d = document.createElement('div'); d.className = 'us-node';
      d.setAttribute('draggable', 'true');
      d.setAttribute('tabindex', '0');
      d.setAttribute('data-node', n);
      d.setAttribute('aria-label', NODE[n].label + '. Press arrow keys to reorder, Enter to keep.');
      d.innerHTML = '<div class="us-node-head">' + NODE[n].label + '</div><div class="us-node-body">' + NODE[n].desc + '</div>';
      d.addEventListener('dragstart', function (e) { try { e.dataTransfer.setData('text/plain', n); } catch (x) {} });
      d.addEventListener('dragover', function (e) { e.preventDefault(); });
      d.addEventListener('drop', function (e) {
        e.preventDefault();
        var from = null;
        try { from = e.dataTransfer.getData('text/plain'); } catch (x) {}
        if (from && from !== n) moveNode(from, n);
      });
      d.addEventListener('keydown', function (e) {
        var idx = state.order.indexOf(n);
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); if (idx > 0) { state.order.splice(idx, 1); state.order.splice(idx - 1, 0, n); renderGraph(); refreshTree(); } }
        else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); if (idx > -1 && idx < state.order.length - 1) { state.order.splice(idx, 1); state.order.splice(idx + 1, 0, n); renderGraph(); refreshTree(); } }
      });
      chainEl.appendChild(d);
    });
    var end = document.createElement('div'); end.className = 'us-node us-node--end';
    end.innerHTML = '<div class="us-node-head">&#9634; Exec continues</div><div class="us-node-body">Every frame, then loops back on Tick.</div>';
    chainEl.appendChild(end);
  }

  function renderInspector() {
    var g = GAMES[state.game], box = $('usInspector'); if (!box) return;
    box.innerHTML = '';
    g.vars.forEach(function (v) {
      var row = document.createElement('div'); row.className = 'us-field';
      var lab = document.createElement('label'); lab.setAttribute('for', 'v_' + v.id); lab.textContent = v.label;
      var inp = document.createElement('input'); inp.type = 'range'; inp.id = 'v_' + v.id; inp.min = v.min; inp.max = v.max; inp.step = v.max > 20 ? 1 : 0.1; inp.value = state.vars[v.id];
      var out = document.createElement('span'); out.className = 'us-varval'; out.textContent = state.vars[v.id];
      inp.addEventListener('input', function () { state.vars[v.id] = parseFloat(inp.value); out.textContent = inp.value; refreshTree(); });
      row.appendChild(lab); row.appendChild(inp); row.appendChild(out);
      box.appendChild(row);
    });
    var varsCard = document.createElement('div'); varsCard.className = 'us-card';
    varsCard.innerHTML = '<h3>Blueprint Variables</h3><p class="us-note">These are the variables your Blueprint reads. Change one and press Play to see what it does.</p>';
    box.parentNode.insertBefore(varsCard, box);
  }

  function refreshTree() {
    var g = GAMES[state.game], tree = $('usTree'); if (!tree) return;
    var project = ($('xProject') && $('xProject').value || 'MyUnrealGame').replace(/[^A-Za-z0-9_.-]/g, '') || 'MyUnrealGame';
    var files = g.files(state.vars, enabledList());
    tree.textContent = project + '.zip\n' + Object.keys(files).map(function (n) { return '  ' + n; }).join('\n');
  }
  function enabledList() { var g = GAMES[state.game]; var order = (state.order && state.order.length) ? state.order : g.chain; return order.filter(function (n) { return state.enabled[n]; }); }

  /* ---------- live variable code ---------- */
  function currentRecipeText() {
    var g = GAMES[state.game], files = g.files(state.vars, enabledList());
    var names = Object.keys(files);
    return files[names[0]] || '';
  }
  function syncCodeBox() { var ta = $('usCodeEdit'); if (ta) ta.value = currentRecipeText(); }
  function initLiveBits() {
    if (!window.JVDSLiveEdit || !$('usCodeEdit')) return;
    syncCodeBox();
    window.JVDSLiveEdit.bindCodeEditor({
      textareaId: 'usCodeEdit', applyId: 'usCodeApply', resetId: 'usCodeReset', statusId: 'usCodeMsg',
      getCode: currentRecipeText,
      getFieldMeta: function () { return GAMES[state.game].vars.map(function (v) { return { key: v.id, min: v.min, max: v.max }; }); },
      getValues: function () { return state.vars; },
      setValue: function (k, v) { state.vars[k] = v; var inp = $('v_' + k); if (inp) inp.value = v; },
      resetValues: function () { state.vars = defaultsFor(GAMES[state.game]); renderInspector(); },
      refresh: function () { renderInspector(); refreshTree(); if (state.screen === 'play') startPlay(); }
    });
  }

  /* ==========================================================================
     Play loop
     ========================================================================== */
  var playCanvas = null, playCtx = null;
  function startPlay() {
    stopPlay();
    var g = GAMES[state.game];
    state.sim = g.make(state.vars);
    playCanvas = $('usPlay'); if (!playCanvas) return;
    playCtx = playCanvas.getContext('2d');
    var ctl = $('usControls'); if (ctl) ctl.textContent = 'Move with the arrow pad or WASD. Press the action button or Space for the game action.';
    var last = 0;
    function frame(ts) {
      if (!state.sim) return;
      var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016; last = ts;
      var flags = state.enabled;
      g.sim(state.vars, flags, dt, state.sim, state.input);
      g.draw(playCtx, state.sim, state.vars);
      var hud = $('usHud');
      if (hud) { var parts = g.hud(state.sim); hud.textContent = parts.filter(Boolean).join('   |   '); }
      state.raf = requestAnimationFrame(frame);
    }
    state.raf = requestAnimationFrame(frame);
  }
  function stopPlay() { if (state.raf) cancelAnimationFrame(state.raf); state.raf = 0; state.sim = null; }

  /* ==========================================================================
     Input
     ========================================================================== */
  var KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', A: 'left', d: 'right', D: 'right', w: 'up', W: 'up', s: 'down', S: 'down', ' ': 'jump' };
  document.addEventListener('keydown', function (e) { var k = KEYMAP[e.key]; if (k) { state.input[k] = true; if (e.key === ' ') e.preventDefault(); } });
  document.addEventListener('keyup', function (e) { var k = KEYMAP[e.key]; if (k) state.input[k] = false; });
  function bindHold(id, key) { var b = $(id); if (!b) return; b.addEventListener('mousedown', function () { state.input[key] = true; }); b.addEventListener('touchstart', function (e) { e.preventDefault(); state.input[key] = true; }, { passive: false }); ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(function (ev) { b.addEventListener(ev, function () { state.input[key] = false; }); }); }

  /* ==========================================================================
     Export
     ========================================================================== */
  function doExport() {
    var msg = $('usMsg');
    try {
      var g = GAMES[state.game], enc = new TextEncoder();
      var project = (($('xProject') && $('xProject').value) || 'MyUnrealGame').replace(/[^A-Za-z0-9_.-]/g, '') || 'MyUnrealGame';
      var files = g.files(state.vars, enabledList()), arr = [];
      Object.keys(files).forEach(function (n) { arr.push({ name: n, data: enc.encode(files[n]) }); });
      var zip = makeZip(arr), blob = new Blob([zip], { type: 'application/zip' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = project + '.zip';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
      try { var c = parseInt(localStorage.getItem('jvds_tool_export_unreal-studio') || '0', 10) + 1; localStorage.setItem('jvds_tool_export_unreal-studio', String(c)); } catch (e) {}
      if (msg) { msg.className = 'us-msg ok'; msg.textContent = 'Downloaded ' + project + '.zip (' + g.label + '). Follow the README to build it in Unreal Engine 5.'; }
    } catch (e) { if (msg) { msg.className = 'us-msg bad'; msg.textContent = 'Something went wrong building the zip. Try again.'; } }
  }

  /* ==========================================================================
     Boot
     ========================================================================== */
  function boot() {
    [].forEach.call(document.querySelectorAll('.us-game-btn'), function (b) { b.addEventListener('click', function () { switchGame(b.getAttribute('data-game')); }); });
    [].forEach.call(document.querySelectorAll('.us-tab'), function (btn) {
      btn.addEventListener('click', function () {
        [].forEach.call(document.querySelectorAll('.us-tab'), function (b) { b.classList.remove('is-active'); });
        [].forEach.call(document.querySelectorAll('.us-panel'), function (p) { p.classList.remove('is-active'); });
        btn.classList.add('is-active');
        var p = $('panel-' + btn.getAttribute('data-tab')); if (p) p.classList.add('is-active');
        state.screen = btn.getAttribute('data-tab');
        if (state.screen === 'play') startPlay(); else stopPlay();
        if (state.screen === 'export') refreshTree();
      });
    });
    var rs = $('usReset'); if (rs) rs.addEventListener('click', function () { if (state.screen === 'play') startPlay(); });
    var op = $('usOpenPlay'); if (op) op.addEventListener('click', function () { var t = document.querySelector('.us-tab[data-tab="play"]'); if (t) t.click(); });
    var dl = $('xDownload'); if (dl) dl.addEventListener('click', doExport);
    var cp = $('xCopy'); if (cp) cp.addEventListener('click', function () {
      var g = GAMES[state.game], files = g.files(state.vars, enabledList());
      var all = Object.keys(files).map(function (n) { return '// ===== ' + n + ' =====\n' + files[n]; }).join('\n');
      try { navigator.clipboard.writeText(all).then(function () { var m = $('usMsg'); if (m) { m.className = 'us-msg ok'; m.textContent = 'Copied the Blueprint recipe to the clipboard.'; } }, function () {}); } catch (e) {}
    });
    var proj = $('xProject'); if (proj) proj.addEventListener('input', refreshTree);
    bindHold('usLeft', 'left'); bindHold('usRight', 'right'); bindHold('usUp', 'up'); bindHold('usDown', 'down'); bindHold('usJump', 'jump');
    var want = (new URLSearchParams(location.search)).get('game');
    switchGame(GAMES[want] ? want : 'shooter');
    initLiveBits();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
