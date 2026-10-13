/* Terraria World Workshop - in-browser world planner.
   A tiny paint-your-own-layout grid so learners can plan before opening TEdit.
   Browser-only on purpose: no install, no game, works on a school computer. */
(function () {
  var canvas = document.getElementById('twPlanner');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var COLS = 24, ROWS = 16, CELL = 24;
  var BASE = 'grass';
  var COLORS = { grass: '#5cae4a', dirt: '#7a4a2b', stone: '#7d7d84', water: '#3b7dd8', sand: '#dcc38a', tree: '#2f6b33', chest: '#c08a3e' };
  var tiles = new Array(COLS * ROWS).fill(BASE);
  var current = BASE;
  var painting = false;

  function idx(c, r) { return r * COLS + c; }

  function drawTileAt(g, x, y, s, t) {
    g.fillStyle = COLORS[t] || COLORS.grass;
    g.fillRect(x, y, s, s);
    if (t === 'tree') {
      g.fillStyle = '#5a3a22';
      g.fillRect(x + s / 2 - 2, y + s - 8, 4, 7);
      g.fillStyle = '#1f4d24';
      g.beginPath();
      g.arc(x + s / 2, y + s / 2 - 2, s * 0.34, 0, Math.PI * 2);
      g.fill();
    } else if (t === 'chest') {
      g.fillStyle = '#8a5a2b';
      g.fillRect(x + 3, y + 6, s - 6, s - 9);
      g.fillStyle = '#e2b95f';
      g.fillRect(x + 3, y + 6, s - 6, 4);
      g.fillRect(x + s / 2 - 1, y + 10, 3, 5);
    } else if (t === 'water') {
      g.strokeStyle = 'rgba(255,255,255,.45)';
      g.lineWidth = Math.max(1, s / 10);
      g.beginPath();
      g.moveTo(x + s * 0.15, y + s * 0.58);
      g.lineTo(x + s * 0.85, y + s * 0.58);
      g.stroke();
    } else if (t === 'dirt') {
      g.fillStyle = 'rgba(0,0,0,.12)';
      g.fillRect(x + s * 0.2, y + s * 0.2, s * 0.2, s * 0.2);
      g.fillRect(x + s * 0.6, y + s * 0.55, s * 0.18, s * 0.18);
    } else if (t === 'stone') {
      g.fillStyle = 'rgba(255,255,255,.16)';
      g.fillRect(x + s * 0.18, y + s * 0.2, s * 0.24, s * 0.24);
      g.fillStyle = 'rgba(0,0,0,.16)';
      g.fillRect(x + s * 0.55, y + s * 0.5, s * 0.26, s * 0.26);
    } else if (t === 'sand') {
      g.fillStyle = 'rgba(0,0,0,.08)';
      g.fillRect(x + s * 0.3, y + s * 0.3, s * 0.14, s * 0.14);
    }
  }

  function drawTile(c, r, t) { drawTileAt(ctx, c * CELL, r * CELL, CELL, t); }

  function render() {
    var r, c;
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) drawTile(c, r, tiles[idx(c, r)]);
    ctx.strokeStyle = 'rgba(0,0,0,.12)';
    ctx.lineWidth = 1;
    for (c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(c * CELL + 0.5, 0); ctx.lineTo(c * CELL + 0.5, ROWS * CELL); ctx.stroke(); }
    for (r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * CELL + 0.5); ctx.lineTo(COLS * CELL, r * CELL + 0.5); ctx.stroke(); }
  }

  function paintAt(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var sx = (clientX - rect.left) * (canvas.width / rect.width);
    var sy = (clientY - rect.top) * (canvas.height / rect.height);
    var c = Math.floor(sx / CELL), r = Math.floor(sy / CELL);
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
    tiles[idx(c, r)] = (current === 'erase') ? BASE : current;
    drawTile(c, r, tiles[idx(c, r)]);
  }

  canvas.addEventListener('pointerdown', function (e) {
    painting = true;
    if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (x) {} }
    paintAt(e.clientX, e.clientY);
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', function (e) { if (painting) paintAt(e.clientX, e.clientY); });
  canvas.addEventListener('pointerup', function () { painting = false; });
  canvas.addEventListener('pointercancel', function () { painting = false; });
  canvas.addEventListener('pointerleave', function () { painting = false; });

  var swatches = [].slice.call(document.querySelectorAll('.tw-swatch'));
  swatches.forEach(function (b) {
    b.addEventListener('click', function () {
      swatches.forEach(function (x) { x.classList.remove('is-active'); x.setAttribute('aria-pressed', 'false'); });
      b.classList.add('is-active');
      b.setAttribute('aria-pressed', 'true');
      current = b.getAttribute('data-tile');
    });
  });

  var clearBtn = document.getElementById('twPlannerClear');
  if (clearBtn) clearBtn.addEventListener('click', function () {
    for (var i = 0; i < tiles.length; i++) tiles[i] = BASE;
    render();
  });

  var saveBtn = document.getElementById('twPlannerSave');
  if (saveBtn) saveBtn.addEventListener('click', function () {
    try {
      var a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = 'my-terraria-world-plan.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {}
  });

  /* Export the painted grid as a small world.json plan, an honest starting
     point you can reopen or follow while building in TEdit. It is not a
     loadable .wld on its own. */
  var jsonBtn = document.getElementById('twPlannerJson');
  if (jsonBtn) jsonBtn.addEventListener('click', function () {
    try {
      var plan = { app: 'jvds-terraria-world-planner', version: 1, cols: COLS, rows: ROWS, tiles: tiles.slice() };
      var blob = new Blob([JSON.stringify(plan)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'my-terraria-world.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    } catch (e) {}
  });

  render();
})();
