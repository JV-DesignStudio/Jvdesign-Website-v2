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
  var SVG_MM_PER_CELL = 20;
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
    { id: 'counter',  label: 'Counter',    glyph: '1',  color: '#c98a2e', counter: true },
    { id: 'sword',   label: 'Sword',      glyph: '⚔️', color: '#7d7566' },
    { id: 'shield',  label: 'Shield',     glyph: '🛡️', color: '#3f6e71' },
    { id: 'dragon',  label: 'Dragon',     glyph: '🐉', color: '#BC4749' },
    { id: 'skull',   label: 'Skull',      glyph: '💀', color: '#6B6257' },
    { id: 'crown',   label: 'Crown',      glyph: '👑', color: '#c98a2e' },
    { id: 'wizard',  label: 'Wizard',     glyph: '🧙', color: '#7a5aa8' },
    { id: 'coin',    label: 'Coin',       glyph: '🪙', color: '#c98a2e' },
    { id: 'cottage', label: 'Cottage',    glyph: '🏠', color: '#b8956a' }
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
    wall:   { name: 'Wall',   color: '#6B6257', icon: '🧱' },
    cave:   { name: 'Cave',   color: '#2D2B35', icon: '🕳️' },
    sky:    { name: 'Sky',    color: '#A8D5F5', icon: '☁️' },
    swamp:  { name: 'Swamp',  color: '#4E6741', icon: '🐸' },
    magic:  { name: 'Magic',  color: '#7B4BBF', icon: '🔮' }
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
  var MIN_COLS = 2;
  var MAX_COLS = 40;
  var MIN_ROWS = 2;
  var MAX_ROWS = 30;
  var PLAYER_COLORS = ['#BC4749', '#3f6e71', '#c98a2e', '#7a5aa8'];
  var EFFECT_TYPES = { forward: 1, back: 1, goTo: 1, skip: 1, again: 1, card: 1, money: 1 };
  var TEACH = {
    snakes: {
      steps: { paint: 'Number the track', piece: 'Add snakes and ladders', roll: 'Roll and climb' },
      build: 'Tap Play, roll for Player 1 and climb a ladder.',
      play: 'Roll the dice, then watch the pawn climb or slide.'
    },
    ludo: {
      steps: { paint: 'Check the loop', piece: 'Set the four homes', roll: 'Roll a 6 to start' },
      build: 'Tap Set up player pawns, then roll a 6 to leave home.',
      play: 'Roll a 6 to start. Land on a rival to send it home.'
    },
    property: {
      steps: { paint: 'Check the streets', piece: 'Set starting money', roll: 'Roll and buy' },
      build: 'Set starting money, then tap Play and roll to buy a street.',
      play: 'Roll and move. Buy the tile under your pawn.'
    },
    life: {
      steps: { paint: 'Follow the path', piece: 'Read the events', roll: 'Roll and move' },
      build: 'Read the event tiles, then tap Play and roll.',
      play: 'Roll and move. Paydays and setbacks change your money.'
    },
    draughts: {
      steps: { paint: 'Check the squares', piece: 'Place the pieces', roll: 'Start playing' },
      build: 'Pieces are ready. Drag one to make your first move.',
      play: 'Drag a piece one dark square diagonally.'
    },
    connect: {
      steps: { paint: 'Check the columns', piece: 'Add counters', roll: 'Start playing' },
      build: 'Drop a counter into a column to start.',
      play: 'Drop a counter into a column.'
    }
  };

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
  var modeDiceBtn = document.getElementById('ttModeDice');
  var modeSpinnerBtn = document.getElementById('ttModeSpinner');
  var dicePanel = document.getElementById('ttDicePanel');
  var spinnerPanel = document.getElementById('ttSpinnerPanel');
  var spinnerSizeInput = document.getElementById('ttSpinnerSize');
  var spinnerLabelsInput = document.getElementById('ttSpinnerLabels');
  var spinBtn = document.getElementById('ttSpinBtn');
  var spinnerWheel = document.getElementById('ttSpinnerWheel');
  var spinnerResult = document.getElementById('ttSpinnerResult');
  var deckSelect = document.getElementById('ttDeckSelect');
  var deckNameInput = document.getElementById('ttDeckName');
  var deckAddBtn = document.getElementById('ttDeckAdd');
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
  var colsInput = document.getElementById('ttCols');
  var rowsInput = document.getElementById('ttRows');
  var sizeApplyBtn = document.getElementById('ttSizeApply');
  var pathDrawBtn = document.getElementById('ttPathDraw');
  var pathLinkBtn = document.getElementById('ttPathLink');
  var pathNumberBtn = document.getElementById('ttPathNumber');
  var pathSerpentineBtn = document.getElementById('ttPathSerpentine');
  var pathReverseBtn = document.getElementById('ttPathReverse');
  var pathClearBtn = document.getElementById('ttPathClear');
  var pathSnapInput = document.getElementById('ttPathSnap');
  var routeCount = document.getElementById('ttRouteCount');
  var routeHelp = document.getElementById('ttRouteHelp');
  var setupPawnsBtn = document.getElementById('ttSetupPawns');
  var ruleExactInput = document.getElementById('ttRuleExact');
  var ruleSixInput = document.getElementById('ttRuleSix');
  var ruleStartBonusInput = document.getElementById('ttRuleStartBonus');
  var ruleCaptureInput = document.getElementById('ttRuleCapture');
  var ruleStackInput = document.getElementById('ttRuleStack');
  var ruleRentInput = document.getElementById('ttRuleRent');
  var buyTileBtn = document.getElementById('ttBuyTile');
  var tileOwnerInput = document.getElementById('ttTileOwner');
  var startingMoneyInput = document.getElementById('ttStartingMoney');
  var tilePanel = document.getElementById('ttTilePanel');
  var tileBackdrop = document.getElementById('ttTileBackdrop');
  var tileCloseBtn = document.getElementById('ttTileClose');
  var tileWhere = document.getElementById('ttTileWhere');
  var tileNumberInput = document.getElementById('ttTileNumber');
  var tileLabelInput = document.getElementById('ttTileLabel');
  var tileIconInput = document.getElementById('ttTileIcon');
  var tileGroupInput = document.getElementById('ttTileGroup');
  var tileGroupClearBtn = document.getElementById('ttTileGroupClear');
  var tileEffectInput = document.getElementById('ttTileEffect');
  var tileEffectLabel = document.getElementById('ttTileEffectLabel');
  var tileEffectValueInput = document.getElementById('ttTileEffectValue');
  var tileNoteInput = document.getElementById('ttTileNote');
  var tileRemoveBtn = document.getElementById('ttTileRemove');
  var tileSaveBtn = document.getElementById('ttTileSave');
  var winEl = document.getElementById('ttWin');
  var winBackdrop = document.getElementById('ttWinBackdrop');
  var winCloseBtn = document.getElementById('ttWinClose');
  var winAgainBtn = document.getElementById('ttWinAgain');
  var winText = document.getElementById('ttWinText');
  var winTitle = document.getElementById('ttWinTitle');
  var printSizeInput = document.getElementById('ttPrintSize');
  var printKitBtn = document.getElementById('ttPrintKit');
  var shareCodeInput = document.getElementById('ttShareCode');
  var shareCopyBtn = document.getElementById('ttShareCopy');
  var shareLoadBtn = document.getElementById('ttShareLoad');
  var recentColoursEl = document.getElementById('ttRecentColours');
  var pieceSearchInput = document.getElementById('ttPieceSearch');
  var selectAreaBtn = document.getElementById('ttSelectArea');
  var copyAreaBtn = document.getElementById('ttCopyArea');
  var stampAreaBtn = document.getElementById('ttStampArea');
  var clearAreaBtn = document.getElementById('ttClearArea');
  var mirrorBoardBtn = document.getElementById('ttMirrorBoard');
  var flipBoardBtn = document.getElementById('ttFlipBoard');
  var dupRowBtn = document.getElementById('ttDupRow');
  var dupColBtn = document.getElementById('ttDupCol');
  var selectHint = document.getElementById('ttSelectHint');
  var rulesGenerateBtn = document.getElementById('ttRulesGenerate');
  var rulesSummaryEl = document.getElementById('ttRulesSummary');
  var branchLabelInput = document.getElementById('ttBranchLabel');
  var branchToolBtn = document.getElementById('ttBranchTool');
  var branchClearBtn = document.getElementById('ttBranchClear');
  var choiceEl = document.getElementById('ttChoice');
  var choiceBackdrop = document.getElementById('ttChoiceBackdrop');
  var choiceCloseBtn = document.getElementById('ttChoiceClose');
  var choiceOptions = document.getElementById('ttChoiceOptions');
  var choiceText = document.getElementById('ttChoiceText');
  var diceNormalBtn = document.getElementById('ttDiceNormal');
  var diceActionBtn = document.getElementById('ttDiceAction');
  var actionFacesInput = document.getElementById('ttActionFaces');
  var actionSaveBtn = document.getElementById('ttActionSave');

  var S = blankState();
  var bgImg = null;
  var soundMuted = false;
  var audioCtx = null;
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
  var spinnerSpinning = false;
  var diceHistoryLog = [];
  var firstSteps = { paint: false, piece: false, roll: false, dismissed: false, celebrated: false };
  var tileTarget = { col: -1, row: -1 };
  var pendingLink = null;
  var moveTimers = [];
  var tileGroupChosen = false;
  var tileTrigger = null;
  var winTrigger = null;
  var longPressTimer = null;
  var longPressCell = null;
  var paintMoved = false;
  var selection = null;
  var areaClipboard = null;
  var recentColours = [];
  var pendingBranch = null;
  var choiceCallback = null;
  var choiceTrigger = null;

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

  function sameCell(a, b) {
    return !!a && !!b && a.c === b.c && a.r === b.r;
  }

  function cellIndex(col, row) {
    return row * S.cols + col;
  }

  function metaAt(col, row) {
    if (col < 0 || row < 0 || col >= S.cols || row >= S.rows) return null;
    return S.meta && S.meta[cellIndex(col, row)] ? S.meta[cellIndex(col, row)] : null;
  }

  function ensureMeta() {
    var total = S.cols * S.rows;
    if (!Array.isArray(S.meta)) S.meta = [];
    while (S.meta.length < total) S.meta.push(null);
    if (S.meta.length > total) S.meta.length = total;
  }

  function sanitiseMeta(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var out = {};
    var n = Number(raw.n);
    if (isFinite(n) && n > 0) out.n = clamp(Math.round(n), 0, 999);
    if (typeof raw.label === 'string' && raw.label.trim()) out.label = raw.label.trim().slice(0, 24);
    if (typeof raw.icon === 'string' && raw.icon.trim()) out.icon = raw.icon.trim().slice(0, 4);
    if (typeof raw.group === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(raw.group)) out.group = raw.group;
    if (typeof raw.note === 'string' && raw.note.trim()) out.note = raw.note.trim().slice(0, 60);
    var owner = Number(raw.owner);
    if (isFinite(owner) && owner >= 1 && owner <= 4) out.owner = Math.round(owner);
    var effect = raw.effect;
    if (effect && typeof effect === 'object' && EFFECT_TYPES[effect.type]) {
      out.effect = {
        type: effect.type,
        value: clamp(Math.round(Number(effect.value) || 0), -999, 999)
      };
    }
    return Object.keys(out).length ? out : null;
  }

  function cloneMeta(meta) {
    if (!meta) return null;
    var copy = {};
    if (meta.n) copy.n = meta.n;
    if (meta.label) copy.label = meta.label;
    if (meta.icon) copy.icon = meta.icon;
    if (meta.group) copy.group = meta.group;
    if (meta.note) copy.note = meta.note;
    if (meta.owner) copy.owner = meta.owner;
    if (meta.effect) copy.effect = { type: meta.effect.type, value: meta.effect.value };
    return copy;
  }

  function pathIndexOf(col, row) {
    for (var i = 0; i < S.path.length; i++) {
      if (S.path[i].c === col && S.path[i].r === row) return i;
    }
    return -1;
  }

  function pathCellAt(index) {
    if (index < 0 || index >= S.path.length) return null;
    return S.path[index];
  }

  function validPath(raw, cols, rows) {
    if (!Array.isArray(raw)) return [];
    return raw.filter(function (p) {
      return p && Number.isInteger(p.c) && Number.isInteger(p.r) &&
        p.c >= 0 && p.r >= 0 && p.c < cols && p.r < rows;
    }).map(function (p) { return { c: p.c, r: p.r }; });
  }

  function validLinks(raw, cols, rows) {
    if (!Array.isArray(raw)) return [];
    return raw.filter(function (l) {
      return l && l.from && l.to &&
        Number.isInteger(l.from.c) && Number.isInteger(l.from.r) &&
        Number.isInteger(l.to.c) && Number.isInteger(l.to.r) &&
        l.from.c >= 0 && l.from.r >= 0 && l.from.c < cols && l.from.r < rows &&
        l.to.c >= 0 && l.to.r >= 0 && l.to.c < cols && l.to.r < rows;
    }).map(function (l) {
      return {
        from: { c: l.from.c, r: l.from.r },
        to: { c: l.to.c, r: l.to.r },
        label: typeof l.label === 'string' ? l.label.slice(0, 12) : ''
      };
    });
  }

  function validBranches(raw, cols, rows) {
    if (!Array.isArray(raw)) return [];
    return raw.filter(function (b) {
      return b && b.from && b.to &&
        Number.isInteger(b.from.c) && Number.isInteger(b.from.r) &&
        Number.isInteger(b.to.c) && Number.isInteger(b.to.r) &&
        b.from.c >= 0 && b.from.r >= 0 && b.from.c < cols && b.from.r < rows &&
        b.to.c >= 0 && b.to.r >= 0 && b.to.c < cols && b.to.r < rows;
    }).map(function (b) {
      return {
        from: { c: b.from.c, r: b.from.r },
        to: { c: b.to.c, r: b.to.r },
        label: typeof b.label === 'string' && b.label.trim() ? b.label.trim().slice(0, 16) : 'Choose'
      };
    }).slice(0, 24);
  }

  function normaliseSettings(raw) {
    var out = defaultSettings();
    if (!raw || typeof raw !== 'object') return out;
    out.exactFinish = !!raw.exactFinish;
    out.sixToStart = !!raw.sixToStart;
    out.startBonus = !!raw.startBonus;
    out.capture = !!raw.capture;
    out.stacking = !!raw.stacking;
    out.rent = !!raw.rent;
    out.startingMoney = clamp(Math.round(Number(raw.startingMoney) || 0), 0, 100000);
    out.snapPath = !!raw.snapPath;
    return out;
  }

  function normalisePlayers(raw) {
    var players = defaultPlayers();
    if (!Array.isArray(raw)) return players;
    raw.slice(0, 4).forEach(function (p, idx) {
      if (!p || typeof p !== 'object') return;
      players[idx].name = typeof p.name === 'string' ? p.name.slice(0, 20) : '';
      players[idx].score = clamp(Number(p.score) || 0, -999, 9999);
      players[idx].money = clamp(Math.round(Number(p.money) || 0), -999999, 999999);
      if (typeof p.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(p.color)) players[idx].color = p.color;
      players[idx].skip = !!p.skip;
    });
    return players;
  }

  function defaultSettings() {
    return {
      exactFinish: false,
      sixToStart: false,
      startBonus: false,
      capture: false,
      stacking: false,
      rent: false,
      startingMoney: 0,
      snapPath: false
    };
  }

  function defaultActionFaces() {
    return ['1', '2', '3', 'Draw a card', 'Miss a turn', 'Roll again'];
  }

  function normaliseActionFaces(raw) {
    var out = defaultActionFaces();
    if (Array.isArray(raw)) {
      for (var i = 0; i < 6; i++) {
        if (typeof raw[i] === 'string' && raw[i].trim()) out[i] = raw[i].trim().slice(0, 24);
      }
    }
    return out;
  }

  function defaultSpinner() {
    return { size: 6, labels: ['1', '2', '3', '4', '5', '6'], last: -1 };
  }

  function normaliseSpinner(raw) {
    var out = defaultSpinner();
    if (!raw || typeof raw !== 'object') return out;
    var size = Number(raw.size);
    if ([4, 6, 8, 10].indexOf(size) >= 0) out.size = size;
    if (Array.isArray(raw.labels)) {
      out.labels = raw.labels.slice(0, out.size).map(function (label) {
        return String(label == null ? '' : label).slice(0, 16);
      });
    }
    while (out.labels.length < out.size) out.labels.push(String(out.labels.length + 1));
    out.labels.length = out.size;
    out.last = clamp(Math.round(Number(raw.last) || -1), -1, out.size - 1);
    return out;
  }

  function defaultPlayers() {
    var players = [];
    for (var i = 0; i < 4; i++) {
      players.push({ name: '', score: 0, money: 0, color: PLAYER_COLORS[i], skip: false });
    }
    return players;
  }

  function blankState() {
    var tiles = [];
    var meta = [];
    for (var i = 0; i < 12 * 9; i++) {
      tiles.push(null);
      meta.push(null);
    }
    return {
      cols: 12,
      rows: 9,
      shape: 'square',
      name: '',
      templateId: '',
      tiles: tiles,
      meta: meta,
      path: [],
      links: [],
      branches: [],
      settings: defaultSettings(),
      bg: null,
      bgColor: null,
      tokens: [],
      deck: makeDeck(),
      customCards: [],
      deckStandard: true,
      decks: [],
      activeDeckId: '',
      spinner: defaultSpinner(),
      actionFaces: defaultActionFaces(),
      dieMode: 'numbers',
      rollMode: 'dice',
      players: defaultPlayers(),
      rules: '',
      turn: 1,
      round: 1,
      winner: 0,
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

  function toast(message, type) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.className = 'tt-toast is-on' + (type ? ' tt-toast--' + type : '');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastEl.classList.remove('is-on');
    }, 2600);
  }

  /* ------------------------------------------------------------------ */
  /* Sound                                                              */
  /* ------------------------------------------------------------------ */

  function getAudioCtx() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (err) { audioCtx = null; }
    }
    return audioCtx;
  }

  function playSound(type) {
    if (soundMuted) return;
    var ctx = getAudioCtx();
    if (!ctx) return;
    try {
      if (type === 'roll') {
        var buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.09), ctx.sampleRate);
        var data = buf.getChannelData(0);
        for (var i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.5) * 0.6;
        var src = ctx.createBufferSource();
        src.buffer = buf;
        var gn = ctx.createGain();
        gn.gain.value = 0.4;
        src.connect(gn); gn.connect(ctx.destination); src.start();
      } else if (type === 'place') {
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(620, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(290, ctx.currentTime + 0.1);
        g.gain.setValueAtTime(0.14, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
        osc.connect(g); g.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.14);
      } else if (type === 'flip') {
        var osc2 = ctx.createOscillator();
        var g2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(900, ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.07);
        g2.gain.setValueAtTime(0.09, ctx.currentTime);
        g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
        osc2.connect(g2); g2.connect(ctx.destination); osc2.start(); osc2.stop(ctx.currentTime + 0.09);
      } else if (type === 'win') {
        [523, 659, 784, 1047].forEach(function (freq, i) {
          var osc3 = ctx.createOscillator();
          var g3 = ctx.createGain();
          var at = ctx.currentTime + i * 0.11;
          osc3.type = 'triangle';
          osc3.frequency.setValueAtTime(freq, at);
          g3.gain.setValueAtTime(0.012, at);
          g3.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
          osc3.connect(g3); g3.connect(ctx.destination);
          osc3.start(at); osc3.stop(at + 0.17);
        });
      }
    } catch (err) { /* audio is optional */ }
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

    context.fillStyle = S.bgColor || '#F0EAD6';
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

    drawRoute(context);
    drawBranches(context);
    drawTileDetails(context);
    drawSelection(context);

    if (withCursor && S.mode === 'build') {
      if (pendingLink) outlineCell(context, pendingLink.c, pendingLink.r, '#c98a2e', 4, []);
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

  function drawRoute(context) {
    var i;
    var a;
    var b;
    var ca;
    var cb;

    if (S.path && S.path.length > 1) {
      context.save();
      context.strokeStyle = 'rgba(26,18,8,.28)';
      context.lineWidth = 3;
      context.setLineDash([5, 6]);
      context.beginPath();
      for (i = 0; i < S.path.length; i++) {
        ca = centerOf(S.path[i].c, S.path[i].r);
        if (i === 0) context.moveTo(ca.x, ca.y);
        else context.lineTo(ca.x, ca.y);
      }
      context.stroke();
      context.restore();
    }

    if (S.path && S.path.length) {
      a = S.path[0];
      ca = centerOf(a.c, a.r);
      context.save();
      context.strokeStyle = '#3f8a5f';
      context.lineWidth = 4;
      context.beginPath();
      context.arc(ca.x, ca.y, Math.min(CELL * 0.3, 22), 0, Math.PI * 2);
      context.stroke();
      context.restore();

      b = S.path[S.path.length - 1];
      cb = centerOf(b.c, b.r);
      context.save();
      context.strokeStyle = '#BC4749';
      context.lineWidth = 4;
      context.beginPath();
      context.arc(cb.x, cb.y, Math.min(CELL * 0.3, 22), 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }

    (S.links || []).forEach(function (link) {
      var from = centerOf(link.from.c, link.from.r);
      var to = centerOf(link.to.c, link.to.r);
      var colour = link.label && link.label.charAt(0) === '-' ? '#BC4749' : '#3f8a5f';
      context.save();
      context.strokeStyle = colour;
      context.lineWidth = 3;
      context.setLineDash([7, 5]);
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
      context.setLineDash([]);
      var angle = Math.atan2(to.y - from.y, to.x - from.x);
      var tip = Math.min(CELL * 0.28, 18);
      context.fillStyle = colour;
      context.beginPath();
      context.moveTo(to.x, to.y);
      context.lineTo(to.x - Math.cos(angle - 0.4) * tip, to.y - Math.sin(angle - 0.4) * tip);
      context.lineTo(to.x - Math.cos(angle + 0.4) * tip, to.y - Math.sin(angle + 0.4) * tip);
      context.closePath();
      context.fill();
      if (link.label) {
        var mx = (from.x + to.x) / 2;
        var my = (from.y + to.y) / 2;
        context.font = '700 12px Inter, system-ui, sans-serif';
        var w = context.measureText(link.label).width + 12;
        context.fillStyle = 'rgba(251,248,242,.94)';
        roundRect(context, mx - w / 2, my - 10, w, 20, 8);
        context.fill();
        context.strokeStyle = colour;
        context.lineWidth = 1.5;
        context.stroke();
        context.fillStyle = colour;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(link.label, mx, my + 1);
      }
      context.restore();
    });
  }

  function drawBranches(context) {
    (S.branches || []).forEach(function (branch) {
      var from = centerOf(branch.from.c, branch.from.r);
      var to = centerOf(branch.to.c, branch.to.r);
      var colour = '#7B4BBF';
      context.save();
      context.strokeStyle = colour;
      context.lineWidth = 3;
      context.setLineDash([3, 5]);
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
      context.setLineDash([]);
      var angle = Math.atan2(to.y - from.y, to.x - from.x);
      var tip = Math.min(CELL * 0.24, 16);
      context.fillStyle = colour;
      context.beginPath();
      context.moveTo(to.x, to.y);
      context.lineTo(to.x - Math.cos(angle - 0.42) * tip, to.y - Math.sin(angle - 0.42) * tip);
      context.lineTo(to.x - Math.cos(angle + 0.42) * tip, to.y - Math.sin(angle + 0.42) * tip);
      context.closePath();
      context.fill();
      var mx = (from.x + to.x) / 2;
      var my = (from.y + to.y) / 2;
      var label = branch.label || 'Choose';
      context.font = '700 11px Inter, system-ui, sans-serif';
      var w = context.measureText(label).width + 12;
      context.fillStyle = 'rgba(251,248,242,.95)';
      roundRect(context, mx - w / 2, my - 10, w, 20, 8);
      context.fill();
      context.strokeStyle = colour;
      context.lineWidth = 1.5;
      context.stroke();
      context.fillStyle = colour;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(label, mx, my + 1);
      context.restore();
    });
  }

  function drawTileDetails(context) {
    var col;
    var row;
    var c;
    var meta;
    var effectGlyph = { forward: '↑', back: '↓', goTo: '→', skip: '⏸', again: '↻', card: '🃏', money: '💰' };

    for (row = 0; row < S.rows; row++) {
      for (col = 0; col < S.cols; col++) {
        meta = S.meta && S.meta[cellIndex(col, row)];
        if (!meta) continue;
        c = centerOf(col, row);

        if (meta.group) {
          context.save();
          context.globalAlpha = 0.85;
          context.fillStyle = meta.group;
          if (S.shape === 'square') {
            roundRect(context, c.x - CELL / 2 + 5, c.y - CELL / 2 + 5, CELL - 10, 7, 4);
            context.fill();
          } else {
            context.beginPath();
            context.arc(c.x, c.y - CELL * 0.28, 6, 0, Math.PI * 2);
            context.fill();
          }
          context.restore();
        }

        if (meta.icon) {
          context.save();
          context.font = '16px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
          context.textAlign = 'right';
          context.textBaseline = 'top';
          context.fillText(meta.icon, c.x + CELL / 2 - 7, c.y - CELL / 2 + 7);
          context.restore();
        }

        if (meta.n) {
          var num = String(meta.n);
          var w = 16 + num.length * 7;
          context.save();
          context.fillStyle = 'rgba(26,18,8,.82)';
          roundRect(context, c.x - CELL / 2 + 6, c.y + CELL / 2 - 23, w, 17, 7);
          context.fill();
          context.fillStyle = '#fff';
          context.font = '800 11px Inter, system-ui, sans-serif';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.fillText(num, c.x - CELL / 2 + 6 + w / 2, c.y + CELL / 2 - 14);
          context.restore();
        }

        if (meta.label) {
          context.save();
          context.font = '700 10px Inter, system-ui, sans-serif';
          context.textAlign = 'left';
          context.textBaseline = 'bottom';
          context.fillStyle = 'rgba(26,18,8,.78)';
          context.fillText(meta.label, c.x - CELL / 2 + 7, c.y + CELL / 2 - 26);
          context.restore();
        }

        if (meta.owner) {
          var ownerColour = (S.players[meta.owner - 1] && S.players[meta.owner - 1].color) || PLAYER_COLORS[(meta.owner - 1) % PLAYER_COLORS.length];
          context.save();
          context.beginPath();
          context.arc(c.x + CELL / 2 - 13, c.y + CELL / 2 - 13, 7, 0, Math.PI * 2);
          context.fillStyle = ownerColour;
          context.fill();
          context.strokeStyle = '#fff';
          context.lineWidth = 2;
          context.stroke();
          context.restore();
        }

        if (meta.effect && effectGlyph[meta.effect.type]) {
          context.save();
          context.font = '700 12px Inter, system-ui, sans-serif';
          context.textAlign = 'left';
          context.textBaseline = 'top';
          context.fillStyle = meta.effect.type === 'back' ? '#BC4749' : '#3f6e71';
          context.fillText(effectGlyph[meta.effect.type], c.x - CELL / 2 + 7, c.y - CELL / 2 + 7);
          context.restore();
        }
      }
    }
  }

  function drawSelection(context) {
    if (!selection) return;
    var rect = selectionRect();
    if (!rect) return;
    var a = centerOf(rect.c1, rect.r1);
    var b = centerOf(rect.c2, rect.r2);
    context.save();
    context.fillStyle = 'rgba(112,163,167,.16)';
    context.strokeStyle = 'rgba(63,110,113,.9)';
    context.lineWidth = 2;
    context.setLineDash([6, 4]);
    if (S.shape === 'square') {
      var x = rect.c1 * CELL;
      var y = rect.r1 * CELL;
      var w = (rect.c2 - rect.c1 + 1) * CELL;
      var h = (rect.r2 - rect.r1 + 1) * CELL;
      context.fillRect(x, y, w, h);
      context.strokeRect(x, y, w, h);
    } else {
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, a.y);
      context.lineTo(b.x, b.y);
      context.lineTo(a.x, b.y);
      context.closePath();
      context.fill();
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
    updateRouteState();
    renderCardList();
    renderDecks();
    renderSpinner();
    renderActionDie();
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
    var who = t.pawn && S.players[t.player - 1] && S.players[t.player - 1].name
      ? S.players[t.player - 1].name : def.label;
    if (def.counter) return who + ' ' + (t.value || 1) + ', ' + posLabel(t);
    return who + ', ' + posLabel(t);
  }

  function applyTokenFace(btn, t) {
    var def = t.type === 'card' ? null : pieceDef(t.kind);
    btn.classList.toggle('tt-token--char', !!(def && def.img));
    btn.classList.toggle('tt-token--custom', !!(t.type === 'card' && t.card));
    btn.classList.toggle('tt-token--counter', !!(def && def.counter));
    btn.classList.toggle('tt-token--pawn', !!t.pawn);
    btn.classList.toggle('is-active-pawn', !!t.pawn && t.player === S.turn && S.mode === 'play');
    btn.classList.toggle('is-down', t.type === 'card' && !!t.faceDown);

    var colour = t.type === 'card' ? cardBorder(t) : (t.color || def.color);
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

    if (t.note) {
      var noteEl = document.createElement('span');
      noteEl.className = 'tt-token-note';
      noteEl.textContent = t.note;
      btn.appendChild(noteEl);
    }

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
    var existingNote = el.querySelector('.tt-token-note');
    if (t.note) {
      if (existingNote) existingNote.textContent = t.note;
      else { var nn = document.createElement('span'); nn.className = 'tt-token-note'; nn.textContent = t.note; el.appendChild(nn); }
    } else if (existingNote) {
      existingNote.remove();
    }
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
    playSound('place');
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
    var pieceNoteEl = byId('ttPieceNote');
    if (pieceNoteEl) {
      pieceNoteEl.hidden = !t || t.type === 'card';
      if (t && t.type !== 'card') pieceNoteEl.value = t.note || '';
    }
  }

  function flipToken(t) {
    pushUndo();
    t.faceDown = !t.faceDown;
    updateTokenElement(t);
    markDirty();
    playSound('flip');
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

  function normaliseDeck(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var id = typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 40) : 'deck-' + Math.random().toString(36).slice(2, 8);
    var name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 24) : 'Deck';
    var customCards = Array.isArray(raw.customCards)
      ? raw.customCards.map(sanitiseCustomCard).filter(Boolean).slice(0, 20)
      : [];
    var deck = Array.isArray(raw.deck) ? raw.deck.filter(function (card) {
      if (!card) return false;
      if (card.c) return customCards.some(function (c) { return c.id === card.c; });
      return Number.isInteger(card.r) && card.r >= 0 && card.r < 13 &&
        Number.isInteger(card.s) && card.s >= 0 && card.s < 4;
    }).map(function (card) {
      return card.c ? { c: card.c } : { r: card.r, s: card.s };
    }) : [];
    return { id: id, name: name, customCards: customCards, deck: deck, deckStandard: raw.deckStandard !== false };
  }

  function ensureDecks() {
    if (!Array.isArray(S.decks)) S.decks = [];
    S.decks = S.decks.map(normaliseDeck).filter(Boolean).slice(0, 8);
    if (!S.decks.length) {
      S.decks.push({
        id: 'deck-main',
        name: 'Main deck',
        customCards: (S.customCards || []).map(cloneCustomCard),
        deck: (S.deck || []).map(function (c) { return c && c.c ? { c: c.c } : { r: c.r, s: c.s }; }),
        deckStandard: S.deckStandard !== false
      });
    }
    var found = false;
    for (var i = 0; i < S.decks.length; i++) {
      if (S.decks[i].id === S.activeDeckId) found = true;
    }
    if (!found) S.activeDeckId = S.decks[0].id;
  }

  function activeDeck() {
    ensureDecks();
    for (var i = 0; i < S.decks.length; i++) {
      if (S.decks[i].id === S.activeDeckId) return S.decks[i];
    }
    return S.decks[0];
  }

  function saveActiveDeck() {
    var deck = activeDeck();
    if (!deck) return;
    deck.customCards = (S.customCards || []).map(cloneCustomCard);
    deck.deck = (S.deck || []).map(function (c) { return c && c.c ? { c: c.c } : { r: c.r, s: c.s }; });
    deck.deckStandard = S.deckStandard !== false;
  }

  function loadDeck(id) {
    ensureDecks();
    saveActiveDeck();
    var deck = null;
    for (var i = 0; i < S.decks.length; i++) {
      if (S.decks[i].id === id) deck = S.decks[i];
    }
    if (!deck) return;
    S.activeDeckId = deck.id;
    S.customCards = (deck.customCards || []).map(cloneCustomCard);
    S.deck = (deck.deck || []).map(function (c) { return c && c.c ? { c: c.c } : { r: c.r, s: c.s }; });
    S.deckStandard = deck.deckStandard !== false;
    if (!S.deck.length) S.deck = makeDeck();
    renderDecks();
    renderCardList();
    updateDeckLabel();
    markDirty();
    announce('Switched to ' + deck.name + '.');
  }

  function renderDecks() {
    if (!deckSelect) return;
    ensureDecks();
    deckSelect.textContent = '';
    S.decks.forEach(function (deck) {
      var option = document.createElement('option');
      option.value = deck.id;
      option.textContent = deck.name;
      deckSelect.appendChild(option);
    });
    deckSelect.value = S.activeDeckId;
  }

  function addDeck() {
    ensureDecks();
    if (S.decks.length >= 8) {
      toast('Eight decks is plenty. Pick one of those.');
      return;
    }
    var name = deckNameInput && deckNameInput.value.trim();
    if (!name) {
      toast('Give the new deck a name first.');
      if (deckNameInput) deckNameInput.focus();
      return;
    }
    saveActiveDeck();
    var deck = {
      id: 'deck-' + Date.now().toString(36),
      name: name.slice(0, 24),
      customCards: [],
      deck: [],
      deckStandard: true
    };
    S.decks.push(deck);
    if (deckNameInput) deckNameInput.value = '';
    loadDeck(deck.id);
    toast('Deck “' + deck.name + '” ready.');
  }

  function makeDeck() {
    var deck = [];
    if (!S || S.deckStandard !== false) {
      for (var s = 0; s < SUITS.length; s++) {
        for (var r = 0; r < RANKS.length; r++) deck.push({ r: r, s: s });
      }
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
    var card = S.deck.pop();
    saveActiveDeck();
    return card;
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
    saveActiveDeck();
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
    saveActiveDeck();
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
  /* Route, tile rules and player pawns                                  */
  /* ------------------------------------------------------------------ */

  function setToolMode(tool) {
    S.tool = tool;
    lastPaintCell = null;
    pendingLink = tool === 'link' ? pendingLink : null;
    pendingBranch = tool === 'branch' ? pendingBranch : null;
    updateRouteState();
    updateStatus();
    syncControls();
    scheduleDraw();
  }

  function toggleRouteTool(tool) {
    setToolMode(S.tool === tool ? 'brush' : tool);
    if (S.tool === 'path') toast('Route tool on. Tap tiles in order.');
    else if (S.tool === 'link') toast('Link tool on. Tap a start, then an end.');
  }

  function teachFor() {
    var id = S.templateId || '';
    if (!id && S.name) {
      var name = String(S.name).toLowerCase();
      if (/snake|ladder/.test(name)) id = 'snakes';
      else if (/ludo/.test(name)) id = 'ludo';
      else if (/propert|monopol/.test(name)) id = 'property';
      else if (/life/.test(name)) id = 'life';
      else if (/draught|checker/.test(name)) id = 'draughts';
      else if (/connect/.test(name)) id = 'connect';
    }
    return TEACH[id] || null;
  }

  function buildRulesSummary() {
    var parts = [];
    if (S.path.length) {
      parts.push('Start at tile 1 and race to tile ' + S.path.length + '.');
      parts.push('There are ' + S.path.length + ' stops.');
    }
    if (S.links.length) parts.push(S.links.length + ' snakes or ladders move a pawn up or down.');
    if (S.branches && S.branches.length) parts.push(S.branches.length + ' tiles offer a choice of route.');
    var effects = 0;
    var owners = 0;
    (S.meta || []).forEach(function (meta) {
      if (meta && meta.effect) effects++;
      if (meta && meta.owner) owners++;
    });
    if (effects) parts.push(effects + ' tiles have a landing rule.');
    if (owners) parts.push(owners + ' tiles have an owner.');
    if (S.settings.startingMoney) parts.push('Every player starts with £' + S.settings.startingMoney + '.');
    if (S.settings.sixToStart) parts.push('Roll a 6 to start.');
    if (S.settings.exactFinish && S.path.length) parts.push('Land on the last tile exactly.');
    if (S.settings.startBonus) parts.push('Passing the start pays a bonus.');
    if (S.settings.capture) parts.push('Land on a rival to send it back to the start.');
    if (S.settings.stacking) parts.push('Pieces can share a tile.');
    if (S.settings.rent) parts.push('Landing on an owned tile pays £25 rent.');
    var custom = Array.isArray(S.customCards) ? S.customCards.length : 0;
    if (custom) parts.push('The deck has ' + custom + ' cards of your own.');
    if (S.path.length) parts.push('First to the finish wins.');
    if (!parts.length) parts.push('Paint a board, add pieces and roll the dice.');
    return parts.join(' ');
  }

  function updateRulesSummary() {
    if (rulesSummaryEl) rulesSummaryEl.textContent = buildRulesSummary();
  }

  function writeRulesFromBoard() {
    S.rules = buildRulesSummary();
    if (rulesInput) rulesInput.value = S.rules;
    markDirty();
    toast('Rules written into the box. Edit them any way you like.');
    announce('Rules summary added. You can edit it.');
  }

  function updateRouteState() {
    if (!routeCount) return;
    if (pendingLink) {
      routeCount.textContent = 'Now tap the other end of the link.';
    } else if (!S.path || !S.path.length) {
      routeCount.textContent = 'No route yet. Draw a route, or use Serpentine for a full board.';
    } else {
      routeCount.textContent = S.path.length + ' stops. Start is circled green, finish is circled red.';
    }
    if (pathDrawBtn) pathDrawBtn.setAttribute('aria-pressed', S.tool === 'path' ? 'true' : 'false');
    if (pathLinkBtn) pathLinkBtn.setAttribute('aria-pressed', S.tool === 'link' ? 'true' : 'false');
    if (branchToolBtn) branchToolBtn.setAttribute('aria-pressed', S.tool === 'branch' ? 'true' : 'false');
    if (pendingBranch) {
      routeCount.textContent = 'Now tap the route tile the branch should lead to.';
    } else if (S.branches && S.branches.length) {
      routeCount.textContent = S.path.length + ' stops and ' + S.branches.length + ' choice branches.';
    } else if (S.path.length) {
      routeCount.textContent = S.path.length + ' stops. Start is circled green, finish is circled red.';
    }
    if (pathSnapInput) pathSnapInput.checked = !!(S.settings && S.settings.snapPath);
    if (routeHelp) {
      routeHelp.textContent = S.tool === 'path'
        ? 'Tap tiles in order. Tap Number 1..N when the route is ready.'
        : S.tool === 'link'
          ? 'Tap the start of a snake or ladder, then its end.'
          : S.tool === 'branch'
            ? 'Tap the tile a pawn leaves, then the route tile it can choose.'
            : 'Draw a route, then number it. Race games, snakes and ladders and ludo all use a route.';
    }
  }

  function setMetaNumber(col, row, number) {
    var idx = cellIndex(col, row);
    var meta = S.meta[idx] || {};
    if (number) meta.n = number;
    else delete meta.n;
    S.meta[idx] = Object.keys(meta).length ? meta : null;
  }

  function numberPath() {
    if (!S.path.length) {
      toast('Draw a route first.');
      return;
    }
    pushUndo();
    S.path.forEach(function (p, i) {
      setMetaNumber(p.c, p.r, i + 1);
    });
    scheduleDraw();
    markDirty();
    toast('Route numbered 1 to ' + S.path.length + '.');
    announce('Route numbered 1 to ' + S.path.length + '.');
    updateRouteState();
  }

  function fillSerpentine() {
    S.path = [];
    for (var r = 0; r < S.rows; r++) {
      var forward = r % 2 === 0;
      for (var step = 0; step < S.cols; step++) {
        var c = forward ? step : S.cols - 1 - step;
        S.path.push({ c: c, r: r });
        setMetaNumber(c, r, S.path.length);
      }
    }
  }

  function buildSerpentine() {
    pushUndo();
    fillSerpentine();
    scheduleDraw();
    markDirty();
    hideEmpty();
    toast('Serpentine route numbered 1 to ' + S.path.length + '.');
    announce('Serpentine route numbered 1 to ' + S.path.length + '.');
    updateRouteState();
  }

  function reverseRoute() {
    if (S.path.length < 2) {
      toast('Draw a route first.');
      return;
    }
    pushUndo();
    S.path.reverse();
    S.path.forEach(function (p, i) { setMetaNumber(p.c, p.r, i + 1); });
    scheduleDraw();
    markDirty();
    toast('Route reversed.');
    updateRouteState();
  }

  function clearRoute() {
    if (!S.path.length && !S.links.length) {
      toast('There is no route to clear.');
      return;
    }
    pushUndo();
    S.path.forEach(function (p) {
      var meta = S.meta[cellIndex(p.c, p.r)];
      if (!meta) return;
      delete meta.n;
      if (!Object.keys(meta).length) S.meta[cellIndex(p.c, p.r)] = null;
    });
    S.path = [];
    S.links = [];
    S.branches = [];
    pendingLink = null;
    pendingBranch = null;
    scheduleDraw();
    markDirty();
    toast('Route cleared.');
    updateRouteState();
  }

  function addRouteCell(cell) {
    var last = S.path[S.path.length - 1];
    if (last && sameCell(last, cell)) return;
    pushUndo();
    S.path.push({ c: cell.col, r: cell.row });
    if (!S.tiles[cellIndex(cell.col, cell.row)]) S.tiles[cellIndex(cell.col, cell.row)] = 'path';
    if (!S.path.length || S.path.length === 1) setMetaNumber(cell.col, cell.row, 1);
    else setMetaNumber(cell.col, cell.row, S.path.length);
    hideEmpty();
    markDirty();
    scheduleDraw();
    updateRouteState();
  }

  function metaNumberAt(col, row) {
    var meta = metaAt(col, row);
    return meta && meta.n ? meta.n : 0;
  }

  function addRouteLink(from, to) {
    if (sameCell(from, to)) {
      toast('Pick a different tile for the other end.');
      return;
    }
    pushUndo();
    var startNumber = metaNumberAt(from.col, from.row);
    var endNumber = metaNumberAt(to.col, to.row);
    var label = '';
    if (startNumber && endNumber) {
      var delta = endNumber - startNumber;
      label = (delta > 0 ? '+' : '') + delta;
    }
    S.links.push({ from: { c: from.col, r: from.row }, to: { c: to.col, r: to.row }, label: label });
    setMetaNumber(from.col, from.row, startNumber);
    var idx = cellIndex(from.col, from.row);
    var meta = S.meta[idx] || {};
    if (endNumber) meta.effect = { type: 'goTo', value: endNumber };
    S.meta[idx] = meta;
    pendingLink = null;
    markDirty();
    scheduleDraw();
    toast('Link added' + (label ? ' ' + label : '') + '.');
    announce('Snake or ladder link added.');
    updateRouteState();
  }

  function branchOptionsAt(cell) {
    if (!cell) return [];
    return (S.branches || []).filter(function (branch) {
      return branch.from.c === cell.c && branch.from.r === cell.r;
    });
  }

  function addBranch(fromCell, toCell) {
    if (sameCell(fromCell, toCell)) {
      toast('Pick a different tile for the branch.');
      return;
    }
    var targetIndex = pathIndexOf(toCell.c, toCell.r);
    if (targetIndex < 0) {
      toast('The branch must end on a route tile.');
      return;
    }
    var label = branchLabelInput && branchLabelInput.value.trim()
      ? branchLabelInput.value.trim().slice(0, 16) : 'Choose';
    pushUndo();
    S.branches = (S.branches || []).filter(function (branch) {
      return !(branch.from.c === fromCell.c && branch.from.r === fromCell.r &&
        branch.to.c === toCell.c && branch.to.r === toCell.r);
    });
    S.branches.push({
      from: { c: fromCell.c, r: fromCell.r },
      to: { c: toCell.c, r: toCell.r },
      label: label
    });
    pendingBranch = null;
    markDirty();
    scheduleDraw();
    updateRouteState();
    toast('Branch “' + label + '” added.');
    announce('Choice branch added. Pick it when a pawn lands here.');
  }

  function handleBranchTap(cell) {
    var picked = { c: cell.col, r: cell.row };
    if (!pendingBranch) {
      pendingBranch = picked;
      toast('Now tap the route tile the branch should lead to.');
      scheduleDraw();
      updateRouteState();
    } else if (sameCell(pendingBranch, picked)) {
      pendingBranch = null;
      toast('Branch cancelled.');
      scheduleDraw();
      updateRouteState();
    } else {
      addBranch(pendingBranch, picked);
    }
  }

  function clearBranches() {
    if (!S.branches || !S.branches.length) {
      toast('There are no branches to clear.');
      return;
    }
    pushUndo();
    S.branches = [];
    pendingBranch = null;
    markDirty();
    scheduleDraw();
    updateRouteState();
    toast('Branches cleared.');
  }

  function handleRouteTap(cell) {
    if (S.tool === 'branch') {
      handleBranchTap(cell);
    } else if (S.tool === 'path') {
      addRouteCell(cell);
    } else if (S.tool === 'link') {
      var picked = { c: cell.col, r: cell.row };
      if (!pendingLink) {
        pendingLink = picked;
        toast('Now tap where the link should end.');
        announce('Link start chosen. Tap the end tile.');
        scheduleDraw();
        updateRouteState();
      } else if (sameCell(pendingLink, picked)) {
        pendingLink = null;
        toast('Link cancelled.');
        scheduleDraw();
        updateRouteState();
      } else {
        addRouteLink(pendingLink, picked);
      }
    } else if (S.tool === 'tile') {
      openTilePanel(cell.col, cell.row);
    }
  }

  function selectionRect() {
    if (!selection) return null;
    return {
      c1: Math.min(selection.c1, selection.c2),
      r1: Math.min(selection.r1, selection.r2),
      c2: Math.max(selection.c1, selection.c2),
      r2: Math.max(selection.r1, selection.r2)
    };
  }

  function updateSelectHint() {
    if (!selectHint) return;
    if (!selection) {
      selectHint.textContent = 'No area selected. Tap Select an area, then two corners.';
    } else if (!selection.complete) {
      selectHint.textContent = 'Now tap the opposite corner to finish the area.';
    } else {
      var rect = selectionRect();
      selectHint.textContent = 'Area: ' + (rect.c2 - rect.c1 + 1) + ' x ' + (rect.r2 - rect.r1 + 1) + '. Copy it or clear it.';
    }
    if (selectAreaBtn) selectAreaBtn.setAttribute('aria-pressed', S.tool === 'select' ? 'true' : 'false');
  }

  function handleSelectTap(cell) {
    if (!selection || selection.complete) {
      selection = { c1: cell.col, r1: cell.row, c2: cell.col, r2: cell.row, complete: false };
    } else {
      selection.c2 = cell.col;
      selection.r2 = cell.row;
      selection.complete = true;
    }
    updateSelectHint();
    scheduleDraw();
    hideEmpty();
    announce(selection.complete ? 'Area selected.' : 'Area started. Tap the opposite corner.');
  }

  function copyArea() {
    var rect = selectionRect();
    if (!rect || !selection.complete) {
      toast('Select an area first.');
      return;
    }
    areaClipboard = { cols: rect.c2 - rect.c1 + 1, rows: rect.r2 - rect.r1 + 1, tiles: [], meta: [] };
    for (var r = rect.r1; r <= rect.r2; r++) {
      for (var c = rect.c1; c <= rect.c2; c++) {
        var idx = cellIndex(c, r);
        areaClipboard.tiles.push(S.tiles[idx] || null);
        areaClipboard.meta.push(cloneMeta(S.meta[idx]));
      }
    }
    toast('Copied a ' + areaClipboard.cols + ' x ' + areaClipboard.rows + ' area.');
    announce('Area copied. Select where to stamp it.');
  }

  function stampArea() {
    if (!areaClipboard) {
      toast('Copy an area first.');
      return;
    }
    pushUndo();
    var rect = selectionRect();
    var destC = rect ? rect.c1 : (hover ? hover.col : 0);
    var destR = rect ? rect.r1 : (hover ? hover.row : 0);
    for (var r = 0; r < areaClipboard.rows; r++) {
      for (var c = 0; c < areaClipboard.cols; c++) {
        var tc = destC + c;
        var tr = destR + r;
        if (tc < 0 || tr < 0 || tc >= S.cols || tr >= S.rows) continue;
        var idx = cellIndex(tc, tr);
        S.tiles[idx] = areaClipboard.tiles[r * areaClipboard.cols + c] || null;
        S.meta[idx] = cloneMeta(areaClipboard.meta[r * areaClipboard.cols + c]);
      }
    }
    hideEmpty();
    scheduleDraw();
    markDirty();
    toast('Area stamped.');
    announce('Copied area stamped onto the board.');
  }

  function clearArea() {
    var rect = selectionRect();
    if (!rect || !selection.complete) {
      toast('Select an area first.');
      return;
    }
    pushUndo();
    for (var r = rect.r1; r <= rect.r2; r++) {
      for (var c = rect.c1; c <= rect.c2; c++) {
        var idx = cellIndex(c, r);
        S.tiles[idx] = null;
        S.meta[idx] = null;
      }
    }
    scheduleDraw();
    markDirty();
    toast('Area cleared.');
  }

  function mirrorBoard() {
    pushUndo();
    var tiles = [];
    var meta = [];
    for (var r = 0; r < S.rows; r++) {
      for (var c = 0; c < S.cols; c++) {
        var from = cellIndex(c, r);
        var to = cellIndex(S.cols - 1 - c, r);
        tiles[to] = S.tiles[from];
        meta[to] = cloneMeta(S.meta[from]);
      }
    }
    S.tiles = tiles;
    S.meta = meta;
    S.path = S.path.map(function (p) { return { c: S.cols - 1 - p.c, r: p.r }; });
    S.links = S.links.map(function (l) {
      return { from: { c: S.cols - 1 - l.from.c, r: l.from.r }, to: { c: S.cols - 1 - l.to.c, r: l.to.r }, label: l.label };
    });
    S.branches = S.branches.map(function (b) {
      return { from: { c: S.cols - 1 - b.from.c, r: b.from.r }, to: { c: S.cols - 1 - b.to.c, r: b.to.r }, label: b.label };
    });
    selection = null;
    updateSelectHint();
    scheduleDraw();
    markDirty();
    toast('Board mirrored.');
  }

  function flipBoard() {
    pushUndo();
    var tiles = [];
    var meta = [];
    for (var r = 0; r < S.rows; r++) {
      for (var c = 0; c < S.cols; c++) {
        var from = cellIndex(c, r);
        var to = cellIndex(c, S.rows - 1 - r);
        tiles[to] = S.tiles[from];
        meta[to] = cloneMeta(S.meta[from]);
      }
    }
    S.tiles = tiles;
    S.meta = meta;
    S.path = S.path.map(function (p) { return { c: p.c, r: S.rows - 1 - p.r }; });
    S.links = S.links.map(function (l) {
      return { from: { c: l.from.c, r: S.rows - 1 - l.from.r }, to: { c: l.to.c, r: S.rows - 1 - l.to.r }, label: l.label };
    });
    S.branches = S.branches.map(function (b) {
      return { from: { c: b.from.c, r: S.rows - 1 - b.from.r }, to: { c: b.to.c, r: S.rows - 1 - b.to.r }, label: b.label };
    });
    selection = null;
    updateSelectHint();
    scheduleDraw();
    markDirty();
    toast('Board flipped.');
  }

  function duplicateRow() {
    if (S.rows >= MAX_ROWS) {
      toast('That is as tall as the board can get.');
      return;
    }
    pushUndo();
    var oldTiles = S.tiles.slice();
    var oldMeta = (S.meta || []).slice();
    var oldRows = S.rows;
    S.rows = oldRows + 1;
    S.tiles = [];
    S.meta = [];
    for (var i = 0; i < S.cols * S.rows; i++) {
      S.tiles.push(null);
      S.meta.push(null);
    }
    for (var r = 0; r < oldRows; r++) {
      for (var c = 0; c < S.cols; c++) {
        S.tiles[r * S.cols + c] = oldTiles[r * S.cols + c];
        S.meta[r * S.cols + c] = cloneMeta(oldMeta[r * S.cols + c]);
      }
    }
    for (var c2 = 0; c2 < S.cols; c2++) {
      S.tiles[oldRows * S.cols + c2] = oldTiles[(oldRows - 1) * S.cols + c2];
      S.meta[oldRows * S.cols + c2] = cloneMeta(oldMeta[(oldRows - 1) * S.cols + c2]);
    }
    selection = null;
    updateSelectHint();
    renderAll();
    syncControls();
    markDirty();
    toast('Row duplicated.');
  }

  function duplicateColumn() {
    if (S.cols >= MAX_COLS) {
      toast('That is as wide as the board can get.');
      return;
    }
    pushUndo();
    var oldTiles = S.tiles.slice();
    var oldMeta = (S.meta || []).slice();
    var oldCols = S.cols;
    S.cols = oldCols + 1;
    S.tiles = [];
    S.meta = [];
    for (var i = 0; i < S.cols * S.rows; i++) {
      S.tiles.push(null);
      S.meta.push(null);
    }
    for (var r = 0; r < S.rows; r++) {
      for (var c = 0; c < oldCols; c++) {
        S.tiles[r * S.cols + c] = oldTiles[r * oldCols + c];
        S.meta[r * S.cols + c] = cloneMeta(oldMeta[r * oldCols + c]);
      }
      S.tiles[r * S.cols + oldCols] = oldTiles[r * oldCols + oldCols - 1];
      S.meta[r * S.cols + oldCols] = cloneMeta(oldMeta[r * oldCols + oldCols - 1]);
    }
    selection = null;
    updateSelectHint();
    renderAll();
    syncControls();
    markDirty();
    toast('Column duplicated.');
  }

  function firstBoardCell() {
    for (var i = 0; i < S.tiles.length; i++) {
      if (S.tiles[i]) return { c: i % S.cols, r: Math.floor(i / S.cols) };
    }
    return null;
  }

  function playerToken(player) {
    for (var i = 0; i < S.tokens.length; i++) {
      if (S.tokens[i].pawn && S.tokens[i].player === player) return S.tokens[i];
    }
    return null;
  }

  function pawnOffset(player) {
    var dx = player === 2 || player === 4 ? 9 : -9;
    var dy = player === 3 || player === 4 ? 9 : -9;
    return { x: dx, y: dy };
  }

  function setPawnPosition(token, pathIndex, instant) {
    var pathCell = pathCellAt(pathIndex);
    if (!pathCell) return;
    var centre = centerOf(pathCell.c, pathCell.r);
    var off = pawnOffset(token.player || 1);
    token.pathIndex = pathIndex;
    token.x = centre.x + off.x;
    token.y = centre.y + off.y;
    var el = tokensLayer.querySelector('.tt-token[data-id="' + token.id + '"]');
    if (el) {
      if (!instant && !reduceMotion()) {
        el.classList.add('is-moving');
        window.setTimeout(function () { el.classList.remove('is-moving'); }, 190);
      }
      updateTokenElement(token);
    }
  }

  function setupPawns(resetToStart) {
    if (!S.path.length) {
      var fallback = firstBoardCell();
      if (!fallback) {
        toast('Paint a board or add a route first.');
        return;
      }
      S.path = [fallback];
    }
    pushUndo();
    clearMoveTimers();
    var start = S.path[0];
    S.players.forEach(function (player, idx) {
      var number = idx + 1;
      var token = playerToken(number);
      if (!token) {
        token = addPiece('meeple', 0, 0);
        token.pawn = true;
        token.player = number;
        token.scale = 0.92;
      }
      token.pawn = true;
      token.player = number;
      token.color = player.color || PLAYER_COLORS[idx];
      token.pathIndex = 0;
      setPawnPosition(token, 0, true);
    });
    S.turn = clamp(S.turn || 1, 1, 4);
    S.winner = 0;
    renderTokens();
    layoutTokens();
    hideWin(false);
    markDirty();
    renderPlayers();
    updatePlayAids();
    updateStatus();
    scheduleDraw();
    toast('Player pawns are ready at the start.');
    announce('Player pawns set up at the start of the route.');
  }

  function clearMoveTimers() {
    moveTimers.forEach(function (id) { window.clearTimeout(id); });
    moveTimers = [];
  }

  function buyCurrentTile() {
    var token = playerToken(S.turn || 1);
    if (!token) {
      toast('Set up the player pawns first.');
      return;
    }
    var pathCell = pathCellAt(token.pathIndex);
    if (!pathCell) {
      toast('The current pawn is not on a route tile.');
      return;
    }
    ensureMeta();
    pushUndo();
    var idx = cellIndex(pathCell.c, pathCell.r);
    var meta = S.meta[idx] || {};
    meta.owner = S.turn || 1;
    S.meta[idx] = sanitiseMeta(meta);
    scheduleDraw();
    markDirty();
    toast(activePlayerName() + ' now owns this tile.');
    announce(activePlayerName() + ' now owns this tile.');
  }

  function activePlayerName() {
    var player = S.players[(S.turn || 1) - 1];
    return player && player.name ? player.name : 'Player ' + (S.turn || 1);
  }

  function findCellByNumber(number) {
    if (!number) return null;
    for (var i = 0; i < S.meta.length; i++) {
      var meta = S.meta[i];
      if (meta && meta.n === number) {
        return { c: i % S.cols, r: Math.floor(i / S.cols) };
      }
    }
    return null;
  }

  function movePlayerBy(player, steps, done) {
    var token = playerToken(player);
    if (!token) {
      if (done) done();
      return;
    }
    clearMoveTimers();
    var from = Number.isFinite(token.pathIndex) ? token.pathIndex : 0;
    var target = from + steps;
    var last = S.path.length - 1;
    if (target < 0) target = 0;
    if (target > last) {
      target = last;
      if (S.settings.exactFinish && from + steps > last) {
        target = from;
        toast('Need the exact number to finish.');
      }
    }
    if (steps > 0 && from >= last) {
      if (done) done();
      return;
    }
    var direction = target >= from ? 1 : -1;
    var current = from;
    var stepTime = reduceMotion() ? 0 : 150;
    function step() {
      if (current === target) {
        if (done) done();
        return;
      }
      current += direction;
      setPawnPosition(token, current, false);
      announce('Tile ' + (current + 1) + ' of ' + S.path.length + '.');
      if (stepTime === 0) {
        step();
      } else {
        moveTimers.push(window.setTimeout(step, stepTime));
      }
    }
    step();
  }

  function captureRivals(player) {
    if (!S.settings.capture) return 0;
    var token = playerToken(player);
    if (!token) return 0;
    var caught = 0;
    S.tokens.forEach(function (t) {
      if (!t.pawn || t.player === player) return;
      if (t.pathIndex !== token.pathIndex) return;
      t.pathIndex = 0;
      t.started = false;
      setPawnPosition(t, 0, false);
      caught++;
    });
    if (caught) {
      toast('Captured ' + caught + ' pawn' + (caught > 1 ? 's' : '') + '.');
      announce('Captured ' + caught + ' pawn' + (caught > 1 ? 's' : '') + '.');
    }
    return caught;
  }

  function resolveLanding(player, depth, againFlag, done) {
    var token = playerToken(player);
    if (!token) {
      if (done) done({ again: againFlag });
      return;
    }
    var pathCell = pathCellAt(token.pathIndex);
    if (!pathCell) {
      if (done) done({ again: againFlag });
      return;
    }
    var meta = metaAt(pathCell.c, pathCell.r);
    if (meta && meta.owner && meta.owner !== player && S.settings.rent && depth === 0) {
      var rent = 25;
      S.players[player - 1].money -= rent;
      S.players[meta.owner - 1].money += rent;
      toast('Pay £' + rent + ' rent to ' + (S.players[meta.owner - 1].name || 'Player ' + meta.owner) + '.');
      renderPlayers();
    }
    if (!meta || !meta.effect || depth >= 3) {
      if (done) done({ again: againFlag });
      return;
    }
    var effect = meta.effect;
    var value = effect.value || 0;
    if (effect.type === 'forward' && value) {
      toast('Move forward ' + Math.abs(value) + '.');
      movePlayerBy(player, Math.abs(value), function () { resolveLanding(player, depth + 1, againFlag, done); });
      return;
    }
    if (effect.type === 'back' && value) {
      toast('Move back ' + Math.abs(value) + '.');
      movePlayerBy(player, -Math.abs(value), function () { resolveLanding(player, depth + 1, againFlag, done); });
      return;
    }
    if (effect.type === 'goTo' && value) {
      var targetCell = findCellByNumber(value);
      var targetIndex = targetCell ? pathIndexOf(targetCell.c, targetCell.r) : -1;
      if (targetIndex >= 0) {
        toast('Go to ' + value + '.');
        var jump = targetIndex - token.pathIndex;
        movePlayerBy(player, jump, function () { resolveLanding(player, depth + 1, againFlag, done); });
        return;
      }
    }
    if (effect.type === 'skip') {
      S.players[player - 1].skip = true;
      toast('Miss a turn.');
      announce('Miss a turn.');
    } else if (effect.type === 'again') {
      againFlag = true;
      toast('Roll again.');
    } else if (effect.type === 'card') {
      var spot = freeSpotFrom(pathCell.c, pathCell.r, -1);
      var cardCentre = centerOf(spot.col, spot.row);
      addCard(cardCentre.x, cardCentre.y);
      renderTokens();
      layoutTokens();
      toast('Draw a card.');
    } else if (effect.type === 'money' && value) {
      S.players[player - 1].money += value;
      toast((value > 0 ? 'Collect ' : 'Pay ') + Math.abs(value) + '.');
      renderPlayers();
    }
    if (done) done({ again: againFlag });
  }

  function advanceTurn(againFlag) {
    if (S.players[S.turn - 1]) S.players[S.turn - 1].skip = false;
    if (!againFlag) {
      var next = (S.turn % S.players.length) + 1;
      var guard = 0;
      while (S.players[next - 1] && S.players[next - 1].skip && guard < 4) {
        S.players[next - 1].skip = false;
        next = (next % S.players.length) + 1;
        guard++;
      }
      if (next === 1) S.round = clamp((S.round || 1) + 1, 1, 99);
      S.turn = next;
    }
    renderPlayers();
    updatePlayAids();
    updateStatus();
    markDirty();
  }

  function handlePlayRoll(total) {
    if (S.mode !== 'play' || !S.path.length || rolling) return;
    if (S.winner) {
      toast('This game is finished. Play again from the win screen.');
      return;
    }
    var player = S.turn || 1;
    if (!playerToken(player)) setupPawns(false);
    var token = playerToken(player);
    if (!token) return;
    var name = activePlayerName();
    pushUndo();

    if (S.settings.sixToStart && !token.started) {
      if (total !== 6) {
        toast(name + ' needs a 6 to start.');
        announce(name + ' needs a 6 to start. Turn passes.');
        advanceTurn(false);
        return;
      }
      token.started = true;
      toast(name + ' rolled a 6 and joins the board.');
    }

    var before = token.pathIndex || 0;
    movePlayerBy(player, total, function () {
      if (S.settings.startBonus && before + total >= S.path.length) {
        S.players[player - 1].money += 10;
      }
      afterPlayMove(player);
    });
  }

  function handleActionRoll(label) {
    var text = String(label || '');
    var match = text.match(/-?\d+/);
    var number = match ? parseInt(match[0], 10) : NaN;
    if (isFinite(number)) {
      handlePlayRoll(number);
      return;
    }
    if (S.winner) return;
    toast('"' + text + '" - no move this turn.');
    announce('The action die says ' + text + '. The turn passes.');
    advanceTurn(false);
    scheduleDraw();
  }

  function completePlayTurn(player, again) {
    var token = playerToken(player);
    var last = S.path.length - 1;
    if (token && token.pathIndex >= last) {
      if (!S.settings.exactFinish || token.pathIndex === last) {
        showWinner(player);
        renderPlayers();
        updatePlayAids();
        scheduleDraw();
        markDirty();
        return;
      }
    }
    advanceTurn(!!again);
    scheduleDraw();
  }

  function afterPlayMove(player) {
    captureRivals(player);
    var token = playerToken(player);
    if (!token) {
      completePlayTurn(player, false);
      return;
    }
    var cell = pathCellAt(token.pathIndex);
    var options = branchOptionsAt(cell);
    if (options.length) {
      showChoice(player, options, function (branch) {
        if (!branch) {
          completePlayTurn(player, false);
          return;
        }
        var targetIndex = pathIndexOf(branch.to.c, branch.to.r);
        if (targetIndex < 0) {
          completePlayTurn(player, false);
          return;
        }
        var current = playerToken(player);
        movePlayerBy(player, targetIndex - (current ? current.pathIndex : 0), function () {
          captureRivals(player);
          resolveLanding(player, 1, false, function (state) {
            completePlayTurn(player, state && state.again);
          });
        });
      });
      return;
    }
    resolveLanding(player, 0, false, function (state) {
      completePlayTurn(player, state && state.again);
    });
  }

  function rollForCurrentPlayer() {
    if (!S.path.length) {
      toast('Add a route first, then players can race along it.');
      return;
    }
    if (!playerToken(S.turn || 1)) setupPawns(false);
    setMode('play');
    var roll = byId('ttRoll');
    if (roll) roll.click();
  }

  function resetGame() {
    hideWin(false);
    S.winner = 0;
    S.turn = 1;
    S.round = 1;
    S.players.forEach(function (p) { p.skip = false; });
    S.tokens.forEach(function (t) {
      if (t.pawn) t.started = false;
    });
    if (S.path.length) {
      S.tokens.forEach(function (t) {
        if (t.pawn) setPawnPosition(t, 0, true);
      });
    }
    renderAll();
    markDirty();
    toast('New game ready.');
  }

  /* ------------------------------------------------------------------ */
  /* Undo and save                                                       */
  /* ------------------------------------------------------------------ */

  function snapshot() {
    ensureDecks();
    saveActiveDeck();
    return {
      cols: S.cols,
      rows: S.rows,
      shape: S.shape,
      name: S.name,
      templateId: S.templateId || '',
      tiles: S.tiles.slice(),
      meta: (S.meta || []).map(cloneMeta),
      path: (S.path || []).map(function (p) { return { c: p.c, r: p.r }; }),
      links: (S.links || []).map(function (l) {
        return { from: { c: l.from.c, r: l.from.r }, to: { c: l.to.c, r: l.to.r }, label: l.label || '' };
      }),
      branches: (S.branches || []).map(function (b) {
        return { from: { c: b.from.c, r: b.from.r }, to: { c: b.to.c, r: b.to.r }, label: b.label || 'Choose' };
      }),
      settings: normaliseSettings(S.settings),
      winner: S.winner || 0,
      spinner: normaliseSpinner(S.spinner),
      actionFaces: normaliseActionFaces(S.actionFaces),
      dieMode: S.dieMode === 'action' ? 'action' : 'numbers',
      rollMode: S.rollMode === 'spinner' ? 'spinner' : 'dice',
      activeDeckId: S.activeDeckId || '',
      decks: (S.decks || []).map(function (deck) {
        return {
          id: deck.id,
          name: deck.name,
          customCards: (deck.customCards || []).map(cloneCustomCard),
          deck: (deck.deck || []).map(function (c) { return c && c.c ? { c: c.c } : { r: c.r, s: c.s }; }),
          deckStandard: deck.deckStandard !== false
        };
      }),
      bg: S.bg,
      bgColor: S.bgColor || null,
      rules: S.rules || '',
      turn: S.turn || 1,
      round: S.round || 1,
      deckStandard: S.deckStandard !== false,
      players: (S.players || []).map(function (p) {
        return {
          name: p.name || '',
          score: Number(p.score) || 0,
          money: Number(p.money) || 0,
          color: p.color || PLAYER_COLORS[0],
          skip: !!p.skip
        };
      }),
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
    S.templateId = typeof snap.templateId === 'string' ? snap.templateId.slice(0, 24) : '';
    S.tiles = snap.tiles.slice();
    S.meta = Array.isArray(snap.meta)
      ? snap.meta.map(sanitiseMeta).slice(0, snap.tiles.length)
      : [];
    ensureMeta();
    S.path = validPath(snap.path, S.cols, S.rows);
    S.links = validLinks(snap.links, S.cols, S.rows);
    S.branches = validBranches(snap.branches, S.cols, S.rows);
    S.settings = normaliseSettings(snap.settings);
    S.winner = clamp(Number(snap.winner) || 0, 0, 4);
    S.bg = snap.bg;
    S.bgColor = typeof snap.bgColor === 'string' ? snap.bgColor : null;
    S.rules = typeof snap.rules === 'string' ? snap.rules : '';
    S.turn = clamp(Number(snap.turn) || 1, 1, 99);
    S.round = clamp(Number(snap.round) || 1, 1, 99);
    S.deckStandard = snap.deckStandard !== false;
    S.spinner = normaliseSpinner(snap.spinner);
    S.actionFaces = normaliseActionFaces(snap.actionFaces);
    S.dieMode = snap.dieMode === 'action' ? 'action' : 'numbers';
    S.rollMode = snap.rollMode === 'spinner' ? 'spinner' : 'dice';
    S.decks = Array.isArray(snap.decks) ? snap.decks.slice(0, 8).map(normaliseDeck) : [];
    S.activeDeckId = typeof snap.activeDeckId === 'string' ? snap.activeDeckId : '';
    ensureDecks();
    S.players = normalisePlayers(snap.players);
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

  function clearHistory() {
    undos.length = 0;
    redos.length = 0;
    updateHistoryButtons();
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
    var saveBtn = byId('ttSave');
    if (saveBtn) saveBtn.classList.toggle('is-dirty', !!isDirty);
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
    payload.v = 3;
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
        toast('Saved to this browser.', 'save');
        announce('Board saved to this browser.');
        if (window.ToolAnalytics) {
          try { ToolAnalytics.event('board_saved', 'manual'); } catch (err) { /* analytics is optional */ }
        }
      }
      return true;
    } catch (err) {
      toast('Could not save. Browser storage may be full.', 'error');
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
    if (dirty && !saveBoard(true)) {
      toast('Could not switch boards: this browser storage is full.');
      return;
    }
    library.activeId = id;
    writeLibrary();
    if (!applyBoardData(target.data)) {
      toast('That board could not be opened.');
      return;
    }
    clearHistory();
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
    if (dirty && !saveBoard(true)) {
      toast('Could not make a new board: this browser storage is full.');
      return;
    }
    if (library.boards.length >= MAX_BOARDS) {
      toast('You have ' + MAX_BOARDS + ' boards. Delete one before making another.');
      return;
    }
    resetToBlank();
    clearHistory();
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
    if (dirty && !saveBoard(true)) {
      toast('Could not copy the board: this browser storage is full.');
      return;
    }
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
    clearHistory();
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
      clearHistory();
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
    S.templateId = typeof data.templateId === 'string' ? data.templateId.slice(0, 24) : '';

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

    var srcCols = clamp(Number(data.cols) || cols, 2, MAX_COLS);
    var srcRows = clamp(Number(data.rows) || rows, 2, MAX_ROWS);
    var metaSource = Array.isArray(data.meta) ? data.meta : [];
    S.meta = [];
    for (var mi = 0; mi < cols * rows; mi++) S.meta.push(null);
    if (metaSource.length === cols * rows) {
      S.meta = metaSource.map(sanitiseMeta);
    } else if (metaSource.length === srcCols * srcRows) {
      for (var mr = 0; mr < Math.min(srcRows, rows); mr++) {
        for (var mc = 0; mc < Math.min(srcCols, cols); mc++) {
          S.meta[mr * cols + mc] = sanitiseMeta(metaSource[mr * srcCols + mc]);
        }
      }
    }

    S.path = validPath(data.path, cols, rows);
    S.links = validLinks(data.links, cols, rows);
    S.branches = validBranches(data.branches, cols, rows);
    S.settings = normaliseSettings(data.settings);
    S.winner = clamp(Number(data.winner) || 0, 0, 4);
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
          if (typeof t.note === 'string') token.note = t.note.slice(0, 20);
          if (t.pawn) {
            token.pawn = true;
            token.player = clamp(Math.round(Number(t.player) || 1), 1, 4);
            if (typeof t.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(t.color)) token.color = t.color;
            if (Number.isFinite(Number(t.pathIndex))) token.pathIndex = Math.round(Number(t.pathIndex));
          }
        }
        maxId = Math.max(maxId, id);
        S.tokens.push(token);
      });
    }
    S.nextId = Math.max(maxId + 1, Number(data.nextId) || 1);
    S.mode = data.mode === 'play' ? 'play' : 'build';
    S.terrain = TERRAIN[data.terrain] ? data.terrain : 'grass';
    S.brush = Number(data.brush) === 3 ? 3 : 1;
    S.tool = /^(brush|fill|pick|tile)$/.test(data.tool) ? data.tool : 'brush';
    S.snap = true;
    S.selectedId = 0;
    S.bgColor = typeof data.bgColor === 'string' ? data.bgColor : null;
    S.deckStandard = data.deckStandard !== false;
    S.spinner = normaliseSpinner(data.spinner);
    S.actionFaces = normaliseActionFaces(data.actionFaces);
    S.dieMode = data.dieMode === 'action' ? 'action' : 'numbers';
    S.rollMode = data.rollMode === 'spinner' ? 'spinner' : 'dice';
    S.decks = Array.isArray(data.decks) ? data.decks.slice(0, 8).map(normaliseDeck).filter(Boolean) : [];
    S.activeDeckId = typeof data.activeDeckId === 'string' ? data.activeDeckId : '';
    ensureDecks();
    S.players = normalisePlayers(data.players);

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
      x.fillStyle = S.bgColor || '#F0EAD6';
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

  function resizeGridData(cols, rows, shape) {
    var oldCols = S.cols;
    var oldRows = S.rows;
    var oldTiles = S.tiles;
    var oldMeta = S.meta || [];
    var next = [];
    var nextMeta = [];
    var i;
    for (i = 0; i < cols * rows; i++) {
      next.push(null);
      nextMeta.push(null);
    }
    for (var r = 0; r < Math.min(oldRows, rows); r++) {
      for (var c = 0; c < Math.min(oldCols, cols); c++) {
        next[r * cols + c] = oldTiles[r * oldCols + c] || null;
        nextMeta[r * cols + c] = cloneMeta(oldMeta[r * oldCols + c]);
      }
    }
    S.cols = cols;
    S.rows = rows;
    S.shape = shape;
    S.tiles = next;
    S.meta = nextMeta;
    S.path = validPath(S.path, cols, rows);
    S.links = validLinks(S.links, cols, rows);
    S.branches = validBranches(S.branches, cols, rows);
  }

  function resetGridTo(cols, rows, shape) {
    cols = clamp(Math.round(Number(cols) || S.cols), MIN_COLS, MAX_COLS);
    rows = clamp(Math.round(Number(rows) || S.rows), MIN_ROWS, MAX_ROWS);
    S.cols = cols;
    S.rows = rows;
    S.shape = shape === 'hex' ? 'hex' : 'square';
    S.tiles = [];
    S.meta = [];
    for (var i = 0; i < cols * rows; i++) {
      S.tiles.push(null);
      S.meta.push(null);
    }
    S.path = [];
    S.links = [];
    S.branches = [];
  }

  function setGrid(cols, rows, shape) {
    cols = clamp(Math.round(Number(cols) || S.cols), MIN_COLS, MAX_COLS);
    rows = clamp(Math.round(Number(rows) || S.rows), MIN_ROWS, MAX_ROWS);
    shape = shape === 'hex' ? 'hex' : 'square';
    if (cols === S.cols && rows === S.rows && shape === S.shape) return;
    pushUndo();
    resizeGridData(cols, rows, shape);
    hover = null;
    pendingLink = null;
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
    syncControls();
    markDirty();
    toast('Board is now ' + cols + ' × ' + rows + '.');
  }

  /* ------------------------------------------------------------------ */
  /* Dice                                                                */
  /* ------------------------------------------------------------------ */

  function renderActionDie() {
    S.actionFaces = normaliseActionFaces(S.actionFaces);
    if (actionFacesInput && document.activeElement !== actionFacesInput) {
      actionFacesInput.value = S.actionFaces.join(', ');
    }
    var action = S.dieMode === 'action';
    if (diceNormalBtn) diceNormalBtn.setAttribute('aria-pressed', action ? 'false' : 'true');
    if (diceActionBtn) diceActionBtn.setAttribute('aria-pressed', action ? 'true' : 'false');
    if (rollBtn) rollBtn.textContent = action ? 'Roll action die' : 'Roll d' + dieSides;
    if (quickRollBtn && !(S.path.length && S.mode === 'play')) {
      quickRollBtn.textContent = action ? '🎲 Action die' : '🎲 Roll d6';
    }
  }

  function setDieMode(mode) {
    S.dieMode = mode === 'action' ? 'action' : 'numbers';
    if (S.dieMode === 'action') setDie(6);
    renderActionDie();
    markDirty();
    announce(S.dieMode === 'action' ? 'Action die selected.' : 'Number dice selected.');
  }

  function saveActionFaces() {
    var labels = actionFacesInput ? actionFacesInput.value.split(',').map(function (s) { return s.trim(); }) : [];
    S.actionFaces = normaliseActionFaces(labels);
    renderActionDie();
    markDirty();
    toast('Action die faces saved.');
  }

  function renderSpinner() {
    S.spinner = normaliseSpinner(S.spinner);
    if (dicePanel) dicePanel.hidden = S.rollMode === 'spinner';
    if (spinnerPanel) spinnerPanel.hidden = S.rollMode !== 'spinner';
    if (modeDiceBtn) modeDiceBtn.setAttribute('aria-pressed', S.rollMode === 'spinner' ? 'false' : 'true');
    if (modeSpinnerBtn) modeSpinnerBtn.setAttribute('aria-pressed', S.rollMode === 'spinner' ? 'true' : 'false');
    if (spinnerSizeInput) spinnerSizeInput.value = String(S.spinner.size);
    if (spinnerLabelsInput && document.activeElement !== spinnerLabelsInput) {
      spinnerLabelsInput.value = S.spinner.labels.join(', ');
    }
    if (!spinnerWheel) return;
    spinnerWheel.textContent = '';
    S.spinner.labels.forEach(function (label, i) {
      var chip = document.createElement('span');
      chip.className = 'tt-spinner-seg' + (i === S.spinner.last ? ' is-winner' : '');
      chip.textContent = label || String(i + 1);
      chip.dataset.spinIndex = String(i);
      spinnerWheel.appendChild(chip);
    });
    if (spinnerResult && S.spinner.last >= 0 && !spinnerSpinning) {
      spinnerResult.textContent = 'The wheel landed on ' + (S.spinner.labels[S.spinner.last] || (S.spinner.last + 1)) + '.';
    }
  }

  function setRollMode(mode) {
    S.rollMode = mode === 'spinner' ? 'spinner' : 'dice';
    renderSpinner();
    markDirty();
    announce(S.rollMode === 'spinner' ? 'Spinner selected.' : 'Dice selected.');
  }

  function spinnerValue(label, index) {
    var number = parseInt(String(label).replace(/[^0-9-]/g, ''), 10);
    return isFinite(number) ? number : index + 1;
  }

  function spinSpinner() {
    if (spinnerSpinning) return;
    S.spinner = normaliseSpinner(S.spinner);
    var labels = S.spinner.labels;
    if (!labels.length) return;
    spinnerSpinning = true;
    if (spinBtn) spinBtn.disabled = true;
    if (spinnerResult) spinnerResult.textContent = 'Spinning...';
    var chips = spinnerWheel ? spinnerWheel.querySelectorAll('.tt-spinner-seg') : [];
    function clearLit() {
      for (var i = 0; i < chips.length; i++) chips[i].classList.remove('is-lit', 'is-winner');
    }
    var ticks = 0;
    var total = reduceMotion() ? 0 : 18;
    function finish() {
      var index = Math.floor(Math.random() * labels.length);
      var value = spinnerValue(labels[index], index);
      S.spinner.last = index;
      clearLit();
      if (chips[index]) chips[index].classList.add('is-winner');
      if (spinnerResult) spinnerResult.textContent = 'The wheel landed on ' + labels[index] + '.';
      diceHistoryLog.unshift('Spin = ' + labels[index]);
      if (diceHistoryLog.length > 12) diceHistoryLog.length = 12;
      renderHistory();
      playSound('roll');
      announce('The wheel landed on ' + labels[index] + '.');
      spinnerSpinning = false;
      if (spinBtn) spinBtn.disabled = false;
      markDirty();
      if (S.mode === 'play' && S.path.length) {
        window.setTimeout(function () { handlePlayRoll(value); }, 80);
      }
    }
    if (!total) {
      finish();
      return;
    }
    var timer = window.setInterval(function () {
      clearLit();
      var index = Math.floor(Math.random() * labels.length);
      if (chips[index]) chips[index].classList.add('is-lit');
      ticks++;
      if (ticks >= total) {
        window.clearInterval(timer);
        finish();
      }
    }, 70);
  }

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
    var action = S.dieMode === 'action' && sides === 6;
    rollBtn.textContent = action ? 'Roll action die' : 'Roll d' + sides;
    if (quickRollBtn) quickRollBtn.textContent = action ? '🎲 Action die' : '🎲 Roll d' + sides;
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

  function makeFlatDie(sides, action) {
    var wrap = document.createElement('div');
    wrap.className = 'tt-die tt-die--flat' + (action ? ' tt-die--action' : '');
    var num = document.createElement('span');
    num.className = 'tt-die-num';
    var tag = document.createElement('span');
    tag.className = 'tt-die-sides';
    tag.textContent = action ? 'Action' : 'd' + sides;
    wrap.appendChild(num);
    wrap.appendChild(tag);
    return {
      el: wrap,
      set: function (value) {
        num.textContent = action
          ? (normaliseActionFaces(S.actionFaces)[value - 1] || String(value))
          : String(value);
      },
      spin: function (on) {
        wrap.classList.toggle('is-spinning', on);
      }
    };
  }

  function showRollOverlay(results, sides, action) {
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
      var die = (sides === 6 && !action) ? makeCubeDie() : makeFlatDie(sides, !!action);
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
      settle: function (total) {
        window.clearInterval(tick);
        dice.forEach(function (d, i) {
          d.spin(false);
          d.set(results[i]);
        });
        if (total !== undefined) {
          var slam = document.createElement('div');
          slam.className = 'tt-roll-slam';
          slam.textContent = String(total);
          layer.appendChild(slam);
        }
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
    var action = S.dieMode === 'action' && useSides === 6;

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
      var die = (useSides === 6 && !action) ? makeCubeDie() : makeFlatDie(useSides, action);
      dice.push(die);
      diceStage.appendChild(die.el);
    }

    var overlay = showRollOverlay(results, useSides, action);

    function settle() {
      for (var d = 0; d < dice.length; d++) {
        dice[d].spin(false);
        dice[d].set(results[d]);
        dice[d].el.classList.remove('is-settled');
        void dice[d].el.offsetWidth;
        dice[d].el.classList.add('is-settled');
      }

      var total = results.reduce(function (a, b) { return a + b; }, 0);
      var faceLabel = action ? normaliseActionFaces(S.actionFaces)[results[0] - 1] : '';

      if (overlay) {
        overlay.settle(action ? undefined : total);
        window.setTimeout(overlay.remove, 300);
      }

      playSound('roll');
      var text;
      if (action) {
        text = 'The action die says "' + faceLabel + '".';
      } else if (results.length === 1) {
        text = 'You rolled ' + results[0] + ' on a d' + useSides + '.';
      } else {
        text = 'You rolled ' + results.join(', ') + ' on ' + results.length + 'd' + useSides + ' (total ' + total + ').';
      }
      diceResult.textContent = text;
      if (barResultEl) {
        barResultEl.textContent = action
          ? faceLabel
          : (results.length === 1 ? 'You rolled ' + results[0] : 'Total ' + total);
        barResultEl.classList.add('is-on');
      }
      markStep('roll');
      announce(text);

      var entry = action
        ? 'Action = ' + faceLabel
        : (results.length === 1
          ? 'd' + useSides + ' = ' + results[0]
          : results.length + 'd' + useSides + ' = ' + total);
      diceHistoryLog.unshift(entry);
      if (diceHistoryLog.length > 12) diceHistoryLog.length = 12;
      renderHistory();

      rolling = false;
      rollBtn.disabled = false;
      countDownBtn.disabled = dieCount <= 1;
      countUpBtn.disabled = dieCount >= MAX_DICE;

      if (S.mode === 'play' && S.path.length) {
        window.setTimeout(function () {
          if (action) handleActionRoll(faceLabel);
          else handlePlayRoll(total);
        }, reduceMotion() ? 0 : 80);
      }
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
    stage.classList.add('tt-mode-flash', S.mode === 'play' ? 'tt-mode-flash--play' : 'tt-mode-flash--build');
    window.setTimeout(function () {
      stage.classList.remove('tt-mode-flash', 'tt-mode-flash--play', 'tt-mode-flash--build');
    }, 350);
    if (S.mode === 'play') {
      if (S.path.length > 1 && !playerToken(S.turn || 1)) setupPawns(false);
      toast('Play mode. Roll or drag pieces.', 'save');
      announce('Play mode. Roll to move players, or drag pieces anywhere. Tap a card to flip it.');
    } else {
      announce('Build mode. Paint tiles and snap pieces to the grid.');
    }
  }

  function updateStatus() {
    var terrainName = S.terrain === 'erase' ? 'Eraser' : (TERRAIN[S.terrain] ? TERRAIN[S.terrain].name : 'Paint');
    var terrainHelp = byId('ttTerrainHelp');
    var barText = barHint ? barHint.textContent : '';
    if (S.mode === 'play') {
      if (S.winner) {
        statusEl.textContent = 'Player ' + S.winner + ' won. Play again or change the board.';
        barText = 'Game over. Use Play again on the win screen.';
      } else if (S.path.length > 1) {
        statusEl.textContent = 'Play mode: ' + activePlayerName() + ' rolls, then moves along the route.';
        barText = 'Roll to move ' + activePlayerName() + ' along the route.';
      } else {
        statusEl.textContent = 'Play mode: drag pieces freely';
        barText = 'Add a route to roll and move players.';
      }
      if (terrainHelp) terrainHelp.textContent = 'Play mode is on. Switch to Build to paint.';
    } else if (S.tool === 'select') {
      statusEl.textContent = 'Select: tap two corners';
      barText = 'Tap one corner, then the opposite corner.';
      if (terrainHelp) terrainHelp.textContent = 'Select is on. Tap two corners to mark an area.';
    } else if (S.tool === 'path') {
      statusEl.textContent = 'Route: tap tiles in order';
      barText = 'Tap each stop in order, then Number 1..N.';
      if (terrainHelp) terrainHelp.textContent = 'Route is on. Tap tiles in the order pieces should travel.';
    } else if (S.tool === 'branch') {
      statusEl.textContent = 'Branch: tap a start, then a route tile';
      barText = 'Make a choice point on the route.';
      if (terrainHelp) terrainHelp.textContent = 'Branch is on. Tap the branch tile, then where it can lead.';
    } else if (S.tool === 'link') {
      statusEl.textContent = 'Link: tap a start, then an end';
      barText = 'Make a snake or ladder between two tiles.';
      if (terrainHelp) terrainHelp.textContent = 'Link is on. Tap the top of a ladder, then the bottom.';
    } else if (S.tool === 'tile') {
      statusEl.textContent = 'Tile settings: tap a tile';
      barText = 'Number it, name it or add a rule.';
      if (terrainHelp) terrainHelp.textContent = 'Tile is on. Tap a tile to set its number, name and effect.';
    } else if (S.tool === 'fill') {
      statusEl.textContent = 'Fill: ' + terrainName + ' selected';
      barText = 'Fill floods a whole area.';
      if (terrainHelp) terrainHelp.textContent = 'Fill is on. Tap a tile to flood it with ' + terrainName + '.';
    } else if (S.tool === 'pick') {
      statusEl.textContent = 'Pick: tap a tile to sample it';
      barText = 'Pick a tile to reuse its ground.';
      if (terrainHelp) terrainHelp.textContent = 'Pick is on. Click a tile to sample its terrain.';
    } else {
      statusEl.textContent = 'Brush: ' + terrainName + ' selected';
      barText = 'Paint tiles, or open Route to number a track.';
      if (terrainHelp) terrainHelp.textContent = 'Pick a colour, then paint the board.';
    }
    var teach = teachFor();
    if (teach) {
      if (S.mode === 'play' && S.path.length && !S.winner) barText = teach.play;
      else if (S.mode === 'build') barText = teach.build;
    }
    if (barHint) barHint.textContent = barText;
    updateRulesSummary();
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
    var defaults = { paint: 'Paint a tile', piece: 'Add a piece', roll: 'Roll the dice' };
    var teach = teachFor();
    var all = firstSteps.paint && firstSteps.piece && firstSteps.roll;
    var steps = stepsEl.querySelectorAll('.tt-step');
    for (var i = 0; i < steps.length; i++) {
      var key = steps[i].dataset.step;
      var done = !!firstSteps[key];
      steps[i].classList.toggle('is-done', done);
      var num = steps[i].querySelector('.tt-step-num');
      if (num) num.textContent = done ? 'V' : String(keys.indexOf(key) + 1);
      var textEl = steps[i].querySelector('.tt-step-text');
      if (textEl) {
        textEl.textContent = (teach && teach.steps && teach.steps[key]) ? teach.steps[key] : defaults[key];
      }
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
    for (i = 0; i < S.tiles.length; i++) {
      S.tiles[i] = null;
      if (S.meta) S.meta[i] = null;
    }
    S.tokens = [];
    S.path = [];
    S.links = [];
    S.settings = defaultSettings();
    S.winner = 0;
    S.bg = null;
    bgImg = null;
    S.selectedId = 0;
    S.turn = 1;
    S.round = 1;
    S.rules = '';
    S.bgColor = null;
    S.players = defaultPlayers();
  }

  function clearPieces() {
    var cards = S.tokens.filter(function (t) { return t.type === 'card'; });
    cards.forEach(function (t) {
      var card = t.card ? { c: t.card.id } : { r: t.r, s: t.s };
      S.deck.push(card);
    });
    S.tokens = [];
    S.selectedId = 0;
    renderAll();
    markDirty();
    announce('Board cleared.');
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
    return addPiece(kind, c.x, c.y);
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

  function setTemplateMeta(col, row, data) {
    if (col < 0 || row < 0 || col >= S.cols || row >= S.rows) return;
    var idx = cellIndex(col, row);
    var meta = S.meta[idx] || {};
    Object.keys(data || {}).forEach(function (key) { meta[key] = data[key]; });
    S.meta[idx] = sanitiseMeta(meta);
  }

  function templateLink(fromNumber, toNumber) {
    var from = findCellByNumber(fromNumber);
    var to = findCellByNumber(toNumber);
    if (!from || !to) return;
    var delta = toNumber - fromNumber;
    var label = (delta > 0 ? '+' : '') + delta;
    S.links.push({ from: { c: from.c, r: from.r }, to: { c: to.c, r: to.r }, label: label });
    var idx = cellIndex(from.c, from.r);
    var meta = S.meta[idx] || {};
    meta.effect = { type: 'goTo', value: toNumber };
    meta.label = delta > 0 ? 'Ladder' : 'Snake';
    meta.icon = delta > 0 ? '🪜' : '🐍';
    S.meta[idx] = meta;
  }

  function placeTemplatePawns(count) {
    for (var i = 0; i < count; i++) {
      var t = addPiece('meeple', 0, 0);
      t.pawn = true;
      t.player = i + 1;
      t.color = PLAYER_COLORS[i];
      t.scale = 0.86;
      t.pathIndex = 0;
      t.started = false;
      setPawnPosition(t, 0, true);
    }
  }

  function buildSnakesTemplate() {
    resetGridTo(10, 10, 'square');
    fillTiles('sand');
    fillSerpentine();
    [
      [4, 14], [9, 31], [20, 38], [28, 84], [40, 59], [51, 67], [63, 81], [71, 91],
      [17, 7], [54, 34], [62, 19], [87, 24], [93, 73], [95, 75], [99, 78]
    ].forEach(function (pair) { templateLink(pair[0], pair[1]); });
    placeTemplatePawns(4);
    S.name = 'Snakes and Ladders';
    S.rules = 'Roll a d6 and race from 1 to 100. Ladders climb you up. Snakes slide you down. Need the exact number to finish.';
    S.settings.exactFinish = true;
    S.settings.snapPath = true;
    S.turn = 1;
    S.round = 1;
  }

  function buildLudoTemplate() {
    resetGridTo(15, 15, 'square');
    fillTiles('snow');
    var c;
    var r;
    for (r = 0; r < 15; r++) {
      for (c = 6; c <= 8; c++) setTileAt(c, r, 'path');
    }
    for (c = 0; c < 15; c++) {
      for (r = 6; r <= 8; r++) setTileAt(c, r, 'path');
    }
    for (r = 6; r <= 8; r++) {
      for (c = 6; c <= 8; c++) setTileAt(c, r, 'magic');
    }
    var homes = [
      { c: 1, r: 1, colour: '#BC4749' },
      { c: 12, r: 1, colour: '#3f6e71' },
      { c: 1, r: 12, colour: '#c98a2e' },
      { c: 12, r: 12, colour: '#7a5aa8' }
    ];
    homes.forEach(function (home) {
      for (var hr = 0; hr < 5; hr++) {
        for (var hc = 0; hc < 5; hc++) {
          var cc = home.c - 2 + hc;
          var rr = home.r - 2 + hr;
          if (cc === 7 && rr === 7) continue;
          setTileAt(cc, rr, 'grass');
        }
      }
      setTemplateMeta(home.c, home.r, { group: home.colour, icon: '🏠', label: 'Home' });
    });
    S.path = [];
    for (c = 0; c < S.cols; c++) S.path.push({ c: c, r: 0 });
    for (r = 1; r < S.rows; r++) S.path.push({ c: S.cols - 1, r: r });
    for (c = S.cols - 2; c >= 0; c--) S.path.push({ c: c, r: S.rows - 1 });
    for (r = S.rows - 2; r >= 1; r--) S.path.push({ c: 0, r: r });
    S.path.forEach(function (p, i) {
      setTileAt(p.c, p.r, 'path');
      setMetaNumber(p.c, p.r, i + 1);
    });
    [5, 13, 21, 29, 37, 45].forEach(function (n) {
      var cell = findCellByNumber(n);
      if (cell) setTemplateMeta(cell.c, cell.r, { icon: '⭐', label: 'Safe' });
    });
    placeTemplatePawns(4);
    S.name = 'Ludo Loop';
    S.rules = 'Four players race around the loop. Roll a 6 to leave home. Land on a rival to send it back to the start. First pawn all the way round wins.';
    S.settings.sixToStart = true;
    S.settings.capture = true;
    S.settings.snapPath = true;
    S.turn = 1;
    S.round = 1;
  }

  function buildPropertyTemplate() {
    resetGridTo(11, 11, 'square');
    fillTiles('grass');
    S.path = [];
    var c;
    var r;
    for (c = 0; c < S.cols; c++) S.path.push({ c: c, r: 0 });
    for (r = 1; r < S.rows; r++) S.path.push({ c: S.cols - 1, r: r });
    for (c = S.cols - 2; c >= 0; c--) S.path.push({ c: c, r: S.rows - 1 });
    for (r = S.rows - 2; r >= 1; r--) S.path.push({ c: 0, r: r });

    var groups = ['#BC4749', '#3f6e71', '#c98a2e', '#7a5aa8', '#5E8C5A', '#C9A97D', '#6FA9C9', '#D46A4A'];
    S.path.forEach(function (p, i) {
      setTileAt(p.c, p.r, 'path');
      setMetaNumber(p.c, p.r, i + 1);
      var n = i + 1;
      if (n % 3 === 0 && n !== S.path.length) {
        setTemplateMeta(p.c, p.r, {
          group: groups[(n / 3 - 1) % groups.length],
          label: 'Street ' + Math.ceil(n / 3)
        });
      }
    });
    var corners = [
      [1, 'GO', '🚩'],
      [11, 'Jail', '🔒'],
      [21, 'Free', '🎉'],
      [31, 'Park', '🌳']
    ];
    corners.forEach(function (corner) {
      var cell = findCellByNumber(corner[0]);
      if (cell) setTemplateMeta(cell.c, cell.r, { label: corner[1], icon: corner[2], group: '#c98a2e' });
    });
    [6, 16, 26, 36].forEach(function (n) {
      var cell = findCellByNumber(n);
      if (cell) setTemplateMeta(cell.c, cell.r, { icon: '🃏', label: 'Card', effect: { type: 'card', value: 0 } });
    });
    [9, 29].forEach(function (n) {
      var cell = findCellByNumber(n);
      if (cell) setTemplateMeta(cell.c, cell.r, { icon: '💰', label: 'Tax', effect: { type: 'money', value: -50 } });
    });
    placeTemplatePawns(4);
    S.name = 'Property Loop';
    S.rules = 'Start with £1500. Roll and move around the loop. Buy streets by marking them with your pawn colour. Land on Tax to pay £50. Draw a card on card tiles. Richest player when someone passes GO twice wins.';
    S.settings.startingMoney = 1500;
    S.settings.snapPath = true;
    S.players.forEach(function (p) { p.money = 1500; });
    S.turn = 1;
    S.round = 1;
  }

  function buildLifeTemplate() {
    resetGridTo(9, 9, 'square');
    fillTiles('sand');
    fillSerpentine();
    [
      [7, { effect: { type: 'money', value: 100 }, label: 'Payday', icon: '💷' }],
      [13, { effect: { type: 'forward', value: 3 }, label: 'Degree', icon: '🎓' }],
      [21, { effect: { type: 'back', value: 2 }, label: 'Bills', icon: '🧾' }],
      [30, { effect: { type: 'money', value: -100 }, label: 'Repair', icon: '🔧' }],
      [38, { effect: { type: 'again', value: 0 }, label: 'Twins', icon: '👶' }],
      [45, { effect: { type: 'forward', value: 4 }, label: 'New job', icon: '💼' }],
      [55, { effect: { type: 'card', value: 0 }, label: 'Surprise', icon: '🃏' }],
      [62, { effect: { type: 'money', value: 200 }, label: 'Win', icon: '🏆' }],
      [70, { effect: { type: 'back', value: 3 }, label: 'Setback', icon: '🌧️' }],
      [78, { effect: { type: 'money', value: 50 }, label: 'Bonus', icon: '🎁' }]
    ].forEach(function (entry) {
      var cell = findCellByNumber(entry[0]);
      if (cell) setTemplateMeta(cell.c, cell.r, entry[1]);
    });
    placeTemplatePawns(2);
    S.name = 'Life Path';
    S.rules = 'Roll and move along the path. Payday pays you, bills cost you, and some squares move you forward or back. Finish with the most money.';
    S.settings.snapPath = true;
    S.turn = 1;
    S.round = 1;
  }

  function buildDraughtsTemplate() {
    resetGridTo(8, 8, 'square');
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        setTileAt(c, r, (c + r) % 2 === 0 ? 'snow' : 'wall');
      }
    }
    var count = 0;
    for (r = 0; r < 8; r++) {
      for (c = 0; c < 8; c++) {
        if ((c + r) % 2 !== 1) continue;
        if (r <= 2) {
          var top = addPieceAtCell('meeple', c, r);
          top.color = PLAYER_COLORS[1];
          top.scale = 0.66;
          top.note = 'P2';
        } else if (r >= 5) {
          var bottom = addPieceAtCell('meeple', c, r);
          bottom.color = PLAYER_COLORS[0];
          bottom.scale = 0.66;
          bottom.note = 'P1';
        }
        count++;
      }
    }
    S.name = 'Draughts Board';
    S.rules = 'Pieces move one dark square diagonally. Jump a rival to take it. Reach the far side to become a king. That board is ready for two players.';
    S.turn = 1;
    S.round = 1;
  }

  function buildConnectTemplate() {
    resetGridTo(7, 6, 'square');
    fillTiles('water');
    for (var c = 0; c < 7; c++) {
      setTemplateMeta(c, 5, { icon: '⚪', label: 'Slot ' + (c + 1) });
    }
    S.name = 'Connect 4 Board';
    S.rules = 'Two players take turns dropping a counter into a column. Four in a row wins, across, down or diagonally. Use the counter pieces for discs.';
    S.turn = 1;
    S.round = 1;
  }

  function applyTemplate(id) {
    var names = {
      meadow: 'Meadow',
      dungeon: 'Dungeon',
      island: 'Island',
      surprise: 'Surprise board',
      blank: 'Blank board',
      snakes: 'Snakes and Ladders',
      ludo: 'Ludo Loop',
      property: 'Property Loop',
      life: 'Life Path',
      draughts: 'Draughts Board',
      connect: 'Connect 4 Board'
    };
    var hadContent = !!(S.bg || S.tokens.length || S.tiles.some(function (t) { return !!t; }));
    if (window.ToolAnalytics) {
      try { ToolAnalytics.event('template_used', id); } catch (err) { /* analytics is optional */ }
    }
    pushUndo();
    resetBoardDoc();
    S.templateId = id === 'blank' ? '' : id;
    if (id === 'meadow') buildMeadowTemplate();
    else if (id === 'dungeon') buildDungeonTemplate();
    else if (id === 'island') buildIslandTemplate();
    else if (id === 'surprise') buildSurpriseTemplate();
    else if (id === 'snakes') buildSnakesTemplate();
    else if (id === 'ludo') buildLudoTemplate();
    else if (id === 'property') buildPropertyTemplate();
    else if (id === 'life') buildLifeTemplate();
    else if (id === 'draughts') buildDraughtsTemplate();
    else if (id === 'connect') buildConnectTemplate();
    S.deck = makeDeck();
    if (/^(snakes|ludo|property|life)$/.test(id)) dieSides = 6;
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
    S.meta = [];
    for (var i = 0; i < S.cols * S.rows; i++) {
      S.tiles.push(null);
      S.meta.push(null);
    }
    S.tokens = [];
    S.path = [];
    S.links = [];
    S.branches = [];
    S.settings = defaultSettings();
    S.winner = 0;
    S.templateId = '';
    S.players = defaultPlayers();
    hideWin(false);
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
    for (var i = 0; i < S.tiles.length; i++) {
      S.tiles[i] = null;
      if (S.meta) S.meta[i] = null;
    }
    S.path = [];
    S.links = [];
    S.branches = [];
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

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function boardImageData() {
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
    return out.toDataURL('image/png');
  }

  function cardSheetData() {
    var cards = (S.customCards || []).slice(0, 18);
    var scale = 2;
    var cols = 3;
    var rows = Math.max(1, Math.ceil(cards.length / cols));
    var cardW = 240;
    var cardH = 330;
    var gap = 18;
    var out = document.createElement('canvas');
    out.width = (cardW * cols + gap * (cols + 1)) * scale;
    out.height = (cardH * rows + gap * (rows + 1)) * scale;
    var o = out.getContext('2d');
    o.scale(scale, scale);
    o.fillStyle = '#fbf8f2';
    o.fillRect(0, 0, out.width / scale, out.height / scale);
    if (!cards.length) {
      o.fillStyle = '#403B33';
      o.font = '700 20px Inter, system-ui, sans-serif';
      o.textAlign = 'center';
      o.fillText('No custom cards in this deck yet.', out.width / (2 * scale), 80);
      o.font = '400 14px Inter, system-ui, sans-serif';
      o.fillText('Make a card in the Cards panel, then print the kit again.', out.width / (2 * scale), 110);
      return out.toDataURL('image/png');
    }
    cards.forEach(function (card, i) {
      var col = i % cols;
      var row = Math.floor(i / cols);
      var x = gap + col * (cardW + gap);
      var y = gap + row * (cardH + gap);
      roundRect(o, x, y, cardW, cardH, 14);
      o.fillStyle = '#fffdf8';
      o.fill();
      o.strokeStyle = card.color || '#403B33';
      o.lineWidth = 4;
      o.stroke();
      o.fillStyle = card.color || '#403B33';
      o.font = '700 34px "Segoe UI Emoji", Inter, sans-serif';
      o.textAlign = 'center';
      o.textBaseline = 'middle';
      o.fillText(card.icon || '★', x + cardW / 2, y + 58);
      o.fillStyle = '#1a1208';
      o.font = '800 18px Inter, system-ui, sans-serif';
      o.fillText(String(card.name || 'Card').slice(0, 20), x + cardW / 2, y + 118);
      o.font = '400 14px Inter, system-ui, sans-serif';
      var lines = wrapTextLines(o, String(card.text || ''), cardW - 24);
      lines.slice(0, 5).forEach(function (line, li) {
        o.fillText(line, x + cardW / 2, y + 152 + li * 20);
      });
      o.fillStyle = 'rgba(64,59,51,.55)';
      o.font = '700 11px Inter, system-ui, sans-serif';
      o.fillText('JVDesignStudio', x + cardW / 2, y + cardH - 18);
    });
    return out.toDataURL('image/png');
  }

  function printKit() {
    var paper = printSizeInput ? printSizeInput.value : 'A4';
    var rules = String(S.rules || '').trim();
    var title = S.name || 'My tabletop game';
    var boardImg = boardImageData();
    var cardImg = cardSheetData();
    var html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
      '<title>' + escapeHtml(title) + ' - print kit</title>' +
      '<style>' +
      '@page { size: ' + (paper === 'A3' ? 'A3' : 'A4') + ' portrait; margin: 10mm; }' +
      'body { font-family: Inter, system-ui, sans-serif; color: #1a1208; background: #fff; margin: 0; }' +
      '.sheet { page-break-after: always; padding: 4mm; }' +
      '.sheet:last-child { page-break-after: auto; }' +
      'h1 { font-size: 22pt; margin: 0 0 2mm; }' +
      'h2 { font-size: 14pt; margin: 4mm 0 2mm; }' +
      '.meta { font-size: 9pt; color: #555; margin-bottom: 3mm; }' +
      '.board { width: 100%; max-height: 220mm; object-fit: contain; border: 1px solid #999; }' +
      '.rules { white-space: pre-wrap; font-size: 11pt; line-height: 1.5; margin-top: 4mm; }' +
      '.cards { width: 100%; max-height: 240mm; object-fit: contain; }' +
      '.cut { font-size: 8pt; color: #777; margin-top: 2mm; }' +
      '@media print { .no-print { display: none; } }' +
      '</style></head><body>' +
      '<section class="sheet"><h1>' + escapeHtml(title) + '</h1>' +
      '<p class="meta">JVDesignStudio Tabletop Studio - ' + S.cols + ' x ' + S.rows + ' - ' + paper + '</p>' +
      '<img class="board" alt="Board" src="' + boardImg + '">' +
      (rules ? '<h2>Rules</h2><div class="rules">' + escapeHtml(rules) + '</div>' : '') +
      '</section>' +
      '<section class="sheet"><h1>Cards</h1>' +
      '<img class="cards" alt="Card sheet" src="' + cardImg + '">' +
      '<p class="cut">Cut along the card borders. Print at 100% for the best fit.</p>' +
      '</section>' +
      '<p class="no-print">If the print dialog did not open, press Ctrl and P.</p>' +
      '</body></html>';
    var win = window.open('', '_blank');
    if (!win) {
      toast('Allow pop-ups to open the print kit.');
      return;
    }
    try {
      win.document.write(html);
      win.document.close();
      win.focus();
      window.setTimeout(function () {
        try { win.print(); } catch (err) { /* the print button is still there */ }
      }, 500);
      toast('Print kit ready in a new tab.');
      announce('Print kit ready. Choose A4 or A3 in the print dialog.');
    } catch (err) {
      toast('Could not open the print kit.');
    }
  }

  function encodeShareCode() {
    var json = JSON.stringify(boardPayload());
    return 'TT3-' + btoa(unescape(encodeURIComponent(json)));
  }

  function decodeShareCode(text) {
    var raw = String(text || '').trim();
    if (!raw) return null;
    if (raw.indexOf('TT3-') === 0) raw = raw.slice(4);
    raw = raw.replace(/\s+/g, '');
    var json = decodeURIComponent(escape(atob(raw)));
    return JSON.parse(json);
  }

  function copyShareCode() {
    if (!shareCodeInput) return;
    var code;
    try {
      code = encodeShareCode();
    } catch (err) {
      toast('Could not make a share code for this board.');
      return;
    }
    shareCodeInput.value = code;
    try {
      shareCodeInput.focus();
      shareCodeInput.select();
    } catch (err) { /* select is optional */ }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(function () {
        toast('Share code copied.');
        announce('Share code copied to the clipboard.');
      }).catch(function () {
        toast('Share code is in the box. Copy it from there.');
      });
    } else {
      toast('Share code is in the box. Copy it from there.');
    }
  }

  function loadShareCode() {
    if (!shareCodeInput) return;
    var data;
    try {
      data = decodeShareCode(shareCodeInput.value);
    } catch (err) {
      toast('That share code is not complete.');
      return;
    }
    if (!data) {
      toast('Paste a share code first.');
      return;
    }
    var snap = snapshot();
    if (!applyBoardData(data)) {
      toast('That share code could not be loaded.');
      return;
    }
    pushUndoSnapshot(snap);
    emptyDismissed = true;
    setBgImage(S.bg);
    syncControls();
    renderAll();
    markDirty();
    toast('Share code loaded.');
    announce('Board loaded from a share code.');
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
    var terrainKeys = Object.keys(TERRAIN);
    terrainKeys.forEach(function (key, idx) {
      var t = TERRAIN[key];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tt-swatch';
      b.dataset.terrain = key;
      b.style.setProperty('--sw', t.color);
      b.setAttribute('aria-pressed', key === S.terrain ? 'true' : 'false');
      b.setAttribute('aria-label', t.name + (idx < 9 ? ' (key ' + (idx + 1) + ')' : ''));
      if (idx < 9) b.dataset.hotkey = String(idx + 1);
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
    if (colsInput) colsInput.value = String(S.cols);
    if (rowsInput) rowsInput.value = String(S.rows);
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
    var bgColorInput = byId('ttBgColor');
    if (bgColorInput) bgColorInput.value = S.bgColor || '#F0EAD6';
    var deckStdCheck = byId('ttDeckStandard');
    if (deckStdCheck) deckStdCheck.checked = S.deckStandard !== false;
    updateStatus();
    updatePlayAids();
    updateSelectHint();
    renderActionDie();
  }

  function renderPlayers() {
    var container = byId('ttPlayers');
    if (!container) return;
    container.innerHTML = '';
    S.players.forEach(function (p, idx) {
      var row = document.createElement('div');
      row.className = 'tt-player-row' + (S.turn === idx + 1 ? ' tt-player-active' : '');
      var nameIn = document.createElement('input');
      nameIn.type = 'text';
      nameIn.className = 'tt-player-name';
      nameIn.maxLength = 20;
      nameIn.placeholder = 'Player ' + (idx + 1);
      nameIn.value = p.name;
      nameIn.dataset.playerIdx = idx;
      var scoreOut = document.createElement('span');
      scoreOut.className = 'tt-player-score';
      scoreOut.textContent = p.score;
      var downBtn = document.createElement('button');
      downBtn.type = 'button';
      downBtn.className = 'tt-player-score-btn';
      downBtn.textContent = '−';
      downBtn.dataset.playerIdx = idx;
      downBtn.dataset.scoreDelta = '-1';
      var upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.className = 'tt-player-score-btn';
      upBtn.textContent = '+';
      upBtn.dataset.playerIdx = idx;
      upBtn.dataset.scoreDelta = '1';
      var colour = document.createElement('button');
      colour.type = 'button';
      colour.className = 'tt-player-dot';
      colour.dataset.playerColour = idx;
      colour.style.background = p.color || PLAYER_COLORS[idx];
      colour.title = 'Change pawn colour';
      colour.setAttribute('aria-label', 'Change player ' + (idx + 1) + ' pawn colour');
      var moneyOut = document.createElement('span');
      moneyOut.className = 'tt-player-money';
      moneyOut.textContent = '£' + (p.money || 0);
      var moneyDown = document.createElement('button');
      moneyDown.type = 'button';
      moneyDown.className = 'tt-player-money-btn';
      moneyDown.textContent = '-£10';
      moneyDown.dataset.playerIdx = idx;
      moneyDown.dataset.moneyDelta = '-10';
      var moneyUp = document.createElement('button');
      moneyUp.type = 'button';
      moneyUp.className = 'tt-player-money-btn';
      moneyUp.textContent = '+£10';
      moneyUp.dataset.playerIdx = idx;
      moneyUp.dataset.moneyDelta = '10';
      var moneyBtns = document.createElement('span');
      moneyBtns.className = 'tt-player-money-btns';
      moneyBtns.appendChild(moneyDown);
      moneyBtns.appendChild(moneyUp);
      if (p.skip) {
        var skipBadge = document.createElement('span');
        skipBadge.className = 'tt-player-skip';
        skipBadge.textContent = 'miss';
        row.appendChild(skipBadge);
      }
      row.appendChild(colour);
      row.appendChild(nameIn);
      row.appendChild(moneyOut);
      row.appendChild(moneyBtns);
      row.appendChild(downBtn);
      row.appendChild(scoreOut);
      row.appendChild(upBtn);
      container.appendChild(row);
    });
  }

  function updatePlayAids() {
    if (roundOut) roundOut.textContent = String(S.round || 1);
    if (turnOut) turnOut.textContent = String(S.turn || 1);
    if (turnChip) {
      var activeName = '';
      if (Array.isArray(S.players)) {
        var activeTurn = (S.turn || 1) - 1;
        var ap = S.players[activeTurn % S.players.length];
        if (ap && ap.name && ap.name.trim()) activeName = ' - ' + ap.name.trim();
      }
      turnChip.textContent = 'Round ' + (S.round || 1) + ' · Turn ' + (S.turn || 1) + activeName;
    }
    if (rulesInput && document.activeElement !== rulesInput) rulesInput.value = S.rules || '';
    if (quickRollBtn) {
      quickRollBtn.textContent = S.path.length && S.mode === 'play'
        ? '🎲 Roll for ' + activePlayerName()
        : (S.dieMode === 'action' ? '🎲 Action die' : '🎲 Roll d6');
    }
    if (ruleExactInput) ruleExactInput.checked = !!S.settings.exactFinish;
    if (ruleSixInput) ruleSixInput.checked = !!S.settings.sixToStart;
    if (ruleStartBonusInput) ruleStartBonusInput.checked = !!S.settings.startBonus;
    if (ruleCaptureInput) ruleCaptureInput.checked = !!S.settings.capture;
    if (ruleStackInput) ruleStackInput.checked = !!S.settings.stacking;
    if (ruleRentInput) ruleRentInput.checked = !!S.settings.rent;
    if (startingMoneyInput && document.activeElement !== startingMoneyInput) {
      startingMoneyInput.value = String(S.settings.startingMoney || 0);
    }
    renderPlayers();
    updateRouteState();
  }

  function changeRound(delta) {
    pushUndo();
    S.round = clamp((S.round || 1) + delta, 1, 99);
    updatePlayAids();
    markDirty();
    announce('Round ' + S.round + '.');
  }

  function changeTurn(delta) {
    pushUndo();
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
    o.fillStyle = S.bgColor || '#F0EAD6';
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
  /* SVG export for paper and 3D printing                                */
  /* ------------------------------------------------------------------ */

  function escapeXml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function svgNumber(value) {
    return String(Math.round(Number(value) * 100) / 100);
  }

  function polygonPoints(cx, cy, r, sides, rotation) {
    var points = [];
    for (var i = 0; i < sides; i++) {
      var angle = ((rotation || 0) + (360 / sides) * i) * Math.PI / 180;
      points.push(svgNumber(cx + r * Math.cos(angle)) + ',' + svgNumber(cy + r * Math.sin(angle)));
    }
    return points.join(' ');
  }

  function starPoints(cx, cy, r, innerRatio) {
    var points = [];
    for (var i = 0; i < 10; i++) {
      var radius = (i % 2) ? r * innerRatio : r;
      var angle = (-90 + i * 36) * Math.PI / 180;
      points.push(svgNumber(cx + radius * Math.cos(angle)) + ',' + svgNumber(cy + radius * Math.sin(angle)));
    }
    return points.join(' ');
  }

  function pieceSvgShape(def, r) {
    var colour = def.color || '#c98a2e';
    var kind = def.id;
    if (def.counter) {
      return '<rect x="' + svgNumber(-r) + '" y="' + svgNumber(-r) + '" width="' + svgNumber(r * 2) +
        '" height="' + svgNumber(r * 2) + '" rx="' + svgNumber(r * 0.2) + '" fill="' + colour + '"/>';
    }
    if (kind === 'treasure') return '<polygon points="' + polygonPoints(0, 0, r, 4, 0) + '" fill="' + colour + '"/>';
    if (kind === 'star') return '<polygon points="' + starPoints(0, 0, r, 0.45) + '" fill="' + colour + '"/>';
    if (kind === 'monster') return '<polygon points="' + starPoints(0, 0, r, 0.62) + '" fill="' + colour + '"/>';
    if (kind === 'flag') return '<polygon points="' + polygonPoints(0, 0, r, 3, -90) + '" fill="' + colour + '"/>';
    if (kind === 'castle' || kind === 'rock') {
      return '<rect x="' + svgNumber(-r) + '" y="' + svgNumber(-r) + '" width="' + svgNumber(r * 2) +
        '" height="' + svgNumber(r * 2) + '" rx="' + svgNumber(kind === 'castle' ? r * 0.18 : r * 0.55) +
        '" fill="' + colour + '"/>';
    }
    if (def.img) return '<polygon points="' + polygonPoints(0, 0, r, 6, 0) + '" fill="' + colour + '"/>';
    return '<circle cx="0" cy="0" r="' + svgNumber(r) + '" fill="' + colour + '"/>';
  }

  function buildBoardSVG() {
    var size = boardSize();
    var gap = 1.5;
    var mmW = (size.W / CELL) * SVG_MM_PER_CELL;
    var mmH = (size.H / CELL) * SVG_MM_PER_CELL;
    var out = [];
    out.push('<?xml version="1.0" encoding="UTF-8"?>');
    out.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size.W + ' ' + size.H +
      '" width="' + svgNumber(mmW) + 'mm" height="' + svgNumber(mmH) +
      '" role="img" aria-label="Tabletop board ready for 3D printing">');
    out.push('  <title>' + escapeXml(S.name || 'Tabletop board') + '</title>');
    out.push('  <desc>Each tile is a separate shape at 20 mm per cell. Import into Tinkercad and extrude.</desc>');
    out.push('  <g id="terrain">');
    for (var row = 0; row < S.rows; row++) {
      for (var col = 0; col < S.cols; col++) {
        var key = S.tiles[row * S.cols + col];
        if (!key || !TERRAIN[key]) continue;
        var centre = centerOf(col, row);
        if (S.shape === 'square') {
          out.push('    <rect class="tile" data-terrain="' + key +
            '" x="' + svgNumber(col * CELL + gap) + '" y="' + svgNumber(row * CELL + gap) +
            '" width="' + svgNumber(CELL - gap * 2) + '" height="' + svgNumber(CELL - gap * 2) +
            '" rx="2.5" fill="' + TERRAIN[key].color + '"/>');
        } else {
          out.push('    <polygon class="tile" data-terrain="' + key +
            '" points="' + polygonPoints(centre.x, centre.y, hexMetrics().r - gap, 6, -90) +
            '" fill="' + TERRAIN[key].color + '"/>');
        }
      }
    }
    out.push('  </g>');

    if (S.tokens.length) {
      out.push('  <g id="pieces">');
      S.tokens.forEach(function (t) {
        var transform = 'translate(' + svgNumber(t.x) + ' ' + svgNumber(t.y) + ') rotate(' +
          svgNumber(t.rot || 0) + ') scale(' + svgNumber(t.scale || 1) + ')';
        if (t.type === 'card') {
          var cw = CELL * 0.36;
          var ch = CELL * 0.5;
          out.push('    <g class="piece card" data-piece="card" transform="' + transform + '">');
          out.push('      <title>' + escapeXml(cardLabel(t)) + '</title>');
          out.push('      <rect x="' + svgNumber(-cw / 2) + '" y="' + svgNumber(-ch / 2) +
            '" width="' + svgNumber(cw) + '" height="' + svgNumber(ch) +
            '" rx="3.5" fill="' + (t.faceDown ? '#70A3A7' : cardBorder(t)) + '"/>');
          out.push('    </g>');
        } else {
          var def = pieceDef(t.kind);
          out.push('    <g class="piece" data-piece="' + def.id + '" transform="' + transform + '">');
          out.push('      <title>' + escapeXml(tokenLabel(t)) + '</title>');
          out.push('      ' + pieceSvgShape(def, CELL * 0.3));
          out.push('    </g>');
        }
      });
      out.push('  </g>');
    }
    out.push('</svg>');
    return out.join('\n');
  }

  function buildPiecesSVG() {
    var cols = 6;
    var cellW = 96;
    var cellH = 118;
    var top = 64;
    var rows = Math.ceil(PIECE_DEFS.length / cols);
    var W = cols * cellW;
    var H = top + rows * cellH;
    var mmW = (W / CELL) * SVG_MM_PER_CELL;
    var mmH = (H / CELL) * SVG_MM_PER_CELL;
    var out = [];
    out.push('<?xml version="1.0" encoding="UTF-8"?>');
    out.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H +
      '" width="' + svgNumber(mmW) + 'mm" height="' + svgNumber(mmH) +
      '" role="img" aria-label="Tabletop Studio piece sheet">');
    out.push('  <title>Tabletop Studio piece sheet</title>');
    out.push('  <text x="16" y="28" font-family="Inter, sans-serif" font-size="16" font-weight="700" fill="#1a1208">Tabletop Studio pieces</text>');
    out.push('  <text x="16" y="46" font-family="Inter, sans-serif" font-size="11" fill="#4e4a42">Extrude each shape. One board square is 20 mm.</text>');
    PIECE_DEFS.forEach(function (def, i) {
      var col = i % cols;
      var row = Math.floor(i / cols);
      var cx = col * cellW + cellW / 2;
      var cy = top + row * cellH + 32;
      out.push('  <g class="piece" data-piece="' + def.id + '" transform="translate(' + cx + ' ' + cy + ')">');
      out.push('    <title>' + escapeXml(def.label) + '</title>');
      out.push('    ' + pieceSvgShape(def, 24));
      out.push('  </g>');
      out.push('  <text x="' + cx + '" y="' + (cy + 44) +
        '" text-anchor="middle" font-family="Inter, sans-serif" font-size="10" font-weight="600" fill="#1a1208">' +
        escapeXml(def.label) + '</text>');
    });
    out.push('</svg>');
    return out.join('\n');
  }

  function downloadSvg(text, filename) {
    var blob = new Blob([text], { type: 'image/svg+xml;charset=utf-8' });
    downloadBlob(blob, filename);
  }

  function exportBoardSVG() {
    downloadSvg(buildBoardSVG(), safeName() + '-board.svg');
    toast('Board SVG saved. Open it in Tinkercad and extrude the tiles.');
    announce('Board SVG saved for 3D printing.');
  }

  function exportPiecesSVG() {
    downloadSvg(buildPiecesSVG(), safeName() + '-pieces.svg');
    toast('Piece sheet SVG saved. Extrude each piece.');
    announce('Piece sheet SVG saved for 3D printing.');
  }

  /* ------------------------------------------------------------------ */
  /* Events                                                              */
  /* ------------------------------------------------------------------ */

  function filterPieces(query) {
    var q = String(query || '').trim().toLowerCase();
    var buttons = byId('ttPieces').querySelectorAll('[data-piece]');
    for (var i = 0; i < buttons.length; i++) {
      var label = buttons[i].textContent.toLowerCase();
      buttons[i].hidden = !!q && label.indexOf(q) === -1;
    }
  }

  function renderRecentColours() {
    if (!recentColoursEl) return;
    recentColoursEl.textContent = '';
    recentColours.forEach(function (key) {
      var t = TERRAIN[key];
      if (!t) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tt-recent-colour';
      b.dataset.recentTerrain = key;
      b.style.background = t.color;
      b.title = t.name;
      b.setAttribute('aria-label', 'Use ' + t.name);
      recentColoursEl.appendChild(b);
    });
  }

  function rememberColour(key) {
    if (!TERRAIN[key]) return;
    recentColours = recentColours.filter(function (k) { return k !== key; });
    recentColours.unshift(key);
    recentColours = recentColours.slice(0, 5);
    renderRecentColours();
  }

  function onTerrainClick(event) {
    var btn = event.target.closest('.tt-swatch');
    if (!btn) return;
    S.terrain = btn.dataset.terrain;
    if (S.terrain !== 'erase') rememberColour(S.terrain);
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
    var tool = btn.dataset.tool;
    S.tool = (tool === 'fill' || tool === 'pick' || tool === 'tile') ? tool : 'brush';
    var all = document.querySelectorAll('[data-tool]');
    for (var i = 0; i < all.length; i++) {
      all[i].setAttribute('aria-pressed', all[i] === btn ? 'true' : 'false');
    }
    if (S.tool === 'tile') {
      updateStatus();
      updateRouteState();
      announce('Tile settings tool selected. Tap a tile.');
      return;
    }
    var name = S.terrain === 'erase' ? 'erase' : (TERRAIN[S.terrain] ? TERRAIN[S.terrain].name : 'paint');
    byId('ttTerrainHelp').textContent = S.tool === 'fill'
      ? 'Fill is on. Tap a tile to flood it with ' + name + '.'
      : S.tool === 'pick'
        ? 'Pick is on. Click a tile to sample its terrain.'
        : 'Painting with ' + name + '. Drag to paint.';
    updateStatus();
    announce(S.tool === 'fill' ? 'Fill tool selected.' : S.tool === 'pick' ? 'Pick tool selected.' : 'Brush tool selected.');
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

  function updateTileEffectLabel() {
    if (!tileEffectInput || !tileEffectLabel || !tileEffectValueInput) return;
    var type = tileEffectInput.value;
    var labels = {
      none: 'Amount',
      forward: 'How many tiles forward',
      back: 'How many tiles back',
      goTo: 'Go to which number',
      skip: 'Turns to miss',
      again: 'No amount needed',
      card: 'No amount needed',
      money: 'Money up or down (-100 is a cost)'
    };
    tileEffectLabel.textContent = labels[type] || 'Amount';
    tileEffectValueInput.disabled = type === 'again' || type === 'card' || type === 'none';
    if (type === 'skip' && Number(tileEffectValueInput.value) < 1) tileEffectValueInput.value = '1';
  }

  function openTilePanel(col, row) {
    if (col < 0 || row < 0 || col >= S.cols || row >= S.rows) {
      toast('Tap a tile on the board first.');
      return;
    }
    ensureMeta();
    var meta = metaAt(col, row) || {};
    tileTarget = { col: col, row: row };
    tileTrigger = document.activeElement;
    tileWhere.textContent = 'Row ' + (row + 1) + ', column ' + (col + 1) + '. Anything here shows on the board.';
    tileNumberInput.value = meta.n || '';
    tileLabelInput.value = meta.label || '';
    tileIconInput.value = meta.icon || '';
    tileGroupChosen = !!meta.group;
    tileGroupInput.value = meta.group || '#70A3A7';
    tileEffectInput.value = meta.effect ? meta.effect.type : 'none';
    tileEffectValueInput.value = meta.effect ? String(meta.effect.value) : '1';
    tileNoteInput.value = meta.note || '';
    if (tileOwnerInput) tileOwnerInput.value = String(meta.owner || 0);
    updateTileEffectLabel();
    tilePanel.hidden = false;
    document.body.classList.add('tt-modal-open');
    try { tileNumberInput.focus({ preventScroll: true }); } catch (err) { tileNumberInput.focus(); }
  }

  function closeTilePanel(focusBack) {
    if (!tilePanel || tilePanel.hidden) return;
    tilePanel.hidden = true;
    document.body.classList.remove('tt-modal-open');
    if (focusBack !== false && tileTrigger && tileTrigger.offsetParent !== null) {
      try { tileTrigger.focus({ preventScroll: true }); } catch (err) { tileTrigger.focus(); }
    }
    tileTrigger = null;
    tileTarget = { col: -1, row: -1 };
  }

  function saveTilePanel() {
    if (tileTarget.col < 0 || tileTarget.row < 0) return;
    ensureMeta();
    pushUndo();
    var meta = {};
    var n = Number(tileNumberInput.value);
    if (isFinite(n) && n > 0) meta.n = clamp(Math.round(n), 0, 999);
    if (tileLabelInput.value.trim()) meta.label = tileLabelInput.value.trim().slice(0, 24);
    if (tileIconInput.value.trim()) meta.icon = tileIconInput.value.trim().slice(0, 4);
    if (tileGroupChosen && tileGroupInput.value) meta.group = tileGroupInput.value;
    if (tileNoteInput.value.trim()) meta.note = tileNoteInput.value.trim().slice(0, 60);
    if (tileOwnerInput && Number(tileOwnerInput.value)) meta.owner = clamp(Math.round(Number(tileOwnerInput.value)), 1, 4);
    var type = tileEffectInput.value;
    if (type && type !== 'none' && EFFECT_TYPES[type]) {
      meta.effect = {
        type: type,
        value: clamp(Math.round(Number(tileEffectValueInput.value) || 0), -999, 999)
      };
    }
    var clean = sanitiseMeta(meta);
    S.meta[cellIndex(tileTarget.col, tileTarget.row)] = clean;
    closeTilePanel();
    scheduleDraw();
    markDirty();
    toast(clean ? 'Tile details saved.' : 'Tile details removed.');
    announce(clean ? 'Tile details saved.' : 'Tile details removed.');
  }

  function removeTilePanel() {
    if (tileTarget.col < 0 || tileTarget.row < 0) return;
    pushUndo();
    S.meta[cellIndex(tileTarget.col, tileTarget.row)] = null;
    closeTilePanel();
    scheduleDraw();
    markDirty();
    toast('Tile details removed.');
  }

  function targetLabelForBranch(branch) {
    var targetCell = pathCellAt(pathIndexOf(branch.to.c, branch.to.r));
    var meta = targetCell ? metaAt(targetCell.c, targetCell.r) : null;
    return meta && meta.n ? 'tile ' + meta.n : 'the next stop';
  }

  function showChoice(player, options, callback) {
    choiceCallback = callback;
    choiceTrigger = document.activeElement;
    choiceText.textContent = activePlayerName() + ', choose where to go.';
    choiceOptions.textContent = '';
    options.forEach(function (branch) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tt-btn tt-btn--primary';
      btn.textContent = branch.label + ' → ' + targetLabelForBranch(branch);
      btn.addEventListener('click', function () { chooseBranch(branch); });
      choiceOptions.appendChild(btn);
    });
    choiceEl.hidden = false;
    document.body.classList.add('tt-modal-open');
    var first = choiceOptions.querySelector('button');
    if (first) {
      try { first.focus({ preventScroll: true }); } catch (err) { first.focus(); }
    }
  }

  function hideChoice(focusBack) {
    if (!choiceEl || choiceEl.hidden) return;
    choiceEl.hidden = true;
    document.body.classList.remove('tt-modal-open');
    if (focusBack !== false && choiceTrigger && choiceTrigger.offsetParent !== null) {
      try { choiceTrigger.focus({ preventScroll: true }); } catch (err) { choiceTrigger.focus(); }
    }
    choiceTrigger = null;
  }

  function chooseBranch(branch) {
    var callback = choiceCallback;
    choiceCallback = null;
    hideChoice(false);
    if (callback) callback(branch);
  }

  function showWinner(playerIndex) {
    var player = S.players[playerIndex - 1] || S.players[0];
    var name = player && player.name ? player.name : 'Player ' + playerIndex;
    S.winner = playerIndex;
    winTitle.textContent = name + ' wins!';
    winText.textContent = 'Pip says: ' + name + ' reached the finish. Play again, or change the board and make it your own.';
    winTrigger = document.activeElement;
    winEl.hidden = false;
    document.body.classList.add('tt-modal-open');
    try { winAgainBtn.focus({ preventScroll: true }); } catch (err) { winAgainBtn.focus(); }
    announce(name + ' wins the game.');
    playSound('win');
  }

  function hideWin(focusBack) {
    if (!winEl || winEl.hidden) return;
    winEl.hidden = true;
    document.body.classList.remove('tt-modal-open');
    if (focusBack !== false && winTrigger && winTrigger.offsetParent !== null) {
      try { winTrigger.focus({ preventScroll: true }); } catch (err) { winTrigger.focus(); }
    }
    winTrigger = null;
  }

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

    var cell = pointerCell(event);

    if (event.button === 2) {
      openTilePanel(cell.col, cell.row);
      return;
    }
    if (S.tool === 'select') {
      handleSelectTap(cell);
      return;
    }
    if (S.tool === 'path' || S.tool === 'link' || S.tool === 'tile' || S.tool === 'branch') {
      handleRouteTap(cell);
      return;
    }
    if (S.tool === 'pick') {
      var idx = cell.row * S.cols + cell.col;
      var picked = S.tiles[idx];
      if (picked && TERRAIN[picked]) {
        S.terrain = picked;
        S.tool = 'brush';
        syncControls();
        announce('Sampled ' + TERRAIN[picked].name + '.');
      }
      return;
    }

    if (event.pointerType === 'touch') {
      window.clearTimeout(longPressTimer);
      longPressCell = { col: cell.col, row: cell.row };
      paintMoved = false;
      longPressTimer = window.setTimeout(function () {
        if (paintMoved) return;
        longPressTimer = null;
        longPressCell = null;
        openTilePanel(cell.col, cell.row);
      }, 650);
    }

    pushUndo();
    eraseStroke = S.terrain === 'erase';
    lastPaintCell = null;
    kbActive = false;
    if (S.tool === 'fill') {
      applyPaint(cell, eraseStroke);
      markDirty();
      return;
    }
    painting = true;
    applyPaint(cell, eraseStroke);
    markDirty();
  }

  function onCanvasPointerMove(event) {
    if (S.mode !== 'build') return;
    var cell = pointerCell(event);
    if (longPressCell && (longPressCell.col !== cell.col || longPressCell.row !== cell.row)) {
      paintMoved = true;
      window.clearTimeout(longPressTimer);
      longPressTimer = null;
    }
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
    window.clearTimeout(longPressTimer);
    longPressTimer = null;
    longPressCell = null;
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
    if (choiceEl && !choiceEl.hidden) {
      if (event.key === 'Escape') {
        event.preventDefault();
        chooseBranch(null);
      } else if (event.key === 'Tab') {
        trapFocus(choiceEl.querySelector('.tt-modal-card'), event);
      }
      return;
    }
    if (tilePanel && !tilePanel.hidden) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeTilePanel();
      } else if (event.key === 'Tab') {
        trapFocus(tilePanel.querySelector('.tt-modal-card'), event);
      }
      return;
    }
    if (winEl && !winEl.hidden) {
      if (event.key === 'Escape') {
        event.preventDefault();
        hideWin();
      } else if (event.key === 'Tab') {
        trapFocus(winEl.querySelector('.tt-modal-card'), event);
      }
      return;
    }
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
      selection = null;
      updateSelectHint();
      scheduleDraw();
      closeSidebar();
    }
    if (!typing && S.mode === 'build') {
      var terrainKeys = Object.keys(TERRAIN);
      var kNum = parseInt(event.key, 10);
      if (!isNaN(kNum) && kNum >= 1 && kNum <= terrainKeys.length) {
        S.terrain = terrainKeys[kNum - 1];
        syncControls();
        announce(TERRAIN[S.terrain].name + ' selected.');
        return;
      }
      if (event.key === '0') {
        S.terrain = 'erase';
        syncControls();
        announce('Erase selected.');
        return;
      }
      if (event.key === '=' || event.key === '+') {
        applyZoom(zoom + 0.5);
        return;
      }
      if (event.key === '-' || event.key === '_') {
        applyZoom(zoom - 0.5);
        return;
      }
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
    if (printKitBtn) printKitBtn.addEventListener('click', printKit);
    if (shareCopyBtn) shareCopyBtn.addEventListener('click', copyShareCode);
    if (shareLoadBtn) shareLoadBtn.addEventListener('click', loadShareCode);
    byId('ttExportSvg').addEventListener('click', exportBoardSVG);
    byId('ttExportPiecesSvg').addEventListener('click', exportPiecesSVG);
    if (turnChip) turnChip.addEventListener('click', function () {
      if (window.matchMedia('(max-width: 980px)').matches) openSidebar();
      var sec = byId('ttRules').closest('details');
      if (sec) {
        sec.open = true;
        try { sec.scrollIntoView({ block: 'nearest' }); } catch (err) { /* scroll is optional */ }
      }
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
    if (modeDiceBtn) modeDiceBtn.addEventListener('click', function () { setRollMode('dice'); });
    if (modeSpinnerBtn) modeSpinnerBtn.addEventListener('click', function () { setRollMode('spinner'); });
    if (spinBtn) spinBtn.addEventListener('click', spinSpinner);
    if (spinnerSizeInput) spinnerSizeInput.addEventListener('change', function () {
      S.spinner.size = [4, 6, 8, 10].indexOf(Number(spinnerSizeInput.value)) >= 0 ? Number(spinnerSizeInput.value) : 6;
      S.spinner = normaliseSpinner(S.spinner);
      renderSpinner();
      markDirty();
    });
    if (spinnerLabelsInput) spinnerLabelsInput.addEventListener('change', function () {
      var labels = spinnerLabelsInput.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      S.spinner.labels = labels.slice(0, S.spinner.size);
      S.spinner = normaliseSpinner(S.spinner);
      renderSpinner();
      markDirty();
    });
    if (deckSelect) deckSelect.addEventListener('change', function () { loadDeck(deckSelect.value); });
    if (deckAddBtn) deckAddBtn.addEventListener('click', addDeck);
    if (diceNormalBtn) diceNormalBtn.addEventListener('click', function () { setDieMode('numbers'); });
    if (diceActionBtn) diceActionBtn.addEventListener('click', function () { setDieMode('action'); });
    if (actionSaveBtn) actionSaveBtn.addEventListener('click', saveActionFaces);
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
    function applyCustomSize() {
      var cols = Number(colsInput && colsInput.value);
      var rows = Number(rowsInput && rowsInput.value);
      if (!cols || !rows) {
        toast('Type a column and row count first.');
        return;
      }
      setGrid(cols, rows, S.shape);
    }
    if (sizeApplyBtn) sizeApplyBtn.addEventListener('click', applyCustomSize);
    if (selectAreaBtn) selectAreaBtn.addEventListener('click', function () {
      if (S.mode !== 'build') setMode('build');
      setToolMode(S.tool === 'select' ? 'brush' : 'select');
      updateSelectHint();
      if (S.tool === 'select') toast('Select on. Tap two corners of an area.');
    });
    if (copyAreaBtn) copyAreaBtn.addEventListener('click', copyArea);
    if (stampAreaBtn) stampAreaBtn.addEventListener('click', stampArea);
    if (clearAreaBtn) clearAreaBtn.addEventListener('click', clearArea);
    if (mirrorBoardBtn) mirrorBoardBtn.addEventListener('click', mirrorBoard);
    if (flipBoardBtn) flipBoardBtn.addEventListener('click', flipBoard);
    if (dupRowBtn) dupRowBtn.addEventListener('click', duplicateRow);
    if (dupColBtn) dupColBtn.addEventListener('click', duplicateColumn);
    if (pieceSearchInput) pieceSearchInput.addEventListener('input', function () {
      filterPieces(pieceSearchInput.value);
    });
    if (recentColoursEl) recentColoursEl.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-recent-terrain]');
      if (!btn) return;
      S.terrain = btn.dataset.recentTerrain;
      S.tool = S.tool === 'fill' ? 'fill' : 'brush';
      syncControls();
      rememberColour(S.terrain);
      announce(TERRAIN[S.terrain].name + ' selected.');
    });
    [colsInput, rowsInput].forEach(function (input) {
      if (!input) return;
      input.addEventListener('change', applyCustomSize);
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          applyCustomSize();
        }
      });
    });

    if (pathDrawBtn) pathDrawBtn.addEventListener('click', function () { toggleRouteTool('path'); });
    if (pathLinkBtn) pathLinkBtn.addEventListener('click', function () { toggleRouteTool('link'); });
    if (pathNumberBtn) pathNumberBtn.addEventListener('click', numberPath);
    if (pathSerpentineBtn) pathSerpentineBtn.addEventListener('click', buildSerpentine);
    if (pathReverseBtn) pathReverseBtn.addEventListener('click', reverseRoute);
    if (pathClearBtn) pathClearBtn.addEventListener('click', clearRoute);
    if (branchToolBtn) branchToolBtn.addEventListener('click', function () { toggleRouteTool('branch'); });
    if (branchClearBtn) branchClearBtn.addEventListener('click', clearBranches);
    if (pathSnapInput) {
      pathSnapInput.addEventListener('change', function () {
        S.settings.snapPath = !!pathSnapInput.checked;
        markDirty();
        announce(S.settings.snapPath ? 'Pieces snap to the route.' : 'Pieces move freely.');
      });
    }

    if (setupPawnsBtn) setupPawnsBtn.addEventListener('click', function () { setupPawns(true); });
    if (buyTileBtn) buyTileBtn.addEventListener('click', buyCurrentTile);
    if (rulesGenerateBtn) rulesGenerateBtn.addEventListener('click', writeRulesFromBoard);
    [ruleExactInput, ruleSixInput, ruleStartBonusInput, ruleCaptureInput, ruleStackInput, ruleRentInput].forEach(function (input) {
      if (!input) return;
      input.addEventListener('change', function () {
        S.settings.exactFinish = !!(ruleExactInput && ruleExactInput.checked);
        S.settings.sixToStart = !!(ruleSixInput && ruleSixInput.checked);
        S.settings.startBonus = !!(ruleStartBonusInput && ruleStartBonusInput.checked);
        S.settings.capture = !!(ruleCaptureInput && ruleCaptureInput.checked);
        S.settings.stacking = !!(ruleStackInput && ruleStackInput.checked);
        S.settings.rent = !!(ruleRentInput && ruleRentInput.checked);
        markDirty();
      });
    });
    if (startingMoneyInput) {
      startingMoneyInput.addEventListener('change', function () {
        S.settings.startingMoney = clamp(Math.round(Number(startingMoneyInput.value) || 0), 0, 100000);
        S.players.forEach(function (p) { p.money = S.settings.startingMoney; });
        renderPlayers();
        markDirty();
      });
    }

    if (tileEffectInput) tileEffectInput.addEventListener('change', updateTileEffectLabel);
    if (tileGroupClearBtn) tileGroupClearBtn.addEventListener('click', function () {
      tileGroupChosen = false;
      tileGroupInput.value = '#70A3A7';
    });
    if (tileGroupInput) tileGroupInput.addEventListener('input', function () { tileGroupChosen = true; });
    if (tileSaveBtn) tileSaveBtn.addEventListener('click', saveTilePanel);
    if (tileRemoveBtn) tileRemoveBtn.addEventListener('click', removeTilePanel);
    if (tileCloseBtn) tileCloseBtn.addEventListener('click', function () { closeTilePanel(); });
    if (tileBackdrop) tileBackdrop.addEventListener('click', function () { closeTilePanel(); });
    if (winCloseBtn) winCloseBtn.addEventListener('click', function () { hideWin(); });
    if (winBackdrop) winBackdrop.addEventListener('click', function () { hideWin(); });
    if (choiceCloseBtn) choiceCloseBtn.addEventListener('click', function () { chooseBranch(null); });
    if (choiceBackdrop) choiceBackdrop.addEventListener('click', function () { chooseBranch(null); });
    if (winAgainBtn) winAgainBtn.addEventListener('click', function () {
      hideWin(false);
      resetGame();
    });
    if (cv) cv.addEventListener('contextmenu', function (event) { event.preventDefault(); });

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
          var firstSwatch = document.querySelector('.tt-swatch');
          if (firstSwatch) {
            firstSwatch.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            firstSwatch.focus({ preventScroll: true });
          } else {
            try { cv.focus({ preventScroll: true }); } catch (err) { cv.focus(); }
          }
        }
        toast('Pick a colour and paint.', 'save');
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

    var reshuffleBtn = byId('ttReshuffleDeck');
    if (reshuffleBtn) reshuffleBtn.addEventListener('click', function () {
      pushUndo();
      S.deck = makeDeck();
      saveActiveDeck();
      updateDeckLabel();
      markDirty();
      announce('Deck reshuffled.');
      playSound('flip');
    });

    var bgColorInput2 = byId('ttBgColor');
    if (bgColorInput2) bgColorInput2.addEventListener('input', function () {
      S.bgColor = bgColorInput2.value;
      drawScene();
      markDirty();
    });

    var bgColorReset = byId('ttBgColorReset');
    if (bgColorReset) bgColorReset.addEventListener('click', function () {
      S.bgColor = null;
      var inp = byId('ttBgColor');
      if (inp) inp.value = '#F0EAD6';
      drawScene();
      markDirty();
      announce('Board colour reset.');
    });

    var clearPiecesBtn = byId('ttClearPieces');
    if (clearPiecesBtn) clearPiecesBtn.addEventListener('click', clearPieces);

    var deckStdCheck = byId('ttDeckStandard');
    if (deckStdCheck) deckStdCheck.addEventListener('change', function () {
      S.deckStandard = deckStdCheck.checked;
      saveActiveDeck();
      markDirty();
    });

    var pieceNoteEl = byId('ttPieceNote');
    if (pieceNoteEl) pieceNoteEl.addEventListener('input', function () {
      var t = tokenById(S.selectedId);
      if (!t || t.type === 'card') return;
      t.note = pieceNoteEl.value.slice(0, 20);
      updateTokenElement(t);
      markDirty();
    });

    var soundMuteBtn = byId('ttSoundMute');
    if (soundMuteBtn) soundMuteBtn.addEventListener('click', function () {
      soundMuted = !soundMuted;
      soundMuteBtn.setAttribute('aria-pressed', soundMuted ? 'true' : 'false');
      soundMuteBtn.textContent = soundMuted ? '🔇' : '🔊';
      announce(soundMuted ? 'Sound muted.' : 'Sound on.');
    });

    var playersEl = byId('ttPlayers');
    if (playersEl) {
      playersEl.addEventListener('input', function (event) {
        var nameIn = event.target.closest('.tt-player-name');
        if (!nameIn) return;
        var idx = parseInt(nameIn.dataset.playerIdx, 10);
        if (isNaN(idx)) return;
        S.players[idx].name = nameIn.value.slice(0, 20);
        markDirty();
      });
      playersEl.addEventListener('click', function (event) {
        var colourBtn = event.target.closest('[data-player-colour]');
        if (colourBtn) {
          var colourIdx = parseInt(colourBtn.dataset.playerColour, 10);
          if (isNaN(colourIdx)) return;
          var currentColour = S.players[colourIdx].color || PLAYER_COLORS[0];
          var at = PLAYER_COLORS.indexOf(currentColour);
          S.players[colourIdx].color = PLAYER_COLORS[(at + 1) % PLAYER_COLORS.length];
          S.tokens.forEach(function (t) {
            if (t.pawn && t.player === colourIdx + 1) {
              t.color = S.players[colourIdx].color;
              updateTokenElement(t);
            }
          });
          renderPlayers();
          markDirty();
          announce('Player ' + (colourIdx + 1) + ' colour changed.');
          return;
        }
        var moneyBtn = event.target.closest('.tt-player-money-btn');
        if (moneyBtn) {
          var moneyIdx = parseInt(moneyBtn.dataset.playerIdx, 10);
          var moneyDelta = parseInt(moneyBtn.dataset.moneyDelta, 10);
          if (isNaN(moneyIdx) || isNaN(moneyDelta)) return;
          S.players[moneyIdx].money = clamp((S.players[moneyIdx].money || 0) + moneyDelta, -999999, 999999);
          renderPlayers();
          markDirty();
          return;
        }
        var btn = event.target.closest('.tt-player-score-btn');
        if (!btn) return;
        var idx = parseInt(btn.dataset.playerIdx, 10);
        var delta = parseInt(btn.dataset.scoreDelta, 10);
        if (isNaN(idx) || isNaN(delta)) return;
        S.players[idx].score = clamp(S.players[idx].score + delta, -999, 9999);
        renderPlayers();
        markDirty();
      });
    }
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

  function freeSpotFrom(col, row, excludeId) {
    var occupied = {};
    S.tokens.forEach(function (t) {
      if (t.id === excludeId) return;
      var c = cellAt(t.x, t.y);
      occupied[c.col + ',' + c.row] = true;
    });
    if (!occupied[col + ',' + row]) return { col: col, row: row };
    for (var radius = 1; radius <= Math.max(S.cols, S.rows); radius++) {
      for (var dc = -radius; dc <= radius; dc++) {
        for (var dr = -radius; dr <= radius; dr++) {
          if (Math.abs(dc) !== radius && Math.abs(dr) !== radius) continue;
          var nc = col + dc;
          var nr = row + dr;
          if (nc < 0 || nr < 0 || nc >= S.cols || nr >= S.rows) continue;
          if (!occupied[nc + ',' + nr]) return { col: nc, row: nr };
        }
      }
    }
    return { col: col, row: row };
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
        var free = freeSpotFrom(cell.col, cell.row, drag.t.id);
        var c = centerOf(free.col, free.row);
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
  /* Section open/close memory                                          */
  /* ------------------------------------------------------------------ */

  var SEC_KEY = 'jvds-tabletop-sections-v1';

  function saveSectionStates() {
    try {
      var state = {};
      document.querySelectorAll('.tt-sec').forEach(function (el) {
        if (el.id) state[el.id] = el.open;
      });
      localStorage.setItem(SEC_KEY, JSON.stringify(state));
    } catch (err) {}
  }

  function restoreSectionStates() {
    try {
      var raw = localStorage.getItem(SEC_KEY);
      if (!raw) return;
      var state = JSON.parse(raw);
      document.querySelectorAll('.tt-sec').forEach(function (el) {
        if (el.id && state.hasOwnProperty(el.id)) el.open = !!state[el.id];
      });
    } catch (err) {}
  }

  function wireSectionMemory() {
    document.querySelectorAll('.tt-sec').forEach(function (el) {
      el.addEventListener('toggle', saveSectionStates);
    });
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
    wireSectionMemory();
    restoreSectionStates();
    applyZoom(1);

    ensureDecks();
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



