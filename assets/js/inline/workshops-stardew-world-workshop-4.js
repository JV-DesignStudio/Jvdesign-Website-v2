/* Stardew World Workshop - in-browser map planner.
   A tiny paint-your-own-layout grid so learners can plan before opening Tiled.
   Browser-only on purpose: no install, no game, works on a school computer. */
(function () {
  var canvas = document.getElementById('sdPlanner');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var COLS = 24, ROWS = 16, CELL = 24;
  var BASE = 'grass';
  var COLORS = { grass: '#7bb661', path: '#c9a26b', water: '#5aa9e6', tree: '#2f6b33', building: '#8a5a44', flower: '#e07aa8' };
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
      g.arc(x + s / 2, y + s / 2 - 1, s * 0.34, 0, Math.PI * 2);
      g.fill();
    } else if (t === 'building') {
      g.fillStyle = '#6d4535';
      g.fillRect(x + 2, y + 7, s - 4, s - 8);
      g.fillStyle = '#c98a2e';
      g.beginPath();
      g.moveTo(x + 1, y + 7);
      g.lineTo(x + s / 2, y + 1);
      g.lineTo(x + s - 1, y + 7);
      g.closePath();
      g.fill();
    } else if (t === 'flower') {
      g.fillStyle = '#fff2f8';
      g.beginPath();
      g.arc(x + s / 2, y + s / 2, Math.max(2, s * 0.2), 0, Math.PI * 2);
      g.fill();
    } else if (t === 'water') {
      g.strokeStyle = 'rgba(255,255,255,.45)';
      g.lineWidth = Math.max(1, s / 10);
      g.beginPath();
      g.moveTo(x + s * 0.15, y + s * 0.58);
      g.lineTo(x + s * 0.85, y + s * 0.58);
      g.stroke();
    } else if (t === 'path') {
      g.fillStyle = 'rgba(0,0,0,.12)';
      g.fillRect(x + s * 0.16, y + s * 0.16, s * 0.68, s * 0.68);
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

  var swatches = [].slice.call(document.querySelectorAll('.sd-swatch'));
  swatches.forEach(function (b) {
    b.addEventListener('click', function () {
      swatches.forEach(function (x) { x.classList.remove('is-active'); x.setAttribute('aria-pressed', 'false'); });
      b.classList.add('is-active');
      b.setAttribute('aria-pressed', 'true');
      current = b.getAttribute('data-tile');
    });
  });

  var clearBtn = document.getElementById('sdPlannerClear');
  if (clearBtn) clearBtn.addEventListener('click', function () {
    for (var i = 0; i < tiles.length; i++) tiles[i] = BASE;
    render();
  });

  var saveBtn = document.getElementById('sdPlannerSave');
  if (saveBtn) saveBtn.addEventListener('click', function () {
    try {
      var a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = 'my-stardew-world-plan.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {}
  });

  /* Export a .tmx Tiled can open. The painted grid is split onto the three
     Stardew layers (Back / Buildings / Front) and a tiny tileset image is
     embedded, so the file opens with no missing-image warnings. This is a
     starting file for the Tiled editor, not a game-loadable mod on its own. */
  var TILE_ORDER = ['grass', 'path', 'water', 'tree', 'building', 'flower'];
  var LAYER_FOR = { grass: 'Back', path: 'Back', water: 'Back', building: 'Buildings', flower: 'Buildings', tree: 'Front' };

  function tilesetPngBase64() {
    var t = document.createElement('canvas');
    t.width = 16 * TILE_ORDER.length;
    t.height = 16;
    var g = t.getContext('2d');
    for (var i = 0; i < TILE_ORDER.length; i++) drawTileAt(g, i * 16, 0, 16, TILE_ORDER[i]);
    return t.toDataURL('image/png').split(',')[1];
  }

  function buildTMX() {
    var gidOf = {}, i, r, c, t;
    for (i = 0; i < TILE_ORDER.length; i++) gidOf[TILE_ORDER[i]] = i + 1;
    var layers = { Back: [], Buildings: [], Front: [] };
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        t = tiles[idx(c, r)];
        layers[LAYER_FOR[t] || 'Back'].push(gidOf[t] || gidOf.grass);
      }
    }
    function csv(arr) {
      var rows = [];
      for (var k = 0; k < arr.length; k += COLS) rows.push(arr.slice(k, k + COLS).join(','));
      return rows.join(',\n');
    }
    var base64 = tilesetPngBase64();
    var layerXml = ['Back', 'Buildings', 'Front'].map(function (name, n) {
      return ' <layer id="' + (n + 1) + '" name="' + name + '" width="' + COLS + '" height="' + ROWS + '">\n' +
        '  <data encoding="csv">' + csv(layers[name]) + '</data>\n' +
        ' </layer>';
    }).join('\n');
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="' + COLS + '" height="' + ROWS + '" tilewidth="16" tileheight="16" infinite="0" nextlayerid="4" nextobjectid="1">\n' +
      ' <tileset firstgid="1" name="planner-tiles" tilewidth="16" tileheight="16" spacing="0" margin="0" tilecount="' + TILE_ORDER.length + '" columns="' + TILE_ORDER.length + '">\n' +
      '  <image format="png" width="' + (16 * TILE_ORDER.length) + '" height="16"><data encoding="base64">' + base64 + '</data></image>\n' +
      ' </tileset>\n' +
      layerXml + '\n' +
      '</map>\n';
  }

  var tmxBtn = document.getElementById('sdPlannerTmx');
  if (tmxBtn) tmxBtn.addEventListener('click', function () {
    try {
      var blob = new Blob([buildTMX()], { type: 'application/xml' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'my-stardew-world.tmx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    } catch (e) {}
  });

  render();
})();
