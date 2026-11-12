/* ==========================================================================
   Tabletop Studio (A2960)

   No libraries. One canvas draws the board, small DOM buttons handle pieces
   so drag and drop stays reliable on touch screens.
   ========================================================================== */
(function () {
  'use strict';

  var STORE_KEY = 'jvds-tabletop-v1';
  var CELL = 80;
  var MAX_DICE = 6;

  var PIECE_DEFS = [
    { id: 'meeple',   label: 'Meeple',     glyph: '🧍', color: '#BC4749' },
    { id: 'hero',     label: 'Fox hero',   glyph: '🦊', color: '#3f6e71' },
    { id: 'tiger',    label: 'Tiger hero', glyph: '🐯', color: '#c98a2e' },
    { id: 'monster',  label: 'Monster',    glyph: '👾', color: '#7a5aa8' },
    { id: 'treasure', label: 'Treasure',   glyph: '💎', color: '#3f6e71' },
    { id: 'flag',     label: 'Flag',       glyph: '🚩', color: '#BC4749' },
    { id: 'tree',     label: 'Tree',       glyph: '🌳', color: '#5E8C5A' },
    { id: 'rock',     label: 'Rock',       glyph: '🪨', color: '#7d7566' },
    { id: 'star',     label: 'Star',       glyph: '⭐', color: '#c98a2e' },
    { id: 'castle',   label: 'Castle',     glyph: '🏰', color: '#b8956a' }
  ];

  var TERRAIN = {
    grass:  { name: 'Meadow', color: '#8FBF6A' },
    water:  { name: 'Water',  color: '#6FA9C9' },
    sand:   { name: 'Sand',   color: '#E3CD8F' },
    forest: { name: 'Forest', color: '#5E8C5A' },
    stone:  { name: 'Stone',  color: '#B9B4A8' },
    path:   { name: 'Path',   color: '#C9A97D' },
    lava:   { name: 'Lava',   color: '#D46A4A' },
    snow:   { name: 'Snow',   color: '#EDF2F4' }
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
  var rollBtn = document.getElementById('ttRoll');
  var diceStage = document.getElementById('ttDiceStage');
  var diceResult = document.getElementById('ttDiceResult');
  var diceHistory = document.getElementById('ttDiceHistory');
  var dieCountOut = document.getElementById('ttCount');
  var countDownBtn = document.getElementById('ttCountDown');
  var countUpBtn = document.getElementById('ttCountUp');
  var deckLeftEl = document.getElementById('ttDeckLeft');
  var flipBtn = document.getElementById('ttFlipBtn');

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
  var clearArmed = false;
  var clearTimer = null;
  var toastTimer = null;
  var drawQueued = false;

  var dieSides = 6;
  var dieCount = 1;
  var rolling = false;
  var diceHistoryLog = [];

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
      tiles: tiles,
      bg: null,
      tokens: [],
      deck: makeDeck(),
      nextId: 1,
      mode: 'build',
      terrain: 'grass',
      brush: 1,
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
    updateUndoButton();
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
    var rank = RANK_NAMES[t.r] || String(t.r + 1);
    return rank + ' of ' + SUITS[t.s].name;
  }

  function cardFaceText(t) {
    return RANKS[t.r] + SUITS[t.s].glyph;
  }

  function tokenLabel(t) {
    if (t.type === 'card') {
      return (t.faceDown ? 'Face down card' : 'Card ' + cardLabel(t)) + ', ' + posLabel(t);
    }
    return pieceDef(t.kind).label + ', ' + posLabel(t);
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

    if (t.type === 'card') {
      btn.classList.toggle('is-down', !!t.faceDown);
      btn.style.setProperty('--tc', SUITS[t.s].color);
      btn.style.color = t.faceDown ? '#fff' : SUITS[t.s].color;
    } else {
      btn.style.setProperty('--tc', pieceDef(t.kind).color);
    }

    var glyph = document.createElement('span');
    glyph.className = 'tt-token-glyph';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.textContent = t.type === 'card'
      ? (t.faceDown ? '★' : cardFaceText(t))
      : pieceDef(t.kind).glyph;
    btn.appendChild(glyph);

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
    if (t.type === 'card') {
      el.classList.toggle('is-down', !!t.faceDown);
      el.style.color = t.faceDown ? '#fff' : SUITS[t.s].color;
      var glyph = el.querySelector('.tt-token-glyph');
      if (glyph) glyph.textContent = t.faceDown ? '★' : cardFaceText(t);
    }
  }

  function layoutTokens() {
    var rect = stage.getBoundingClientRect();
    if (!rect.width) return;
    var cellPx = rect.width / S.cols;
    var tok = clamp(cellPx * 0.8, 24, 64);
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
    S.tokens.push(t);
    return t;
  }

  function addCard(x, y) {
    var card = drawFromDeck();
    var t = {
      id: S.nextId++,
      type: 'card',
      r: card.r,
      s: card.s,
      x: x,
      y: y,
      rot: (Math.random() * 12) - 6,
      scale: 1,
      faceDown: false
    };
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
    toast('You drew the ' + cardLabel(t) + '.');
    announce('Drew the ' + cardLabel(t) + '.');
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
    if (t) flipBtn.hidden = t.type !== 'card';
  }

  function flipToken(t) {
    t.faceDown = !t.faceDown;
    updateTokenElement(t);
    markDirty();
    announce(t.faceDown ? 'Card turned face down.' : 'Card turned face up: ' + cardLabel(t) + '.');
  }

  function nudgeToken(t, dx, dy) {
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
    if (S.selectedId === t.id) S.selectedId = 0;
    renderTokens();
    markDirty();
    updatePieceBar();
    announce('Piece removed.');
  }

  /* ------------------------------------------------------------------ */
  /* Cards                                                               */
  /* ------------------------------------------------------------------ */

  function makeDeck() {
    var deck = [];
    for (var s = 0; s < SUITS.length; s++) {
      for (var r = 0; r < RANKS.length; r++) deck.push({ r: r, s: s });
    }
    for (var i = deck.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = deck[i];
      deck[i] = deck[j];
      deck[j] = tmp;
    }
    return deck;
  }

  function drawFromDeck() {
    if (!Array.isArray(S.deck) || S.deck.length === 0) S.deck = makeDeck();
    return S.deck.pop();
  }

  function updateDeckLabel() {
    var n = Array.isArray(S.deck) ? S.deck.length : 52;
    deckLeftEl.textContent = n + ' cards left. Tap a card on the board to flip it.';
  }

  /* ------------------------------------------------------------------ */
  /* Painting                                                            */
  /* ------------------------------------------------------------------ */

  function paintCell(col, row, terrain) {
    var spread = (S.shape === 'square' && S.brush === 3) ? 1 : 0;
    for (var dr = -spread; dr <= spread; dr++) {
      for (var dc = -spread; dc <= spread; dc++) {
        var c = col + dc;
        var r = row + dr;
        if (c < 0 || r < 0 || c >= S.cols || r >= S.rows) continue;
        S.tiles[r * S.cols + c] = (terrain === 'erase') ? null : terrain;
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
    if (lastPaintCell) paintLine(lastPaintCell, cell, terrain);
    else paintCell(cell.col, cell.row, terrain);
    lastPaintCell = cell;
    hideEmpty();
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
      tiles: S.tiles.slice(),
      bg: S.bg,
      tokens: S.tokens.map(function (t) {
        var copy = {};
        for (var k in t) {
          if (Object.prototype.hasOwnProperty.call(t, k)) copy[k] = t[k];
        }
        return copy;
      }),
      deck: (S.deck || []).map(function (c) {
        return { r: c.r, s: c.s };
      }),
      nextId: S.nextId
    };
  }

  function pushUndo() {
    undos.push(snapshot());
    if (undos.length > 30) undos.shift();
    updateUndoButton();
  }

  function restore(snap) {
    S.cols = snap.cols;
    S.rows = snap.rows;
    S.shape = snap.shape;
    S.tiles = snap.tiles.slice();
    S.bg = snap.bg;
    S.tokens = snap.tokens.map(function (t) {
      var copy = {};
      for (var k in t) {
        if (Object.prototype.hasOwnProperty.call(t, k)) copy[k] = t[k];
      }
      return copy;
    });
    S.deck = (snap.deck || []).slice();
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
    restore(undos.pop());
    markDirty();
    toast('Undone.');
    announce('Undone.');
  }

  function updateUndoButton() {
    if (undoBtn) undoBtn.disabled = undos.length === 0;
  }

  function markDirty() {
    updateSaveState('Unsaved changes', true);
  }

  function updateSaveState(text, dirty) {
    if (!savedEl) return;
    savedEl.textContent = text;
    savedEl.classList.toggle('is-dirty', !!dirty);
  }

  function saveBoard(quiet) {
    try {
      var payload = snapshot();
      payload.v = 1;
      payload.savedAt = Date.now();
      payload.mode = S.mode;
      payload.terrain = S.terrain;
      payload.brush = S.brush;
      payload.snap = S.snap;
      payload.selectedId = 0;
      localStorage.setItem(STORE_KEY, JSON.stringify(payload));
      updateSaveState('Saved just now', false);
      if (!quiet) {
        toast('Saved to this browser.');
        announce('Board saved to this browser.');
      }
      return true;
    } catch (err) {
      toast('Could not save. Browser storage may be full.');
      return false;
    }
  }

  function loadBoard() {
    var raw;
    try {
      raw = localStorage.getItem(STORE_KEY);
    } catch (err) {
      return false;
    }
    if (!raw) return false;

    var data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      return false;
    }
    if (!data || !Array.isArray(data.tiles)) return false;

    var cols = clamp(Number(data.cols) || 12, 2, 40);
    var rows = clamp(Number(data.rows) || 9, 2, 30);
    var shape = data.shape === 'hex' ? 'hex' : 'square';

    S.cols = cols;
    S.rows = rows;
    S.shape = shape;

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
    S.deck = Array.isArray(data.deck) ? data.deck.filter(function (card) {
      return card &&
        Number.isInteger(card.r) && card.r >= 0 && card.r < 13 &&
        Number.isInteger(card.s) && card.s >= 0 && card.s < 4;
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
          token.r = clamp(Number(t.r) || 0, 0, 12);
          token.s = clamp(Number(t.s) || 0, 0, 3);
          token.faceDown = !!t.faceDown;
        } else {
          token.type = 'piece';
          token.kind = pieceDef(t.kind).id;
        }
        maxId = Math.max(maxId, id);
        S.tokens.push(token);
      });
    }
    S.nextId = Math.max(maxId + 1, Number(data.nextId) || 1);
    S.mode = data.mode === 'play' ? 'play' : 'build';
    S.terrain = TERRAIN[data.terrain] ? data.terrain : 'grass';
    S.brush = Number(data.brush) === 3 ? 3 : 1;
    S.snap = data.snap !== false;
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

    function settle() {
      for (var d = 0; d < dice.length; d++) {
        dice[d].spin(false);
        dice[d].set(results[d]);
        dice[d].el.classList.remove('is-settled');
        void dice[d].el.offsetWidth;
        dice[d].el.classList.add('is-settled');
      }

      var total = results.reduce(function (a, b) { return a + b; }, 0);
      var text;
      if (results.length === 1) {
        text = 'You rolled ' + results[0] + ' on a d' + useSides + '.';
      } else {
        text = 'You rolled ' + results.join(', ') + ' on ' + results.length + 'd' + useSides + ' (total ' + total + ').';
      }
      diceResult.textContent = text;
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
      statusEl.textContent = 'Play mode: drag pieces anywhere. Tap a card to flip it.';
      barHint.textContent = 'Pieces move freely in Play mode.';
      byId('ttTerrainHelp').textContent = 'Play mode is on. Switch to Build to paint.';
    } else {
      statusEl.textContent = 'Build mode: paint tiles, then drag pieces into place.';
      barHint.textContent = 'Drag a piece onto the board.';
      byId('ttTerrainHelp').textContent = 'Pick a colour, then paint the board.';
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
  }

  function hideEmpty() {
    if (!emptyDismissed) {
      emptyDismissed = true;
      emptyEl.hidden = true;
    }
  }

  function startMeadow() {
    pushUndo();
    S.tiles = [];
    var i;
    for (i = 0; i < S.cols * S.rows; i++) S.tiles.push('grass');

    var pathRow = Math.floor(S.rows / 2);
    for (var c = 0; c < S.cols; c++) {
      S.tiles[pathRow * S.cols + c] = 'path';
      if (c % 3 === 0 && pathRow + 1 < S.rows) S.tiles[(pathRow + 1) * S.cols + c] = 'path';
    }

    var pond = [[S.cols - 4, 1], [S.cols - 3, 1], [S.cols - 4, 2], [S.cols - 3, 2]];
    pond.forEach(function (p) {
      if (p[0] >= 0 && p[1] >= 0 && p[0] < S.cols && p[1] < S.rows) {
        S.tiles[p[1] * S.cols + p[0]] = 'water';
      }
    });

    var forest = [[1, 1], [2, 1], [1, 2], [2, 2], [S.cols - 2, S.rows - 2], [S.cols - 3, S.rows - 2]];
    forest.forEach(function (p) {
      if (p[0] >= 0 && p[1] >= 0 && p[0] < S.cols && p[1] < S.rows) {
        S.tiles[p[1] * S.cols + p[0]] = 'forest';
      }
    });

    S.tokens = [];
    S.deck = makeDeck();
    var heroSpot = centerOf(1, pathRow);
    var meepleSpot = centerOf(2, pathRow);
    var treeSpot = centerOf(2, 2);
    var starSpot = centerOf(S.cols - 2, 2);
    addPiece('hero', heroSpot.x, heroSpot.y);
    addPiece('meeple', meepleSpot.x, meepleSpot.y);
    addPiece('tree', treeSpot.x, treeSpot.y);
    addPiece('star', starSpot.x, starSpot.y);

    S.selectedId = 0;
    hideEmpty();
    renderAll();
    markDirty();
    toast('A little meadow, ready to play.');
    announce('Meadow board started with four pieces.');
  }

  function clearBoard() {
    pushUndo();
    S.tiles = [];
    for (var i = 0; i < S.cols * S.rows; i++) S.tiles.push(null);
    S.tokens = [];
    S.bg = null;
    bgImg = null;
    S.deck = [];
    S.selectedId = 0;
    emptyDismissed = false;
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
        context.strokeStyle = '#403B33';
        context.lineWidth = 3 * scale;
        context.stroke();
        context.fillStyle = t.faceDown ? '#70A3A7' : SUITS[t.s].color;
        context.font = '800 ' + Math.round(18 * scale) + 'px Inter, system-ui, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(t.faceDown ? '★' : cardFaceText(t), 0, 0);
      } else {
        var r = cell * 0.3;
        context.beginPath();
        context.arc(0, 0, r, 0, Math.PI * 2);
        context.fillStyle = '#fffdf8';
        context.fill();
        context.strokeStyle = pieceDef(t.kind).color;
        context.lineWidth = 4 * scale;
        context.stroke();
        context.fillStyle = '#1a1a1a';
        context.font = Math.round(r * 1.25) + 'px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(pieceDef(t.kind).glyph, 0, 0);
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
        downloadBlob(blob, 'tabletop-board.png');
        toast('Board image exported.');
        announce('Board image exported as a PNG.');
      }, 'image/png');
    } else {
      var link = document.createElement('a');
      link.href = out.toDataURL('image/png');
      link.download = 'tabletop-board.png';
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast('Board image exported.');
    }
  }

  function exportJSON() {
    var data = snapshot();
    data.v = 1;
    data.savedAt = Date.now();
    data.mode = S.mode;
    data.terrain = S.terrain;
    data.brush = S.brush;
    data.snap = S.snap;
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'tabletop-board.json');
    toast('Board file saved.');
    announce('Board file saved as JSON.');
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
      b.innerHTML = '<span class="tt-swatch-chip" aria-hidden="true"></span><span class="tt-swatch-name">' + t.name + '</span>';
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
      b.className = 'tt-piece-btn';
      b.dataset.piece = p.id;
      b.setAttribute('aria-label', 'Place ' + p.label);
      b.innerHTML = '<span class="tt-piece-glyph" aria-hidden="true">' + p.glyph + '</span><span>' + p.label + '</span>';
      frag.appendChild(b);
    });
    host.appendChild(frag);
  }

  function syncControls() {
    byId('ttShape').value = S.shape;
    byId('ttSize').value = S.cols + 'x' + S.rows;
    byId('ttSnap').checked = !!S.snap;

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

    dieCountOut.textContent = String(dieCount);
    countDownBtn.disabled = dieCount <= 1;
    countUpBtn.disabled = dieCount >= MAX_DICE;
    rollBtn.textContent = 'Roll d' + dieSides;
    stage.dataset.mode = S.mode;
    updateStatus();
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
      byId('ttTerrainHelp').textContent = 'Erase is on. Drag across tiles to rub them out.';
      announce('Eraser selected.');
    } else {
      byId('ttTerrainHelp').textContent = 'Painting with ' + TERRAIN[btn.dataset.terrain].name + '.';
      announce(TERRAIN[btn.dataset.terrain].name + ' selected.');
    }
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
    painting = true;
    eraseStroke = event.button === 2 || S.terrain === 'erase';
    lastPaintCell = null;
    kbActive = false;
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
      paintCell(kbCursor.col, kbCursor.row, S.terrain);
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

  function onGlobalKeyDown(event) {
    var tag = (event.target.tagName || '').toLowerCase();
    var typing = tag === 'input' || tag === 'textarea' || tag === 'select';
    if ((event.ctrlKey || event.metaKey) && !typing && String(event.key).toLowerCase() === 'z') {
      event.preventDefault();
      undo();
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
      t.rot = ((t.rot || 0) + 45) % 360;
      updateTokenElement(t);
      markDirty();
    } else if (action === 'smaller') {
      t.scale = clamp((t.scale || 1) - 0.15, 0.55, 1.9);
      updateTokenElement(t);
      markDirty();
    } else if (action === 'bigger') {
      t.scale = clamp((t.scale || 1) + 0.15, 0.55, 1.9);
      updateTokenElement(t);
      markDirty();
    } else if (action === 'flip') {
      flipToken(t);
    } else if (action === 'remove') {
      removeToken(t);
    }
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

    byId('ttPieces').addEventListener('click', onPieceClick);
    byId('ttPieces').addEventListener('pointerdown', onPiecePointerDown);

    byId('ttDrawCard').addEventListener('click', spawnCard);
    byId('ttQuickCard').addEventListener('click', spawnCard);

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
    undoBtn.addEventListener('click', undo);
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

    byId('ttSnap').addEventListener('change', function (event) {
      S.snap = event.target.checked;
      announce(S.snap ? 'Snap on. Pieces click to the grid.' : 'Snap off. Pieces stay where you drop them.');
    });

    byId('ttStartMeadow').addEventListener('click', startMeadow);
    byId('ttStartBlank').addEventListener('click', function () {
      hideEmpty();
      try { cv.focus({ preventScroll: true }); } catch (err) { cv.focus(); }
      toast('Blank board ready. Pick a colour and paint.');
      announce('Blank board ready. Pick a terrain colour and paint the board.');
    });

    sidebarOpen.addEventListener('click', openSidebar);
    byId('ttSidebarClose').addEventListener('click', closeSidebar);
    backdrop.addEventListener('click', closeSidebar);

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
    var hadSave = loadBoard();

    buildTerrainPalette();
    buildPieces();
    buildDiceTypes();
    wireEvents();

    if (hadSave && S.bg) setBgImage(S.bg);
    syncControls();
    renderAll();
    updateSaveState(hadSave ? 'Saved board loaded' : 'Not saved yet', false);
    if (hadSave) toast('Your saved board is back.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

