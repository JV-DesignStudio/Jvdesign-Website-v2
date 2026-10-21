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
  var magnifier = document.getElementById('msMagnifier');
  var magCanvas = document.getElementById('msMagCanvas');
  var magCtx = magCanvas ? magCanvas.getContext('2d') : null;
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
    showLabels: false,
    walkAnim: false
  };
  var LS_KEY = 'jvds_minecraft_skin';
  var alexModel = false;
  var colorHistory = [];
  var MAX_HISTORY = 8;
  var partClipboard = null;

  // ---- view pan / zoom (canvas viewport) -------------------------------------
  var viewScale = 1, viewPanX = 0, viewPanY = 0;
  var _vpPanning = false, _vpPanLast = { x: 0, y: 0 };
  var _pinchDist0 = null, _pinchScale0 = 1;

  // ---- 3D limb pivot refs (for walk animation) --------------------------------
  var _rArmPivot = null, _lArmPivot = null;
  var _rLegPivot = null, _lLegPivot = null;

  // ---- named skin gallery -----------------------------------------------------
  var SKIN_SLOTS = 8;
  var LS_SLOTS_KEY = 'jvds_mc_skins';
  var skinSlots = [];
  var skinModalOpen = false;

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

  // ---- HSL helpers -----------------------------------------------------------
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  }

  function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    var r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      var hue2rgb = function (p, q, t) {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  function updateSliderGradients(h, s, l) {
    var satEl = document.getElementById('msSat');
    var litEl = document.getElementById('msLit');
    if (satEl) {
      var c0 = hslToRgb(h, 0, l), c1 = hslToRgb(h, 100, l);
      satEl.style.background = 'linear-gradient(to right,rgb(' + c0 + '),rgb(' + c1 + '))';
    }
    if (litEl) {
      var cl = hslToRgb(h, s, 0), cm = hslToRgb(h, s, 50), cr = hslToRgb(h, s, 100);
      litEl.style.background = 'linear-gradient(to right,rgb(' + cl + '),rgb(' + cm + '),rgb(' + cr + '))';
    }
  }

  function updateHslSliders() {
    if (!state.rgba || state.rgba[3] === 0) return;
    var hsl = rgbToHsl(state.rgba[0], state.rgba[1], state.rgba[2]);
    var hueEl = document.getElementById('msHue');
    var satEl = document.getElementById('msSat');
    var litEl = document.getElementById('msLit');
    var hexEl = document.getElementById('msHexInput');
    if (hueEl) hueEl.value = hsl[0];
    if (satEl) satEl.value = hsl[1];
    if (litEl) litEl.value = hsl[2];
    if (hexEl) hexEl.value = state.color.toUpperCase();
    var hv = document.getElementById('msHueVal');
    var sv = document.getElementById('msSatVal');
    var lv = document.getElementById('msLitVal');
    if (hv) hv.textContent = hsl[0];
    if (sv) sv.textContent = hsl[1];
    if (lv) lv.textContent = hsl[2];
    updateSliderGradients(hsl[0], hsl[1], hsl[2]);
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
    { name: 'BODY', g: null }, { name: 'JACKET', g: null },
    { name: 'RARM_OUT', g: null }, { name: 'LARM_OUT', g: null },
    { name: 'RLEG_OUT', g: null }, { name: 'LLEG_OUT', g: null }
  ];
  var FACE_NAMES = ['top', 'bottom', 'right', 'front', 'left', 'back'];
  var SYMM_PARTNER = {
    RARM: 'LARM', LARM: 'RARM', RLEG: 'LLEG', LLEG: 'RLEG',
    RARM_OUT: 'LARM_OUT', LARM_OUT: 'RARM_OUT', RLEG_OUT: 'LLEG_OUT', LLEG_OUT: 'RLEG_OUT'
  };
  var SYMM_FACE = { right: 'left', left: 'right', front: 'front', back: 'back', top: 'top', bottom: 'bottom' };

  function initPartGroups() {
    var map = {
      RARM: RARM, LARM: LARM, RLEG: RLEG, LLEG: LLEG,
      HEAD: HEAD, HAT: HAT, BODY: BODY, JACKET: JACKET,
      RARM_OUT: RARM_OUT, LARM_OUT: LARM_OUT, RLEG_OUT: RLEG_OUT, LLEG_OUT: LLEG_OUT
    };
    PART_GROUPS.forEach(function (p) { p.g = map[p.name]; });
  }

  var PART_MAP = {
    HEAD: HEAD, HAT: HAT, BODY: BODY, JACKET: JACKET,
    RARM: RARM, LARM: LARM, RLEG: RLEG, LLEG: LLEG,
    RARM_OUT: RARM_OUT, LARM_OUT: LARM_OUT, RLEG_OUT: RLEG_OUT, LLEG_OUT: LLEG_OUT
  };

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
  // Alex model arm UVs (3px wide instead of 4px)
  var RARM_ALEX = {
    top: R(44,16,3,4), bottom: R(47,16,3,4), right: R(40,20,4,12),
    front: R(44,20,3,12), left: R(47,20,4,12), back: R(51,20,3,12)
  };
  var LARM_ALEX = {
    top: R(36,48,3,4), bottom: R(39,48,3,4), right: R(32,52,4,12),
    front: R(36,52,3,12), left: R(39,52,4,12), back: R(43,52,3,12)
  };
  // Outer layer overlays for arms and legs
  var RARM_OUT = {
    top: R(44,32,4,4), bottom: R(48,32,4,4), right: R(40,36,4,12),
    front: R(44,36,4,12), left: R(48,36,4,12), back: R(52,36,4,12)
  };
  var LARM_OUT = {
    top: R(52,48,4,4), bottom: R(56,48,4,4), right: R(48,52,4,12),
    front: R(52,52,4,12), left: R(56,52,4,12), back: R(60,52,4,12)
  };
  var RLEG_OUT = {
    top: R(4,32,4,4), bottom: R(8,32,4,4), right: R(0,36,4,12),
    front: R(4,36,4,12), left: R(8,36,4,12), back: R(12,36,4,12)
  };
  var LLEG_OUT = {
    top: R(4,48,4,4), bottom: R(8,48,4,4), right: R(0,52,4,12),
    front: R(4,52,4,12), left: R(8,52,4,12), back: R(12,52,4,12)
  };

  function facesOf(group) { return [group.top, group.bottom, group.right, group.front, group.left, group.back]; }
  var ALL_RECTS = [].concat(
    facesOf(HEAD), facesOf(HAT), facesOf(BODY), facesOf(JACKET),
    facesOf(RARM), facesOf(LARM), facesOf(RLEG), facesOf(LLEG),
    facesOf(RARM_OUT), facesOf(LARM_OUT), facesOf(RLEG_OUT), facesOf(LLEG_OUT)
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
    { name: 'HEAD',     label: 'Head',     color: '#6fe6dc' },
    { name: 'HAT',      label: 'Hat',      color: '#6fe6dc' },
    { name: 'BODY',     label: 'Body',     color: '#7cb342' },
    { name: 'JACKET',   label: 'Jacket',   color: '#7cb342' },
    { name: 'RARM',     label: 'R.Arm',    color: '#e8c34a' },
    { name: 'LARM',     label: 'L.Arm',    color: '#e8c34a' },
    { name: 'RLEG',     label: 'R.Leg',    color: '#e07a6b' },
    { name: 'LLEG',     label: 'L.Leg',    color: '#e07a6b' },
    { name: 'RARM_OUT', label: 'R.Sleeve', color: '#c8a030' },
    { name: 'LARM_OUT', label: 'L.Sleeve', color: '#c8a030' },
    { name: 'RLEG_OUT', label: 'R.Trousers', color: '#b05040' },
    { name: 'LLEG_OUT', label: 'L.Trousers', color: '#b05040' }
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

  // ---- view pan / zoom -------------------------------------------------------
  function applyViewTransform() {
    var wrap = document.getElementById('msCanvasWrap');
    if (!wrap) return;
    wrap.style.transform = 'translate(' + viewPanX + 'px,' + viewPanY + 'px) scale(' + viewScale + ')';
  }

  function clampPan() {
    if (viewScale <= 1) { viewPanX = 0; viewPanY = 0; return; }
    var stage = document.getElementById('msPaintStage');
    if (!stage) return;
    var hw = stage.clientWidth  * (viewScale - 1) / 2;
    var hh = stage.clientHeight * (viewScale - 1) / 2;
    viewPanX = Math.max(-hw, Math.min(hw, viewPanX));
    viewPanY = Math.max(-hh, Math.min(hh, viewPanY));
  }

  function setViewScale(s, ox, oy) {
    var stage = document.getElementById('msPaintStage');
    var sw = stage ? stage.clientWidth  : 300;
    var sh = stage ? stage.clientHeight : 300;
    ox = (ox !== undefined) ? ox : sw / 2;
    oy = (oy !== undefined) ? oy : sh / 2;
    var old = viewScale;
    viewScale = Math.max(1, Math.min(8, s));
    var ratio = viewScale / old;
    viewPanX = (ox - sw / 2) * (1 - ratio) + ratio * viewPanX;
    viewPanY = (oy - sh / 2) * (1 - ratio) + ratio * viewPanY;
    if (viewScale <= 1) { viewPanX = 0; viewPanY = 0; }
    clampPan();
    applyViewTransform();
    var rvBtn = document.getElementById('msViewReset');
    if (rvBtn) rvBtn.style.display = viewScale > 1 ? '' : 'none';
  }

  function initCanvasPanZoom() {
    var stage = document.getElementById('msPaintStage');
    if (!stage) return;

    // Ctrl+scroll → view zoom
    stage.addEventListener('wheel', function (e) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      var rect = stage.getBoundingClientRect();
      setViewScale(viewScale * (e.deltaY > 0 ? 0.8 : 1.25), e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: false });

    // Right-click drag → pan
    stage.addEventListener('pointerdown', function (e) {
      if (e.button !== 2) return;
      e.preventDefault();
      _vpPanning = true;
      _vpPanLast.x = e.clientX; _vpPanLast.y = e.clientY;
      try { stage.setPointerCapture(e.pointerId); } catch (_) {}
    });
    stage.addEventListener('pointermove', function (e) {
      if (!_vpPanning) return;
      viewPanX += e.clientX - _vpPanLast.x;
      viewPanY += e.clientY - _vpPanLast.y;
      _vpPanLast.x = e.clientX; _vpPanLast.y = e.clientY;
      clampPan(); applyViewTransform();
    });
    stage.addEventListener('pointerup',   function (e) { if (e.button === 2) _vpPanning = false; });
    stage.addEventListener('pointercancel', function () { _vpPanning = false; });
    stage.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // Two-finger pinch on canvas → view zoom/pan
    stage.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        e.preventDefault();
        _pinchDist0  = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        _pinchScale0 = viewScale;
      }
    }, { passive: false });
    stage.addEventListener('touchmove', function (e) {
      if (e.touches.length !== 2 || _pinchDist0 === null) return;
      e.preventDefault();
      var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      var rect = stage.getBoundingClientRect();
      var midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      var midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      setViewScale(_pinchScale0 * (d / _pinchDist0), midX, midY);
    }, { passive: false });
    stage.addEventListener('touchend', function () { _pinchDist0 = null; });
  }

  // ---- named skin gallery ----------------------------------------------------
  function loadSkinSlots() {
    try {
      var s = localStorage.getItem(LS_SLOTS_KEY);
      if (s) skinSlots = JSON.parse(s).slice(0, SKIN_SLOTS);
    } catch (e) { skinSlots = []; }
  }
  function saveSkinSlots() {
    try { localStorage.setItem(LS_SLOTS_KEY, JSON.stringify(skinSlots)); } catch (e) {}
  }
  function saveToSlot(name, slotIdx) {
    syncOffscreen();
    var url = off.toDataURL('image/png');
    if (slotIdx >= 0 && slotIdx < skinSlots.length) {
      skinSlots[slotIdx].url = url;
      skinSlots[slotIdx].name = name;
    } else {
      if (skinSlots.length >= SKIN_SLOTS) skinSlots.shift();
      skinSlots.push({ name: name, url: url });
    }
    saveSkinSlots();
    renderSkinGallery();
    toast('Saved to gallery');
  }
  function loadFromSlot(slotIdx) {
    if (!skinSlots[slotIdx]) return;
    var img = new Image();
    img.onload = function () { importImage(img); };
    img.src = skinSlots[slotIdx].url;
    closeSkinModal();
  }
  function deleteSlot(slotIdx) {
    skinSlots.splice(slotIdx, 1);
    saveSkinSlots();
    renderSkinGallery();
  }
  function renderSkinGallery() {
    var grid = document.getElementById('msSkinGalleryGrid');
    if (!grid) return;
    grid.innerHTML = '';
    skinSlots.forEach(function (slot, i) {
      var card = document.createElement('div');
      card.className = 'ms-skin-slot';
      var img = document.createElement('img');
      img.src = slot.url; img.width = 64; img.height = 64;
      var nameIn = document.createElement('input');
      nameIn.type = 'text'; nameIn.className = 'ms-text-input'; nameIn.value = slot.name;
      nameIn.addEventListener('change', function () { skinSlots[i].name = nameIn.value; saveSkinSlots(); });
      var btns = document.createElement('div');
      btns.className = 'ms-grid2'; btns.style.marginTop = '6px';
      var lb = document.createElement('button');
      lb.className = 'ms-btn primary'; lb.textContent = 'Load'; lb.type = 'button';
      lb.addEventListener('click', function () { loadFromSlot(i); });
      var db = document.createElement('button');
      db.className = 'ms-btn danger'; db.textContent = 'Del'; db.type = 'button';
      db.addEventListener('click', function () { deleteSlot(i); });
      btns.appendChild(lb); btns.appendChild(db);
      card.appendChild(img); card.appendChild(nameIn); card.appendChild(btns);
      grid.appendChild(card);
    });
    if (skinSlots.length < SKIN_SLOTS) {
      var newCard = document.createElement('div');
      newCard.className = 'ms-skin-slot ms-skin-new';
      var sb = document.createElement('button');
      sb.className = 'ms-btn primary'; sb.textContent = '+ Save current skin';
      sb.type = 'button'; sb.style.width = '100%';
      sb.addEventListener('click', function () {
        var n = prompt('Name this skin:', 'Skin ' + (skinSlots.length + 1));
        if (n !== null) saveToSlot(n || ('Skin ' + (skinSlots.length + 1)), -1);
      });
      newCard.appendChild(sb);
      grid.appendChild(newCard);
    }
  }
  function openSkinModal() {
    loadSkinSlots();
    renderSkinGallery();
    var m = document.getElementById('msSkinModal');
    if (m) { m.classList.add('open'); skinModalOpen = true; }
  }
  function closeSkinModal() {
    var m = document.getElementById('msSkinModal');
    if (m) { m.classList.remove('open'); skinModalOpen = false; }
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

  // ---- magnifier lens (touch precision) ------------------------------------
  var _isTouchDraw = false;

  function showMagnifier(clientX, clientY, pixelX, pixelY) {
    if (!magnifier || !magCtx || !magCanvas) return;
    var HALF = 5; // show 11x11 pixel region around the touch point
    magCtx.imageSmoothingEnabled = false;
    magCtx.clearRect(0, 0, magCanvas.width, magCanvas.height);
    // checkerboard background for transparent pixels
    for (var gy = 0; gy < magCanvas.height; gy += 8) {
      for (var gx = (gy / 8 % 2 === 0 ? 0 : 8); gx < magCanvas.width; gx += 16) {
        magCtx.fillStyle = '#1e1e24'; magCtx.fillRect(gx, gy, 8, 8);
      }
    }
    // draw zoomed skin region from the offscreen 64x64 canvas
    var srcX = pixelX - HALF, srcY = pixelY - HALF;
    var srcW = HALF * 2 + 1, srcH = HALF * 2 + 1;
    magCtx.drawImage(off, srcX, srcY, srcW, srcH, 0, 0, magCanvas.width, magCanvas.height);
    // crosshair on the active pixel
    var pxSize = Math.round(magCanvas.width / srcW);
    var cx = Math.floor(magCanvas.width / 2 - pxSize / 2);
    var cy = Math.floor(magCanvas.height / 2 - pxSize / 2);
    magCtx.strokeStyle = 'rgba(255,255,255,0.9)';
    magCtx.lineWidth = 1.5;
    magCtx.strokeRect(cx + 0.5, cy + 0.5, pxSize - 1, pxSize - 1);
    // position lens above the finger, clamped to viewport
    var lensSize = 96;
    var lx = clientX - lensSize / 2;
    var ly = clientY - lensSize - 20;
    lx = Math.max(8, Math.min(window.innerWidth - lensSize - 8, lx));
    ly = Math.max(8, ly);
    magnifier.style.left = lx + 'px';
    magnifier.style.top  = ly + 'px';
    magnifier.style.display = 'block';
  }

  function hideMagnifier() {
    if (magnifier) magnifier.style.display = 'none';
    _isTouchDraw = false;
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
    if (e.pointerType === 'touch') { _isTouchDraw = true; e.preventDefault(); }
    if (state.tool === 'eyedropper') {
      pickFromPixel(p[0], p[1]);
      if (_isTouchDraw) showMagnifier(e.clientX, e.clientY, p[0], p[1]);
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
    if (_isTouchDraw) showMagnifier(e.clientX, e.clientY, p[0], p[1]);
    try { overlayCanvas.setPointerCapture(e.pointerId); } catch (err) {}
  }
  function moveStroke(e) {
    if (e.pointerType === 'touch' && drawing) e.preventDefault();
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
    if (_isTouchDraw) showMagnifier(e.clientX, e.clientY, p[0], p[1]);
  }
  function endStroke() {
    if (drawing && strokeDirty) { scheduleAutosave(); }
    drawing = false; lastPt = null; strokeDirty = false;
    hideMagnifier();
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
    addToHistory(hex);
    updateHslSliders();
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

  // ---- colour history -------------------------------------------------------
  function addToHistory(hex) {
    hex = hex.toLowerCase();
    colorHistory = colorHistory.filter(function (c) { return c !== hex; });
    colorHistory.unshift(hex);
    if (colorHistory.length > MAX_HISTORY) colorHistory.pop();
    renderColorHistory();
    try { localStorage.setItem(LS_KEY + '_hist', JSON.stringify(colorHistory)); } catch (e) {}
  }
  function loadColorHistory() {
    try {
      var h = localStorage.getItem(LS_KEY + '_hist');
      if (h) colorHistory = JSON.parse(h).slice(0, MAX_HISTORY);
    } catch (e) {}
  }
  function renderColorHistory() {
    var el = document.getElementById('msColorHistory');
    if (!el) return;
    el.innerHTML = '';
    colorHistory.forEach(function (hex) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ms-swatch';
      b.style.background = hex;
      b.setAttribute('data-color', hex);
      b.setAttribute('aria-label', 'Recent colour ' + hex);
      b.addEventListener('click', function () { setColor(hex); });
      el.appendChild(b);
    });
  }

  // ---- part copy / paste ----------------------------------------------------
  function copyPart(name) {
    var group = PART_MAP[name];
    if (!group) { toast('Unknown part'); return; }
    var faces = {};
    FACE_NAMES.forEach(function (fn) {
      var r = group[fn];
      var pixels = [];
      for (var y = r[1]; y < r[1] + r[3]; y++) {
        for (var x = r[0]; x < r[0] + r[2]; x++) {
          var i = idx(x, y);
          pixels.push(data[i], data[i + 1], data[i + 2], data[i + 3]);
        }
      }
      faces[fn] = { rect: r.slice(), pixels: pixels };
    });
    partClipboard = { name: name, faces: faces };
    toast('Copied ' + name);
    var pb = document.getElementById('msPastePartBtn');
    if (pb) pb.disabled = false;
  }
  function pastePart(name) {
    if (!partClipboard) { toast('Nothing copied yet'); return; }
    var dstGroup = PART_MAP[name];
    if (!dstGroup) { toast('Unknown target part'); return; }
    pushUndo();
    FACE_NAMES.forEach(function (fn) {
      var src = partClipboard.faces[fn];
      var dstRect = dstGroup[fn];
      var srcRect = src.rect;
      var w = Math.min(srcRect[2], dstRect[2]);
      var h = Math.min(srcRect[3], dstRect[3]);
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var si = (y * srcRect[2] + x) * 4;
          setPixel(dstRect[0] + x, dstRect[1] + y,
            src.pixels[si], src.pixels[si + 1], src.pixels[si + 2], src.pixels[si + 3]);
        }
      }
    });
    renderAll(); scheduleAutosave();
    toast('Pasted to ' + name);
  }

  // ---- 3D preview (three.js r128) ----------------------------------------
  // Build a box mesh whose six faces sample the skin texture. Corners are given
  // in "outside viewer" order (TL,TR,BR,BL); winding is corrected to face outward.
  function makeBox(w, h, d, cx, cy, cz, faces) {
    var hw = w / 2, hh = h / 2, hd = d / 2;
    var pos = [], uv = [], idx2 = [];
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
      idx2.push(base, base + 1, base + 2, base, base + 2, base + 3);
    });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx2);
    geo.computeVertexNormals();
    return geo;
  }

  var texCanvas = document.createElement('canvas');
  texCanvas.width = texCanvas.height = SIZE;
  var texCtx = texCanvas.getContext('2d');
  var renderer, scene, camera, pivot, skinTexture;
  var camDist = 54;
  var threeOk = false;
  // module-level refs for rebuilding arm meshes on Alex/Steve toggle
  var _player = null;
  var _baseMat = null;
  var _overMat = null;
  var _armMeshes = [];

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

    _baseMat = new THREE.MeshLambertMaterial({ map: skinTexture, alphaTest: 0.02, side: THREE.FrontSide });
    _overMat = new THREE.MeshLambertMaterial({ map: skinTexture, alphaTest: 0.5, side: THREE.FrontSide });

    _player = new THREE.Group();
    _player.position.y = -16;

    function addBox(w, h, d, x, y, z, faces, mat, partName) {
      var mesh = new THREE.Mesh(makeBox(w, h, d, x, y, z, faces), mat);
      mesh.userData.part = partName;
      _player.add(mesh);
    }
    // absolute y positions (feet at 0): legs 6, body 18, head 28, arms 18
    addBox(8, 8, 8, 0, 28, 0, HEAD, _baseMat, 'HEAD');
    addBox(8.5, 8.5, 8.5, 0, 28, 0, HAT, _overMat, 'HAT');
    addBox(8, 12, 4, 0, 18, 0, BODY, _baseMat, 'BODY');
    addBox(8.25, 12.25, 4.25, 0, 18, 0, JACKET, _overMat, 'JACKET');
    // Leg pivots at hip joint (y=12 = bottom of body) for walk animation
    _rLegPivot = new THREE.Group(); _rLegPivot.position.set( 2, 12, 0); _player.add(_rLegPivot);
    _lLegPivot = new THREE.Group(); _lLegPivot.position.set(-2, 12, 0); _player.add(_lLegPivot);
    function mkLeg(geo, mat, part) { var m = new THREE.Mesh(geo, mat); m.userData.part = part; return m; }
    _rLegPivot.add(mkLeg(makeBox(4,    12,    4,    0, -6, 0, RLEG),     _baseMat, 'RLEG'));
    _lLegPivot.add(mkLeg(makeBox(4,    12,    4,    0, -6, 0, LLEG),     _baseMat, 'LLEG'));
    _rLegPivot.add(mkLeg(makeBox(4.25, 12.25, 4.25, 0, -6, 0, RLEG_OUT), _overMat, 'RLEG_OUT'));
    _lLegPivot.add(mkLeg(makeBox(4.25, 12.25, 4.25, 0, -6, 0, LLEG_OUT), _overMat, 'LLEG_OUT'));
    // arms are built separately so they can be swapped on Alex/Steve toggle
    _buildArmMeshes();

    pivot = new THREE.Group();
    pivot.position.set(0, 16, 0);
    pivot.add(_player);
    scene.add(pivot);

    threeOk = true;
    resize3D();
    animate3D();
  }

  function _buildArmMeshes() {
    if (!_player || !_baseMat || !_overMat) return;
    // Dispose old arm meshes and pivot groups
    _armMeshes.forEach(function (m) {
      if (m.parent) m.parent.remove(m);
      if (m.geometry) m.geometry.dispose();
    });
    _armMeshes = [];
    if (_rArmPivot) { _player.remove(_rArmPivot); _rArmPivot = null; }
    if (_lArmPivot) { _player.remove(_lArmPivot); _lArmPivot = null; }

    var w = alexModel ? 3 : 4;
    var ox = alexModel ? 5.5 : 6;
    var rUV = alexModel ? RARM_ALEX : RARM;
    var lUV = alexModel ? LARM_ALEX : LARM;
    var rOutW = w + 0.25;

    // Pivot at shoulder joint (y=24 = body top) so arm can swing around it
    _rArmPivot = new THREE.Group(); _rArmPivot.position.set(ox, 24, 0);
    _lArmPivot = new THREE.Group(); _lArmPivot.position.set(-ox, 24, 0);
    _player.add(_rArmPivot); _player.add(_lArmPivot);

    function mkMesh(geo, mat, part) {
      var m = new THREE.Mesh(geo, mat); m.userData.part = part; return m;
    }
    // Arms positioned at (0,-6,0) local to pivot so center is 6 below shoulder
    var rm  = mkMesh(makeBox(w,     12,    4,    0, -6, 0, rUV),     _baseMat, 'RARM');
    var lm  = mkMesh(makeBox(w,     12,    4,    0, -6, 0, lUV),     _baseMat, 'LARM');
    var rom = mkMesh(makeBox(rOutW, 12.25, 4.25, 0, -6, 0, RARM_OUT), _overMat, 'RARM_OUT');
    var lom = mkMesh(makeBox(rOutW, 12.25, 4.25, 0, -6, 0, LARM_OUT), _overMat, 'LARM_OUT');
    _rArmPivot.add(rm); _rArmPivot.add(rom);
    _lArmPivot.add(lm); _lArmPivot.add(lom);
    _armMeshes = [rm, lm, rom, lom];
  }
  function rebuildArms() {
    if (!threeOk) return;
    _buildArmMeshes();
    try { localStorage.setItem(LS_KEY + '_alex', alexModel ? '1' : '0'); } catch (e) {}
  }
  function loadAlexPref() {
    try { alexModel = localStorage.getItem(LS_KEY + '_alex') === '1'; } catch (e) {}
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
    if (state.autoRotate) pivot.position.y = 16 + Math.sin(now * 0.0018) * 0.35;
    // Walk animation - arms and legs swing in opposite phase
    if (state.walkAnim) {
      var ta = now * 0.003, amp = 0.6;
      if (_rArmPivot) _rArmPivot.rotation.x =  Math.sin(ta) * amp;
      if (_lArmPivot) _lArmPivot.rotation.x = -Math.sin(ta) * amp;
      if (_rLegPivot) _rLegPivot.rotation.x = -Math.sin(ta) * amp;
      if (_lLegPivot) _lLegPivot.rotation.x =  Math.sin(ta) * amp;
    } else {
      // Ease limbs back to rest
      if (_rArmPivot && Math.abs(_rArmPivot.rotation.x) > 0.001) _rArmPivot.rotation.x *= 0.85;
      else if (_rArmPivot) _rArmPivot.rotation.x = 0;
      if (_lArmPivot && Math.abs(_lArmPivot.rotation.x) > 0.001) _lArmPivot.rotation.x *= 0.85;
      else if (_lArmPivot) _lArmPivot.rotation.x = 0;
      if (_rLegPivot && Math.abs(_rLegPivot.rotation.x) > 0.001) _rLegPivot.rotation.x *= 0.85;
      else if (_rLegPivot) _rLegPivot.rotation.x = 0;
      if (_lLegPivot && Math.abs(_lLegPivot.rotation.x) > 0.001) _lLegPivot.rotation.x *= 0.85;
      else if (_lLegPivot) _lLegPivot.rotation.x = 0;
    }
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
      var hits = raycaster3D.intersectObjects(_player ? [_player] : scene.children, true);
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

    // Alex / Steve toggle
    var alexBtn = byId('msAlexBtn');
    if (alexBtn) {
      alexBtn.classList.toggle('on', alexModel);
      alexBtn.textContent = alexModel ? 'Alex (slim)' : 'Steve (wide)';
      alexBtn.addEventListener('click', function () {
        alexModel = !alexModel;
        alexBtn.classList.toggle('on', alexModel);
        alexBtn.textContent = alexModel ? 'Alex (slim)' : 'Steve (wide)';
        rebuildArms();
        toast(alexModel ? 'Alex (slim) arms' : 'Steve (wide) arms');
      });
    }

    // part copy / paste
    var copySelEl = byId('msCopyPartSel');
    var copyBtn   = byId('msCopyPartBtn');
    var pasteSelEl = byId('msPastePartSel');
    var pasteBtn   = byId('msPastePartBtn');
    if (copyBtn && copySelEl) {
      copyBtn.addEventListener('click', function () {
        var v = copySelEl.value;
        if (!v) { toast('Choose a source part first'); return; }
        copyPart(v);
      });
    }
    if (pasteBtn && pasteSelEl) {
      pasteBtn.disabled = true;
      pasteBtn.addEventListener('click', function () {
        var v = pasteSelEl.value;
        if (!v) { toast('Choose a target part first'); return; }
        pastePart(v);
      });
    }

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

    // Walk animation toggle
    var walkToggle = byId('msWalkAnim');
    if (walkToggle) walkToggle.addEventListener('change', function () { state.walkAnim = walkToggle.checked; });

    // View pan/zoom: reset button
    if (byId('msViewReset')) byId('msViewReset').addEventListener('click', function () {
      viewScale = 1; viewPanX = 0; viewPanY = 0;
      applyViewTransform();
      byId('msViewReset').style.display = 'none';
    });

    // HSL sliders
    var hueEl2  = byId('msHue'), satEl2 = byId('msSat'), litEl2 = byId('msLit');
    var hexEl2  = byId('msHexInput');
    var hueValEl = byId('msHueVal'), satValEl = byId('msSatVal'), litValEl = byId('msLitVal');
    function fromHsl() {
      var h = +(hueEl2 ? hueEl2.value : 0);
      var s = +(satEl2 ? satEl2.value : 100);
      var l = +(litEl2 ? litEl2.value : 50);
      if (hueValEl) hueValEl.textContent = h;
      if (satValEl) satValEl.textContent = s;
      if (litValEl) litValEl.textContent = l;
      var rgb = hslToRgb(h, s, l);
      var hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
      state.color = hex;
      state.rgba  = [rgb[0], rgb[1], rgb[2], 255];
      if (colorInput) colorInput.value = hex;
      if (colorVal)   colorVal.textContent = hex.toUpperCase();
      if (hexEl2)     hexEl2.value = hex.toUpperCase();
      highlightSwatch(hex);
      if (state.tool === 'eraser' || state.tool === 'eyedropper') setTool('pencil');
      addToHistory(hex);
      updateSliderGradients(h, s, l);
      var mc = byId('msMobileColor');
      if (mc) mc.value = hex;
    }
    if (hueEl2) hueEl2.addEventListener('input', fromHsl);
    if (satEl2) satEl2.addEventListener('input', fromHsl);
    if (litEl2) litEl2.addEventListener('input', fromHsl);
    if (hexEl2) hexEl2.addEventListener('change', function () {
      var v = hexEl2.value.trim().replace('#', '');
      if (/^[0-9a-f]{6}$/i.test(v) || /^[0-9a-f]{3}$/i.test(v)) setColor('#' + v.toLowerCase());
    });
    if (hexEl2) hexEl2.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') hexEl2.dispatchEvent(new Event('change'));
    });

    // Skin gallery
    if (byId('msSkinGalleryBtn')) byId('msSkinGalleryBtn').addEventListener('click', openSkinModal);
    var skinModal2 = document.getElementById('msSkinModal');
    if (skinModal2) skinModal2.addEventListener('click', function (e) { if (e.target === skinModal2) closeSkinModal(); });
    if (byId('msSkinModalClose')) byId('msSkinModalClose').addEventListener('click', closeSkinModal);
    if (byId('msSkinModalSave')) byId('msSkinModalSave').addEventListener('click', function () {
      var n = prompt('Name this skin:', 'Skin ' + (skinSlots.length + 1));
      if (n !== null) saveToSlot(n || ('Skin ' + (skinSlots.length + 1)), -1);
    });

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

    // mobile view tabs
    var tab2D  = byId('msTab2D');
    var tab3D  = byId('msTab3D');
    var msMain = document.querySelector('.ms-main');
    if (tab2D && tab3D && msMain) {
      tab2D.addEventListener('click', function () {
        msMain.setAttribute('data-view', '2d');
        tab2D.classList.add('active');    tab2D.setAttribute('aria-selected', 'true');
        tab3D.classList.remove('active'); tab3D.setAttribute('aria-selected', 'false');
      });
      tab3D.addEventListener('click', function () {
        msMain.setAttribute('data-view', '3d');
        tab3D.classList.add('active');    tab3D.setAttribute('aria-selected', 'true');
        tab2D.classList.remove('active'); tab2D.setAttribute('aria-selected', 'false');
        setTimeout(resize3D, 60); // re-fit 3D canvas after it becomes visible
      });
    }

    // modal
    function openModal() { if (modal) modal.classList.add('open'); }
    function closeModal() { if (modal) modal.classList.remove('open'); }
    if (byId('msHelpBtn')) byId('msHelpBtn').addEventListener('click', openModal);
    if (byId('msModalClose')) byId('msModalClose').addEventListener('click', closeModal);
    if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal && modal.classList.contains('open')) closeModal();
      else if (e.key === 'Escape' && skinModalOpen) closeSkinModal();
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
    loadAlexPref();
    loadColorHistory();
    loadSkinSlots();
    wire();
    renderColorHistory();
    updateHslSliders();
    initCanvasPanZoom();
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
