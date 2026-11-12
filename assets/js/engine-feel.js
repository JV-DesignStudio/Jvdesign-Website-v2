/*
 * Engine Feel - one reusable browser replica of a game engine editor (A2958).
 * Godot first. Each mount picks a preset scene, so every episode gets the same
 * Scene tree, Inspector, 2D viewport and Output as the real editor, with a
 * real Godot project download.
 *
 * Mount with:  <div data-engine-feel="godot" data-ef-preset="racing"></div>
 * No dependencies, no account, no inline script and no network calls.
 */
(function () {
  'use strict';

  var mount = document.querySelector('[data-engine-feel="godot"]');
  if (!mount) return;

  var TYPES = {
    Node2D: { color: '#8b9dc3' },
    CharacterBody2D: { color: '#7dd3fc' },
    StaticBody2D: { color: '#4b5563' },
    Area2D: { color: '#fbbf24' },
    Sprite2D: { color: '#a78bfa' },
    Timer: { color: '#f472b6' },
    Camera2D: { color: '#34d399' },
    Button: { color: '#fb923c' }
  };
  var ADDABLE = ['Sprite2D', 'CharacterBody2D', 'Area2D', 'StaticBody2D', 'Timer', 'Camera2D', 'Button', 'Node2D'];

  function node(id, name, type, x, y, extra) {
    var n = { id: id, name: name, type: type, x: x, y: y, core: true };
    if (extra) Object.keys(extra).forEach(function (k) { n[k] = extra[k]; });
    return n;
  }
  function world() { return node('world', 'World', 'Node2D', 0, 0); }

  var PRESETS = {
    starter: {
      title: 'My First Video Game',
      scene: 'World',
      scoreLabel: 'Coins',
      hint: 'Click the viewport, then use the arrow keys to move the player. Press Run to collect the coin.',
      script: 'player.gd',
      pickup: 'coin.gd',
      readme: [
        '# My First Video Game',
        '',
        'You built this in the JVDS Godot replica. It opens in the real Godot 4 editor.',
        '',
        '1. Install Godot 4 from godotengine.org (free).',
        '2. Open Godot, choose Import, and pick project.godot.',
        '3. Open main.tscn and press F6 or F5 to run it.',
        '',
        'Next: add a Sprite2D and a CollisionShape2D to the Player node, then draw your own character.'
      ],
      nodes: [
        world(),
        node('player', 'Player', 'CharacterBody2D', 120, 180, { speed: 180, color: '#7dd3fc' }),
        node('ground', 'Ground', 'StaticBody2D', 0, 300, { width: 640, height: 60, color: '#4b5563' }),
        node('coin', 'Coin', 'Area2D', 470, 150, { radius: 12, color: '#fbbf24' })
      ]
    },
    racing: {
      title: 'Episode 1 - Zoom Zoom! Top-Down Racing',
      scene: 'RaceTrack',
      scoreLabel: 'Checkpoints',
      hint: 'Move the car with the arrow keys. Press Run to collect the checkpoint.',
      script: 'car.gd',
      pickup: 'checkpoint.gd',
      readme: ['# Episode 1 - Zoom Zoom!', '', 'Open project.godot in Godot 4, then open main.tscn.', 'Drive the car around the track and add a lap timer next.', ''],
      nodes: [
        world(),
        node('track', 'Track', 'Node2D', 320, 240),
        node('player', 'Car', 'CharacterBody2D', 120, 180, { speed: 220, color: '#f87171' }),
        node('coin', 'Checkpoint', 'Area2D', 470, 150, { radius: 14, color: '#4ade80' }),
        node('timer', 'Lap Timer', 'Timer', 560, 60)
      ]
    },
    platformer: {
      title: 'Episode 2 - Jump Jump! Mario-Style Platformer',
      scene: 'Level1',
      scoreLabel: 'Coins',
      hint: 'Move the player with the arrow keys. Press Run to collect the coin.',
      script: 'player.gd',
      pickup: 'coin.gd',
      readme: ['# Episode 2 - Jump Jump!', '', 'Open project.godot in Godot 4, then open main.tscn.', 'Add gravity and a jump to the Player node next.', ''],
      nodes: [
        world(),
        node('player', 'Player', 'CharacterBody2D', 100, 240, { speed: 180, color: '#7dd3fc' }),
        node('ground', 'Ground', 'StaticBody2D', 0, 300, { width: 640, height: 60, color: '#4b5563' }),
        node('coin', 'Coin', 'Area2D', 420, 170, { radius: 12, color: '#fbbf24' }),
        node('camera', 'Camera2D', 'Camera2D', 320, 180)
      ]
    },
    shooter: {
      title: 'Episode 3 - Bang Bang! Top-Down Shooter',
      scene: 'Arena',
      scoreLabel: 'Enemies',
      hint: 'Move with the arrow keys. Press Run to clear the enemy.',
      script: 'player.gd',
      pickup: 'enemy.gd',
      readme: ['# Episode 3 - Bang Bang!', '', 'Open project.godot in Godot 4, then open main.tscn.', 'Add a bullet scene and a spawn timer next.', ''],
      nodes: [
        world(),
        node('player', 'Player', 'CharacterBody2D', 120, 180, { speed: 200, color: '#7dd3fc' }),
        node('coin', 'Enemy', 'Area2D', 470, 120, { radius: 16, color: '#f87171' }),
        node('bullet', 'Bullet', 'Area2D', 150, 180, { radius: 6, color: '#fbbf24' }),
        node('spawner', 'Spawner', 'Timer', 560, 60)
      ]
    },
    survivors: {
      title: 'Episode 4 - Fairy Survivors',
      scene: 'SurvivorArena',
      scoreLabel: 'XP Gems',
      hint: 'Move the fairy with the arrow keys. Press Run to collect the gem.',
      script: 'player.gd',
      pickup: 'xp_gem.gd',
      readme: ['# Episode 4 - Fairy Survivors', '', 'Open project.godot in Godot 4, then open main.tscn.', 'Add an auto-attack and a wave timer next.', ''],
      nodes: [
        world(),
        node('player', 'Fairy', 'CharacterBody2D', 320, 180, { speed: 160, color: '#c084fc' }),
        node('coin', 'XP Gem', 'Area2D', 200, 240, { radius: 10, color: '#4ade80' }),
        node('bug', 'Bug', 'Area2D', 470, 120, { radius: 14, color: '#f472b6' }),
        node('wave', 'Wave Timer', 'Timer', 560, 60)
      ]
    },
    barrel: {
      title: 'Episode 5 - Barrel Blast',
      scene: 'DonkeyKong',
      scoreLabel: 'Ladders',
      hint: 'Move the player with the arrow keys. Press Run to reach the ladder.',
      script: 'player.gd',
      pickup: 'ladder.gd',
      readme: ['# Episode 5 - Barrel Blast', '', 'Open project.godot in Godot 4, then open main.tscn.', 'Add rolling barrels and a spawn timer next.', ''],
      nodes: [
        world(),
        node('player', 'Player', 'CharacterBody2D', 100, 180, { speed: 170, color: '#7dd3fc' }),
        node('coin', 'Ladder', 'Area2D', 300, 240, { radius: 18, color: '#a16207' }),
        node('barrel', 'Barrel', 'CharacterBody2D', 470, 120, { speed: 150, color: '#f97316' }),
        node('timer', 'Barrel Timer', 'Timer', 560, 60)
      ]
    },
    quest: {
      title: 'Episode 6 - Pixel Quest',
      scene: 'Dungeon',
      scoreLabel: 'Treasure',
      hint: 'Move the hero with the arrow keys. Press Run to reach the chest.',
      script: 'player.gd',
      pickup: 'chest.gd',
      readme: ['# Episode 6 - Pixel Quest', '', 'Open project.godot in Godot 4, then open main.tscn.', 'Give the hero a sword and add a locked door next.', ''],
      nodes: [
        world(),
        node('player', 'Hero', 'CharacterBody2D', 100, 180, { speed: 170, color: '#7dd3fc' }),
        node('coin', 'Chest', 'Area2D', 520, 240, { radius: 14, color: '#fbbf24' }),
        node('sword', 'Sword', 'Area2D', 130, 180, { radius: 10, color: '#e5e7eb' }),
        node('slime', 'Slime', 'Area2D', 470, 150, { radius: 14, color: '#4ade80' }),
        node('door', 'Door', 'StaticBody2D', 600, 180, { width: 20, height: 60, color: '#a16207' })
      ]
    },
    nightwatch: {
      title: 'Episode 7 - Night Watch',
      scene: 'SecurityOffice',
      scoreLabel: 'Power Cells',
      hint: 'Move the guard with the arrow keys. Press Run to collect a power cell.',
      script: 'player.gd',
      pickup: 'power_cell.gd',
      readme: ['# Episode 7 - Night Watch', '', 'Open project.godot in Godot 4, then open main.tscn.', 'Add camera switching and door power next.', ''],
      nodes: [
        world(),
        node('player', 'Guard', 'CharacterBody2D', 320, 220, { speed: 120, color: '#7dd3fc' }),
        node('coin', 'Power Cell', 'Area2D', 200, 260, { radius: 10, color: '#4ade80' }),
        node('camera', 'Camera2D', 'Camera2D', 320, 180),
        node('door', 'Door', 'StaticBody2D', 600, 180, { width: 20, height: 120, color: '#4b5563' }),
        node('animatronic', 'Animatronic', 'Area2D', 470, 120, { radius: 18, color: '#f87171' }),
        node('power', 'Power Timer', 'Timer', 560, 60)
      ]
    },
    nightwatch2: {
      title: 'Episode 8 - Night Watch Part 2',
      scene: 'Night2',
      scoreLabel: 'Power Cells',
      hint: 'Move the guard with the arrow keys. Press Run to collect a power cell.',
      script: 'player.gd',
      pickup: 'power_cell.gd',
      readme: ['# Episode 8 - Night Watch Part 2', '', 'Open project.godot in Godot 4, then open main.tscn.', 'Add Bonnie, Chica and Foxy behaviours next.', ''],
      nodes: [
        world(),
        node('player', 'Guard', 'CharacterBody2D', 320, 220, { speed: 120, color: '#7dd3fc' }),
        node('coin', 'Power Cell', 'Area2D', 200, 260, { radius: 10, color: '#4ade80' }),
        node('bonnie', 'Bonnie', 'Area2D', 470, 120, { radius: 16, color: '#a78bfa' }),
        node('chica', 'Chica', 'Area2D', 520, 180, { radius: 16, color: '#fbbf24' }),
        node('foxy', 'Foxy', 'Area2D', 560, 240, { radius: 16, color: '#f87171' }),
        node('door', 'Door', 'StaticBody2D', 600, 180, { width: 20, height: 120, color: '#4b5563' })
      ]
    },
    nightwatch3: {
      title: 'Episode 9 - Night Watch Part 3',
      scene: 'Night3',
      scoreLabel: 'Fuses',
      hint: 'Move the guard with the arrow keys. Press Run to collect a fuse.',
      script: 'player.gd',
      pickup: 'fuse.gd',
      readme: ['# Episode 9 - Night Watch Part 3', '', 'Open project.godot in Godot 4, then open main.tscn.', 'Add screen shake and flickering lights next.', ''],
      nodes: [
        world(),
        node('player', 'Guard', 'CharacterBody2D', 320, 220, { speed: 120, color: '#7dd3fc' }),
        node('coin', 'Fuse', 'Area2D', 200, 260, { radius: 10, color: '#fbbf24' }),
        node('camera', 'Camera2D', 'Camera2D', 320, 180),
        node('lights', 'Lights', 'Node2D', 320, 120),
        node('animatronic', 'Animatronic', 'Area2D', 470, 120, { radius: 18, color: '#f87171' })
      ]
    },
    rally: {
      title: 'Godot Rally',
      scene: 'RallyTrack',
      scoreLabel: 'Checkpoints',
      hint: 'Move the car with the arrow keys. Press Run to collect the checkpoint.',
      script: 'car.gd',
      pickup: 'checkpoint.gd',
      readme: ['# Godot Rally', '', 'Open project.godot in Godot 4, then open main.tscn.', 'Add a lap timer and a finish line next.', ''],
      nodes: [
        world(),
        node('track', 'Track', 'Node2D', 320, 240),
        node('player', 'Car', 'CharacterBody2D', 120, 180, { speed: 220, color: '#f87171' }),
        node('coin', 'Checkpoint', 'Area2D', 470, 150, { radius: 14, color: '#4ade80' }),
        node('timer', 'Lap Timer', 'Timer', 560, 60)
      ]
    },
    world: {
      title: 'Godot World',
      scene: 'GodotWorld',
      scoreLabel: 'Coins',
      hint: 'Move the player with the arrow keys. Press Run to collect the coin.',
      script: 'player.gd',
      pickup: 'coin.gd',
      readme: ['# Godot World', '', 'Open project.godot in Godot 4, then open main.tscn.', 'Paint a tilemap and add an enemy next.', ''],
      nodes: [
        world(),
        node('player', 'Player', 'CharacterBody2D', 120, 180, { speed: 180, color: '#7dd3fc' }),
        node('tiles', 'TileMapLayer', 'Node2D', 320, 260),
        node('enemy', 'Enemy', 'Area2D', 470, 150, { radius: 14, color: '#f87171' }),
        node('coin', 'Coin', 'Area2D', 520, 220, { radius: 12, color: '#fbbf24' })
      ]
    },
    tutorial: {
      title: 'Godot Tutorial',
      scene: 'Tutorial',
      scoreLabel: 'Coins',
      hint: 'Move the player with the arrow keys. Press Run to collect the coin.',
      script: 'player.gd',
      pickup: 'coin.gd',
      readme: ['# Godot Tutorial', '', 'Open project.godot in Godot 4, then open main.tscn.', 'Add your own sprite and a jump next.', ''],
      nodes: [
        world(),
        node('player', 'Player', 'CharacterBody2D', 120, 180, { speed: 180, color: '#7dd3fc' }),
        node('sprite', 'Sprite2D', 'Sprite2D', 320, 180, { scale: 1, color: '#a78bfa' }),
        node('coin', 'Coin', 'Area2D', 470, 150, { radius: 12, color: '#fbbf24' })
      ]
    },
    templates: {
      title: 'Godot Templates',
      scene: 'Starter',
      scoreLabel: 'Coins',
      hint: 'Move the player with the arrow keys. Press Run to collect the coin.',
      script: 'player.gd',
      pickup: 'coin.gd',
      readme: ['# Godot Templates', '', 'Open project.godot in Godot 4, then open main.tscn.', 'Use the Timer to spawn a new coin next.', ''],
      nodes: [
        world(),
        node('player', 'Player', 'CharacterBody2D', 120, 180, { speed: 180, color: '#7dd3fc' }),
        node('sprite', 'Sprite2D', 'Sprite2D', 320, 180, { scale: 1, color: '#a78bfa' }),
        node('coin', 'Coin', 'Area2D', 470, 150, { radius: 12, color: '#fbbf24' }),
        node('timer', 'Timer', 'Timer', 560, 60)
      ]
    },
    modstudio: {
      title: 'Godot Mod Studio',
      scene: 'ModProject',
      scoreLabel: 'Pickups',
      hint: 'Move the player with the arrow keys. Press Run to collect the pickup.',
      script: 'player.gd',
      pickup: 'pickup.gd',
      readme: ['# Godot Mod Studio', '', 'Open project.godot in Godot 4, then open main.tscn.', 'Add your modded sprite and a custom item next.', ''],
      nodes: [
        world(),
        node('player', 'Player', 'CharacterBody2D', 120, 180, { speed: 180, color: '#7dd3fc' }),
        node('sprite', 'Sprite2D', 'Sprite2D', 320, 180, { scale: 1, color: '#a78bfa' }),
        node('coin', 'Pickup', 'Area2D', 470, 150, { radius: 12, color: '#fbbf24' })
      ]
    }
  };

  var presetId = mount.getAttribute('data-ef-preset') || 'starter';
  var PRESET = PRESETS[presetId] || PRESETS.starter;

  var state = {
    nodes: [],
    selected: 'player',
    running: false,
    score: 0,
    nextId: 1
  };

  function resetState() {
    state.nodes = PRESET.nodes.map(function (n) {
      var copy = {};
      Object.keys(n).forEach(function (k) { copy[k] = n[k]; });
      copy.core = true;
      return copy;
    });
    state.selected = 'player';
    state.running = false;
    state.score = 0;
    state.nextId = 1;
  }
  resetState();

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nodeById(id) {
    for (var i = 0; i < state.nodes.length; i++) if (state.nodes[i].id === id) return state.nodes[i];
    return null;
  }
  function extraNodes() {
    return state.nodes.filter(function (n) {
      return n.id !== 'player' && n.id !== 'coin' && n.id !== 'ground' && n.id !== 'world';
    });
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function num(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : fallback;
  }

  var root = document.createElement('div');
  root.className = 'ef';
  root.innerHTML =
    '<div class="ef-titlebar">' +
      '<span class="ef-dots" aria-hidden="true"><span></span><span></span><span></span></span>' +
      '<span class="ef-title">Godot 4 - ' + esc(PRESET.title) + '</span>' +
      '<span class="ef-chip">Browser replica</span>' +
    '</div>' +
    '<div class="ef-body">' +
      '<aside class="ef-scene" aria-label="Scene tree">' +
        '<div class="ef-panel-head">Scene<span class="ef-spacer"></span><button type="button" class="ef-add" aria-expanded="false">+ Add node</button></div>' +
        '<div class="ef-add-menu" hidden></div>' +
        '<div class="ef-tree" role="tree" aria-label="Node tree"></div>' +
      '</aside>' +
      '<div class="ef-viewport">' +
        '<div class="ef-viewport-bar">' +
          '<span class="ef-tab active">2D</span>' +
          '<span class="ef-tab dim" aria-disabled="true">3D</span>' +
          '<span class="ef-tab dim" aria-disabled="true">Script</span>' +
          '<button type="button" class="ef-run" aria-pressed="false">Run</button>' +
        '</div>' +
        '<canvas class="ef-canvas" width="640" height="360" tabindex="0" aria-label="Godot 2D viewport. Click, then use the arrow keys to move the player."></canvas>' +
        '<p class="ef-hint">' + esc(PRESET.hint) + '</p>' +
      '</div>' +
      '<aside class="ef-inspector" aria-label="Inspector">' +
        '<div class="ef-panel-head">Inspector</div>' +
        '<div class="ef-fields"></div>' +
      '</aside>' +
      '<div class="ef-output">' +
        '<div class="ef-panel-head">Output</div>' +
        '<div class="ef-log" role="log" aria-live="polite"></div>' +
      '</div>' +
    '</div>' +
    '<div class="ef-actions">' +
      '<button type="button" class="ef-btn ef-btn--main ef-download">Download my Godot project</button>' +
      '<button type="button" class="ef-btn ef-copy">Copy my player script</button>' +
      '<button type="button" class="ef-btn ef-btn--ghost ef-reset">Reset scene</button>' +
      '<a class="ef-btn ef-btn--ghost ef-real" href="https://godotengine.org/download" target="_blank" rel="noopener">Open the real Godot</a>' +
      '<p class="ef-status" role="status" aria-live="polite"></p>' +
    '</div>';

  mount.appendChild(root);

  var treeEl = root.querySelector('.ef-tree');
  var addBtn = root.querySelector('.ef-add');
  var addMenu = root.querySelector('.ef-add-menu');
  var fieldsEl = root.querySelector('.ef-fields');
  var logEl = root.querySelector('.ef-log');
  var canvas = root.querySelector('.ef-canvas');
  var ctx = canvas.getContext('2d');
  var runBtn = root.querySelector('.ef-run');
  var statusEl = root.querySelector('.ef-status');
  var logLines = [];
  var keys = {};
  var lastTs = 0;

  function log(msg) {
    logLines.push(msg);
    if (logLines.length > 8) logLines.shift();
    logEl.innerHTML = logLines.map(function (line) {
      return '<div class="ef-log-line">' + esc(line) + '</div>';
    }).join('');
    logEl.scrollTop = logEl.scrollHeight;
  }
  function setStatus(msg) { statusEl.textContent = msg || ''; }

  function renderTree() {
    var rows = ['<button type="button" class="ef-node" role="treeitem" data-id="world" aria-selected="' +
      (state.selected === 'world') + '"><span class="ef-dot" style="background:' + TYPES.Node2D.color +
      '"></span>World<span class="ef-node-type">Node2D</span></button>'];
    state.nodes.forEach(function (n) {
      if (n.id === 'world') return;
      var t = TYPES[n.type] || TYPES.Node2D;
      rows.push('<button type="button" class="ef-node" role="treeitem" data-id="' + esc(n.id) +
        '" aria-selected="' + (state.selected === n.id) + '"><span class="ef-dot" style="background:' + t.color +
        '"></span>' + esc(n.name) + '<span class="ef-node-type">' + esc(n.type) + '</span></button>');
    });
    treeEl.innerHTML = rows.join('');
  }

  function field(label, control) {
    return '<label class="ef-field"><span>' + esc(label) + '</span>' + control + '</label>';
  }
  function textField(key, label, value) {
    return field(label, '<input type="text" data-key="' + key + '" value="' + esc(value) + '">');
  }
  function numberField(key, label, value, step) {
    return field(label, '<input type="number" data-key="' + key + '" value="' + esc(value) + '" step="' + (step || 1) + '">');
  }
  function colorField(key, label, value) {
    return field(label, '<input type="color" data-key="' + key + '" value="' + esc(value || '#7dd3fc') + '">');
  }

  function renderInspector() {
    var n = nodeById(state.selected) || nodeById('player');
    if (!n) { fieldsEl.innerHTML = '<p class="ef-hint">Select a node.</p>'; return; }
    var html = '<div class="ef-field"><span>Type</span><span class="ef-readonly">' + esc(n.type) + '</span></div>';
    html += textField('name', 'Name', n.name);
    html += numberField('x', 'Position X', Math.round(n.x));
    html += numberField('y', 'Position Y', Math.round(n.y));
    if (n.type === 'CharacterBody2D') {
      html += numberField('speed', 'Speed', n.speed == null ? 180 : n.speed);
      html += colorField('color', 'Colour', n.color);
    } else if (n.type === 'Area2D') {
      html += numberField('radius', 'Radius', n.radius == null ? 12 : n.radius);
      html += colorField('color', 'Colour', n.color);
    } else if (n.type === 'StaticBody2D') {
      html += numberField('width', 'Width', n.width == null ? 640 : n.width);
      html += numberField('height', 'Height', n.height == null ? 60 : n.height);
      html += colorField('color', 'Colour', n.color);
    } else if (n.type === 'Sprite2D') {
      html += numberField('scale', 'Scale', n.scale == null ? 1 : n.scale, 0.1);
      html += colorField('color', 'Colour', n.color || '#a78bfa');
    } else if (n.type === 'Timer') {
      html += numberField('wait', 'Wait time', n.wait == null ? 1 : n.wait, 0.1);
    } else if (n.type === 'Camera2D') {
      html += numberField('zoom', 'Zoom', n.zoom == null ? 1 : n.zoom, 0.1);
    } else if (n.type === 'Button') {
      html += textField('text', 'Text', n.text == null ? 'Start' : n.text);
    }
    var deletable = !n.core;
    html += '<button type="button" class="ef-delete" data-delete="' + esc(n.id) + '"' +
      (deletable ? '' : ' disabled title="Keep the starter nodes so the demo still runs"') + '>Delete node</button>';
    fieldsEl.innerHTML = html;
  }

  function draw() {
    var W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#101521');
    bg.addColorStop(1, '#0a0d14');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(255,255,255,.045)';
    ctx.lineWidth = 1;
    var gx, gy;
    for (gx = 0; gx <= W; gx += 32) {
      ctx.beginPath(); ctx.moveTo(gx + 0.5, 0); ctx.lineTo(gx + 0.5, H); ctx.stroke();
    }
    for (gy = 0; gy <= H; gy += 32) {
      ctx.beginPath(); ctx.moveTo(0, gy + 0.5); ctx.lineTo(W, gy + 0.5); ctx.stroke();
    }

    var ground = nodeById('ground');
    if (ground) {
      ctx.fillStyle = ground.color || '#4b5563';
      ctx.fillRect(ground.x, ground.y, ground.width || 640, ground.height || 60);
      ctx.fillStyle = 'rgba(255,255,255,.14)';
      ctx.fillRect(ground.x, ground.y, ground.width || 640, 3);
    }

    extraNodes().forEach(drawExtra);

    var coin = nodeById('coin');
    if (coin) {
      var r = coin.radius || 12;
      if (state.running) {
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, r + 7, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(251,191,36,.18)';
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, r, 0, Math.PI * 2);
      ctx.fillStyle = coin.color || '#fbbf24';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.28)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#3b2a00';
      ctx.font = '700 10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(PRESET.scoreLabel || 'Coin').slice(0, 1), coin.x, coin.y + 3);
      ctx.textAlign = 'left';
    }

    var player = nodeById('player');
    if (player) {
      ctx.fillStyle = player.color || '#7dd3fc';
      roundRect(ctx, player.x - 15, player.y - 15, 30, 30, 7);
      ctx.fill();
      ctx.fillStyle = 'rgba(8,18,30,.72)';
      ctx.fillRect(player.x - 8, player.y - 5, 5, 6);
      ctx.fillRect(player.x + 3, player.y - 5, 5, 6);
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.fillRect(player.x - 6, player.y + 5, 12, 2);
    }

    ctx.fillStyle = 'rgba(230,233,239,.72)';
    ctx.font = '700 12px Inter, system-ui, sans-serif';
    ctx.fillText('Godot 4 replica', 14, 22);
    ctx.fillStyle = state.running ? '#4ade80' : 'rgba(230,233,239,.5)';
    ctx.fillText(state.running ? 'Running' : 'Paused', 14, 40);
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'right';
    ctx.fillText((PRESET.scoreLabel || 'Score') + ': ' + state.score, W - 14, 22);
    ctx.textAlign = 'left';
  }

  function drawExtra(n) {
    var c = n.color || (TYPES[n.type] || TYPES.Node2D).color;
    ctx.save();
    if (n.type === 'Timer') {
      ctx.beginPath();
      ctx.arc(n.x, n.y, 13, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.fillStyle = '#2a0f1c';
      ctx.font = '800 10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('T', n.x, n.y + 3);
      ctx.textAlign = 'left';
    } else if (n.type === 'Camera2D') {
      ctx.beginPath();
      ctx.moveTo(n.x, n.y - 14);
      ctx.lineTo(n.x + 14, n.y);
      ctx.lineTo(n.x, n.y + 14);
      ctx.lineTo(n.x - 14, n.y);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
    } else if (n.type === 'Button') {
      ctx.fillStyle = c;
      roundRect(ctx, n.x - 38, n.y - 14, 76, 28, 7);
      ctx.fill();
      ctx.fillStyle = '#3a1600';
      ctx.font = '800 10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(n.text || 'Start').slice(0, 10), n.x, n.y + 3);
      ctx.textAlign = 'left';
    } else if (n.type === 'StaticBody2D') {
      ctx.fillStyle = c;
      ctx.fillRect(n.x, n.y, n.width || 80, n.height || 20);
    } else if (n.type === 'Area2D') {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius || 12, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (n.type === 'Node2D') {
      ctx.beginPath();
      ctx.arc(n.x, n.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
    } else {
      var s = 24 * (n.scale || 1);
      ctx.fillStyle = c;
      roundRect(ctx, n.x - s / 2, n.y - s / 2, s, s, 5);
      ctx.fill();
    }
    ctx.restore();
  }

  function roundRect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function movePlayer(dt) {
    var p = nodeById('player');
    if (!p) return;
    var speed = num(p.speed, 180);
    var dx = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
    var dy = (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0);
    if (!dx && !dy) return;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    p.x = clamp(p.x + dx / len * speed * dt, 18, canvas.width - 18);
    p.y = clamp(p.y + dy / len * speed * dt, 18, canvas.height - 18);
    renderInspector();
    if (state.running) {
      var coin = nodeById('coin');
      if (coin) {
        var dist = Math.sqrt(Math.pow(p.x - coin.x, 2) + Math.pow(p.y - coin.y, 2));
        if (dist < (coin.radius || 12) + 18) {
          state.score++;
          coin.x = 60 + Math.random() * (canvas.width - 120);
          coin.y = 60 + Math.random() * (canvas.height - 160);
          log('[' + (PRESET.scoreLabel || 'Pickup') + '] collected. Score ' + state.score);
          setStatus((PRESET.scoreLabel || 'Pickup') + ' collected. Score ' + state.score + '.');
        }
      }
    }
  }

  function loop(ts) {
    var dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
    lastTs = ts;
    movePlayer(dt);
    draw();
    window.requestAnimationFrame(loop);
  }

  function addNode(type) {
    if (ADDABLE.indexOf(type) === -1) return null;
    var n = { id: 'node_' + (state.nextId++), name: type.replace('2D', '') + ' ' + state.nextId, type: type, x: 320, y: 180 };
    if (type === 'CharacterBody2D') { n.speed = 180; n.color = '#7dd3fc'; }
    if (type === 'Area2D') { n.radius = 12; n.color = '#fbbf24'; }
    if (type === 'StaticBody2D') { n.width = 160; n.height = 24; n.color = '#4b5563'; }
    if (type === 'Sprite2D') { n.scale = 1; n.color = '#a78bfa'; }
    if (type === 'Timer') { n.wait = 1; }
    if (type === 'Camera2D') { n.zoom = 1; }
    if (type === 'Button') { n.text = 'Start'; }
    state.nodes.push(n);
    state.selected = n.id;
    renderTree();
    renderInspector();
    draw();
    log('[Scene] added ' + n.name + ' (' + n.type + ')');
    setStatus('Added ' + n.name + '. Change it in the Inspector.');
    return n.id;
  }

  function selectNode(id) {
    if (!nodeById(id)) return;
    state.selected = id;
    renderTree();
    renderInspector();
  }

  function deleteNode(id) {
    var n = nodeById(id);
    if (!n || n.core) return;
    state.nodes = state.nodes.filter(function (x) { return x.id !== id; });
    state.selected = 'player';
    renderTree();
    renderInspector();
    draw();
    log('[Scene] removed ' + n.name);
  }

  treeEl.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-id]');
    if (!btn) return;
    selectNode(btn.getAttribute('data-id'));
  });

  addBtn.addEventListener('click', function () {
    var open = addMenu.hidden;
    addMenu.hidden = !open;
    addBtn.setAttribute('aria-expanded', String(open));
  });

  addMenu.innerHTML = ADDABLE.map(function (t) {
    return '<button type="button" data-add="' + t + '">' + t + '</button>';
  }).join('');
  addMenu.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-add]');
    if (!btn) return;
    addNode(btn.getAttribute('data-add'));
    addMenu.hidden = true;
    addBtn.setAttribute('aria-expanded', 'false');
  });

  fieldsEl.addEventListener('input', function (e) {
    var input = e.target.closest('[data-key]');
    if (!input) return;
    var n = nodeById(state.selected);
    if (!n) return;
    var key = input.getAttribute('data-key');
    if (key === 'name') {
      n.name = input.value.slice(0, 24) || n.type;
      renderTree();
    } else if (key === 'text') {
      n.text = input.value.slice(0, 12);
    } else if (key === 'color') {
      n.color = input.value;
    } else {
      n[key] = num(input.value, n[key]);
    }
    draw();
  });

  fieldsEl.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-delete]');
    if (!btn) return;
    deleteNode(btn.getAttribute('data-delete'));
  });

  runBtn.addEventListener('click', function () {
    state.running = !state.running;
    runBtn.setAttribute('aria-pressed', String(state.running));
    runBtn.textContent = state.running ? 'Pause' : 'Run';
    log(state.running ? '[Game] running. Collect the ' + (PRESET.scoreLabel || 'pickup').toLowerCase() + '.' : '[Game] paused.');
    setStatus(state.running ? 'Running. Move with the arrow keys.' : 'Paused.');
    draw();
  });

  canvas.addEventListener('keydown', function (e) {
    if (e.key.indexOf('Arrow') === 0) {
      keys[e.key] = true;
      e.preventDefault();
    }
  });
  canvas.addEventListener('keyup', function (e) {
    if (e.key.indexOf('Arrow') === 0) {
      keys[e.key] = false;
      e.preventDefault();
    }
  });
  canvas.addEventListener('blur', function () { keys = {}; });
  canvas.addEventListener('click', function () { canvas.focus(); });

  root.querySelector('.ef-reset').addEventListener('click', function () {
    resetState();
    renderTree();
    renderInspector();
    draw();
    runBtn.setAttribute('aria-pressed', 'false');
    runBtn.textContent = 'Run';
    log('[Scene] reset to the ' + PRESET.title + ' starter nodes.');
    setStatus('Scene reset.');
  });

  /* ---------- real Godot project export ---------- */

  function safeName(s) {
    return String(s || 'Node').replace(/[^A-Za-z0-9 _-]/g, '').trim().slice(0, 32) || 'Node';
  }
  function sceneText() {
    var out = ['[gd_scene load_steps=2 format=3]', '', '[ext_resource type="Script" path="res://' + PRESET.script + '" id="1_player"]', ''];
    out.push('[node name="' + safeName(PRESET.scene) + '" type="Node2D"]');
    out.push('');
    state.nodes.forEach(function (n) {
      if (n.id === 'world') return;
      out.push('[node name="' + safeName(n.name) + '" type="' + n.type + '" parent="."]');
      out.push('position = Vector2(' + Math.round(n.x) + ', ' + Math.round(n.y) + ')');
      if (n.id === 'player') out.push('script = ExtResource("1_player")');
      out.push('');
    });
    return out.join('\n');
  }
  function playerScript() {
    var p = nodeById('player');
    var speed = p ? num(p.speed, 180) : 180;
    var extendsType = p ? p.type : 'CharacterBody2D';
    return [
      'extends ' + extendsType,
      '',
      '@export var speed := ' + speed + '.0',
      '',
      'func _physics_process(_delta: float) -> void:',
      '    var direction := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")',
      '    velocity = direction * speed',
      '    move_and_slide()',
      ''
    ].join('\n');
  }
  function pickupScript() {
    return [
      'extends Area2D',
      '',
      'signal collected',
      '',
      'func _ready() -> void:',
      '    body_entered.connect(_on_body_entered)',
      '',
      'func _on_body_entered(_body: Node2D) -> void:',
      '    collected.emit()',
      '    queue_free()',
      ''
    ].join('\n');
  }
  function projectFiles() {
    return [
      {
        name: 'project.godot',
        text: [
          'config_version=5',
          '',
          '[application]',
          'config/name="' + PRESET.title.replace(/"/g, '') + '"',
          'run/main_scene="res://main.tscn"',
          '',
          '[display]',
          'window/size/viewport_width=640',
          'window/size/viewport_height=360',
          'window/stretch/mode="canvas_items"',
          ''
        ].join('\n')
      },
      { name: 'main.tscn', text: sceneText() },
      { name: PRESET.script, text: playerScript() },
      { name: PRESET.pickup, text: pickupScript() },
      { name: 'README.md', text: (PRESET.readme || []).join('\n') + '\n' }
    ];
  }

  var CRC = (function () {
    var t = [], n, k, c;
    for (n = 0; n < 256; n++) {
      c = n;
      for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(b) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function u16(v) { return [v & 0xFF, (v >> 8) & 0xFF]; }
  function u32(v) { return [v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >>> 24) & 0xFF]; }
  function zip(files) {
    var enc = new TextEncoder(), chunks = [], central = [], off = 0;
    files.forEach(function (f) {
      var nb = enc.encode(f.name), data = enc.encode(f.text), crc = crc32(data);
      var loc = [].concat(u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(nb.length), u16(0));
      var h = new Uint8Array(loc.length + nb.length);
      h.set(loc, 0); h.set(nb, loc.length);
      chunks.push(h); chunks.push(data);
      var cd = [].concat(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(nb.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off));
      var cdh = new Uint8Array(cd.length + nb.length);
      cdh.set(cd, 0); cdh.set(nb, cd.length);
      central.push(cdh);
      off += h.length + data.length;
    });
    var cdSize = central.reduce(function (s, c) { return s + c.length; }, 0);
    var eocd = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdSize), u32(off), u16(0)));
    var total = chunks.reduce(function (s, c) { return s + c.length; }, 0) + cdSize + eocd.length;
    var out = new Uint8Array(total), p = 0;
    chunks.forEach(function (c) { out.set(c, p); p += c.length; });
    central.forEach(function (c) { out.set(c, p); p += c.length; });
    out.set(eocd, p);
    return out;
  }

  function download() {
    try {
      var blob = new Blob([zip(projectFiles())], { type: 'application/zip' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'my-first-godot-project.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
      log('[Export] my-first-godot-project.zip saved.');
      setStatus('Project saved. Open project.godot in Godot 4.');
    } catch (e) {
      setStatus('Could not build the zip. Copy the player script instead.');
    }
  }

  function copyScript() {
    var text = playerScript();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        setStatus('Player script copied.');
        log('[Script] ' + PRESET.script + ' copied.');
      }, function () { prompt('Copy your player script:', text); });
    } else {
      prompt('Copy your player script:', text);
    }
  }

  root.querySelector('.ef-download').addEventListener('click', download);
  root.querySelector('.ef-copy').addEventListener('click', copyScript);

  renderTree();
  renderInspector();
  log('[Godot] ' + PRESET.scene + ' ready. Select a node or press Run.');
  draw();
  window.requestAnimationFrame(loop);

  window.EngineFeel = {
    mount: mount,
    preset: presetId,
    state: function () {
      return {
        nodes: state.nodes.map(function (n) { return Object.assign({}, n); }),
        selected: state.selected,
        running: state.running,
        score: state.score
      };
    },
    addNode: addNode,
    selectNode: selectNode,
    deleteNode: deleteNode,
    step: function () { movePlayer(0.016); draw(); return window.EngineFeel.state(); },
    projectFiles: projectFiles,
    download: download,
    reset: function () {
      resetState();
      renderTree();
      renderInspector();
      draw();
    }
  };
})();
