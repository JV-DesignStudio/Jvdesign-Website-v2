/* tools/minecraft-skin-editor.html , Minecraft Skin Editor runtime.
   External script (no inline handlers, no inline <script>) so the page keeps a
   strict CSP. Paints the 64x64 skin texture, renders a 3D player preview with
   the vendored three.js r128, imports/exports PNG and saves to localStorage. */
(function () {
  'use strict';

  var SIZE = 64; // skin texture is 64x64
  var SCALE = 8; // internal pixels per skin pixel

  // ---- DOM ----------------------------------------------------------------
  var skinCanvas = document.getElementById('msSkin');
  var overlayCanvas = document.getElementById('msOverlay');
  var colorInput = document.getElementById('msColor');
  var colorVal = document.getElementById('msColorVal');
  var toolGrid = document.getElementById('msToolGrid');
  var brushGrid = document.getElementById('msBrushGrid');
  var swatchWrap = document.getElementById('msSwatches');
  var templateGrid = document.getElementById('msTemplateGrid');
  var fileInput = document.getElementById('msFile');
  var toastEl = document.getElementById('msToast');
  var modal = document.getElementById('msModal');
  var toastTimer = null;

  if (!skinCanvas || !overlayCanvas) return;

  var skinCtx = skinCanvas.getContext('2d');
  var overlayCtx = overlayCanvas.getContext('2d');
  skinCanvas.width = skinCanvas.height = SIZE * SCALE;
  overlayCanvas.width = overlayCanvas.height = SIZE * SCALE;

  // offscreen 1:1 copy used for scaling to screen and for the 3D texture
  var off = document.createElement('canvas');
  off.width = off.height = SIZE;
  var offCtx = off.getContext('2d');

  // ---- pixel data ---------------------------------------------------------
  var data = new Uint8ClampedArray(SIZE * SIZE * 4); // RGBA, alpha 0 = clear
  var undoStack = [];
  var redoStack = [];
  var MAX_UNDO = 40;

  var state = {
    tool: 'pencil',
    brush: 1,
    color: '#3fa9d8',
    rgba: [63, 169, 216, 255],
    showGrid: true,
    showOverlay: true,
    autoRotate: true,
    symmetry: false,
    showLabels: false
  };
  var LS_KEY = 'jvds_minecraft_skin';

  // ---- zoom ---------------------------------------------------------------
  var ZOOM_STEPS = [4, 8, 16, 32];
  var zoomIdx = 1; // default 8x

  function effectiveScale() { return skinCanvas.width / SIZE; }

  function applyZoom() {
    var sc = ZOOM_STEPS[zoomIdx];
    skinCanvas.width  = skinCanvas.height  = SIZE * sc;
    overlayCanvas.width = overlayCanvas.height = SIZE * sc;
    gridCache.width = gridCache.height = 0; // invalidate
    var el = document.getElementById('msZoomVal');
    if (el) el.textContent = sc + 'x';
    buildGridCache(); repaintPixels(); renderOverlay();
    try { localStorage.setItem(LS_KEY + '_zoom', zoomIdx); } catch (e) {}
  }
  function zoomIn()  { if (zoomIdx < ZOOM_STEPS.length - 1) { zoomIdx++; applyZoom(); } }
  function zoomOut() { if (zoomIdx > 0)                     { zoomIdx--; applyZoom(); } }
  function loadZoom() {
    try {
      var z = localStorage.getItem(LS_KEY + '_zoom');
      if (z !== null) zoomIdx = Math.min(Math.max(+z | 0, 0), ZOOM_STEPS.length - 1);
    } catch (e) {}
  }

  function idx(x, y) { return (y * SIZE + x) * 4; }

  function setPixel(x, y, r, g, b, a) {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
    var i = idx(x, y);
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
  }

  function getPixel(x, y) {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return [0, 0, 0, 0];
    var i = idx(x, y);
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  }

  function snapshot() { return new Uint8ClampedArray(data); }
  function pushUndo() {
    undoStack.push(snapshot());
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack.length = 0;
    updateUndoButtons();
  }
  function undo() {
    if (!undoStack.length) { toast('Nothing to undo'); return; }
    redoStack.push(snapshot());
    data = undoStack.pop();
    renderAll(); scheduleAutosave(); updateUndoButtons();
  }
  function redo() {
    if (!redoStack.length) { toast('Nothing to redo'); return; }
    undoStack.push(snapshot());
    data = redoStack.pop();
    renderAll(); scheduleAutosave(); updateUndoButtons();
  }
  function updateUndoButtons() {
    var u = document.getElementById('msUndoBtn');
    var r = document.getElementById('msRedoBtn');
    if (u) u.disabled = undoStack.length === 0;
    if (r) r.disabled = redoStack.length === 0;
  }

  // ---- colour helpers -----------------------------------------------------
  function hexToRgb(hex) {
    hex = String(hex).replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    return [parseInt(hex.slice(0, 2), 16) || 0, parseInt(hex.slice(2, 4), 16) || 0, parseInt(hex.slice(4, 6), 16) || 0];
  }
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
  }

  // ---- drawing ------------------------------------------------------------
  function paintDotAt(cx, cy, r, g, b, a) {
    var half = Math.floor(state.brush / 2);
    for (var dy = -half; dy < state.brush - half; dy++) {
      for (var dx = -half; dx < state.brush - half; dx++) {
        setPixel(cx + dx, cy + dy, r, g, b, a);
      }
    }
  }
  function paintDot(cx, cy) {
    var r = state.rgba[0], g = state.rgba[1], b = state.rgba[2], a = state.rgba[3];
    paintDotAt(cx, cy, r, g, b, a);
    if (state.symmetry) {
      var sp = symmetricPixel(cx, cy);
      if (sp) paintDotAt(sp[0], sp[1], r, g, b, a);
    }
  }
  function paintLine(x0, y0, x1, y1) {
    var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    var err = dx - dy;
    for (;;) {
      paintDot(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }
  function floodFill(x, y) {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
    var target = getPixel(x, y);
    var repl = state.rgba;
    if (target[0] === repl[0] && target[1] === repl[1] && target[2] === repl[2] && target[3] === repl[3]) return;
    var stack = [[x, y]];
    while (stack.length) {
      var p = stack.pop(), px = p[0], py = p[1];
      if (px < 0 || py < 0 || px >= SIZE || py >= SIZE) continue;
      var cur = getPixel(px, py);
      if (cur[0] !== target[0] || cur[1] !== target[1] || cur[2] !== target[2] || cur[3] !== target[3]) continue;
      setPixel(px, py, repl[0], repl[1], repl[2], repl[3]);
      stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
    }
  }
  // ---- symmetry helpers ---------------------------------------------------
  var PART_GROUPS = [
    { name: 'RARM', g: null }, { name: 'LARM', g: null },
    { name: 'RLEG', g: null }, { name: 'LLEG', g: null },
    { name: 'HEAD', g: null }, { name: 'HAT',  g: null },
    { name: 'BODY', g: null }, { name: 'JACKET', g: null }
  ];
  var FACE_NAMES = ['top', 'bottom', 'right', 'front', 'left', 'back'];
  var SYMM_PARTNER = { RARM: 'LARM', LARM: 'RARM', RLEG: 'LLEG', LLEG: 'RLEG' };
  var SYMM_FACE = { right: 'left', left: 'right', front: 'front', back: 'back', top: 'top', bottom: 'bottom' };

  function initPartGroups() {
    var map = { RARM: RARM, LARM: LARM, RLEG: RLEG, LLEG: LLEG, HEAD: HEAD, HAT: HAT, BODY: BODY, JACKET: JACKET };
    PART_GROUPS.forEach(function (p) { p.g = map[p.name]; });
  }

  function findFace(px, py) {
    for (var gi = 0; gi < PART_GROUPS.length; gi++) {
      var pg = PART_GROUPS[gi];
      for (var fi = 0; fi < FACE_NAMES.length; fi++) {
        var r = pg.g[FACE_NAMES[fi]];
        if (px >= r[0] && px < r[0] + r[2] && py >= r[1] && py < r[1] + r[3]) {
          return { part: pg.name, face: FACE_NAMES[fi], rect: r, lx: px - r[0], ly: py - r[1] };
        }
      }
    }
    return null;
  }

  function symmetricPixel(px, py) {
    var info = findFace(px, py);
    if (!info) return null;
    var partnerName = SYMM_PARTNER[info.part];
    if (!partnerName) return null;
    var partnerGroup = null;
    for (var i = 0; i < PART_GROUPS.length; i++) {
      if (PART_GROUPS[i].name === partnerName) { partnerGroup = PART_GROUPS[i].g; break; }
    }
    if (!partnerGroup) return null;
    var mFaceName = SYMM_FACE[info.face];
    var mRect = partnerGroup[mFaceName];
    var mlx = (info.face === 'right' || info.face === 'left') ? info.lx : (mRect[2] - 1 - info.lx);
    return [mRect[0] + mlx, mRect[1] + info.ly];
  }

  // ---- highlighted part (driven by 3D hover) ------------------------------
  var highlightedPart = null;

  function setHighlightedPart(name) {
    if (highlightedPart === name) return;
    highlightedPart = name;
    buildGridCache(); renderOverlay();
  }

  function clearSkin() {
    pushUndo();
    for (var i = 0; i < data.length; i++) data[i] = 0;
    renderAll(); scheduleAutosave(); toast('Skin cleared');
  }

  // ---- region rectangles (skin layout, 64x64) -----------------------------
  function R(x, y, w, h) { return [x, y, w, h]; }
  var HEAD = {
    top: R(8, 0, 8, 8), bottom: R(16, 0, 8, 8), right: R(0, 8, 8, 8),
    front: R(8, 8, 8, 8), left: R(16, 8, 8, 8), back: R(24, 8, 8, 8)
  };
  var HAT = {
    top: R(40, 0, 8, 8), bottom: R(48, 0, 8, 8), right: R(32, 8, 8, 8),
    front: R(40, 8, 8, 8), left: R(48, 8, 8, 8), back: R(56, 8, 8, 8)
  };
  var BODY = {
    top: R(20, 16, 8, 4), bottom: R(28, 16, 8, 4), right: R(16, 20, 4, 12),
    front: R(20, 20, 8, 12), left: R(28, 20, 4, 12), back: R(32, 20, 8, 12)
  };
  var JACKET = {
    top: R(20, 32, 8, 4), bottom: R(28, 32, 8, 4), right: R(16, 36, 4, 12),
    front: R(20, 36, 8, 12), left: R(28, 36, 4, 12), back: R(32, 36, 8, 12)
  };
  var RARM = {
    top: R(44, 16, 4, 4), bottom: R(48, 16, 4, 4), right: R(40, 20, 4, 12),
    front: R(44, 20, 4, 12), left: R(48, 20, 4, 12), back: R(52, 20, 4, 12)
  };
  var LARM = {
    top: R(36, 48, 4, 4), bottom: R(40, 48, 4, 4), right: R(32, 52, 4, 12),
    front: R(36, 52, 4, 12), left: R(40, 52, 4, 12), back: R(44, 52, 4, 12)
  };
  var RLEG = {
    top: R(4, 16, 4, 4), bottom: R(8, 16, 4, 4), right: R(0, 20, 4, 12),
    front: R(4, 20, 4, 12), left: R(8, 20, 4, 12), back: R(12, 20, 4, 12)
  };
  var LLEG = {
    top: R(20, 48, 4, 4), bottom: R(24, 48, 4, 4), right: R(16, 52, 4, 12),
    front: R(20, 52, 4, 12), left: R(24, 52, 4, 12), back: R(28, 52, 4, 12)
  };

  function facesOf(group) { return [group.top, group.bottom, group.right, group.front, group.left, group.back]; }
  var ALL_RECTS = [].concat(
    facesOf(HEAD), facesOf(HAT), facesOf(BODY), facesOf(JACKET),
    facesOf(RARM), facesOf(LARM), facesOf(RLEG), facesOf(LLEG)
  );

  function fillRect(rect, rgba) {
    var x = rect[0], y = rect[1], w = rect[2], h = rect[3];
    var a = (rgba[3] === undefined) ? 255 : rgba[3];
    for (var yy = y; yy < y + h; yy++) {
      for (var xx = x; xx < x + w; xx++) setPixel(xx, yy, rgba[0], rgba[1], rgba[2], a);
    }
  }
  function fillGroup(group, rgba) { facesOf(group).forEach(function (r) { fillRect(r, rgba); }); }

  // ---- templates ----------------------------------------------------------
  function templateClassic() {
    var skin = hexToRgb('#c9905f'), hair = hexToRgb('#3a2a1a'), shirt = hexToRgb('#3fa9d8');
    var pants = hexToRgb('#3b5ea8'), shoe = hexToRgb('#3a3a44'), white = [245, 245, 245], dark = [26, 26, 34];
    clearData();
    fillGroup(HEAD, skin); fillGroup(BODY, shirt); fillGroup(RARM, skin); fillGroup(LARM, skin);
    fillGroup(RLEG, pants); fillGroup(LLEG, pants);
    fillRect(HEAD.top, hair);
    fillRect(HEAD.right, skin); fillRect(HEAD.left, skin); fillRect(HEAD.back, hair);
    // hair fringe on the side/back top rows
    var topRow = function (r) { fillRect([r[0], r[1], r[2], 2], hair); };
    topRow(HEAD.right); topRow(HEAD.left); topRow(HEAD.back);
    // eyes + mouth on the front face (x 8..16, y 8..16)
    facePixel(10, 12, white); facePixel(11, 12, dark); facePixel(14, 12, dark); facePixel(13, 12, white);
    facePixel(10, 14, dark); facePixel(13, 14, dark);
    // shirt collar + shoes
    fillRect([20, 20, 8, 2], hexToRgb('#2f7fa8'));
    fillRect([4, 30, 4, 2], shoe); fillRect([8, 30, 4, 2], shoe);
    fillRect([20, 30, 4, 2], shoe); fillRect([24, 30, 4, 2], shoe);
  }
  function templateBlank() { clearData(); }
  function templateZombie() {
    var skin = hexToRgb('#5a8a4a'), shirt = hexToRgb('#3f5f8a'), pants = hexToRgb('#2f4a6a'), dark = [20, 40, 20];
    clearData();
    fillGroup(HEAD, skin); fillGroup(BODY, shirt); fillGroup(RARM, skin); fillGroup(LARM, skin);
    fillGroup(RLEG, pants); fillGroup(LLEG, pants);
    fillRect(HEAD.top, hexToRgb('#3f6a34'));
    facePixel(10, 12, dark); facePixel(11, 12, dark); facePixel(13, 12, dark); facePixel(14, 12, dark);
    facePixel(11, 14, dark); facePixel(12, 14, dark);
  }
  function templateRobot() {
    var metal = hexToRgb('#9aa3ad'), metal2 = hexToRgb('#6f7885'), glow = hexToRgb('#6fe6dc');
    clearData();
    fillGroup(HEAD, metal); fillGroup(BODY, metal2); fillGroup(RARM, metal); fillGroup(LARM, metal);
    fillGroup(RLEG, metal2); fillGroup(LLEG, metal2);
    fillRect(HEAD.top, metal2);
    facePixel(10, 12, glow); facePixel(11, 12, glow); facePixel(13, 12, glow); facePixel(14, 12, glow);
    fillRect([20, 22, 8, 2], hexToRgb('#3a4048'));
  }
  function facePixel(x, y, rgb) { setPixel(x, y, rgb[0], rgb[1], rgb[2], 255); }
  function clearData() { for (var i = 0; i < data.length; i++) data[i] = 0; }

  function templateKnight() {
    var steel = hexToRgb('#8fa3b4'), dark = hexToRgb('#3a4a56'), visor = hexToRgb('#c8e0f4');
    var cape = hexToRgb('#7a1a2a'), gold = hexToRgb('#e8c34a');
    clearData();
    fillGroup(HEAD, steel); fillGroup(BODY, steel); fillGroup(RARM, steel); fillGroup(LARM, steel);
    fillGroup(RLEG, steel); fillGroup(LLEG, steel);
    fillRect(HEAD.top, dark); fillRect(HEAD.back, dark);
    // visor slit
    fillRect([9, 12, 6, 2], visor);
    // chest cross
    fillRect([21, 22, 6, 1], gold); fillRect([23, 20, 2, 5], gold);
    // cape (jacket layer back)
    fillRect(JACKET.back, cape); fillRect(JACKET.top, cape);
  }
  function templateWizard() {
    var robe = hexToRgb('#4a2a7a'), robe2 = hexToRgb('#3a1f60'), star = hexToRgb('#e8c34a');
    var skin = hexToRgb('#f0c090'), beard = hexToRgb('#e0e0d0');
    clearData();
    fillGroup(HEAD, skin); fillGroup(BODY, robe); fillGroup(RARM, robe); fillGroup(LARM, robe);
    fillGroup(RLEG, robe2); fillGroup(LLEG, robe2);
    // hat (hat layer = very tall)
    fillGroup(HAT, hexToRgb('#4a2a7a'));
    fillRect(HEAD.top, hexToRgb('#4a2a7a'));
    // eyes
    facePixel(10, 12, hexToRgb('#3a2060')); facePixel(13, 12, hexToRgb('#3a2060'));
    // beard
    fillRect([8, 14, 8, 2], beard);
    // star on chest
    facePixel(23, 22, star); facePixel(22, 23, star); facePixel(23, 23, star); facePixel(24, 23, star);
    facePixel(22, 24, star); facePixel(23, 24, star); facePixel(24, 24, star);
  }
  function templateAstronaut() {
    var suit = hexToRgb('#dce8f0'), visor = hexToRgb('#6fd6e8'), dark = hexToRgb('#3a4a56');
    var accent = hexToRgb('#e07a6b'), pack = hexToRgb('#9aa3ad');
    clearData();
    fillGroup(HEAD, suit); fillGroup(BODY, suit); fillGroup(RARM, suit); fillGroup(LARM, suit);
    fillGroup(RLEG, suit); fillGroup(LLEG, suit);
    // visor
    fillRect([9, 9, 6, 5], visor);
    fillRect([8, 11, 1, 3], visor); fillRect([15, 11, 1, 3], visor);
    // helmet outline
    fillRect([8, 8, 8, 1], dark); fillRect([8, 15, 8, 1], dark);
    // accent stripes
    fillRect([20, 20, 8, 1], accent); fillRect([20, 30, 8, 1], accent);
    // backpack
    fillRect(JACKET.back, pack);
  }
  function templateFox() {
    var fur = hexToRgb('#d4622a'), darkfur = hexToRgb('#2a1a0a'), white = hexToRgb('#f0ede8');
    var chest = hexToRgb('#f0d0a0');
    clearData();
    fillGroup(HEAD, fur); fillGroup(BODY, fur); fillGroup(RARM, fur); fillGroup(LARM, fur);
    fillGroup(RLEG, darkfur); fillGroup(LLEG, darkfur);
    // white muzzle
    fillRect([9, 12, 6, 4], white);
    // dark nose
    facePixel(11, 13, darkfur); facePixel(12, 13, darkfur);
    // eyes
    facePixel(10, 11, darkfur); facePixel(13, 11, darkfur);
    // ear tips (hat layer top)
    fillRect(HAT.top, fur);
    fillRect([40, 0, 2, 2], darkfur); fillRect([46, 0, 2, 2], darkfur);
    // chest
    fillRect(BODY.front, chest); fillRect(JACKET.front, chest);
    // tail tip (jacket back bottom)
    fillRect([32, 44, 8, 4], white);
  }

  var TEMPLATES = [
    { id: 'classic',    label: 'Classic',    fn: templateClassic },
    { id: 'zombie',     label: 'Zombie',     fn: templateZombie },
    { id: 'robot',      label: 'Robot',      fn: templateRobot },
    { id: 'knight',     label: 'Knight',     fn: templateKnight },
    { id: 'wizard',     label: 'Wizard',     fn: templateWizard },
    { id: 'astronaut',  label: 'Astronaut',  fn: templateAstronaut },
    { id: 'fox',        label: 'Fox',        fn: templateFox },
    { id: 'blank',      label: 'Blank',      fn: templateBlank }
  ];
  function applyTemplate(id) {
    var t = TEMPLATES.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    pushUndo();
    t.fn();
    renderAll(); scheduleAutosave();
    toast(t.label + ' base applied');
  }

  // ---- rendering ----------------------------------------------------------
  function syncOffscreen() {
    offCtx.clearRect(0, 0, SIZE, SIZE);
    try { offCtx.putImageData(makeImageData(), 0, 0); }
    catch (e) { /* putImageData unavailable */ }
  }
  function makeImageData() {
    var img;
    try { img = new ImageData(SIZE, SIZE); }
    catch (e) { img = offCtx.createImageData(SIZE, SIZE); }
    var d = img.data;
    for (var i = 0; i < d.length; i++) d[i] = data[i];
    return img;
  }

  function repaintPixels() {
    syncOffscreen();
    skinCtx.imageSmoothingEnabled = false;
    skinCtx.clearRect(0, 0, skinCanvas.width, skinCanvas.height);
    skinCtx.drawImage(off, 0, 0, SIZE, SIZE, 0, 0, skinCanvas.width, skinCanvas.height);
  }

  var PART_LABELS = [
    { name: 'HEAD',   label: 'Head',    color: '#6fe6dc' },
    { name: 'HAT',    label: 'Hat',     color: '#6fe6dc' },
    { name: 'BODY',   label: 'Body',    color: '#7cb342' },
    { name: 'JACKET', label: 'Jacket',  color: '#7cb342' },
    { name: 'RARM',   label: 'R.Arm',   color: '#e8c34a' },
    { name: 'LARM',   label: 'L.Arm',   color: '#e8c34a' },
    { name: 'RLEG',   label: 'R.Leg',   color: '#e07a6b' },
    { name: 'LLEG',   label: 'L.Leg',   color: '#e07a6b' }
  ];

  var gridCache = document.createElement('canvas');
  function buildGridCache() {
    var px = effectiveScale();
    gridCache.width  = SIZE * px;
    gridCache.height = SIZE * px;
    var c = gridCache.getContext('2d');
    c.clearRect(0, 0, gridCache.width, gridCache.height);

    // highlighted part fill (3D hover)
    if (highlightedPart) {
      var hg = null;
      for (var hi = 0; hi < PART_GROUPS.length; hi++) {
        if (PART_GROUPS[hi].name === highlightedPart) { hg = PART_GROUPS[hi].g; break; }
      }
      if (hg) {
        c.fillStyle = 'rgba(111,230,220,0.18)';
        FACE_NAMES.forEach(function (fn) {
          var r = hg[fn];
          c.fillRect(r[0] * px, r[1] * px, r[2] * px, r[3] * px);
        });
      }
    }

    if (!state.showGrid) {
      // still draw labels if enabled, then return
      if (state.showLabels) drawLabels(c, px);
      return;
    }
    c.lineWidth = 1;
    c.strokeStyle = 'rgba(255,255,255,0.08)';
    c.beginPath();
    for (var i = 1; i < SIZE; i++) {
      c.moveTo(i * px + 0.5, 0); c.lineTo(i * px + 0.5, SIZE * px);
      c.moveTo(0, i * px + 0.5); c.lineTo(SIZE * px, i * px + 0.5);
    }
    c.stroke();
    c.strokeStyle = 'rgba(111,230,220,0.35)';
    ALL_RECTS.forEach(function (r) {
      c.strokeRect(r[0] * px + 0.5, r[1] * px + 0.5, r[2] * px - 1, r[3] * px - 1);
    });
    if (state.showLabels) drawLabels(c, px);
  }

  function drawLabels(c, px) {
    var groupMap = {};
    PART_LABELS.forEach(function (pl) {
      for (var gi = 0; gi < PART_GROUPS.length; gi++) {
        if (PART_GROUPS[gi].name === pl.name) { groupMap[pl.name] = PART_GROUPS[gi].g; break; }
      }
    });
    var fs = Math.max(8, Math.round(px * 1.1));
    c.font = 'bold ' + fs + 'px sans-serif';
    c.textBaseline = 'top';
    PART_LABELS.forEach(function (pl) {
      var g = groupMap[pl.name];
      if (!g) return;
      // label above the front face
      var r = g.front;
      var cx = (r[0] + r[2] / 2) * px;
      var cy = r[1] * px - fs - 2;
      if (cy < 0) cy = r[1] * px + 2;
      c.fillStyle = 'rgba(0,0,0,0.55)';
      var tw = c.measureText(pl.label).width;
      c.fillRect(cx - tw / 2 - 2, cy - 1, tw + 4, fs + 2);
      c.fillStyle = pl.color;
      c.fillText(pl.label, cx - tw / 2, cy);
    });
  }

  var hover = { x: -1, y: -1 };
  function renderOverlay() {
    var px = effectiveScale();
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    if (gridCache.width) overlayCtx.drawImage(gridCache, 0, 0);
    if (hover.x >= 0 && hover.y >= 0) {
      overlayCtx.strokeStyle = '#ffffff';
      overlayCtx.lineWidth = 2;
      var s = px * Math.max(1, state.brush);
      var ox = hover.x - Math.floor(state.brush / 2);
      var oy = hover.y - Math.floor(state.brush / 2);
      overlayCtx.strokeRect(ox * px + 1, oy * px + 1, s - 2, s - 2);
      // symmetry ghost
      if (state.symmetry) {
        var sp = symmetricPixel(hover.x, hover.y);
        if (sp) {
          overlayCtx.strokeStyle = 'rgba(111,230,220,0.7)';
          var sox = sp[0] - Math.floor(state.brush / 2);
          var soy = sp[1] - Math.floor(state.brush / 2);
          overlayCtx.strokeRect(sox * px + 1, soy * px + 1, s - 2, s - 2);
        }
      }
    }
  }

  function renderAll() {
    repaintPixels();
    buildGridCache();
    renderOverlay();
    updateTexture();
  }

  // ---- pointer painting ---------------------------------------------------
  function eventToPixel(e) {
    var rect = overlayCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    var x = Math.floor((e.clientX - rect.left) / rect.width * SIZE);
    var y = Math.floor((e.clientY - rect.top) / rect.height * SIZE);
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return null;
    return [x, y];
  }

  var drawing = false, lastPt = null, strokeDirty = false;

  function beginStroke(e) {
    var p = eventToPixel(e);
    if (!p) return;
    if (state.tool === 'eyedropper') {
      pickFromPixel(p[0], p[1]);
      return;
    }
    pushUndo();
    drawing = true;
    strokeDirty = true;
    lastPt = p;
    if (state.tool === 'fill') {
      floodFill(p[0], p[1]);
    } else if (state.tool === 'eraser') {
      paintDot(p[0], p[1]);
    } else {
      paintDot(p[0], p[1]);
    }
    hover.x = p[0]; hover.y = p[1];
    repaintPixels(); renderOverlay(); updateTexture();
    try { overlayCanvas.setPointerCapture(e.pointerId); } catch (err) {}
  }
  function moveStroke(e) {
    var p = eventToPixel(e);
    if (!p) { hover.x = -1; hover.y = -1; renderOverlay(); return; }
    hover.x = p[0]; hover.y = p[1];
    if (drawing && state.tool !== 'fill' && state.tool !== 'eyedropper') {
      var from = lastPt || p;
      if (state.tool === 'eraser') {
        paintLine(from[0], from[1], p[0], p[1]);
      } else {
        paintLine(from[0], from[1], p[0], p[1]);
      }
      lastPt = p;
      repaintPixels(); updateTexture();
    }
    renderOverlay();
  }
  function endStroke() {
    if (drawing && strokeDirty) { scheduleAutosave(); }
    drawing = false; lastPt = null; strokeDirty = false;
    try { overlayCanvas.releasePointerCapture && overlayCanvas.releasePointerCapture; } catch (err) {}
  }

  overlayCanvas.addEventListener('pointerdown', function (e) { e.preventDefault(); beginStroke(e); });
  overlayCanvas.addEventListener('pointermove', moveStroke);
  overlayCanvas.addEventListener('pointerup', endStroke);
  overlayCanvas.addEventListener('pointercancel', endStroke);
  overlayCanvas.addEventListener('pointerleave', function () { hover.x = -1; hover.y = -1; renderOverlay(); });
  // Prevent the page from scrolling while a finger paints the texture.
  overlayCanvas.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });

  function pickFromPixel(x, y) {
    var c = getPixel(x, y);
    if (c[3] === 0) { toast('That pixel is clear'); return; }
    var hex = rgbToHex(c[0], c[1], c[2]);
    setColor(hex);
    toast('Picked ' + hex.toUpperCase());
  }

  // ---- colour + tools UI --------------------------------------------------
  function setColor(hex) {
    state.color = hex;
    state.rgba = hexToRgb(hex).concat([255]);
    if (colorInput) colorInput.value = hex;
    if (colorVal) colorVal.textContent = hex.toUpperCase();
    highlightSwatch(hex);
    if (state.tool === 'eraser' || state.tool === 'eyedropper') setTool('pencil');
  }
  function highlightSwatch(hex) {
    if (!swatchWrap) return;
    Array.prototype.forEach.call(swatchWrap.children, function (b) {
      b.classList.toggle('on', (b.getAttribute('data-color') || '').toLowerCase() === hex.toLowerCase());
    });
  }
  function setTool(name) {
    state.tool = name;
    Array.prototype.forEach.call(toolGrid.children, function (b) {
      b.classList.toggle('on', b.getAttribute('data-tool') === name);
    });
    if (name === 'eraser') {
      state.rgba = [0, 0, 0, 0];
    } else if (name === 'pencil' || name === 'fill') {
      state.rgba = hexToRgb(state.color).concat([255]);
    }
    overlayCanvas.style.cursor = name === 'eyedropper' ? 'copy' : name === 'eraser' ? 'cell' : 'crosshair';
  }
  function setBrush(n) {
    state.brush = n;
    Array.prototype.forEach.call(brushGrid.children, function (b) {
      b.classList.toggle('on', +b.getAttribute('data-brush') === n);
    });
    renderOverlay();
  }

  var PALETTE = [
    '#000000', '#ffffff', '#7a5230', '#c9905f', '#f0c8a0', '#3a2a1a',
    '#d9d9d9', '#8a8f99', '#3b5ea8', '#5b8fd8', '#3fa9d8', '#2f6f3f',
    '#7cb342', '#e8c34a', '#e07a6b', '#b03a5b', '#7a3fb0', '#e05fa0',
    '#00e0d0', '#5a3a1a'
  ];

  function buildControls() {
    var TOOLS = [
      { id: 'pencil', label: 'Pencil', emoji: '✏️' },
      { id: 'eraser', label: 'Eraser', emoji: '🧽' },
      { id: 'fill', label: 'Fill', emoji: '🪣' },
      { id: 'eyedropper', label: 'Pick', emoji: '💧' }
    ];
    if (toolGrid) {
      TOOLS.forEach(function (t) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'ms-btn' + (t.id === state.tool ? ' on' : '');
        b.setAttribute('data-tool', t.id);
        b.innerHTML = '<span class="ms-emoji" aria-hidden="true">' + t.emoji + '</span>' + t.label;
        b.addEventListener('click', function () { setTool(t.id); });
        toolGrid.appendChild(b);
      });
    }
    if (brushGrid) {
      [1, 2, 3, 4].forEach(function (n) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'ms-btn' + (n === state.brush ? ' on' : '');
        b.setAttribute('data-brush', n);
        b.textContent = n + 'px';
        b.addEventListener('click', function () { setBrush(n); });
        brushGrid.appendChild(b);
      });
    }
    if (swatchWrap) {
      PALETTE.forEach(function (hex) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'ms-swatch';
        b.style.background = hex;
        b.setAttribute('data-color', hex);
        b.setAttribute('aria-label', 'Colour ' + hex);
        b.addEventListener('click', function () { setColor(hex); });
        swatchWrap.appendChild(b);
      });
    }
    if (templateGrid) {
      TEMPLATES.forEach(function (t) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'ms-btn';
        b.textContent = t.label;
        b.addEventListener('click', function () { applyTemplate(t.id); });
        templateGrid.appendChild(b);
      });
    }
    highlightSwatch(state.color);
  }

  // ---- import / export ----------------------------------------------------
  function pixelsFromCanvas(srcCanvas) {
    var c = document.createElement('canvas'); c.width = c.height = SIZE;
    var cx = c.getContext('2d');
    cx.imageSmoothingEnabled = false;
    cx.clearRect(0, 0, SIZE, SIZE);
    cx.drawImage(srcCanvas, 0, 0, SIZE, SIZE);
    return cx.getImageData(0, 0, SIZE, SIZE).data;
  }
  function importImage(img) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    if (!(w === 64 && (h === 64 || h === 32)) && !(w === 128 && h === 128)) {
      toast('Use a 64x64 (or 64x32) skin PNG');
      return;
    }
    pushUndo();
    var flipped = pixelsFromCanvas(img);
    for (var i = 0; i < data.length; i++) data[i] = flipped[i];
    renderAll(); scheduleAutosave();
    toast('Skin imported');
  }
  function exportSkin() {
    syncOffscreen();
    var finish = function (blob) {
      if (!blob) { toast('Could not build the PNG'); return; }
      saveBlob(blob, 'minecraft-skin.png');
      toast('Exported minecraft-skin.png');
      if (window.ToolXP && typeof window.ToolXP.award === 'function') {
        window.ToolXP.award('export', 25, 3, 'Skin exported');
      }
    };
    if (off.toBlob) off.toBlob(finish, 'image/png');
    else {
      try {
        var url = off.toDataURL('image/png');
        var bin = atob(url.split(',')[1]);
        var arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        finish(new Blob([arr], { type: 'image/png' }));
      } catch (e) { finish(null); }
    }
  }
  function saveBlob(blob, name) {
    if (typeof window.downloadBlob === 'function') { window.downloadBlob(blob, name); return; }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }

  // ---- localStorage -------------------------------------------------------
  var autosaveTimer = null;
  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(saveSkin, 700);
  }
  function saveSkin(silent) {
    try {
      offCtx.putImageData(makeImageData(), 0, 0);
      localStorage.setItem(LS_KEY, off.toDataURL('image/png'));
      if (!silent) toast('Skin saved on this device');
    } catch (e) { if (!silent) toast('Could not save'); }
  }
  function loadSkin() {
    var url;
    try { url = localStorage.getItem(LS_KEY); } catch (e) { url = null; }
    if (!url) return false;
    var img = new Image();
    img.onload = function () {
      var loaded = pixelsFromCanvas(img);
      for (var i = 0; i < data.length; i++) data[i] = loaded[i];
      renderAll();
    };
    img.onerror = function () {};
    img.src = url;
    return true;
  }

  // ---- toast --------------------------------------------------------------
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }

  // ---- 3D preview (three.js r128) ----------------------------------------
  var texCanvas = document.createElement('canvas');
  texCanvas.width = texCanvas.height = SIZE;
  var texCtx = texCanvas.getContext('2d');
  var renderer, scene, camera, pivot, skinTexture;
  var camDist = 54;
  var threeOk = false;

  function updateTexture() {
    if (!threeOk) return;
    try {
      texCtx.clearRect(0, 0, SIZE, SIZE);
      texCtx.putImageData(makeImageData(), 0, 0);
      if (skinTexture) skinTexture.needsUpdate = true;
    } catch (e) {}
  }

  function uvRect(r) {
    var u0 = r[0] / SIZE, u1 = (r[0] + r[2]) / SIZE;
    var v1 = 1 - r[1] / SIZE, v0 = 1 - (r[1] + r[3]) / SIZE;
    return { u0: u0, u1: u1, v0: v0, v1: v1 };
  }

  // Build a box mesh whose six faces sample the skin texture. Corners are given
  // in "outside viewer" order (TL,TR,BR,BL); winding is corrected to face outward.
  function makeBox(w, h, d, cx, cy, cz, faces) {
    var hw = w / 2, hh = h / 2, hd = d / 2;
    var pos = [], uv = [], idx = [];
    var faceDefs = [
      { r: faces.front, n: [0, 0, 1], c: [[-hw, hh, hd], [hw, hh, hd], [hw, -hh, hd], [-hw, -hh, hd]] },
      { r: faces.back, n: [0, 0, -1], c: [[hw, hh, -hd], [-hw, hh, -hd], [-hw, -hh, -hd], [hw, -hh, -hd]] },
      { r: faces.right, n: [1, 0, 0], c: [[hw, hh, hd], [hw, hh, -hd], [hw, -hh, -hd], [hw, -hh, hd]] },
      { r: faces.left, n: [-1, 0, 0], c: [[-hw, hh, -hd], [-hw, hh, hd], [-hw, -hh, hd], [-hw, -hh, -hd]] },
      { r: faces.top, n: [0, 1, 0], c: [[-hw, hh, -hd], [hw, hh, -hd], [hw, hh, hd], [-hw, hh, hd]] },
      { r: faces.bottom, n: [0, -1, 0], c: [[-hw, -hh, hd], [hw, -hh, hd], [hw, -hh, -hd], [-hw, -hh, -hd]] }
    ];
    faceDefs.forEach(function (f) {
      var uvr = uvRect(f.r);
      var corners = f.c.slice();
      var uvs = [
        [uvr.u0, uvr.v1], [uvr.u1, uvr.v1], [uvr.u1, uvr.v0], [uvr.u0, uvr.v0]
      ];
      var ax = corners[1][0] - corners[0][0], ay = corners[1][1] - corners[0][1], az = corners[1][2] - corners[0][2];
      var bx = corners[2][0] - corners[0][0], by = corners[2][1] - corners[0][1], bz = corners[2][2] - corners[0][2];
      var nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      if (nx * f.n[0] + ny * f.n[1] + nz * f.n[2] < 0) {
        corners = [corners[0], corners[3], corners[2], corners[1]];
        uvs = [uvs[0], uvs[3], uvs[2], uvs[1]];
      }
      var base = pos.length / 3;
      corners.forEach(function (p, i) {
        pos.push(p[0] + cx, p[1] + cy, p[2] + cz);
        uv.push(uvs[i][0], uvs[i][1]);
      });
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  function init3D() {
    var canvas = document.getElementById('ms3D');
    if (!canvas || !window.THREE) { showPreviewFallback(); return; }
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    } catch (e) { showPreviewFallback(); return; }
    if (!renderer) { showPreviewFallback(); return; }

    renderer.setClearColor(0x000000, 0);
    if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
    camera.position.set(0, 20, camDist);
    camera.lookAt(0, 16, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.86));
    var key = new THREE.DirectionalLight(0xffffff, 0.6); key.position.set(6, 12, 9); scene.add(key);
    var rim = new THREE.DirectionalLight(0xffffff, 0.34); rim.position.set(-7, 6, -9); scene.add(rim);

    texCtx.clearRect(0, 0, SIZE, SIZE);
    texCtx.putImageData(makeImageData(), 0, 0);
    skinTexture = new THREE.CanvasTexture(texCanvas);
    skinTexture.magFilter = THREE.NearestFilter;
    skinTexture.minFilter = THREE.NearestFilter;
    skinTexture.generateMipmaps = false;
    if (THREE.sRGBEncoding) skinTexture.encoding = THREE.sRGBEncoding;

    var baseMat = new THREE.MeshLambertMaterial({ map: skinTexture, alphaTest: 0.02, side: THREE.FrontSide });
    var overMat = new THREE.MeshLambertMaterial({ map: skinTexture, alphaTest: 0.5, side: THREE.FrontSide });

    var player = new THREE.Group();
    player.position.y = -16;

    function addBox(w, h, d, x, y, z, faces, mat, partName) {
      var mesh = new THREE.Mesh(makeBox(w, h, d, x, y, z, faces), mat);
      mesh.userData.part = partName;
      player.add(mesh);
    }
    // absolute y positions (feet at 0): legs 6, body 18, head 28, arms 18
    addBox(8, 8, 8, 0, 28, 0, HEAD, baseMat, 'HEAD');
    addBox(8.5, 8.5, 8.5, 0, 28, 0, HAT, overMat, 'HAT');
    addBox(8, 12, 4, 0, 18, 0, BODY, baseMat, 'BODY');
    addBox(8.25, 12.25, 4.25, 0, 18, 0, JACKET, overMat, 'JACKET');
    addBox(4, 12, 4, 6, 18, 0, RARM, baseMat, 'RARM');
    addBox(4, 12, 4, -6, 18, 0, LARM, baseMat, 'LARM');
    addBox(4, 12, 4, 2, 6, 0, RLEG, baseMat, 'RLEG');
    addBox(4, 12, 4, -2, 6, 0, LLEG, baseMat, 'LLEG');

    pivot = new THREE.Group();
    pivot.position.set(0, 16, 0);
    pivot.add(player);
    scene.add(pivot);

    threeOk = true;
    resize3D();
    animate3D();
  }

  function showPreviewFallback() {
    var stage = document.getElementById('ms3DStage');
    var canvas = document.getElementById('ms3D');
    if (canvas) canvas.style.display = 'none';
    if (stage && !stage.querySelector('.ms-prev-fallback')) {
      var d = document.createElement('div');
      d.className = 'ms-prev-fallback';
      d.textContent = 'The 3D preview needs WebGL, which this device turned off. You can still paint and export your skin.';
      stage.appendChild(d);
    }
  }

  function resize3D() {
    if (!threeOk) return;
    var stage = document.getElementById('ms3DStage');
    if (!stage) return;
    var w = stage.clientWidth || 320, h = stage.clientHeight || 320;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  var lastFrame = 0;
  function animate3D(t) {
    requestAnimationFrame(animate3D);
    if (!threeOk) return;
    var now = t || 0;
    if (state.autoRotate && !dragging) pivot.rotation.y += 0.008;
    // gentle bob so the model does not look frozen
    if (state.autoRotate) pivot.position.y = 16 + Math.sin(now * 0.0018) * 0.35;
    renderer.render(scene, camera);
  }

  var dragging = false, lastX = 0, lastY = 0;
  function init3DControls() {
    var canvas = document.getElementById('ms3D');
    if (!canvas) return;
    canvas.addEventListener('pointerdown', function (e) {
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!dragging || !threeOk) return;
      var dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      pivot.rotation.y += dx * 0.01;
      pivot.rotation.x = Math.max(-0.5, Math.min(0.5, pivot.rotation.x + dy * 0.006));
    });
    function stop() { dragging = false; }
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
    canvas.addEventListener('pointerleave', stop);
    canvas.addEventListener('wheel', function (e) {
      if (!threeOk) return;
      e.preventDefault();
      camDist = Math.max(28, Math.min(110, camDist + (e.deltaY > 0 ? 4 : -4)));
      camera.position.z = camDist;
    }, { passive: false });
    var pinch = null;
    canvas.addEventListener('touchmove', function (e) {
      if (e.touches.length === 2) {
        e.preventDefault();
        var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        if (pinch) {
          camDist = Math.max(28, Math.min(110, camDist + (pinch - d) * 0.25));
          if (camera) camera.position.z = camDist;
        }
        pinch = d;
      }
    }, { passive: false });
    canvas.addEventListener('touchend', function () { pinch = null; });

    // 3D hover → highlight body part on 2D canvas
    var raycaster3D = new THREE.Raycaster();
    var mouse3D = new THREE.Vector2();
    canvas.addEventListener('pointermove', function (e) {
      if (!threeOk || dragging) return;
      var rect3 = canvas.getBoundingClientRect();
      mouse3D.x = ((e.clientX - rect3.left) / rect3.width) * 2 - 1;
      mouse3D.y = -((e.clientY - rect3.top) / rect3.height) * 2 + 1;
      raycaster3D.setFromCamera(mouse3D, camera);
      var hits = raycaster3D.intersectObjects(scene.children, true);
      var found = null;
      for (var hi = 0; hi < hits.length; hi++) {
        var obj = hits[hi].object;
        while (obj && !obj.userData.part) obj = obj.parent;
        if (obj && obj.userData.part) { found = obj.userData.part; break; }
      }
      setHighlightedPart(found);
    });
    canvas.addEventListener('pointerleave', function () { setHighlightedPart(null); });

    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () { resize3D(); });
      var stage = document.getElementById('ms3DStage');
      if (stage) ro.observe(stage);
    }
    window.addEventListener('resize', resize3D);
    window.addEventListener('orientationchange', function () { setTimeout(resize3D, 200); });
  }

  // ---- wiring -------------------------------------------------------------
  function wire() {
    buildControls();
    if (colorInput) colorInput.addEventListener('input', function () { setColor(colorInput.value); });
    var byId = function (id) { return document.getElementById(id); };

    if (byId('msUndoBtn')) byId('msUndoBtn').addEventListener('click', undo);
    if (byId('msRedoBtn')) byId('msRedoBtn').addEventListener('click', redo);
    if (byId('msClearBtn')) byId('msClearBtn').addEventListener('click', clearSkin);
    if (byId('msSaveBtn')) byId('msSaveBtn').addEventListener('click', function () { saveSkin(); });
    if (byId('msLoadBtn')) byId('msLoadBtn').addEventListener('click', function () {
      if (loadSkin()) toast('Loaded your saved skin'); else toast('No saved skin yet');
    });
    if (byId('msExportBtn')) byId('msExportBtn').addEventListener('click', exportSkin);
    if (byId('msImportBtn') && fileInput) byId('msImportBtn').addEventListener('click', function () { fileInput.click(); });
    if (fileInput) fileInput.addEventListener('change', function () {
      var f = fileInput.files && fileInput.files[0];
      if (!f) return;
      var img = new Image();
      img.onload = function () { importImage(img); fileInput.value = ''; };
      img.onerror = function () { toast('Could not read that image'); fileInput.value = ''; };
      var reader = new FileReader();
      reader.onload = function () { img.src = reader.result; };
      reader.readAsDataURL(f);
    });

    if (byId('msZoomIn'))  byId('msZoomIn').addEventListener('click', zoomIn);
    if (byId('msZoomOut')) byId('msZoomOut').addEventListener('click', zoomOut);
    if (byId('msStripZoomIn')) byId('msStripZoomIn').addEventListener('click', zoomIn);
    if (byId('msStripUndo'))   byId('msStripUndo').addEventListener('click', undo);

    // mobile strip tool buttons
    var stripBtns = document.querySelectorAll('.ms-strip-btn[data-tool]');
    Array.prototype.forEach.call(stripBtns, function (b) {
      b.addEventListener('click', function () { setTool(b.getAttribute('data-tool')); syncMobileStrip(); });
    });
    // mobile strip color - keep in sync with main color input
    var mobileColor = byId('msMobileColor');
    if (mobileColor) {
      mobileColor.value = state.color;
      mobileColor.addEventListener('input', function () { setColor(mobileColor.value); });
    }
    function syncMobileStrip() {
      if (!mobileColor) return;
      mobileColor.value = state.color;
      Array.prototype.forEach.call(stripBtns, function (b) {
        b.classList.toggle('on', b.getAttribute('data-tool') === state.tool);
      });
    }
    // also sync when setColor is called from swatches/colorInput
    var _origSetColor = setColor;
    setColor = function (hex) { _origSetColor(hex); if (mobileColor) mobileColor.value = hex; };
    syncMobileStrip();

    var symmBtn = byId('msSymmetryBtn');
    if (symmBtn) symmBtn.addEventListener('click', function () {
      state.symmetry = !state.symmetry;
      symmBtn.classList.toggle('on', state.symmetry);
      toast(state.symmetry ? 'Symmetry on' : 'Symmetry off');
    });

    var labelsBtn = byId('msLabelsBtn');
    if (labelsBtn) labelsBtn.addEventListener('click', function () {
      state.showLabels = !state.showLabels;
      labelsBtn.classList.toggle('on', state.showLabels);
      buildGridCache(); renderOverlay();
    });

    // Mojang username import
    var usernameInput = byId('msMojangUser');
    var fetchBtn = byId('msMojangFetch');
    if (fetchBtn && usernameInput) {
      fetchBtn.addEventListener('click', function () {
        var name = (usernameInput.value || '').trim();
        if (!name) { toast('Enter a Minecraft username'); return; }
        fetchBtn.disabled = true;
        fetchBtn.textContent = 'Loading…';
        fetch('https://api.mojang.com/users/profiles/minecraft/' + encodeURIComponent(name))
          .then(function (r) { if (!r.ok) throw new Error('Player not found'); return r.json(); })
          .then(function (profile) {
            return fetch('https://sessionserver.mojang.com/session/minecraft/profile/' + profile.id);
          })
          .then(function (r) { if (!r.ok) throw new Error('Profile error'); return r.json(); })
          .then(function (prof) {
            var prop = prof.properties && prof.properties[0];
            if (!prop) throw new Error('No skin data');
            var decoded = JSON.parse(atob(prop.value));
            var skinUrl = decoded.textures && decoded.textures.SKIN && decoded.textures.SKIN.url;
            if (!skinUrl) throw new Error('No skin URL');
            return new Promise(function (resolve, reject) {
              var img = new Image(); img.crossOrigin = 'anonymous';
              img.onload = function () { resolve(img); };
              img.onerror = function () { reject(new Error('Could not load skin image')); };
              img.src = skinUrl;
            });
          })
          .then(function (img) {
            importImage(img);
            toast('Loaded ' + (usernameInput.value || '').trim() + "'s skin");
          })
          .catch(function (err) { toast('Could not load: ' + err.message); })
          .then(function () { fetchBtn.disabled = false; fetchBtn.textContent = 'Load'; },
                function () { fetchBtn.disabled = false; fetchBtn.textContent = 'Load'; });
      });
    }

    var gridToggle = byId('msShowGrid');
    if (gridToggle) gridToggle.addEventListener('change', function () {
      state.showGrid = gridToggle.checked; buildGridCache(); renderOverlay();
    });
    var overToggle = byId('msShowOverlay');
    if (overToggle) overToggle.addEventListener('change', function () {
      state.showOverlay = overToggle.checked;
      if (pivot) pivot.children.forEach(function (g) { g.children.forEach(function (m, i) { if (i % 2 === 1) m.visible = state.showOverlay; }); });
    });
    var rotToggle = byId('msAutoRotate');
    if (rotToggle) rotToggle.addEventListener('change', function () { state.autoRotate = rotToggle.checked; });

    // modal
    function openModal() { if (modal) modal.classList.add('open'); }
    function closeModal() { if (modal) modal.classList.remove('open'); }
    if (byId('msHelpBtn')) byId('msHelpBtn').addEventListener('click', openModal);
    if (byId('msModalClose')) byId('msModalClose').addEventListener('click', closeModal);
    if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal && modal.classList.contains('open')) closeModal();
      var tag = (e.target && e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redo(); }
      else if (e.key === 'p') setTool('pencil');
      else if (e.key === 'e') setTool('eraser');
      else if (e.key === 'f') setTool('fill');
      else if (e.key === 'i') setTool('eyedropper');
      else if (e.key === '[') setBrush(Math.max(1, state.brush - 1));
      else if (e.key === ']') setBrush(Math.min(4, state.brush + 1));
      else if (e.key === '+' || e.key === '=') zoomIn();
      else if (e.key === '-' || e.key === '_') zoomOut();
      else if (e.key === 's') {
        state.symmetry = !state.symmetry;
        var sb = document.getElementById('msSymmetryBtn');
        if (sb) sb.classList.toggle('on', state.symmetry);
        toast(state.symmetry ? 'Symmetry on' : 'Symmetry off');
      }
      else if (e.key === 'l') {
        state.showLabels = !state.showLabels;
        var lb = document.getElementById('msLabelsBtn');
        if (lb) lb.classList.toggle('on', state.showLabels);
        buildGridCache(); renderOverlay();
      }
    });
  }

  // ---- ember guide --------------------------------------------------------
  function initGuide() {
    var tries = 0;
    (function tryInit() {
      if (window.EmberGuide) {
        try {
          window.EmberGuide.init({
            id: 'minecraft-skin-editor',
            steps: [
              { target: '#msPaintStage', title: 'Paint the texture', text: 'This is your skin laid flat. Drag to paint, and use the tools on the left.' },
              { target: '#ms3DStage', title: 'See it in 3D', text: 'Your player updates as you paint. Drag the model to turn it around.' },
              { target: '#msExportBtn', title: 'Export your skin', text: 'Press Export PNG to keep the file and use it in Minecraft.' }
            ]
          });
        } catch (e) {}
        return;
      }
      if (tries++ < 12) setTimeout(tryInit, 350);
    })();
  }

  // ---- boot ---------------------------------------------------------------
  function boot() {
    initPartGroups();
    loadZoom();
    wire();
    init3DControls();
    init3D();
    applyZoom(); // resize canvases to stored zoom level before first render
    var hadSaved = loadSkin();
    if (!hadSaved) { templateClassic(); renderAll(); }
    renderAll();
    updateUndoButtons();
    initGuide();
    setTimeout(resize3D, 400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // small public surface for tests and cross-tool integration
  window.JVDSMinecraftSkin = {
    size: SIZE,
    getData: function () { return data; },
    setColor: setColor,
    setTool: setTool,
    setBrush: setBrush,
    applyTemplate: applyTemplate,
    undo: undo,
    redo: redo,
    exportSkin: exportSkin,
    toDataURL: function () { syncOffscreen(); return off.toDataURL('image/png'); }
  };
})();
