/* ==========================================================================
   Tabletop Studio (A2960)

   No libraries. One canvas draws the board, small DOM buttons handle pieces
   so drag and drop stays reliable on touch screens.
   ========================================================================== */
(function () {
  'use strict';

  var STORE_KEY = 'jvds-tabletop-v1';
  var LIB_KEY = 'jvds-tabletop-v2';
  var MAX_BOARDS = 12;
  var CELL = 80;
  var MAX_DICE = 6;

  var PIECE_DEFS = [
    { id: 'meeple',   label: 'Player 1',   glyph: '🧍', color: '#BC4749' },
    { id: 'meeple-2', label: 'Player 2',   glyph: '🧍', color: '#3f6e71' },
    { id: 'meeple-3', label: 'Player 3',   glyph: '🧍', color: '#c98a2e' },
    { id: 'meeple-4', label: 'Player 4',   glyph: '🧍', color: '#7a5aa8' },
    { id: 'stardust', label: 'Stardust',   glyph: '✨', color: '#c98a2e', img: '/assets/mascots/stardust-badge.webp' },
    { id: 'lumo',     label: 'Lumo',       glyph: '🦊', color: '#7a5aa8', img: '/assets/mascots/lumo-badge.webp' },
    { id: 'ember',    label: 'Ember',      glyph: '🔥', color: '#BC4749', img: '/assets/mascots/ember-badge.webp' },
    { id: 'pip',      label: 'Pip',        glyph: '🐾', color: '#3f6e71', img: '/assets/mascots/pip-badge.webp' },
    { id: 'echo',     label: 'Echo',       glyph: '🪶', color: '#5E8C5A', img: '/assets/mascots/echo-badge.webp' },
    { id: 'barnaby',  label: 'Barnaby',    glyph: '🦊', color: '#b8956a', img: '/assets/mascots/barnaby-badge.webp' },
    { id: 'monster',  label: 'Monster',    glyph: '👾', color: '#7a5aa8' },
    { id: 'treasure', label: 'Treasure',   glyph: '💎', color: '#3f6e71' },
    { id: 'flag',     label: 'Flag',       glyph: '🚩', color: '#BC4749' },
    { id: 'tree',     label: 'Tree',       glyph: '🌳', color: '#5E8C5A' },
    { id: 'rock',     label: 'Rock',       glyph: '🪨', color: '#7d7566' },
    { id: 'star',     label: 'Star',       glyph: '⭐', color: '#c98a2e' },
    { id: 'castle',   label: 'Castle',     glyph: '🏰', color: '#b8956a' },
    { id: 'counter',  label: 'Counter',    glyph: '1',  color: '#c98a2e', counter: true }
  ];

  var TERRAIN = {
    grass:  { name: 'Meadow', color: '#8FBF6A', icon: '🌿' },
    water:  { name: 'Water',  color: '#6FA9C9', icon: '💧' },
    sand:   { name: 'Sand',   color: '#E3CD8F', icon: '🏖️' },
    forest: { name: 'Forest', color: '#5E8C5A', icon: '🌲' },
    stone:  { name: 'Stone',  color: '#B9B4A8', icon: '🪨' },
    path:   { name: 'Path',   color: '#C9A97D', icon: '🛤️' },
    lava:   { name: 'Lava',   color: '#D46A4A', icon: '🌋' },
    snow:   { name: 'Snow',   color: '#EDF2F4', icon: '❄️' },
    wall:   { name: 'Wall',   color: '#6B6257', icon: '🧱' }
  };

  var SUITS = [
    { glyph: '♠', color: '#1a1a1a', name: 'spades' },
    { glyph: '♥', color: '#BC4749', name: 'hearts' },
    { glyph: '♦', color: '#BC4749', name: 'diamonds' },
    { glyph: '♣', color: '#1a1a1a', name: 'clubs' }
  ];

  var RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var RANK_NAMES = { A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King' };
  var DICE = [4, 6, 8, 10, 12, 20];

  var cv = document.getElementById('ttBoard');
  var ctx = cv.getContext('2d');
  var stage = document.getElementById('ttStage');
  var scaleWrap = document.getElementById('ttScale');
  var tokensLayer = document.getElementById('ttTokens');
  var sidebar = document.getElementById('ttSidebar');
  var backdrop = document.getElementById('ttBackdrop');
  var sidebarOpen = document.getElementById('ttSidebarOpen');
  var statusEl = document.getElementById('ttStatus');
  var savedEl = document.getElementById('ttSaved');
  var toastEl = document.getElementById('ttToast');
  var announceEl = document.getElementById('ttAnnounce');
  var barHint = document.getElementById('ttBarHint');
  var emptyEl = document.getElementById('ttEmpty');
  var pieceBar = document.getElementById('ttPieceBar');
  var clearBtn = document.getElementById('ttClear');
  var undoBtn = document.getElementById('ttUndo');
  var redoBtn = document.getElementById('ttRedo');
  var rollBtn = document.getElementById('ttRoll');
  var diceStage = document.getElementById('ttDiceStage');
  var diceResult = document.getElementById('ttDiceResult');
  var diceHistory = document.getElementById('ttDiceHistory');
  var dieCountOut = document.getElementById('ttCount');
  var countDownBtn = document.getElementById('ttCountDown');
  var countUpBtn = document.getElementById('ttCountUp');
  var deckLeftEl = document.getElementById('ttDeckLeft');
  var flipBtn = document.getElementById('ttFlipBtn');
  var stepsEl = document.getElementById('ttSteps');
  var stepsClose = document.getElementById('ttStepsClose');
  var barResultEl = document.getElementById('ttBarResult');
  var quickRollBtn = document.getElementById('ttQuickRoll');
  var helpEl = document.getElementById('ttHelp');
  var helpBtn = document.getElementById('ttHelpBtn');
  var helpClose = document.getElementById('ttHelpClose');
  var helpStart = document.getElementById('ttHelpStart');
  var helpBackdrop = document.getElementById('ttHelpBackdrop');
  var valueDownBtn = document.getElementById('ttValueDown');
  var valueUpBtn = document.getElementById('ttValueUp');
  var cardList = document.getElementById('ttCardList');
  var libList = document.getElementById('ttLib');
  var libCount = document.getElementById('ttLibCount');
  var roundOut = document.getElementById('ttRound');
  var turnOut = document.getElementById('ttTurn');
  var turnChip = document.getElementById('ttTurnChip');
  var rulesInput = document.getElementById('ttRules');
  var zoomOutBtn = document.getElementById('ttZoomOut');
  var zoomInBtn = document.getElementById('ttZoomIn');
  var zoomFitBtn = document.getElementById('ttZoomFit');
  var zoomVal = document.getElementById('ttZoomVal');

  var S = blankState();
  var bgImg = null;
  var emptyDismissed = false;
  var hover = null;
  var kbCursor = { col: 0, row: 0 };
  var kbActive = false;
  var painting = false;
  var eraseStroke = false;
  var lastPaintCell = null;
  var tokDrag = null;
  var spawnDrag = null;
  var suppressClickUntil = 0;
  var undos = [];
  var redos = [];
  var clearArmed = false;
  var clearTimer = null;
  var toastTimer = null;
  var autosaveTimer = null;
  var dirty = false;
  var lastDrawReshuffled = false;
  var drawQueued = false;
  var zoom = 1;
  var pinch = null;
  var touchPointers = [];
  var rollOverlay = null;
  var spriteCache = {};

  var library = { v: 2, activeId: '', boards: [] };

  var dieSides = 6;
  var dieCount = 1;
  var rolling = false;
  var diceHistoryLog = [];
  var firstSteps = { paint: false, piece: false, roll: false, dismissed: false, celebrated: false };

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                       */
  /* ------------------------------------------------------------------ */

  function byId(id) {
    return document.getElementById(id);
  }

  function clamp(value, low, high) {
    return Math.min(high, Math.max(low, value));
  }

  function reduceMotion() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (err) {
      return false;
    }
  }

  function pieceDef(id) {
    for (var i = 0; i < PIECE_DEFS.length; i++) {
      if (PIECE_DEFS[i].id === id) return PIECE_DEFS[i];
    }
    return PIECE_DEFS[0];
  }

  function blankState() {
    var tiles = [];
    for (var i = 0; i < 12 * 9; i++) tiles.push(null);
    return {
      cols: 12,
      rows: 9,
      shape: 'square',
      name: '',
      tiles: tiles,
      bg: null,
      tokens: [],
      deck: makeDeck(),
      customCards: [],
      rules: '',
      turn: 1,
      round: 1,
      nextId: 1,
      mode: 'build',
      terrain: 'grass',
      brush: 1,
      tool: 'brush',
      snap: true,
      selectedId: 0
    };
  }

  function announce(message) {
    if (!announceEl) return;
    announceEl.textContent = '';
    window.setTimeout(function () {
      announceEl.textContent = message;
    }, 30);
  }

  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('is-on');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastEl.classList.remove('is-on');
    }, 2600);
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1500);
  }

  function safeName() {
    var raw = String(S.name || 'tabletop-board')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return raw.slice(0, 40) || 'tabletop-board';
  }

  /* ------------------------------------------------------------------ */
  /* Geometry                                                            */
  /* ------------------------------------------------------------------ */

  function hexMetrics() {
    var r = CELL * 0.5;
    return { r: r, w: Math.sqrt(3) * r, rowH: r * 1.5, margin: 12 };
  }

  function boardSize() {
    if (S.shape === 'hex') {
      var m = hexMetrics();
      return {
        W: Math.round(m.margin * 2 + S.cols * m.w + m.w / 2),
        H: Math.round(m.margin * 2 + m.r * 2 + (S.rows - 1) * m.rowH)
      };
    }
    return { W: S.cols * CELL, H: S.rows * CELL };
  }

  function hexCenter(col, row) {
    var m = hexMetrics();
    var offset = (row % 2) ? m.w / 2 : 0;
    return {
      x: m.margin + m.r + col * m.w + offset,
      y: m.margin + m.r + row * m.rowH
    };
  }

  function centerOf(col, row) {
    if (S.shape === 'square') {
      return { x: (col + 0.5) * CELL, y: (row + 0.5) * CELL };
    }
    return hexCenter(col, row);
  }

  function cellAt(x, y) {
    if (S.shape === 'square') {
      return {
        col: clamp(Math.floor(x / CELL), 0, S.cols - 1),
        row: clamp(Math.floor(y / CELL), 0, S.rows - 1)
      };
    }
    var best = { d: Infinity, col: 0, row: 0 };
    for (var row = 0; row < S.rows; row++) {
      for (var col = 0; col < S.cols; col++) {
        var c = hexCenter(col, row);
        var dx = c.x - x;
        var dy = c.y - y;
        var d = dx * dx + dy * dy;
        if (d < best.d) {
          best.d = d;
          best.col = col;
          best.row = row;
        }
      }
    }
    return { col: best.col, row: best.row };
  }

  function hexPath(context, cx, cy, r) {
    context.beginPath();
    for (var i = 0; i < 6; i++) {
      var angle = (Math.PI / 180) * (60 * i - 90);
      var x = cx + r * Math.cos(angle);
      var y = cy + r * Math.sin(angle);
      if (i === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
  }

  function roundRect(context, x, y, w, h, r) {
    var radius = Math.min(r, w / 2, h / 2);
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + w - radius, y);
    context.quadraticCurveTo(x + w, y, x + w, y + radius);
    context.lineTo(x + w, y + h - radius);
    context.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    context.lineTo(x + radius, y + h);
    context.quadraticCurveTo(x, y + h, x, y + h - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */

  function drawScene(context, W, H, withCursor) {
    context.clearRect(0, 0, W, H);

    context.fillStyle = '#F0EAD6';
    context.fillRect(0, 0, W, H);

    if (bgImg && bgImg.complete && bgImg.naturalWidth) {
      var scale = Math.max(W / bgImg.naturalWidth, H / bgImg.naturalHeight);
      var dw = bgImg.naturalWidth * scale;
      var dh = bgImg.naturalHeight * scale;
      context.drawImage(bgImg, (W - dw) / 2, (H - dh) / 2, dw, dh);
    }

    var col;
    var row;
    var t;
    var c;

    for (row = 0; row < S.rows; row++) {
      for (col = 0; col < S.cols; col++) {
        t = S.tiles[row * S.cols + col];
        if (!t || !TERRAIN[t]) continue;
        c = centerOf(col, row);
        if (S.shape === 'square') {
          roundRect(context, c.x - CELL / 2 + 3, c.y - CELL / 2 + 3, CELL - 6, CELL - 6, 9);
          context.fillStyle = TERRAIN[t].color;
          context.fill();
          context.strokeStyle = 'rgba(26,18,8,.10)';
          context.lineWidth = 1;
          context.stroke();
        } else {
          hexPath(context, c.x, c.y, hexMetrics().r - 2);
          context.fillStyle = TERRAIN[t].color;
          context.fill();
          context.strokeStyle = 'rgba(26,18,8,.10)';
          context.lineWidth = 1;
          context.stroke();
        }
      }
    }

    context.strokeStyle = 'rgba(64,59,51,.18)';
    context.lineWidth = 1;

    if (S.shape === 'square') {
      context.beginPath();
      for (col = 0; col <= S.cols; col++) {
        context.moveTo(col * CELL, 0);
        context.lineTo(col * CELL, H);
      }
      for (row = 0; row <= S.rows; row++) {
        context.moveTo(0, row * CELL);
        context.lineTo(W, row * CELL);
      }
      context.stroke();
    } else {
      var m = hexMetrics();
      for (row = 0; row < S.rows; row++) {
        for (col = 0; col < S.cols; col++) {
          c = hexCenter(col, row);
          hexPath(context, c.x, c.y, m.r);
          context.stroke();
        }
      }
    }

    if (withCursor && S.mode === 'build') {
      if (kbActive) outlineCell(context, kbCursor.col, kbCursor.row, '#BC4749', 3, [7, 5]);
      else if (hover) outlineCell(context, hover.col, hover.row, 'rgba(64,59,51,.55)', 2, []);
    }

    context.strokeStyle = 'rgba(64,59,51,.26)';
    context.lineWidth = 2;
    context.strokeRect(1, 1, W - 2, H - 2);
  }

  function outlineCell(context, col, row, colour, width, dash) {
    var c = centerOf(col, row);
    context.save();
    context.strokeStyle = colour;
    context.lineWidth = width;
    context.setLineDash(dash);
    if (S.shape === 'square') {
      context.strokeRect(c.x - CELL / 2 + 3, c.y - CELL / 2 + 3, CELL - 6, CELL - 6);
    } else {
      hexPath(context, c.x, c.y, hexMetrics().r - 3);
      context.stroke();
    }
    context.restore();
  }

  function drawBoard() {
    var size = boardSize();
    if (cv.width !== size.W || cv.height !== size.H) {
      cv.width = size.W;
      cv.height = size.H;
    }
    drawScene(ctx, size.W, size.H, true);
  }

  function scheduleDraw() {
    if (drawQueued) return;
    drawQueued = true;
    window.requestAnimationFrame(function () {
      drawQueued = false;
      drawBoard();
    });
  }

  function renderAll() {
    drawBoard();
    renderTokens();
    layoutTokens();
    updateEmptyState();
    updateDeckLabel();
    updateStatus();
    updatePieceBar();
    updateHistoryButtons();
    updatePlayAids();
    renderCardList();
    renderLibrary();
  }

  /* ------------------------------------------------------------------ */
  /* Tokens                                                              */
  /* ------------------------------------------------------------------ */

  function tokenById(id) {
    for (var i = 0; i < S.tokens.length; i++) {
      if (S.tokens[i].id === id) return S.tokens[i];
    }
    return null;
  }

  function posLabel(t) {
    var cell = cellAt(t.x, t.y);
    return 'row ' + (cell.row + 1) + ', column ' + (cell.col + 1);
  }

  function cardLabel(t) {
    if (t.card && t.card.name) {
      return t.card.text ? '“' + t.card.name + '”, ' + t.card.text : '“' + t.card.name + '”';
    }
    var rank = RANK_NAMES[t.r] || String(t.r + 1);
    return rank + ' of ' + SUITS[t.s].name;
  }

  function cardFaceText(t) {
    if (t.card) {
      if (t.card.icon) return t.card.icon;
      var name = String(t.card.name || 'Card');
      return name.charAt(0).toUpperCase();
    }
    return RANKS[t.r] + SUITS[t.s].glyph;
  }

  function cardBorder(t) {
    return t.card && t.card.color ? t.card.color : SUITS[t.s].color;
  }

  function tokenLabel(t) {
    if (t.type === 'card') {
      return (t.faceDown ? 'Face down card' : 'Card ' + cardLabel(t)) + ', ' + posLabel(t);
    }
    var def = pieceDef(t.kind);
    if (def.counter) return def.label + ' ' + (t.value || 1) + ', ' + posLabel(t);
    return def.label + ', ' + posLabel(t);
  }

  function applyTokenFace(btn, t) {
    var def = t.type === 'card' ? null : pieceDef(t.kind);
    btn.classList.toggle('tt-token--char', !!(def && def.img));
    btn.classList.toggle('tt-token--custom', !!(t.type === 'card' && t.card));
    btn.classList.toggle('tt-token--counter', !!(def && def.counter));
    btn.classList.toggle('is-down', t.type === 'card' && !!t.faceDown);

    var colour = t.type === 'card' ? cardBorder(t) : def.color;
    btn.style.setProperty('--tc', colour);
    if (t.type === 'card') {
      btn.style.color = t.faceDown ? '#fff' : colour;
    }

    btn.textContent = '';

    if (def && def.img) {
      var img = document.createElement('img');
      img.className = 'tt-token-img';
      img.src = def.img;
      img.alt = '';
      img.loading = 'lazy';
      img.width = 64;
      img.height = 64;
      btn.appendChild(img);
      return;
    }

    var glyph = document.createElement('span');
    glyph.className = 'tt-token-glyph';
    glyph.setAttribute('aria-hidden', 'true');
    if (t.type === 'card') {
      glyph.textContent = t.faceDown ? '★' : cardFaceText(t);
    } else if (def.counter) {
      glyph.textContent = String(t.value || 1);
    } else {
      glyph.textContent = def.glyph;
    }
    btn.appendChild(glyph);
  }

  function buildTokenElement(t) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tt-token' + (t.type === 'card' ? ' tt-token--card' : '');
    btn.dataset.id = String(t.id);
    btn.style.left = (t.x / boardSize().W * 100) + '%';
    btn.style.top = (t.y / boardSize().H * 100) + '%';
    btn.style.transform = 'translate(-50%,-50%) rotate(' + (t.rot || 0) + 'deg) scale(' + (t.scale || 1) + ')';
    btn.setAttribute('aria-label', tokenLabel(t));

    applyTokenFace(btn, t);

    if (t.id === S.selectedId) btn.classList.add('is-selected');
    return btn;
  }

  function renderTokens() {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < S.tokens.length; i++) {
      frag.appendChild(buildTokenElement(S.tokens[i]));
    }
    tokensLayer.textContent = '';
    tokensLayer.appendChild(frag);
  }

  function updateTokenElement(t) {
    var el = tokensLayer.querySelector('.tt-token[data-id="' + t.id + '"]');
    if (!el) return;
    el.style.left = (t.x / boardSize().W * 100) + '%';
    el.style.top = (t.y / boardSize().H * 100) + '%';
    el.style.transform = 'translate(-50%,-50%) rotate(' + (t.rot || 0) + 'deg) scale(' + (t.scale || 1) + ')';
    el.setAttribute('aria-label', tokenLabel(t));
    applyTokenFace(el, t);
  }

  function layoutTokens() {
    var width = scaleWrap ? scaleWrap.clientWidth : 0;
    if (!width) width = stage.getBoundingClientRect().width;
    if (!width) return;
    var cellPx = width / S.cols;
    var tok = clamp(cellPx * 0.8, 24, 74);
    tokensLayer.style.setProperty('--tok', tok + 'px');
    for (var i = 0; i < S.tokens.length; i++) updateTokenElement(S.tokens[i]);
  }

  function freeSpot() {
    var cx = Math.floor(S.cols / 2);
    var cy = Math.floor(S.rows / 2);
    var limit = Math.max(S.cols, S.rows);
    for (var radius = 0; radius <= limit; radius++) {
      for (var dr = -radius; dr <= radius; dr++) {
        for (var dc = -radius; dc <= radius; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
          var col = cx + dc;
          var row = cy + dr;
          if (col < 0 || row < 0 || col >= S.cols || row >= S.rows) continue;
          var c = centerOf(col, row);
          var taken = false;
          for (var i = 0; i < S.tokens.length; i++) {
            if (Math.hypot(S.tokens[i].x - c.x, S.tokens[i].y - c.y) < CELL * 0.5) {
              taken = true;
              break;
            }
          }
          if (!taken) return c;
        }
      }
    }
    return centerOf(cx, cy);
  }

  function addPiece(kind, x, y) {
    var def = pieceDef(kind);
    var t = {
      id: S.nextId++,
      type: 'piece',
      kind: def.id,
      x: x,
      y: y,
      rot: 0,
      scale: 1
    };
    if (def.counter) t.value = 1;
    S.tokens.push(t);
    return t;
  }

  function addCard(x, y) {
    var card = drawFromDeck();
    var t = {
      id: S.nextId++,
      type: 'card',
      x: x,
      y: y,
      rot: (Math.random() * 12) - 6,
      scale: 1,
      faceDown: false
    };
    if (card && card.c) {
      var template = customCardById(card.c);
      t.card = template ? cloneCustomCard(template) : { id: card.c, name: 'My card', text: '', icon: '★', color: '#BC4749' };
    } else if (card) {
      t.r = card.r;
      t.s = card.s;
    }
    S.tokens.push(t);
    return t;
  }

  function spawnPiece(kind) {
    var spot = freeSpot();
    pushUndo();
    var t = addPiece(kind, spot.x, spot.y);
    renderTokens();
    layoutTokens();
    hideEmpty();
    markDirty();
    selectToken(t.id);
    markStep('piece');
    toast(pieceDef(kind).label + ' placed.');
    announce(pieceDef(kind).label + ' placed on ' + posLabel(t) + '.');
  }

  function spawnCard() {
    var spot = freeSpot();
    pushUndo();
    var t = addCard(spot.x, spot.y);
    renderTokens();
    layoutTokens();
    hideEmpty();
    markDirty();
    updateDeckLabel();
    selectToken(t.id);
    markStep('piece');
    var prefix = lastDrawReshuffled ? 'Deck reshuffled. ' : '';
    toast(prefix + 'You drew the ' + cardLabel(t) + '.');
    announce(prefix + 'Drew the ' + cardLabel(t) + '.');
  }

  function selectToken(id) {
    S.selectedId = id;
    var nodes = tokensLayer.querySelectorAll('.tt-token');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.toggle('is-selected', Number(nodes[i].dataset.id) === id);
    }
    updatePieceBar();
  }

  function deselect() {
    S.selectedId = 0;
    var nodes = tokensLayer.querySelectorAll('.tt-token.is-selected');
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove('is-selected');
    updatePieceBar();
  }

  function updatePieceBar() {
    var t = tokenById(S.selectedId);
    pieceBar.hidden = !t;
    var def = t && t.type === 'piece' ? pieceDef(t.kind) : null;
    var isCounter = !!(def && def.counter);
    if (t) flipBtn.hidden = t.type !== 'card';
    if (valueDownBtn) valueDownBtn.hidden = !isCounter;
    if (valueUpBtn) valueUpBtn.hidden = !isCounter;
  }

  function flipToken(t) {
    pushUndo();
    t.faceDown = !t.faceDown;
    updateTokenElement(t);
    markDirty();
    announce(t.faceDown ? 'Card turned face down.' : 'Card turned face up: ' + cardLabel(t) + '.');
  }

  function nudgeToken(t, dx, dy) {
    pushUndo();
    var cell = cellAt(t.x, t.y);
    var col = clamp(cell.col + dx, 0, S.cols - 1);
    var row = clamp(cell.row + dy, 0, S.rows - 1);
    var c = centerOf(col, row);
    t.x = c.x;
    t.y = c.y;
    updateTokenElement(t);
    markDirty();
    announce(tokenLabel(t));
  }

  function removeToken(t) {
    pushUndo();
    S.tokens = S.tokens.filter(function (x) { return x.id !== t.id; });
    if (t.type === 'card') {
      if (!Array.isArray(S.deck)) S.deck = [];
      if (t.card) {
        if (customCardById(t.card.id)) S.deck.push({ c: t.card.id });
      } else {
        S.deck.push({ r: t.r, s: t.s });
      }
    }
    if (S.selectedId === t.id) S.selectedId = 0;
    renderTokens();
    markDirty();
    updateDeckLabel();
    updatePieceBar();
    announce(t.type === 'card' ? 'Card returned to the deck.' : 'Piece removed.');
  }

  /* ------------------------------------------------------------------ */
  /* Cards                                                               */
  /* ------------------------------------------------------------------ */

  function sanitiseCustomCard(c) {
    if (!c || typeof c !== 'object') return null;
    var name = typeof c.name === 'string' ? c.name.trim().slice(0, 24) : '';
    if (!name) return null;
    var text = typeof c.text === 'string' ? c.text.trim().slice(0, 60) : '';
    var icon = typeof c.icon === 'string' ? c.icon.slice(0, 4) : '';
    var color = typeof c.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(c.color) ? c.color : '#BC4749';
    var id = typeof c.id === 'string' && c.id ? c.id.slice(0, 40) : '';
    if (!id) return null;
    return { id: id, name: name, text: text, icon: icon, color: color };
  }

  function cloneCustomCard(c) {
    return { id: c.id, name: c.name, text: c.text, icon: c.icon, color: c.color };
  }

  function customCardById(id) {
    if (!Array.isArray(S.customCards)) return null;
    for (var i = 0; i < S.customCards.length; i++) {
      if (S.customCards[i].id === id) return S.customCards[i];
    }
    return null;
  }

  function makeDeck() {
    var deck = [];
    for (var s = 0; s < SUITS.length; s++) {
      for (var r = 0; r < RANKS.length; r++) deck.push({ r: r, s: s });
    }
    var custom = (S && Array.isArray(S.customCards)) ? S.customCards : [];
    custom.forEach(function (c) { deck.push({ c: c.id }); });
    for (var i = deck.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = deck[i];
      deck[i] = deck[j];
      deck[j] = tmp;
    }
    return deck;
  }

  function drawFromDeck() {
    lastDrawReshuffled = false;
    if (!Array.isArray(S.deck) || S.deck.length === 0) {
      S.deck = makeDeck();
      lastDrawReshuffled = true;
    }
    return S.deck.pop();
  }

  function updateDeckLabel() {
    var n = Array.isArray(S.deck) ? S.deck.length : 52;
    var custom = Array.isArray(S.customCards) ? S.customCards.length : 0;
    var suffix = custom ? ' (' + custom + ' of your own)' : '';
    deckLeftEl.textContent = n === 0
      ? 'Deck empty. Draw a card to reshuffle.'
      : n + ' cards left' + suffix + '. Tap a card on the board to flip it.';
  }

  function renderCardList() {
    if (!cardList) return;
    cardList.textContent = '';
    (S.customCards || []).forEach(function (c) {
      var row = document.createElement('div');
      row.className = 'tt-card-row';
      row.setAttribute('role', 'listitem');
      var chip = document.createElement('span');
      chip.className = 'tt-card-chip';
      chip.style.setProperty('--tc', c.color);
      chip.textContent = c.icon || '★';
      var name = document.createElement('span');
      name.className = 'tt-card-row-name';
      name.textContent = c.name;
      var text = document.createElement('span');
      text.className = 'tt-card-row-text';
      text.textContent = c.text || '';
      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'tt-card-del';
      del.dataset.cardDelete = c.id;
      del.setAttribute('aria-label', 'Remove ' + c.name + ' from the deck');
      del.textContent = '✕';
      row.appendChild(chip);
      row.appendChild(name);
      row.appendChild(del);
      row.appendChild(text);
      cardList.appendChild(row);
    });
  }

  function onCardAdd() {
    var nameEl = byId('ttCardName');
    var textEl = byId('ttCardText');
    var iconEl = byId('ttCardIcon');
    var colorEl = byId('ttCardColor');
    var name = nameEl ? nameEl.value.trim() : '';
    if (!name) {
      toast('Give your card a name first.');
      if (nameEl) nameEl.focus();
      return;
    }
    var card = sanitiseCustomCard({
      id: 'cc-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 9999),
      name: name,
      text: textEl ? textEl.value : '',
      icon: iconEl ? iconEl.value : '★',
      color: colorEl ? colorEl.value : '#BC4749'
    });
    if (!card) return;
    if (S.customCards.length >= 20) {
      toast('That is plenty of cards for one deck. Remove one first.');
      return;
    }
    pushUndo();
    S.customCards.push(card);
    S.deck.push({ c: card.id });
    if (nameEl) nameEl.value = '';
    if (textEl) textEl.value = '';
    hideEmpty();
    renderCardList();
    updateDeckLabel();
    markDirty();
    toast('“' + card.name + '” added to the deck.');
    announce('Added ' + card.name + ' to the deck. Draw a card to place it.');
  }

  function onCardDelete(event) {
    var btn = event.target.closest('[data-card-delete]');
    if (!btn) return;
    var id = btn.dataset.cardDelete;
    var card = customCardById(id);
    pushUndo();
    S.customCards = S.customCards.filter(function (c) { return c.id !== id; });
    S.deck = S.deck.filter(function (c) { return !c || c.c !== id; });
    renderCardList();
    updateDeckLabel();
    markDirty();
    var label = card ? card.name : 'Card';
    toast(label + ' removed from the deck.');
  }

  /* ------------------------------------------------------------------ */
  /* Painting                                                            */
  /* ------------------------------------------------------------------ */

  function hexNeighbours(col, row) {
    var offsets = (row % 2)
      ? [[1, 0], [-1, 0], [1, -1], [0, -1], [1, 1], [0, 1]]
      : [[1, 0], [-1, 0], [0, -1], [-1, -1], [0, 1], [-1, 1]];
    return offsets.map(function (o) {
      return { col: col + o[0], row: row + o[1] };
    });
  }

  function paintCell(col, row, terrain) {
    var value = (terrain === 'erase') ? null : terrain;
    if (S.shape === 'hex' && S.brush === 3) {
      setTileAt(col, row, value);
      hexNeighbours(col, row).forEach(function (n) {
        setTileAt(n.col, n.row, value);
      });
      return;
    }
    var spread = (S.shape === 'square' && S.brush === 3) ? 1 : 0;
    for (var dr = -spread; dr <= spread; dr++) {
      for (var dc = -spread; dc <= spread; dc++) {
        var c = col + dc;
        var r = row + dr;
        if (c < 0 || r < 0 || c >= S.cols || r >= S.rows) continue;
        S.tiles[r * S.cols + c] = value;
      }
    }
  }

  function floodFill(startCol, startRow, terrain) {
    if (startCol < 0 || startRow < 0 || startCol >= S.cols || startRow >= S.rows) return;
    var value = (terrain === 'erase') ? null : terrain;
    var start = S.tiles[startRow * S.cols + startCol];
    if (start === value) return;
    var stack = [{ col: startCol, row: startRow }];
    var seen = {};
    while (stack.length) {
      var cell = stack.pop();
      if (cell.col < 0 || cell.row < 0 || cell.col >= S.cols || cell.row >= S.rows) continue;
      var index = cell.row * S.cols + cell.col;
      if (seen[index]) continue;
      seen[index] = true;
      if (S.tiles[index] !== start) continue;
      S.tiles[index] = value;
      if (S.shape === 'hex') {
        hexNeighbours(cell.col, cell.row).forEach(function (n) { stack.push(n); });
      } else {
        stack.push(
          { col: cell.col + 1, row: cell.row },
          { col: cell.col - 1, row: cell.row },
          { col: cell.col, row: cell.row + 1 },
          { col: cell.col, row: cell.row - 1 }
        );
      }
    }
  }

  function paintLine(a, b, terrain) {
    var x0 = a.col;
    var y0 = a.row;
    var x1 = b.col;
    var y1 = b.row;
    var dx = Math.abs(x1 - x0);
    var dy = Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1;
    var sy = y0 < y1 ? 1 : -1;
    var err = dx - dy;
    var guard = 0;

    while (guard++ < 400) {
      paintCell(x0, y0, terrain);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  function pointerCell(event) {
    var rect = cv.getBoundingClientRect();
    var size = boardSize();
    var x = (event.clientX - rect.left) * (size.W / rect.width);
    var y = (event.clientY - rect.top) * (size.H / rect.height);
    return cellAt(x, y);
  }

  function applyPaint(cell, erase) {
    var terrain = erase ? 'erase' : S.terrain;
    if (S.tool === 'fill') {
      floodFill(cell.col, cell.row, terrain);
      lastPaintCell = null;
    } else if (lastPaintCell) {
      paintLine(lastPaintCell, cell, terrain);
      lastPaintCell = cell;
    } else {
      paintCell(cell.col, cell.row, terrain);
      lastPaintCell = cell;
    }
    hideEmpty();
    markStep('paint');
    scheduleDraw();
  }

  /* ------------------------------------------------------------------ */
  /* Undo and save                                                       */
  /* ------------------------------------------------------------------ */

  function snapshot() {
    return {
      cols: S.cols,
      rows: S.rows,
      shape: S.shape,
      name: S.name,
      tiles: S.tiles.slice(),
      bg: S.bg,
      rules: S.rules || '',
      turn: S.turn || 1,
      round: S.round || 1,
      customCards: (S.customCards || []).map(cloneCustomCard),
      tokens: S.tokens.map(function (t) {
        var copy = {};
        for (var k in t) {
          if (Object.prototype.hasOwnProperty.call(t, k)) copy[k] = t[k];
        }
        if (t.card) copy.card = cloneCustomCard(t.card);
        return copy;
      }),
      deck: (S.deck || []).map(function (c) {
        return c && c.c ? { c: c.c } : { r: c.r, s: c.s };
      }),
      nextId: S.nextId
    };
  }

  function pushUndo() {
    pushUndoSnapshot(snapshot());
  }

  function pushUndoSnapshot(snap) {
    undos.push(snap);
    if (undos.length > 30) undos.shift();
    redos.length = 0;
    updateHistoryButtons();
  }

  function restore(snap) {
    S.cols = snap.cols;
    S.rows = snap.rows;
    S.shape = snap.shape;
    S.name = typeof snap.name === 'string' ? snap.name : '';
    S.tiles = snap.tiles.slice();
    S.bg = snap.bg;
    S.rules = typeof snap.rules === 'string' ? snap.rules : '';
    S.turn = clamp(Number(snap.turn) || 1, 1, 99);
    S.round = clamp(Number(snap.round) || 1, 1, 99);
    S.customCards = (snap.customCards || []).map(cloneCustomCard);
    S.tokens = snap.tokens.map(function (t) {
      var copy = {};
      for (var k in t) {
        if (Object.prototype.hasOwnProperty.call(t, k)) copy[k] = t[k];
      }
      if (t.card) copy.card = cloneCustomCard(t.card);
      return copy;
    });
    S.deck = (snap.deck || []).map(function (c) {
      return c && c.c ? { c: c.c } : { r: c.r, s: c.s };
    });
    S.nextId = snap.nextId;
    S.selectedId = 0;
    hover = null;
    kbCursor = { col: 0, row: 0 };
    kbActive = false;
    setBgImage(S.bg);
    syncControls();
    renderAll();
  }

  function undo() {
    if (!undos.length) {
      toast('Nothing to undo yet.');
      return;
    }
    redos.push(snapshot());
    if (redos.length > 30) redos.shift();
    restore(undos.pop());
    markDirty();
    updateHistoryButtons();
    toast('Undone.');
    announce('Undone.');
  }

  function redo() {
    if (!redos.length) {
      toast('Nothing to redo yet.');
      return;
    }
    undos.push(snapshot());
    if (undos.length > 30) undos.shift();
    restore(redos.pop());
    markDirty();
    updateHistoryButtons();
    toast('Redone.');
    announce('Redone.');
  }

  function updateHistoryButtons() {
    if (undoBtn) undoBtn.disabled = undos.length === 0;
    if (redoBtn) redoBtn.disabled = redos.length === 0;
  }

  function markDirty() {
    dirty = true;
    updateSaveState('Tap Save', true);
    scheduleAutosave();
  }

  function scheduleAutosave() {
    window.clearTimeout(autosaveTimer);
    autosaveTimer = window.setTimeout(function () {
      if (!dirty) return;
      saveBoard(true);
    }, 1500);
  }

  function updateSaveState(text, isDirty) {
    if (!savedEl) return;
    savedEl.textContent = text;
    savedEl.classList.toggle('is-dirty', !!isDirty);
  }

  function newBoardId() {
    return 'b-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 9999).toString(36);
  }

  function activeBoard() {
    for (var i = 0; i < library.boards.length; i++) {
      if (library.boards[i].id === library.activeId) return library.boards[i];
    }
    return null;
  }

  function writeLibrary() {
    try {
      localStorage.setItem(LIB_KEY, JSON.stringify(library));
      return true;
    } catch (err) {
      return false;
    }
  }

  function loadLibrary() {
    var raw = null;
    try { raw = localStorage.getItem(LIB_KEY); } catch (err) { raw = null; }
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.boards) && parsed.boards.length) {
          library.boards = parsed.boards.filter(function (b) {
            return b && typeof b.id === 'string' && b.data && Array.isArray(b.data.tiles);
          });
          if (library.boards.length) {
            library.activeId = library.boards.some(function (b) { return b.id === parsed.activeId; })
              ? parsed.activeId
              : library.boards[0].id;
            return true;
          }
        }
      } catch (err) { /* fall through to the old single-board save */ }
    }

    try {
      var legacy = localStorage.getItem(STORE_KEY);
      if (legacy) {
        var data = JSON.parse(legacy);
        if (data && Array.isArray(data.tiles)) {
          var id = newBoardId();
          library = {
            v: 2,
            activeId: id,
            boards: [{
              id: id,
              name: String(data.name || 'My board').slice(0, 40) || 'My board',
              updated: Date.now(),
              data: data
            }]
          };
          writeLibrary();
          return true;
        }
      }
    } catch (err) { /* no migration possible */ }

    return false;
  }

  function boardPayload() {
    var payload = snapshot();
    payload.v = 2;
    payload.savedAt = Date.now();
    payload.name = S.name;
    payload.mode = S.mode;
    payload.terrain = S.terrain;
    payload.brush = S.brush;
    payload.tool = S.tool;
    payload.snap = S.snap;
    payload.selectedId = 0;
    return payload;
  }

  function saveBoard(quiet) {
    try {
      var payload = boardPayload();
      var board = activeBoard();
      if (!board) {
        board = { id: newBoardId(), name: 'My board', updated: Date.now(), data: payload };
        library.boards.unshift(board);
        library.activeId = board.id;
      }
      board.name = String(S.name || board.name || 'My board').slice(0, 40) || 'My board';
      board.updated = Date.now();
      board.data = payload;

      if (!writeLibrary()) throw new Error('storage full');
      try { localStorage.setItem(STORE_KEY, JSON.stringify(payload)); } catch (err) { /* My Stuff mirror is optional */ }

      dirty = false;
      window.clearTimeout(autosaveTimer);
      updateSaveState(quiet ? 'Autosaved' : 'Saved just now', false);
      if (!quiet) {
        toast('Saved to this browser.');
        announce('Board saved to this browser.');
        if (window.ToolAnalytics) {
          try { ToolAnalytics.event('board_saved', 'manual'); } catch (err) { /* analytics is optional */ }
        }
      }
      return true;
    } catch (err) {
      toast('Could not save. Browser storage may be full.');
      return false;
    }
  }

  function loadBoard() {
    var board = activeBoard();
    if (!board || !board.data) return false;
    return applyBoardData(board.data);
  }

  function formatWhen(ts) {
    if (!ts) return 'Not saved yet';
    var diff = Date.now() - ts;
    if (diff < 60000) return 'Saved just now';
    if (diff < 86400000) return 'Saved today';
    try {
      return 'Saved ' + new Date(ts).toLocaleDateString();
    } catch (err) {
      return 'Saved';
    }
  }

  function renderLibrary() {
    if (!libList) return;
    libList.textContent = '';
    library.boards.forEach(function (board) {
      var row = document.createElement('div');
      row.className = 'tt-lib-row' + (board.id === library.activeId ? ' is-active' : '');

      var open = document.createElement('button');
      open.type = 'button';
      open.className = 'tt-lib-open';
      open.dataset.boardOpen = board.id;
      open.setAttribute('aria-current', board.id === library.activeId ? 'true' : 'false');

      var name = document.createElement('span');
      name.className = 'tt-lib-name';
      name.textContent = board.name || 'Untitled board';
      var meta = document.createElement('span');
      meta.className = 'tt-lib-meta';
      var d = board.data || {};
      meta.textContent = (d.cols || '?') + '×' + (d.rows || '?') +
        ' · ' + (Array.isArray(d.tokens) ? d.tokens.length : 0) + ' pieces · ' + formatWhen(board.updated);
      open.appendChild(name);
      open.appendChild(meta);

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'tt-lib-del';
      del.dataset.boardDelete = board.id;
      del.setAttribute('aria-label', 'Delete ' + (board.name || 'board'));
      del.textContent = '✕';

      row.appendChild(open);
      row.appendChild(del);
      libList.appendChild(row);
    });
    if (libCount) libCount.textContent = String(library.boards.length);
  }

  function resetToBlank() {
    S = blankState();
    bgImg = null;
    hover = null;
    kbCursor = { col: 0, row: 0 };
    kbActive = false;
    emptyDismissed = false;
    firstSteps = { paint: false, piece: false, roll: false, dismissed: false, celebrated: false };
    zoom = 1;
    applyZoom(1);
  }

  function openBoard(id) {
    if (!id || id === library.activeId) return;
    var target = null;
    library.boards.forEach(function (b) { if (b.id === id) target = b; });
    if (!target || !target.data) return;
    saveBoard(true);
    library.activeId = id;
    writeLibrary();
    if (!applyBoardData(target.data)) {
      toast('That board could not be opened.');
      return;
    }
    emptyDismissed = true;
    firstSteps.dismissed = true;
    setBgImage(S.bg);
    syncControls();
    renderAll();
    updateSaveState('Saved', false);
    toast('Opened “' + (target.name || 'board') + '”.');
    announce('Opened ' + (target.name || 'board') + '.');
  }

  function newBoard() {
    saveBoard(true);
    if (library.boards.length >= MAX_BOARDS) {
      toast('You have ' + MAX_BOARDS + ' boards. Delete one before making another.');
      return;
    }
    resetToBlank();
    var board = { id: newBoardId(), name: 'New board', updated: Date.now(), data: null };
    library.boards.unshift(board);
    library.activeId = board.id;
    syncControls();
    renderAll();
    setBgImage(null);
    saveBoard(true);
    renderLibrary();
    updateSaveState('Saved', false);
    closeSidebar();
    toast('New board ready. Give it a name in Board.');
    announce('New blank board ready.');
  }

  function duplicateBoard() {
    saveBoard(true);
    var src = activeBoard();
    if (!src || !src.data) {
      toast('Save the board first.');
      return;
    }
    if (library.boards.length >= MAX_BOARDS) {
      toast('You have ' + MAX_BOARDS + ' boards. Delete one before copying.');
      return;
    }
    var copy;
    try {
      copy = JSON.parse(JSON.stringify(src.data));
    } catch (err) {
      toast('That board could not be copied.');
      return;
    }
    copy.name = String(src.name || 'Board').slice(0, 33) + ' copy';
    var board = { id: newBoardId(), name: copy.name, updated: Date.now(), data: copy };
    library.boards.unshift(board);
    library.activeId = board.id;
    applyBoardData(copy);
    emptyDismissed = true;
    firstSteps.dismissed = true;
    setBgImage(S.bg);
    syncControls();
    renderAll();
    saveBoard(true);
    renderLibrary();
    updateSaveState('Saved', false);
    toast('Copied “' + (src.name || 'board') + '”.');
  }

  function deleteBoard(id) {
    var target = null;
    library.boards.forEach(function (b) { if (b.id === id) target = b; });
    if (!target) return;
    if (library.boards.length <= 1) {
      clearBoard();
      saveBoard(true);
      toast('That was your only board, so it was cleared.');
      return;
    }
    var label = target.name || 'this board';
    if (!window.confirm('Delete “' + label + '”? This cannot be undone.')) return;
    library.boards = library.boards.filter(function (b) { return b.id !== id; });
    if (library.activeId === id) {
      library.activeId = library.boards[0].id;
      applyBoardData(library.boards[0].data);
      emptyDismissed = true;
      firstSteps.dismissed = true;
      setBgImage(S.bg);
      syncControls();
    }
    writeLibrary();
    renderAll();
    updateSaveState('Saved', false);
    toast('Deleted “' + label + '”.');
  }

  function applyBoardData(data) {
    if (!data || !Array.isArray(data.tiles)) return false;

    var cols = clamp(Number(data.cols) || 12, 2, 40);
    var rows = clamp(Number(data.rows) || 9, 2, 30);
    var shape = data.shape === 'hex' ? 'hex' : 'square';

    S.cols = cols;
    S.rows = rows;
    S.shape = shape;
    S.name = typeof data.name === 'string' ? data.name.slice(0, 40) : '';

    if (data.tiles.length === cols * rows) {
      S.tiles = data.tiles.map(function (t) {
        return (t && TERRAIN[t]) ? t : null;
      });
    } else {
      var oldCols = Number(data.cols) || 12;
      var oldRows = Number(data.rows) || 9;
      var next = [];
      var i;
      for (i = 0; i < cols * rows; i++) next.push(null);
      for (var r = 0; r < Math.min(oldRows, rows); r++) {
        for (var c = 0; c < Math.min(oldCols, cols); c++) {
          var v = data.tiles[r * oldCols + c];
          next[r * cols + c] = (v && TERRAIN[v]) ? v : null;
        }
      }
      S.tiles = next;
    }

    S.bg = typeof data.bg === 'string' ? data.bg : null;
    S.rules = typeof data.rules === 'string' ? data.rules.slice(0, 800) : '';
    S.turn = clamp(Number(data.turn) || 1, 1, 99);
    S.round = clamp(Number(data.round) || 1, 1, 99);
    S.customCards = Array.isArray(data.customCards)
      ? data.customCards.map(sanitiseCustomCard).filter(Boolean).slice(0, 20)
      : [];

    S.deck = Array.isArray(data.deck) ? data.deck.filter(function (card) {
      if (!card) return false;
      if (card.c) return !!customCardById(card.c);
      return Number.isInteger(card.r) && card.r >= 0 && card.r < 13 &&
        Number.isInteger(card.s) && card.s >= 0 && card.s < 4;
    }).map(function (card) {
      return card.c ? { c: card.c } : { r: card.r, s: card.s };
    }) : [];

    S.tokens = [];
    var maxId = 0;
    if (Array.isArray(data.tokens)) {
      data.tokens.forEach(function (t) {
        if (!t || typeof t.x !== 'number' || typeof t.y !== 'number') return;
        var id = Number(t.id) || 0;
        if (id <= 0) return;
        var token = {
          id: id,
          x: clamp(t.x, 8, 100000),
          y: clamp(t.y, 8, 100000),
          rot: Number(t.rot) || 0,
          scale: clamp(Number(t.scale) || 1, 0.5, 2)
        };
        if (t.type === 'card') {
          token.type = 'card';
          var custom = sanitiseCustomCard(t.card);
          if (custom) {
            token.card = custom;
          } else {
            token.r = clamp(Number(t.r) || 0, 0, 12);
            token.s = clamp(Number(t.s) || 0, 0, 3);
          }
          token.faceDown = !!t.faceDown;
        } else {
          token.type = 'piece';
          token.kind = pieceDef(t.kind).id;
          if (pieceDef(token.kind).counter) token.value = clamp(Number(t.value) || 1, 1, 99);
        }
        maxId = Math.max(maxId, id);
        S.tokens.push(token);
      });
    }
    S.nextId = Math.max(maxId + 1, Number(data.nextId) || 1);
    S.mode = data.mode === 'play' ? 'play' : 'build';
    S.terrain = TERRAIN[data.terrain] ? data.terrain : 'grass';
    S.brush = Number(data.brush) === 3 ? 3 : 1;
    S.tool = data.tool === 'fill' ? 'fill' : 'brush';
    S.snap = true;
    S.selectedId = 0;

    var size = boardSize();
    S.tokens.forEach(function (t) {
      t.x = clamp(t.x, 10, size.W - 10);
      t.y = clamp(t.y, 10, size.H - 10);
    });

    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Background image                                                    */
  /* ------------------------------------------------------------------ */

  function preloadSprites() {
    PIECE_DEFS.forEach(function (p) {
      if (!p.img || spriteCache[p.img]) return;
      var img = new Image();
      img.src = p.img;
      spriteCache[p.img] = img;
    });
  }

  function setBgImage(url) {
    if (!url) {
      bgImg = null;
      scheduleDraw();
      return;
    }
    var img = new Image();
    img.onload = function () {
      bgImg = img;
      scheduleDraw();
    };
    img.onerror = function () {
      bgImg = null;
      scheduleDraw();
    };
    img.src = url;
  }

  function shrinkImage(dataUrl, done) {
    var img = new Image();
    img.onload = function () {
      var max = 1400;
      var w = img.naturalWidth;
      var h = img.naturalHeight;
      if (!w || !h) {
        done(dataUrl);
        return;
      }
      if (Math.max(w, h) > max) {
        var ratio = max / Math.max(w, h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      var c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      var x = c.getContext('2d');
      x.fillStyle = '#F0EAD6';
      x.fillRect(0, 0, w, h);
      x.drawImage(img, 0, 0, w, h);
      try {
        done(c.toDataURL('image/jpeg', 0.82));
      } catch (err) {
        done(dataUrl);
      }
    };
    img.onerror = function () {
      toast('That image could not be opened.');
    };
    img.src = dataUrl;
  }

  /* ------------------------------------------------------------------ */
  /* Grid changes                                                        */
  /* ------------------------------------------------------------------ */

  function setGrid(cols, rows, shape) {
    if (cols === S.cols && rows === S.rows && shape === S.shape) return;
    pushUndo();
    var oldCols = S.cols;
    var oldRows = S.rows;
    var oldTiles = S.tiles;
    var next = [];
    var i;
    for (i = 0; i < cols * rows; i++) next.push(null);
    for (var r = 0; r < Math.min(oldRows, rows); r++) {
      for (var c = 0; c < Math.min(oldCols, cols); c++) {
        next[r * cols + c] = oldTiles[r * oldCols + c] || null;
      }
    }
    S.cols = cols;
    S.rows = rows;
    S.shape = shape;
    S.tiles = next;
    hover = null;
    kbCursor = {
      col: clamp(kbCursor.col, 0, cols - 1),
      row: clamp(kbCursor.row, 0, rows - 1)
    };
    var size = boardSize();
    S.tokens.forEach(function (t) {
      t.x = clamp(t.x, 10, size.W - 10);
      t.y = clamp(t.y, 10, size.H - 10);
    });
    deselect();
    renderAll();
    markDirty();
    toast('Board updated.');
  }

  /* ------------------------------------------------------------------ */
  /* Dice                                                                */
  /* ------------------------------------------------------------------ */

  function buildDiceTypes() {
    var host = byId('ttDiceTypes');
    var frag = document.createDocumentFragment();
    DICE.forEach(function (sides) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tt-die-chip';
      b.dataset.sides = String(sides);
      b.textContent = 'd' + sides;
      b.setAttribute('aria-label', 'd' + sides + ', ' + sides + ' sided die');
      b.setAttribute('aria-pressed', sides === dieSides ? 'true' : 'false');
      frag.appendChild(b);
    });
    host.appendChild(frag);
  }

  function setDie(sides) {
    dieSides = sides;
    var chips = byId('ttDiceTypes').querySelectorAll('.tt-die-chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].setAttribute('aria-pressed', Number(chips[i].dataset.sides) === sides ? 'true' : 'false');
    }
    rollBtn.textContent = 'Roll d' + sides;
    if (quickRollBtn) quickRollBtn.textContent = '🎲 Roll d' + sides;
    if (barResultEl) {
      barResultEl.textContent = '';
      barResultEl.classList.remove('is-on');
    }
    announce('Ready to roll a d' + sides + '.');
  }

  function cubeFaceTransform(value) {
    switch (value) {
      case 1: return { rx: 0, ry: 0 };
      case 2: return { rx: -90, ry: 0 };
      case 3: return { rx: 0, ry: -90 };
      case 4: return { rx: 0, ry: 90 };
      case 5: return { rx: 90, ry: 0 };
      default: return { rx: 0, ry: 180 };
    }
  }

  function makeCubeDie() {
    var wrap = document.createElement('div');
    wrap.className = 'tt-die tt-die--cube';
    var cube = document.createElement('div');
    cube.className = 'tt-cube';

    var faces = [
      { cls: 'tt-face--1', glyph: '⚀' },
      { cls: 'tt-face--6', glyph: '⚅' },
      { cls: 'tt-face--3', glyph: '⚂' },
      { cls: 'tt-face--4', glyph: '⚃' },
      { cls: 'tt-face--2', glyph: '⚁' },
      { cls: 'tt-face--5', glyph: '⚄' }
    ];
    faces.forEach(function (f) {
      var face = document.createElement('div');
      face.className = 'tt-face ' + f.cls;
      face.textContent = f.glyph;
      cube.appendChild(face);
    });
    wrap.appendChild(cube);

    return {
      el: wrap,
      set: function (value) {
        var t = cubeFaceTransform(value);
        cube.style.setProperty('--rx', t.rx + 'deg');
        cube.style.setProperty('--ry', t.ry + 'deg');
      },
      spin: function (on) {
        wrap.classList.toggle('is-spinning', on);
      }
    };
  }

  function makeFlatDie(sides) {
    var wrap = document.createElement('div');
    wrap.className = 'tt-die tt-die--flat';
    var num = document.createElement('span');
    num.className = 'tt-die-num';
    var tag = document.createElement('span');
    tag.className = 'tt-die-sides';
    tag.textContent = 'd' + sides;
    wrap.appendChild(num);
    wrap.appendChild(tag);
    return {
      el: wrap,
      set: function (value) {
        num.textContent = String(value);
      },
      spin: function (on) {
        wrap.classList.toggle('is-spinning', on);
      }
    };
  }

  function showRollOverlay(results, sides) {
    if (reduceMotion()) return null;
    if (rollOverlay) {
      try { rollOverlay.remove(); } catch (err) { /* already gone */ }
      rollOverlay = null;
    }
    var layer = document.createElement('div');
    layer.className = 'tt-roll-overlay';
    layer.setAttribute('aria-hidden', 'true');
    var rollStage = document.createElement('div');
    rollStage.className = 'tt-roll-stage';
    layer.appendChild(rollStage);
    document.body.appendChild(layer);

    var dice = results.map(function (value, i) {
      var die = sides === 6 ? makeCubeDie() : makeFlatDie(sides);
      die.el.classList.add('tt-roll-die');
      die.el.style.setProperty('--i', String(i));
      die.spin(true);
      die.set(1 + Math.floor(Math.random() * sides));
      rollStage.appendChild(die.el);
      return die;
    });

    var tick = window.setInterval(function () {
      dice.forEach(function (d) { d.set(1 + Math.floor(Math.random() * sides)); });
    }, 80);

    window.requestAnimationFrame(function () { layer.classList.add('is-on'); });
    rollOverlay = layer;

    return {
      settle: function () {
        window.clearInterval(tick);
        dice.forEach(function (d, i) {
          d.spin(false);
          d.set(results[i]);
        });
      },
      remove: function () {
        window.clearInterval(tick);
        if (rollOverlay === layer) rollOverlay = null;
        layer.classList.remove('is-on');
        window.setTimeout(function () {
          if (layer.parentNode) layer.parentNode.removeChild(layer);
        }, 360);
      }
    };
  }

  function renderHistory() {
    diceHistory.textContent = '';
    diceHistoryLog.slice(0, 6).forEach(function (entry) {
      var chip = document.createElement('span');
      chip.textContent = entry;
      diceHistory.appendChild(chip);
    });
  }

  function rollDice(sides, count) {
    if (rolling) return;
    var useSides = DICE.indexOf(sides) >= 0 ? sides : dieSides;
    var useCount = clamp(Number(count) || dieCount, 1, MAX_DICE);

    rolling = true;
    rollBtn.disabled = true;
    countDownBtn.disabled = true;
    countUpBtn.disabled = true;
    diceStage.textContent = '';

    var results = [];
    var dice = [];
    var i;
    for (i = 0; i < useCount; i++) {
      results.push(1 + Math.floor(Math.random() * useSides));
      var die = useSides === 6 ? makeCubeDie() : makeFlatDie(useSides);
      dice.push(die);
      diceStage.appendChild(die.el);
    }

    var overlay = showRollOverlay(results, useSides);

    function settle() {
      for (var d = 0; d < dice.length; d++) {
        dice[d].spin(false);
        dice[d].set(results[d]);
        dice[d].el.classList.remove('is-settled');
        void dice[d].el.offsetWidth;
        dice[d].el.classList.add('is-settled');
      }

      if (overlay) {
        overlay.settle();
        window.setTimeout(overlay.remove, 120);
      }

      var total = results.reduce(function (a, b) { return a + b; }, 0);
      var text;
      if (results.length === 1) {
        text = 'You rolled ' + results[0] + ' on a d' + useSides + '.';
      } else {
        text = 'You rolled ' + results.join(', ') + ' on ' + results.length + 'd' + useSides + ' (total ' + total + ').';
      }
      diceResult.textContent = text;
      if (barResultEl) {
        barResultEl.textContent = results.length === 1
          ? 'You rolled ' + results[0]
          : 'Total ' + total;
        barResultEl.classList.add('is-on');
      }
      markStep('roll');
      announce(text);

      var entry = results.length === 1
        ? 'd' + useSides + ' = ' + results[0]
        : results.length + 'd' + useSides + ' = ' + total;
      diceHistoryLog.unshift(entry);
      if (diceHistoryLog.length > 12) diceHistoryLog.length = 12;
      renderHistory();

      rolling = false;
      rollBtn.disabled = false;
      countDownBtn.disabled = dieCount <= 1;
      countUpBtn.disabled = dieCount >= MAX_DICE;
    }

    if (reduceMotion()) {
      settle();
      return;
    }

    for (var k = 0; k < dice.length; k++) {
      dice[k].spin(true);
      dice[k].set(1 + Math.floor(Math.random() * useSides));
    }

    var ticks = 0;
    var timer = window.setInterval(function () {
      ticks++;
      for (var d = 0; d < dice.length; d++) {
        dice[d].set(1 + Math.floor(Math.random() * useSides));
      }
      if (ticks >= 12) {
        window.clearInterval(timer);
        settle();
      }
    }, 62);
  }

  function setCount(next) {
    dieCount = clamp(next, 1, MAX_DICE);
    dieCountOut.textContent = String(dieCount);
    countDownBtn.disabled = dieCount <= 1;
    countUpBtn.disabled = dieCount >= MAX_DICE;
    announce(dieCount + (dieCount === 1 ? ' die' : ' dice') + ' ready.');
  }

  /* ------------------------------------------------------------------ */
  /* Mode, status and empty state                                        */
  /* ------------------------------------------------------------------ */

  function setMode(mode) {
    S.mode = mode === 'play' ? 'play' : 'build';
    stage.dataset.mode = S.mode;
    var buttons = document.querySelectorAll('.tt-mode-btn');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-pressed', buttons[i].dataset.mode === S.mode ? 'true' : 'false');
    }
    hover = null;
    deselect();
    updateStatus();
    scheduleDraw();
    if (S.mode === 'play') {
      toast('Play mode. Drag pieces anywhere.');
      announce('Play mode. Drag pieces anywhere. Tap a card to flip it.');
    } else {
      announce('Build mode. Paint tiles and snap pieces to the grid.');
    }
  }

  function updateStatus() {
    if (S.mode === 'play') {
      statusEl.textContent = 'Drag pieces. Tap a card to flip it.';
      barHint.textContent = 'Pieces move freely in Play mode.';
      byId('ttTerrainHelp').textContent = 'Play mode is on. Switch to Build to paint.';
    } else {
      statusEl.textContent = 'Paint a tile, then add a piece.';
      barHint.textContent = 'Drag a piece onto the board.';
      byId('ttTerrainHelp').textContent = S.tool === 'fill'
        ? 'Fill is on. Tap a tile to flood it.'
        : 'Pick a colour, then paint the board.';
    }
  }

  function updateEmptyState() {
    var hasTiles = false;
    for (var i = 0; i < S.tiles.length; i++) {
      if (S.tiles[i]) {
        hasTiles = true;
        break;
      }
    }
    var show = !emptyDismissed && !S.bg && !hasTiles && S.tokens.length === 0;
    emptyEl.hidden = !show;
    updateSteps();
  }

  function hideEmpty() {
    if (!emptyDismissed) {
      emptyDismissed = true;
      emptyEl.hidden = true;
    }
    updateSteps();
  }

  function markStep(name) {
    if (!firstSteps[name]) {
      firstSteps[name] = true;
      updateSteps();
    }
  }

  function updateSteps() {
    if (!stepsEl) return;
    var keys = ['paint', 'piece', 'roll'];
    var all = firstSteps.paint && firstSteps.piece && firstSteps.roll;
    var steps = stepsEl.querySelectorAll('.tt-step');
    for (var i = 0; i < steps.length; i++) {
      var key = steps[i].dataset.step;
      var done = !!firstSteps[key];
      steps[i].classList.toggle('is-done', done);
      var num = steps[i].querySelector('.tt-step-num');
      if (num) num.textContent = done ? '✓' : String(keys.indexOf(key) + 1);
    }
    stepsEl.hidden = firstSteps.dismissed || all || !emptyEl.hidden;
    if (all && !firstSteps.celebrated) {
      firstSteps.celebrated = true;
      toast('You made a board game. Press Save to keep it.');
      announce('You finished the first steps. Press Save to keep your board.');
    }
  }

  function resetBoardDoc() {
    var i;
    for (i = 0; i < S.tiles.length; i++) S.tiles[i] = null;
    S.tokens = [];
    S.bg = null;
    bgImg = null;
    S.selectedId = 0;
    S.turn = 1;
    S.round = 1;
  }

  function fillTiles(terrain) {
    for (var i = 0; i < S.tiles.length; i++) S.tiles[i] = terrain;
  }

  function setTileAt(col, row, terrain) {
    if (col < 0 || row < 0 || col >= S.cols || row >= S.rows) return;
    S.tiles[row * S.cols + col] = terrain;
  }

  function addPieceAtCell(kind, col, row) {
    var c = centerOf(clamp(col, 0, S.cols - 1), clamp(row, 0, S.rows - 1));
    addPiece(kind, c.x, c.y);
  }

  function buildMeadowTemplate() {
    fillTiles('grass');
    var pathRow = Math.floor(S.rows / 2);
    for (var c = 0; c < S.cols; c++) {
      setTileAt(c, pathRow, 'path');
      if (c % 3 === 0) setTileAt(c, pathRow + 1, 'path');
    }
    var pond = [[S.cols - 4, 1], [S.cols - 3, 1], [S.cols - 4, 2], [S.cols - 3, 2]];
    pond.forEach(function (p) { setTileAt(p[0], p[1], 'water'); });
    var forest = [[1, 1], [2, 1], [1, 2], [2, 2], [S.cols - 2, S.rows - 2], [S.cols - 3, S.rows - 2]];
    forest.forEach(function (p) { setTileAt(p[0], p[1], 'forest'); });
    addPieceAtCell('lumo', 1, pathRow);
    addPieceAtCell('meeple', 2, pathRow);
    addPieceAtCell('tree', 2, 2);
    addPieceAtCell('star', S.cols - 2, 2);
  }

  function buildDungeonTemplate() {
    fillTiles('stone');
    var c;
    var r;
    for (c = 0; c < S.cols; c++) {
      setTileAt(c, 0, 'wall');
      setTileAt(c, S.rows - 1, 'wall');
    }
    for (r = 0; r < S.rows; r++) {
      setTileAt(0, r, 'wall');
      setTileAt(S.cols - 1, r, 'wall');
    }
    var midRow = Math.floor(S.rows / 2);
    var midCol = Math.floor(S.cols / 2);
    for (c = 1; c < S.cols - 1; c++) setTileAt(c, midRow, 'path');
    for (r = 1; r < S.rows - 1; r++) setTileAt(midCol, r, 'path');
    var lavaCol = Math.max(2, S.cols - 4);
    var lavaRow = Math.max(2, Math.floor(S.rows / 3));
    setTileAt(lavaCol, lavaRow, 'lava');
    setTileAt(lavaCol + 1, lavaRow, 'lava');
    setTileAt(lavaCol, lavaRow + 1, 'lava');
    addPieceAtCell('ember', 2, midRow);
    addPieceAtCell('monster', S.cols - 3, S.rows - 3);
    addPieceAtCell('treasure', lavaCol + 2, lavaRow);
    addPieceAtCell('counter', lavaCol + 2, lavaRow + 1);
    addPieceAtCell('rock', midCol - 1, midRow - 1);
  }

  function buildIslandTemplate() {
    fillTiles('water');
    var cx = Math.floor(S.cols / 2);
    var cy = Math.floor(S.rows / 2);
    var rx = Math.max(2, Math.floor(S.cols * 0.3));
    var ry = Math.max(2, Math.floor(S.rows * 0.3));
    var c;
    var r;
    for (r = 0; r < S.rows; r++) {
      for (c = 0; c < S.cols; c++) {
        if (Math.abs(c - cx) <= rx && Math.abs(r - cy) <= ry) setTileAt(c, r, 'sand');
        if (Math.abs(c - cx) <= rx - 1 && Math.abs(r - cy) <= ry - 1) setTileAt(c, r, 'grass');
      }
    }
    [[cx - 2, cy], [cx - 2, cy - 1], [cx + 1, cy + 1]].forEach(function (p) {
      setTileAt(p[0], p[1], 'forest');
    });
    addPieceAtCell('castle', cx, cy - 2);
    addPieceAtCell('meeple', cx - 1, cy + 1);
    addPieceAtCell('tree', cx - 2, cy);
    addPieceAtCell('flag', cx + 2, cy);
  }

  function buildSurpriseTemplate() {
    var bases = ['grass', 'stone', 'sand', 'water'];
    var base = bases[Math.floor(Math.random() * bases.length)];
    fillTiles(base);
    var keys = Object.keys(TERRAIN).filter(function (k) { return k !== base; });
    var blobs = Math.max(2, Math.floor(S.cols * S.rows / 18));
    for (var i = 0; i < blobs; i++) {
      var col = 1 + Math.floor(Math.random() * (S.cols - 2));
      var row = 1 + Math.floor(Math.random() * (S.rows - 2));
      var key = keys[Math.floor(Math.random() * keys.length)];
      setTileAt(col, row, key);
      if (Math.random() > 0.45) setTileAt(col + 1, row, key);
      if (Math.random() > 0.45) setTileAt(col, row + 1, key);
    }
    var pieces = ['stardust', 'lumo', 'ember', 'pip', 'echo', 'monster', 'treasure', 'tree', 'flag', 'star', 'castle', 'rock'];
    for (var p = 0; p < 4; p++) {
      var spot = freeSpot();
      addPiece(pieces[Math.floor(Math.random() * pieces.length)], spot.x, spot.y);
    }
  }

  function applyTemplate(id) {
    var names = {
      meadow: 'Meadow',
      dungeon: 'Dungeon',
      island: 'Island',
      surprise: 'Surprise board',
      blank: 'Blank board'
    };
    var hadContent = !!(S.bg || S.tokens.length || S.tiles.some(function (t) { return !!t; }));
    if (window.ToolAnalytics) {
      try { ToolAnalytics.event('template_used', id); } catch (err) { /* analytics is optional */ }
    }
    pushUndo();
    resetBoardDoc();
    if (id === 'meadow') buildMeadowTemplate();
    else if (id === 'dungeon') buildDungeonTemplate();
    else if (id === 'island') buildIslandTemplate();
    else if (id === 'surprise') buildSurpriseTemplate();
    S.deck = makeDeck();
    if (id !== 'blank') S.rules = '';
    hideEmpty();
    S.selectedId = 0;
    if (S.mode !== 'build') setMode('build');
    if (id !== 'blank') {
      firstSteps.paint = true;
      firstSteps.piece = true;
    }
    renderAll();
    markDirty();
    var label = names[id] || 'Board';
    var message = id === 'blank'
      ? 'Blank board ready. Pick a colour and paint.'
      : label + ' ready. ' + (firstSteps.roll ? 'Have fun!' : 'Roll the dice to play.');
    if (hadContent) message += ' Press Undo to go back.';
    toast(message);
    announce(message);
    updateSteps();
  }

  function clearBoard() {
    pushUndo();
    S.tiles = [];
    for (var i = 0; i < S.cols * S.rows; i++) S.tiles.push(null);
    S.tokens = [];
    S.bg = null;
    bgImg = null;
    S.deck = makeDeck();
    S.rules = '';
    S.turn = 1;
    S.round = 1;
    S.selectedId = 0;
    emptyDismissed = false;
    firstSteps = { paint: false, piece: false, roll: false, dismissed: firstSteps.dismissed, celebrated: false };
    deselect();
    renderAll();
    markDirty();
    toast('Board cleared.');
    announce('Board cleared. The empty board is ready.');
  }

  function clearTiles() {
    pushUndo();
    for (var i = 0; i < S.tiles.length; i++) S.tiles[i] = null;
    renderAll();
    markDirty();
    toast('Tiles cleared. Pieces are still on the board.');
  }

  /* ------------------------------------------------------------------ */
  /* Export                                                              */
  /* ------------------------------------------------------------------ */

  function drawTokensForExport(context, scale) {
    var cell = CELL * scale;
    for (var i = 0; i < S.tokens.length; i++) {
      var t = S.tokens[i];
      context.save();
      context.translate(t.x * scale, t.y * scale);
      context.rotate((t.rot || 0) * Math.PI / 180);
      context.scale(t.scale || 1, t.scale || 1);

      if (t.type === 'card') {
        var cw = cell * 0.4;
        var ch = cell * 0.56;
        roundRect(context, -cw / 2, -ch / 2, cw, ch, 7 * scale);
        context.fillStyle = '#fffdf8';
        context.fill();
        context.strokeStyle = cardBorder(t);
        context.lineWidth = 3 * scale;
        context.stroke();
        context.fillStyle = t.faceDown ? '#70A3A7' : cardBorder(t);
        context.font = '800 ' + Math.round((t.card ? 14 : 18) * scale) + 'px Inter, system-ui, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(t.faceDown ? '★' : cardFaceText(t), 0, 0);
        if (t.card && !t.faceDown && t.card.name) {
          context.fillStyle = '#2b2620';
          context.font = '700 ' + Math.round(6 * scale) + 'px Inter, system-ui, sans-serif';
          context.fillText(t.card.name.slice(0, 14), 0, ch / 2 - 5 * scale);
        }
      } else {
        var def = pieceDef(t.kind);
        var r = cell * 0.3;
        var sprite = def.img ? spriteCache[def.img] : null;
        context.beginPath();
        context.arc(0, 0, r, 0, Math.PI * 2);
        context.fillStyle = '#fffdf8';
        context.fill();
        context.strokeStyle = def.color;
        context.lineWidth = 4 * scale;
        context.stroke();

        if (sprite && sprite.complete && sprite.naturalWidth) {
          context.save();
          context.beginPath();
          context.arc(0, 0, r - 2 * scale, 0, Math.PI * 2);
          context.clip();
          context.drawImage(sprite, -r, -r, r * 2, r * 2);
          context.restore();
        } else {
          context.fillStyle = '#1a1a1a';
          context.font = Math.round(r * 1.25) + 'px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          var fallback = def.counter ? String(t.value || 1)
            : (def.glyph || String(def.label || '?').charAt(0));
          context.fillText(fallback, 0, 0);
        }
      }
      context.restore();
    }
  }

  function exportPNG() {
    var size = boardSize();
    var scale = 2;
    var out = document.createElement('canvas');
    out.width = size.W * scale;
    out.height = size.H * scale;

    var o = out.getContext('2d');
    o.save();
    o.scale(scale, scale);
    drawScene(o, size.W, size.H, false);
    o.restore();

    drawTokensForExport(o, scale);

    o.fillStyle = 'rgba(64,59,51,.78)';
    o.font = '700 ' + Math.round(12 * scale) + 'px Inter, system-ui, sans-serif';
    o.textAlign = 'right';
    o.textBaseline = 'bottom';
    o.fillText('JVDesignStudio - Tabletop Studio', out.width - 14, out.height - 10);

    if (out.toBlob) {
      out.toBlob(function (blob) {
        if (!blob) {
          toast('Could not export the board image.');
          return;
        }
        downloadBlob(blob, safeName() + '.png');
        toast('Board image exported.');
        announce('Board image exported as a PNG.');
      }, 'image/png');
    } else {
      var link = document.createElement('a');
      link.href = out.toDataURL('image/png');
      link.download = safeName() + '.png';
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast('Board image exported.');
    }
  }

  function exportJSON() {
    var data = snapshot();
    data.v = 2;
    data.savedAt = Date.now();
    data.mode = S.mode;
    data.terrain = S.terrain;
    data.brush = S.brush;
    data.snap = S.snap;
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, safeName() + '.json');
    toast('Board file saved.');
    announce('Board file saved as JSON.');
  }

  function onLoadFile(event) {
    var file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast('That board file is too big.');
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try {
        data = JSON.parse(String(reader.result));
      } catch (err) {
        toast('That file is not a board file.');
        return;
      }
      var snap = snapshot();
      if (!applyBoardData(data)) {
        toast('That file is not a board file.');
        return;
      }
      pushUndoSnapshot(snap);
      emptyDismissed = true;
      firstSteps.dismissed = true;
      setBgImage(S.bg);
      syncControls();
      renderAll();
      markDirty();
      toast('Board loaded.');
      announce('Board loaded from file.');
    };
    reader.onerror = function () {
      toast('That file could not be read.');
    };
    reader.readAsText(file);
  }

  function onBoardNameInput(event) {
    S.name = String(event.target.value || '').slice(0, 40);
    markDirty();
  }

  /* ------------------------------------------------------------------ */
  /* UI build and sync                                                   */
  /* ------------------------------------------------------------------ */

  function buildTerrainPalette() {
    var host = byId('ttTerrain');
    var frag = document.createDocumentFragment();
    Object.keys(TERRAIN).forEach(function (key) {
      var t = TERRAIN[key];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tt-swatch';
      b.dataset.terrain = key;
      b.style.setProperty('--sw', t.color);
      b.setAttribute('aria-pressed', key === S.terrain ? 'true' : 'false');
      b.setAttribute('aria-label', t.name);
      b.innerHTML = '<span class="tt-swatch-chip" aria-hidden="true"><span class="tt-swatch-icon">' + t.icon + '</span></span><span class="tt-swatch-name">' + t.name + '</span>';
      frag.appendChild(b);
    });

    var eraser = document.createElement('button');
    eraser.type = 'button';
    eraser.className = 'tt-swatch';
    eraser.dataset.terrain = 'erase';
    eraser.setAttribute('aria-pressed', 'false');
    eraser.setAttribute('aria-label', 'Erase tiles');
    eraser.innerHTML = '<span class="tt-swatch-chip tt-swatch-chip--erase" aria-hidden="true"></span><span class="tt-swatch-name">Erase</span>';
    frag.appendChild(eraser);

    host.appendChild(frag);
  }

  function buildPieces() {
    var host = byId('ttPieces');
    var frag = document.createDocumentFragment();
    PIECE_DEFS.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tt-piece-btn' + (p.img ? ' tt-piece-btn--char' : '');
      b.dataset.piece = p.id;
      var glyph = document.createElement('span');
      glyph.className = 'tt-piece-glyph';
      glyph.setAttribute('aria-hidden', 'true');
      if (p.img) {
        var img = document.createElement('img');
        img.src = p.img;
        img.alt = '';
        img.width = 28;
        img.height = 28;
        img.loading = 'lazy';
        glyph.appendChild(img);
      } else {
        glyph.textContent = p.glyph;
      }
      b.appendChild(glyph);
      var label = document.createElement('span');
      label.textContent = p.label;
      b.appendChild(label);
      frag.appendChild(b);
    });
    host.appendChild(frag);
  }

  function syncControls() {
    byId('ttShape').value = S.shape;
    byId('ttSize').value = S.cols + 'x' + S.rows;
    var nameInput = byId('ttBoardName');
    if (nameInput) nameInput.value = S.name || '';

    var modeButtons = document.querySelectorAll('.tt-mode-btn');
    for (var i = 0; i < modeButtons.length; i++) {
      modeButtons[i].setAttribute('aria-pressed', modeButtons[i].dataset.mode === S.mode ? 'true' : 'false');
    }

    var swatches = byId('ttTerrain').querySelectorAll('.tt-swatch');
    for (var j = 0; j < swatches.length; j++) {
      swatches[j].setAttribute('aria-pressed', swatches[j].dataset.terrain === S.terrain ? 'true' : 'false');
    }

    var brushes = document.querySelectorAll('[data-brush]');
    for (var k = 0; k < brushes.length; k++) {
      brushes[k].setAttribute('aria-pressed', Number(brushes[k].dataset.brush) === S.brush ? 'true' : 'false');
    }

    var tools = document.querySelectorAll('[data-tool]');
    for (var t = 0; t < tools.length; t++) {
      tools[t].setAttribute('aria-pressed', tools[t].dataset.tool === S.tool ? 'true' : 'false');
    }

    dieCountOut.textContent = String(dieCount);
    countDownBtn.disabled = dieCount <= 1;
    countUpBtn.disabled = dieCount >= MAX_DICE;
    rollBtn.textContent = 'Roll d' + dieSides;
    stage.dataset.mode = S.mode;
    updateStatus();
    updatePlayAids();
  }

  function updatePlayAids() {
    if (roundOut) roundOut.textContent = String(S.round || 1);
    if (turnOut) turnOut.textContent = String(S.turn || 1);
    if (turnChip) turnChip.textContent = 'Round ' + (S.round || 1) + ' · Turn ' + (S.turn || 1);
    if (rulesInput && document.activeElement !== rulesInput) rulesInput.value = S.rules || '';
  }

  function changeRound(delta) {
    S.round = clamp((S.round || 1) + delta, 1, 99);
    updatePlayAids();
    markDirty();
    announce('Round ' + S.round + '.');
  }

  function changeTurn(delta) {
    S.turn = clamp((S.turn || 1) + delta, 1, 99);
    updatePlayAids();
    markDirty();
    announce('Turn ' + S.turn + '.');
  }

  function onRulesInput(event) {
    S.rules = String(event.target.value || '').slice(0, 800);
    markDirty();
  }

  function applyZoom(next) {
    zoom = clamp(Number(next) || 1, 1, 3);
    if (scaleWrap) scaleWrap.style.width = (zoom * 100) + '%';
    if (zoomVal) zoomVal.textContent = Math.round(zoom * 100) + '%';
    if (zoomOutBtn) zoomOutBtn.disabled = zoom <= 1;
    if (zoomInBtn) zoomInBtn.disabled = zoom >= 3;
    layoutTokens();
  }

  function wrapTextLines(context, text, maxWidth) {
    var words = String(text).replace(/\r/g, '').split(/\s+/);
    var lines = [];
    var line = '';
    words.forEach(function (word) {
      var test = line ? line + ' ' + word : word;
      if (context.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  function exportSheetPNG() {
    var size = boardSize();
    var scale = 2;
    var boardW = size.W * scale;
    var boardH = size.H * scale;
    var pad = 36;
    var panelW = Math.max(760, boardW);
    var rules = String(S.rules || '').trim();
    var title = S.name || 'My tabletop game';

    var boardCanvas = document.createElement('canvas');
    boardCanvas.width = boardW;
    boardCanvas.height = boardH;
    var bctx = boardCanvas.getContext('2d');
    bctx.save();
    bctx.scale(scale, scale);
    drawScene(bctx, size.W, size.H, false);
    bctx.restore();
    drawTokensForExport(bctx, scale);

    var meas = document.createElement('canvas').getContext('2d');
    meas.font = '400 16px Inter, system-ui, sans-serif';
    var lines = rules ? wrapTextLines(meas, rules, panelW - pad * 2) : [];
    var panelH = 92 + (lines.length ? lines.length * 24 + 12 : 0);

    var out = document.createElement('canvas');
    out.width = panelW;
    out.height = boardH + panelH + pad;
    var o = out.getContext('2d');
    o.fillStyle = '#F0EAD6';
    o.fillRect(0, 0, out.width, out.height);
    o.drawImage(boardCanvas, Math.round((panelW - boardW) / 2), 0);

    o.textAlign = 'left';
    o.textBaseline = 'top';
    o.fillStyle = '#1a1208';
    o.font = '800 26px Inter, system-ui, sans-serif';
    o.fillText(title, pad, boardH + 24);
    o.fillStyle = '#4e4a42';
    o.font = '700 15px Inter, system-ui, sans-serif';
    o.fillText('Round ' + (S.round || 1) + ' · Turn ' + (S.turn || 1), pad, boardH + 58);
    if (lines.length) {
      o.fillStyle = '#2b2620';
      o.font = '400 16px Inter, system-ui, sans-serif';
      var y = boardH + 86;
      lines.forEach(function (line) {
        o.fillText(line, pad, y);
        y += 24;
      });
    }
    o.fillStyle = '#6b6257';
    o.font = '700 12px Inter, system-ui, sans-serif';
    o.textAlign = 'right';
    o.fillText('JVDesignStudio - Tabletop Studio', out.width - pad, out.height - 22);

    if (out.toBlob) {
      out.toBlob(function (blob) {
        if (!blob) {
          toast('Could not save the play sheet.');
          return;
        }
        downloadBlob(blob, safeName() + '-play-sheet.png');
        toast('Play sheet saved.');
        announce('Play sheet saved as a PNG.');
      }, 'image/png');
    } else {
      var link = document.createElement('a');
      link.href = out.toDataURL('image/png');
      link.download = safeName() + '-play-sheet.png';
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast('Play sheet saved.');
    }
  }

  /* ------------------------------------------------------------------ */
  /* Events                                                              */
  /* ------------------------------------------------------------------ */

  function onTerrainClick(event) {
    var btn = event.target.closest('.tt-swatch');
    if (!btn) return;
    S.terrain = btn.dataset.terrain;
    var all = byId('ttTerrain').querySelectorAll('.tt-swatch');
    for (var i = 0; i < all.length; i++) {
      all[i].setAttribute('aria-pressed', all[i] === btn ? 'true' : 'false');
    }
    if (btn.dataset.terrain === 'erase') {
      byId('ttTerrainHelp').textContent = S.tool === 'fill'
        ? 'Fill is on. Tap a tile to clear its area.'
        : 'Erase is on. Drag across tiles to rub them out.';
      announce('Eraser selected.');
    } else {
      byId('ttTerrainHelp').textContent = S.tool === 'fill'
        ? 'Fill is on. Tap a tile to flood it with ' + TERRAIN[btn.dataset.terrain].name + '.'
        : 'Painting with ' + TERRAIN[btn.dataset.terrain].name + '.';
      announce(TERRAIN[btn.dataset.terrain].name + ' selected.');
    }
  }

  function onToolClick(event) {
    var btn = event.target.closest('[data-tool]');
    if (!btn) return;
    S.tool = btn.dataset.tool === 'fill' ? 'fill' : 'brush';
    var all = document.querySelectorAll('[data-tool]');
    for (var i = 0; i < all.length; i++) {
      all[i].setAttribute('aria-pressed', all[i] === btn ? 'true' : 'false');
    }
    var name = S.terrain === 'erase' ? 'erase' : (TERRAIN[S.terrain] ? TERRAIN[S.terrain].name : 'paint');
    byId('ttTerrainHelp').textContent = S.tool === 'fill'
      ? 'Fill is on. Tap a tile to flood it with ' + name + '.'
      : 'Painting with ' + name + '. Drag to paint.';
    announce(S.tool === 'fill' ? 'Fill tool selected.' : 'Brush tool selected.');
  }

  function onBrushClick(event) {
    var btn = event.target.closest('[data-brush]');
    if (!btn) return;
    S.brush = Number(btn.dataset.brush) === 3 ? 3 : 1;
    var all = document.querySelectorAll('[data-brush]');
    for (var i = 0; i < all.length; i++) {
      all[i].setAttribute('aria-pressed', all[i] === btn ? 'true' : 'false');
    }
    announce(S.brush === 3 ? 'Big brush selected.' : 'Small brush selected.');
  }

  function onPieceClick(event) {
    var btn = event.target.closest('[data-piece]');
    if (!btn) return;
    if (performance.now() < suppressClickUntil) return;
    spawnPiece(btn.dataset.piece);
  }

  function onPiecePointerDown(event) {
    var btn = event.target.closest('[data-piece]');
    if (!btn) return;
    beginSpawnDrag(event, btn.dataset.piece);
  }

  function openSidebar() {
    sidebar.classList.add('open');
    backdrop.hidden = false;
    sidebarOpen.setAttribute('aria-expanded', 'true');
    document.body.classList.add('tt-drawer-open');
    var close = byId('ttSidebarClose');
    try { close.focus({ preventScroll: true }); } catch (err) { close.focus(); }
  }

  function closeSidebar() {
    if (!sidebar.classList.contains('open')) return;
    sidebar.classList.remove('open');
    backdrop.hidden = true;
    sidebarOpen.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('tt-drawer-open');
    try { sidebarOpen.focus({ preventScroll: true }); } catch (err) { sidebarOpen.focus(); }
  }

  function openPieces() {
    if (window.matchMedia('(max-width: 980px)').matches) openSidebar();
    var section = byId('ttPieces').closest('details');
    if (section) {
      section.open = true;
      try { section.scrollIntoView({ block: 'nearest' }); } catch (err) { /* ignore */ }
    }
    var first = byId('ttPieces').querySelector('[data-piece]');
    if (first) {
      try { first.focus({ preventScroll: true }); } catch (err) { first.focus(); }
    }
  }

  var helpTrigger = null;

  function openHelp(event) {
    helpTrigger = (event && event.currentTarget) ? event.currentTarget : helpBtn;
    helpEl.hidden = false;
    document.body.classList.add('tt-modal-open');
    try { helpClose.focus({ preventScroll: true }); } catch (err) { helpClose.focus(); }
  }

  function closeHelp(focusBack) {
    if (helpEl.hidden) return;
    helpEl.hidden = true;
    document.body.classList.remove('tt-modal-open');
    if (focusBack !== false && helpTrigger && helpTrigger.offsetParent !== null) {
      try { helpTrigger.focus({ preventScroll: true }); } catch (err) { helpTrigger.focus(); }
    }
    helpTrigger = null;
  }

  function handleTap(t) {
    selectToken(t.id);
    if (t.type === 'card' && S.mode === 'play') flipToken(t);
  }

  function announceCell() {
    var t = S.tiles[kbCursor.row * S.cols + kbCursor.col];
    announce('Row ' + (kbCursor.row + 1) + ', column ' + (kbCursor.col + 1) + ', ' +
      (t && TERRAIN[t] ? TERRAIN[t].name : 'empty') + '.');
  }

  function clearArm() {
    clearArmed = false;
    clearBtn.classList.remove('is-armed');
    clearBtn.textContent = 'Clear board';
    window.clearTimeout(clearTimer);
  }

  function onClearClick() {
    if (!clearArmed) {
      clearArmed = true;
      clearBtn.classList.add('is-armed');
      clearBtn.textContent = 'Tap again to clear';
      toast('Tap Clear board again to remove everything.');
      window.clearTimeout(clearTimer);
      clearTimer = window.setTimeout(clearArm, 4000);
      return;
    }
    clearArm();
    clearBoard();
  }

  function onBackgroundFile(event) {
    var file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (String(file.type).indexOf('image/') !== 0) {
      toast('That file is not an image.');
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      shrinkImage(String(reader.result), function (dataUrl) {
        pushUndo();
        S.bg = dataUrl;
        setBgImage(dataUrl);
        hideEmpty();
        markDirty();
        toast('Map image added.');
        announce('Map image added to the board.');
      });
    };
    reader.onerror = function () {
      toast('That image could not be read.');
    };
    reader.readAsDataURL(file);
  }

  function onQuickRoll() {
    rollDice(dieSides, dieCount);
  }

  function onCanvasPointerDown(event) {
    try { cv.focus({ preventScroll: true }); } catch (err) { cv.focus(); }
    if (S.mode !== 'build') return;
    if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 2) return;
    event.preventDefault();
    try { cv.setPointerCapture(event.pointerId); } catch (err) { /* capture is optional */ }
    pushUndo();
    eraseStroke = event.button === 2 || S.terrain === 'erase';
    lastPaintCell = null;
    kbActive = false;
    if (S.tool === 'fill') {
      applyPaint(pointerCell(event), eraseStroke);
      markDirty();
      return;
    }
    painting = true;
    applyPaint(pointerCell(event), eraseStroke);
    markDirty();
  }

  function onCanvasPointerMove(event) {
    if (S.mode !== 'build') return;
    var cell = pointerCell(event);
    if (!hover || hover.col !== cell.col || hover.row !== cell.row) {
      hover = cell;
      scheduleDraw();
    }
    if (painting) {
      applyPaint(cell, eraseStroke);
      markDirty();
    }
  }

  function endPaint() {
    if (!painting) return;
    painting = false;
    lastPaintCell = null;
    markDirty();
  }

  function onCanvasKeyDown(event) {
    if (S.mode !== 'build') return;
    var key = event.key;
    var moves = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1]
    };
    if (moves[key]) {
      event.preventDefault();
      kbActive = true;
      kbCursor.col = clamp(kbCursor.col + moves[key][0], 0, S.cols - 1);
      kbCursor.row = clamp(kbCursor.row + moves[key][1], 0, S.rows - 1);
      scheduleDraw();
      announceCell();
      return;
    }
    if (key === ' ' || key === 'Enter') {
      event.preventDefault();
      kbActive = true;
      pushUndo();
      if (S.tool === 'fill') floodFill(kbCursor.col, kbCursor.row, S.terrain);
      else paintCell(kbCursor.col, kbCursor.row, S.terrain);
      hideEmpty();
      markDirty();
      scheduleDraw();
      announceCell();
      return;
    }
    if (key === 'Backspace' || key === 'Delete') {
      event.preventDefault();
      kbActive = true;
      pushUndo();
      paintCell(kbCursor.col, kbCursor.row, 'erase');
      markDirty();
      scheduleDraw();
      announceCell();
    }
  }

  function onTokenKeyDown(event) {
    var el = event.target.closest('.tt-token');
    if (!el) return;
    var t = tokenById(Number(el.dataset.id));
    if (!t) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      removeToken(t);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectToken(t.id);
      if (t.type === 'card' && S.mode === 'play') flipToken(t);
      announce(tokenLabel(t));
      return;
    }
    var moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (moves[event.key]) {
      event.preventDefault();
      nudgeToken(t, moves[event.key][0], moves[event.key][1]);
    }
  }

  function focusables(root) {
    if (!root) return [];
    return Array.prototype.slice.call(root.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )).filter(function (el) {
      return !el.disabled && el.offsetParent !== null;
    });
  }

  function trapFocus(root, event) {
    if (event.key !== 'Tab') return false;
    var list = focusables(root);
    if (!list.length) return false;
    var first = list[0];
    var last = list[list.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return true;
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
      return true;
    }
    return false;
  }

  function onGlobalKeyDown(event) {
    if (!helpEl.hidden) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeHelp();
      } else if (event.key === 'Tab') {
        trapFocus(helpEl.querySelector('.tt-modal-card'), event);
      }
      return;
    }
    if (sidebar.classList.contains('open') && event.key === 'Tab') {
      if (trapFocus(sidebar, event)) return;
    }
    var tag = (event.target.tagName || '').toLowerCase();
    var typing = tag === 'input' || tag === 'textarea' || tag === 'select';
    if ((event.ctrlKey || event.metaKey) && !typing && String(event.key).toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && !typing && String(event.key).toLowerCase() === 'y') {
      event.preventDefault();
      redo();
      return;
    }
    if (event.key === 'Escape') {
      deselect();
      closeSidebar();
    }
  }

  function onPieceBarClick(event) {
    var btn = event.target.closest('[data-piece-act]');
    if (!btn) return;
    var t = tokenById(S.selectedId);
    if (!t) return;
    var action = btn.dataset.pieceAct;
    if (action === 'rotate') {
      pushUndo();
      t.rot = ((t.rot || 0) + 45) % 360;
      updateTokenElement(t);
      markDirty();
    } else if (action === 'smaller') {
      pushUndo();
      t.scale = clamp((t.scale || 1) - 0.15, 0.55, 1.9);
      updateTokenElement(t);
      markDirty();
    } else if (action === 'bigger') {
      pushUndo();
      t.scale = clamp((t.scale || 1) + 0.15, 0.55, 1.9);
      updateTokenElement(t);
      markDirty();
    } else if (action === 'value-down' || action === 'value-up') {
      pushUndo();
      t.value = clamp((Number(t.value) || 1) + (action === 'value-up' ? 1 : -1), 1, 99);
      updateTokenElement(t);
      markDirty();
      announce('Counter now ' + t.value + '.');
    } else if (action === 'flip') {
      flipToken(t);
    } else if (action === 'remove') {
      removeToken(t);
    }
  }

  function onStagePointerDown(event) {
    if (event.pointerType !== 'touch') return;
    touchPointers.push({ id: event.pointerId, x: event.clientX, y: event.clientY });
    if (touchPointers.length === 2) {
      var a = touchPointers[0];
      var b = touchPointers[1];
      pinch = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        zoom: zoom,
        midX: (a.x + b.x) / 2,
        midY: (a.y + b.y) / 2,
        sx: stage.scrollLeft,
        sy: stage.scrollTop
      };
      painting = false;
      lastPaintCell = null;
    }
  }

  function onStagePointerMove(event) {
    if (!pinch) return;
    for (var i = 0; i < touchPointers.length; i++) {
      if (touchPointers[i].id === event.pointerId) {
        touchPointers[i].x = event.clientX;
        touchPointers[i].y = event.clientY;
      }
    }
    if (touchPointers.length < 2) return;
    var a = touchPointers[0];
    var b = touchPointers[1];
    var dist = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinch.dist > 0) {
      event.preventDefault();
      event.stopPropagation();
      applyZoom(pinch.zoom * (dist / pinch.dist));
      var midX = (a.x + b.x) / 2;
      var midY = (a.y + b.y) / 2;
      stage.scrollLeft = pinch.sx - (midX - pinch.midX);
      stage.scrollTop = pinch.sy - (midY - pinch.midY);
    }
  }

  function onStagePointerEnd(event) {
    touchPointers = touchPointers.filter(function (t) { return t.id !== event.pointerId; });
    if (touchPointers.length < 2) pinch = null;
  }

  function onStageWheel(event) {
    if (!event.ctrlKey) return;
    event.preventDefault();
    applyZoom(zoom + (event.deltaY < 0 ? 0.25 : -0.25));
  }

  function wireEvents() {
    document.querySelectorAll('.tt-mode-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setMode(btn.dataset.mode);
      });
    });

    byId('ttTerrain').addEventListener('click', onTerrainClick);
    document.querySelectorAll('[data-brush]').forEach(function (btn) {
      btn.addEventListener('click', onBrushClick);
    });
    document.querySelectorAll('[data-tool]').forEach(function (btn) {
      btn.addEventListener('click', onToolClick);
    });

    byId('ttPieces').addEventListener('click', onPieceClick);
    byId('ttPieces').addEventListener('pointerdown', onPiecePointerDown);

    byId('ttDrawCard').addEventListener('click', spawnCard);
    byId('ttQuickCard').addEventListener('click', spawnCard);
    byId('ttCardAdd').addEventListener('click', onCardAdd);
    if (cardList) cardList.addEventListener('click', onCardDelete);

    byId('ttRoundDown').addEventListener('click', function () { changeRound(-1); });
    byId('ttRoundUp').addEventListener('click', function () { changeRound(1); });
    byId('ttTurnDown').addEventListener('click', function () { changeTurn(-1); });
    byId('ttTurnUp').addEventListener('click', function () { changeTurn(1); });
    if (rulesInput) rulesInput.addEventListener('input', onRulesInput);
    byId('ttExportSheet').addEventListener('click', exportSheetPNG);
    if (turnChip) turnChip.addEventListener('click', function () {
      if (window.matchMedia('(max-width: 980px)').matches) openSidebar();
      var sec = byId('ttRules').closest('details');
      if (sec) sec.open = true;
    });

    if (libList) {
      libList.addEventListener('click', function (event) {
        var open = event.target.closest('[data-board-open]');
        if (open) {
          openBoard(open.dataset.boardOpen);
          return;
        }
        var del = event.target.closest('[data-board-delete]');
        if (del) deleteBoard(del.dataset.boardDelete);
      });
    }
    byId('ttNewBoard').addEventListener('click', newBoard);
    byId('ttDupBoard').addEventListener('click', duplicateBoard);

    zoomOutBtn.addEventListener('click', function () { applyZoom(zoom - 0.25); });
    zoomInBtn.addEventListener('click', function () { applyZoom(zoom + 0.25); });
    zoomFitBtn.addEventListener('click', function () {
      applyZoom(1);
      if (stage) { stage.scrollLeft = 0; stage.scrollTop = 0; }
    });

    byId('ttDiceTypes').addEventListener('click', function (event) {
      var chip = event.target.closest('.tt-die-chip');
      if (chip) setDie(Number(chip.dataset.sides));
    });
    rollBtn.addEventListener('click', onQuickRoll);
    byId('ttQuickRoll').addEventListener('click', onQuickRoll);
    countDownBtn.addEventListener('click', function () { setCount(dieCount - 1); });
    countUpBtn.addEventListener('click', function () { setCount(dieCount + 1); });

    byId('ttSave').addEventListener('click', function () { saveBoard(false); });
    byId('ttExport').addEventListener('click', exportPNG);
    byId('ttExportJson').addEventListener('click', exportJSON);
    byId('ttLoadJson').addEventListener('click', function () { byId('ttLoadFile').click(); });
    byId('ttLoadFile').addEventListener('change', onLoadFile);
    var nameInput = byId('ttBoardName');
    if (nameInput) nameInput.addEventListener('input', onBoardNameInput);
    var printBtn = byId('ttPrint');
    if (printBtn) printBtn.addEventListener('click', function () {
      saveBoard(true);
      window.print();
    });
    undoBtn.addEventListener('click', undo);
    if (redoBtn) redoBtn.addEventListener('click', redo);
    clearBtn.addEventListener('click', onClearClick);
    byId('ttClearTiles').addEventListener('click', clearTiles);

    byId('ttShape').addEventListener('change', function (event) {
      setGrid(S.cols, S.rows, event.target.value === 'hex' ? 'hex' : 'square');
    });
    byId('ttSize').addEventListener('change', function (event) {
      var parts = String(event.target.value).split('x');
      var cols = Number(parts[0]);
      var rows = Number(parts[1]);
      if (cols && rows) setGrid(cols, rows, S.shape);
    });

    byId('ttBgBtn').addEventListener('click', function () { byId('ttBgFile').click(); });
    byId('ttBgFile').addEventListener('change', onBackgroundFile);
    byId('ttBgRemove').addEventListener('click', function () {
      if (!S.bg) {
        toast('There is no map image to remove.');
        return;
      }
      pushUndo();
      S.bg = null;
      setBgImage(null);
      markDirty();
      toast('Map image removed.');
    });

    document.addEventListener('click', function (event) {
      var tpl = event.target.closest('[data-template]');
      if (!tpl) return;
      applyTemplate(tpl.dataset.template || 'blank');
    });

    byId('ttStartBlank').addEventListener('click', function () {
      applyTemplate('blank');
      try { cv.focus({ preventScroll: true }); } catch (err) { cv.focus(); }
    });

    sidebarOpen.addEventListener('click', openSidebar);
    byId('ttSidebarClose').addEventListener('click', closeSidebar);
    backdrop.addEventListener('click', closeSidebar);
    byId('ttPiecesOpen').addEventListener('click', openPieces);

    if (stepsClose) {
      stepsClose.addEventListener('click', function () {
        firstSteps.dismissed = true;
        updateSteps();
        announce('First steps hidden.');
      });
    }

    helpBtn.addEventListener('click', openHelp);
    byId('ttEmptyHelp').addEventListener('click', openHelp);
    helpClose.addEventListener('click', function () { closeHelp(); });
    helpBackdrop.addEventListener('click', function () { closeHelp(); });
    helpStart.addEventListener('click', function () {
      closeHelp(false);
      if (emptyEl.hidden) {
        if (S.mode === 'build') {
          try { cv.focus({ preventScroll: true }); } catch (err) { cv.focus(); }
        }
        toast('Pick a colour and paint.');
        announce('Pick a terrain colour and paint the board.');
      } else {
        toast('Pick a starter board.');
        announce('Pick a starter board, or start with a blank one.');
      }
    });

    pieceBar.addEventListener('click', onPieceBarClick);

    cv.addEventListener('pointerdown', onCanvasPointerDown);
    cv.addEventListener('pointermove', onCanvasPointerMove);
    cv.addEventListener('pointerup', endPaint);
    cv.addEventListener('pointercancel', endPaint);
    cv.addEventListener('pointerleave', function () {
      if (painting) return;
      hover = null;
      scheduleDraw();
    });
    cv.addEventListener('contextmenu', function (event) { event.preventDefault(); });
    cv.addEventListener('keydown', onCanvasKeyDown);

    tokensLayer.addEventListener('pointerdown', onTokenPointerDown);
    tokensLayer.addEventListener('keydown', onTokenKeyDown);

    document.addEventListener('keydown', onGlobalKeyDown);

    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () { layoutTokens(); });
      ro.observe(stage);
    }
    window.addEventListener('resize', layoutTokens);
    window.addEventListener('orientationchange', function () {
      window.setTimeout(layoutTokens, 200);
    });

    stage.addEventListener('pointerdown', onStagePointerDown, true);
    stage.addEventListener('pointermove', onStagePointerMove, true);
    stage.addEventListener('pointerup', onStagePointerEnd, true);
    stage.addEventListener('pointercancel', onStagePointerEnd, true);
    stage.addEventListener('wheel', onStageWheel, { passive: false });
    window.addEventListener('beforeunload', function (event) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    });
  }

  /* ------------------------------------------------------------------ */
  /* Spawn drag                                                          */
  /* ------------------------------------------------------------------ */

  function beginSpawnDrag(event, kind) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    spawnDrag = {
      kind: kind,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      ghost: null
    };
    window.addEventListener('pointermove', onSpawnMove);
    window.addEventListener('pointerup', onSpawnUp, { once: true });
    window.addEventListener('pointercancel', onSpawnCancel, { once: true });
  }

  function onSpawnMove(event) {
    if (!spawnDrag) return;
    if (!spawnDrag.moved && Math.hypot(event.clientX - spawnDrag.startX, event.clientY - spawnDrag.startY) > 8) {
      spawnDrag.moved = true;
      var def = pieceDef(spawnDrag.kind);
      var ghost = document.createElement('div');
      ghost.className = 'tt-ghost';
      ghost.textContent = def.glyph;
      ghost.style.color = def.color;
      document.body.appendChild(ghost);
      spawnDrag.ghost = ghost;
    }
    if (spawnDrag.moved && spawnDrag.ghost) {
      spawnDrag.ghost.style.left = event.clientX + 'px';
      spawnDrag.ghost.style.top = event.clientY + 'px';
    }
  }

  function onSpawnUp(event) {
    var drag = spawnDrag;
    spawnDrag = null;
    window.removeEventListener('pointermove', onSpawnMove);
    if (!drag) return;
    if (drag.ghost) drag.ghost.remove();
    if (!drag.moved) return;

    suppressClickUntil = performance.now() + 400;
    var rect = cv.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
      return;
    }
    var size = boardSize();
    var x = (event.clientX - rect.left) * (size.W / rect.width);
    var y = (event.clientY - rect.top) * (size.H / rect.height);
    var cell = cellAt(x, y);
    var c = centerOf(cell.col, cell.row);
    pushUndo();
    var t = addPiece(drag.kind, c.x, c.y);
    renderTokens();
    layoutTokens();
    hideEmpty();
    markDirty();
    selectToken(t.id);
    toast(pieceDef(drag.kind).label + ' placed.');
    announce(pieceDef(drag.kind).label + ' placed on ' + posLabel(t) + '.');
  }

  function onSpawnCancel() {
    if (spawnDrag && spawnDrag.ghost) spawnDrag.ghost.remove();
    spawnDrag = null;
    window.removeEventListener('pointermove', onSpawnMove);
  }

  /* ------------------------------------------------------------------ */
  /* Token drag                                                          */
  /* ------------------------------------------------------------------ */

  function onTokenPointerDown(event) {
    var el = event.target.closest('.tt-token');
    if (!el) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    var t = tokenById(Number(el.dataset.id));
    if (!t) return;

    event.preventDefault();
    hideEmpty();
    try { el.focus({ preventScroll: true }); } catch (err) { el.focus(); }

    var rect = cv.getBoundingClientRect();
    var size = boardSize();
    var sx = size.W / rect.width;
    var sy = size.H / rect.height;

    tokDrag = {
      t: t,
      el: el,
      startX: event.clientX,
      startY: event.clientY,
      offX: t.x - (event.clientX - rect.left) * sx,
      offY: t.y - (event.clientY - rect.top) * sy,
      sx: sx,
      sy: sy,
      snap: snapshot(),
      moved: false
    };

    el.classList.add('is-dragging');
    try { el.setPointerCapture(event.pointerId); } catch (err) { /* capture is optional */ }
    window.addEventListener('pointermove', onTokenMove);
    window.addEventListener('pointerup', onTokenUp, { once: true });
    window.addEventListener('pointercancel', onTokenUp, { once: true });
  }

  function onTokenMove(event) {
    if (!tokDrag) return;
    var drag = tokDrag;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) {
      drag.moved = true;
    }
    if (!drag.moved) return;

    var rect = cv.getBoundingClientRect();
    var size = boardSize();
    var x = (event.clientX - rect.left) * drag.sx + drag.offX;
    var y = (event.clientY - rect.top) * drag.sy + drag.offY;
    x = clamp(x, 10, size.W - 10);
    y = clamp(y, 10, size.H - 10);

    drag.t.x = x;
    drag.t.y = y;
    drag.el.style.left = (x / size.W * 100) + '%';
    drag.el.style.top = (y / size.H * 100) + '%';
  }

  function onTokenUp() {
    var drag = tokDrag;
    tokDrag = null;
    window.removeEventListener('pointermove', onTokenMove);
    if (!drag) return;

    drag.el.classList.remove('is-dragging');

    if (drag.moved) {
      pushUndoSnapshot(drag.snap);
      if (S.mode === 'build' && S.snap) {
        var cell = cellAt(drag.t.x, drag.t.y);
        var c = centerOf(cell.col, cell.row);
        drag.t.x = c.x;
        drag.t.y = c.y;
      }
      updateTokenElement(drag.t);
      markDirty();
      announce(tokenLabel(drag.t));
    } else {
      handleTap(drag.t);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */

  function init() {
    var existing = loadLibrary();
    if (!existing) {
      var id = newBoardId();
      library = { v: 2, activeId: id, boards: [] };
      library.boards.push({ id: id, name: 'My board', updated: Date.now(), data: boardPayload() });
      writeLibrary();
    }
    var loaded = existing ? loadBoard() : false;
    firstSteps.dismissed = loaded;

    preloadSprites();
    buildTerrainPalette();
    buildPieces();
    buildDiceTypes();
    wireEvents();
    applyZoom(1);

    if (loaded && S.bg) setBgImage(S.bg);
    syncControls();
    renderAll();
    updateSaveState(loaded ? 'Saved' : 'Not saved yet', false);
    renderLibrary();
    if (loaded) toast('Your saved board is back.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

