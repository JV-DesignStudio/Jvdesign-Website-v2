/* First make (A1452) - the tiny paintable canvas on the homepage.
   A no-pressure taste of Ember's Pixel Studio before the learner opens it.
   Pointer drag paints, keyboard arrows move and Enter paints. No storage. */
(function () {
  'use strict';
  var canvas = document.getElementById('fmCanvas');
  if (!canvas || !canvas.getContext) return;

  var COLS = 8, ROWS = 8, CELL = 32;
  var ctx = canvas.getContext('2d');
  canvas.width = COLS * CELL;
  canvas.height = ROWS * CELL;

  var COLORS = ['#BC4749', '#F2637A', '#FFD23C', '#7AC74F', '#70A3A7', '#7C6CF0', '#403B33', '#F0EAD6'];
  var NAMES = ['Red', 'Pink', 'Yellow', 'Green', 'Teal', 'Purple', 'Charcoal', 'Cream'];
  var PAPER = '#FFFDF7';
  var grid = new Array(COLS * ROWS).fill(null);
  var history = [];
  var current = 0;
  var cursor = -1;
  var painting = false;

  function snapshot() {
    history.push(grid.slice());
    if (history.length > 40) history.shift();
  }

  function render() {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (var i = 0; i < grid.length; i++) {
      var x = (i % COLS) * CELL, y = Math.floor(i / COLS) * CELL;
      if (grid[i]) {
        ctx.fillStyle = grid[i];
        ctx.fillRect(x, y, CELL, CELL);
      } else {
        ctx.fillStyle = ((x / CELL + y / CELL) % 2 === 0) ? '#F3EFE4' : '#ECE6D6';
        ctx.fillRect(x, y, CELL, CELL);
      }
    }
    ctx.strokeStyle = 'rgba(64,59,51,0.10)';
    ctx.lineWidth = 1;
    for (var c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * CELL + 0.5, 0); ctx.lineTo(c * CELL + 0.5, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, c * CELL + 0.5); ctx.lineTo(canvas.width, c * CELL + 0.5); ctx.stroke();
    }
    if (cursor >= 0) {
      var cx = (cursor % COLS) * CELL, cy = Math.floor(cursor / COLS) * CELL;
      ctx.strokeStyle = '#4CC9C0';
      ctx.lineWidth = 3;
      ctx.strokeRect(cx + 2, cy + 2, CELL - 4, CELL - 4);
    }
    updateStart();
  }

  // Carry the doodle into Pixel Studio (A1459). The tool reads a #art= hash
  // (base64 of the grid) via importEasyArtFromHash; we append it to the
  // first-mission link so the visitor arrives with their drawing already there.
  var START_BASE = '/tools/pixel-studio.html#first-mission';
  function updateStart() {
    var cta = document.getElementById('fmStart');
    if (!cta) return;
    var hasArt = false;
    for (var i = 0; i < grid.length; i++) { if (grid[i]) { hasArt = true; break; } }
    if (!hasArt) { cta.setAttribute('href', START_BASE); return; }
    try {
      var art = btoa(encodeURIComponent(JSON.stringify({ N: COLS, grid: grid })));
      cta.setAttribute('href', START_BASE + '&art=' + art);
    } catch (e) { cta.setAttribute('href', START_BASE); }
  }

  function cellAt(ev) {
    var r = canvas.getBoundingClientRect();
    var col = Math.floor(((ev.clientX - r.left) / r.width) * COLS);
    var row = Math.floor(((ev.clientY - r.top) / r.height) * ROWS);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return -1;
    return row * COLS + col;
  }

  function spawnSparkle(cellIdx) {
    var wrap = document.querySelector('.fm-canvas-wrap');
    if (!wrap || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var rect = canvas.getBoundingClientRect();
    var wrapRect = wrap.getBoundingClientRect();
    var cx = ((cellIdx % COLS) + 0.5) / COLS * rect.width + (rect.left - wrapRect.left);
    var cy = (Math.floor(cellIdx / COLS) + 0.5) / ROWS * rect.height + (rect.top - wrapRect.top);
    var sparkColors = ['#FFD23C', '#F2637A', '#7C6CF0', '#7AC74F', '#2EB5A5'];
    for (var s = 0; s < 3; s++) {
      var dot = document.createElement('span');
      dot.className = 'fm-sparkle';
      dot.style.left = (cx + (Math.random() - 0.5) * 20) + 'px';
      dot.style.top = (cy + (Math.random() - 0.5) * 20) + 'px';
      dot.style.background = sparkColors[Math.floor(Math.random() * sparkColors.length)];
      dot.style.width = dot.style.height = (4 + Math.random() * 6) + 'px';
      dot.style.animationDuration = (0.35 + Math.random() * 0.3) + 's';
      wrap.appendChild(dot);
      dot.addEventListener('animationend', function () { this.remove(); });
    }
  }

  function paint(i) {
    if (i < 0) return;
    var col = COLORS[current];
    if (grid[i] === col) return;
    grid[i] = col;
    spawnSparkle(i);
    render();
  }

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    snapshot();
    painting = true;
    if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (err) {} }
    paint(cellAt(e));
    canvas.focus({ preventScroll: true });
  });
  canvas.addEventListener('pointermove', function (e) { if (painting) paint(cellAt(e)); });
  window.addEventListener('pointerup', function () { painting = false; });

  canvas.addEventListener('keydown', function (e) {
    var col = cursor < 0 ? 0 : cursor % COLS;
    var row = cursor < 0 ? 0 : Math.floor(cursor / COLS);
    if (e.key === 'ArrowRight') { col = Math.min(COLS - 1, col + 1); }
    else if (e.key === 'ArrowLeft') { col = Math.max(0, col - 1); }
    else if (e.key === 'ArrowDown') { row = Math.min(ROWS - 1, row + 1); }
    else if (e.key === 'ArrowUp') { row = Math.max(0, row - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { snapshot(); paint(row * COLS + col); e.preventDefault(); return; }
    else if (e.key === 'c' || e.key === 'C') { snapshot(); grid = new Array(COLS * ROWS).fill(null); render(); e.preventDefault(); return; }
    else { return; }
    cursor = row * COLS + col;
    e.preventDefault();
    render();
  });
  canvas.addEventListener('focus', function () { if (cursor < 0) cursor = 0; render(); });
  canvas.addEventListener('blur', function () { cursor = -1; render(); });

  var palette = document.getElementById('fmPalette');
  var status = document.getElementById('fmStatus');
  if (palette) {
    COLORS.forEach(function (c, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'fm-swatch';
      b.style.background = c;
      b.setAttribute('aria-label', NAMES[i] + (i === 0 ? ' (selected)' : ''));
      b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
      b.addEventListener('click', function () {
        current = i;
        Array.prototype.forEach.call(palette.children, function (el, j) {
          el.setAttribute('aria-pressed', j === i ? 'true' : 'false');
          el.setAttribute('aria-label', NAMES[j] + (j === i ? ' (selected)' : ''));
        });
        if (status) status.textContent = NAMES[i] + ' selected.';
      });
      palette.appendChild(b);
    });
  }

  var undo = document.getElementById('fmUndo');
  if (undo) undo.addEventListener('click', function () { if (history.length) { grid = history.pop(); render(); } });
  var clear = document.getElementById('fmClear');
  if (clear) clear.addEventListener('click', function () { snapshot(); grid = new Array(COLS * ROWS).fill(null); render(); });

  // Opt-in guide quiz (A1455): the homepage no longer auto-opens the modal,
  // so this button is the way in. showGuideQuiz is defined in mascots.js.
  var findGuide = document.getElementById('findGuide');
  if (findGuide) findGuide.addEventListener('click', function () {
    if (typeof window.showGuideQuiz === 'function') window.showGuideQuiz();
  });

  render();
})();
