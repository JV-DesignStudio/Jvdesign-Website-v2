/* Living-world hero + progress dashboard for the Terraria World Workshop hub. */
(function () {
  var EPISODES = ['jvds-terraria-world-ep1-v2','jvds-terraria-world-ep2-v2','jvds-terraria-world-ep3-v2','jvds-terraria-world-ep4-v2','jvds-terraria-world-ep5-v2','jvds-terraria-world-ep6-v2','jvds-terraria-world-ep7-v2','jvds-terraria-world-ep8-v2','jvds-terraria-world-ep9-v2','jvds-terraria-world-ep10-v2','jvds-terraria-world-ep11-v2','jvds-terraria-world-ep12-v2'];
  function doneCount() { var n = 0; EPISODES.forEach(function (k) { try { var d = JSON.parse(localStorage.getItem(k) || 'null'); if (d && Array.isArray(d.completed) && typeof d.total === 'number' && d.completed.length >= d.total) n++; } catch (e) {} }); return n; }
  try {
    var n = doneCount(), total = EPISODES.length;
    var t = document.getElementById('twProgText'); if (t) t.textContent = n + ' / ' + total + ' episodes complete';
    var f = document.getElementById('twProgFill'); if (f) f.style.width = (n / total * 100) + '%';
    var b = document.getElementById('twProgBadge');
    if (b) { if (n >= total) { b.className = 'tw-prog-badge earned'; b.textContent = '🌳 Earned! You built your own world.'; } else { b.textContent = (total - n) + ' episode' + (total - n === 1 ? '' : 's') + ' to go for the badge.'; } }
    var s = document.getElementById('twProgSub'); if (s && n > 0) s.textContent = 'Nice. Keep going, or open the Studio to practise free.';
    var p = null; try { p = JSON.parse(localStorage.getItem('jvds_profile') || 'null'); } catch (e) {}
    var xp = document.getElementById('twProgXp'); if (xp && p) { var st = p.state || p; xp.textContent = 'Level ' + (st.level || 1) + ' · ' + (st.globalXP || 0) + ' XP across the studio'; }
  } catch (e) {}

  var cv = document.getElementById('twHero'); if (!cv) return;
  var ctx = cv.getContext('2d');
  var COLS = 22, ROWS = 6, CELL = 50;
  var times = [
    { name: 'Day', sky: ['#7ec8f0', '#bfe6f5'], tint: null },
    { name: 'Sunset', sky: ['#f0a15c', '#f7cfa0'], tint: 'rgba(255,150,70,.12)' },
    { name: 'Night', sky: ['#101a3a', '#26356b'], tint: 'rgba(10,16,50,.34)' },
    { name: 'Dawn', sky: ['#8fb8e0', '#e6d7c0'], tint: 'rgba(255,214,150,.10)' }
  ];
  var times_i = 0;
  /* tile codes: 0 air, 1 grass-dirt, 2 dirt, 3 stone, 4 water, 5 tree, 6 chest, 7 wood */
  var layout = new Array(COLS * ROWS).fill(0);
  function set(c, r, v) { if (c >= 0 && c < COLS && r >= 0 && r < ROWS) layout[r * COLS + c] = v; }
  for (var c = 0; c < COLS; c++) { set(c, 4, 1); set(c, 5, 3); }
  for (var wc = 3; wc <= 6; wc++) set(wc, 4, 4);
  set(2, 3, 5); set(10, 3, 5); set(16, 3, 5); set(18, 3, 5);
  set(12, 3, 7); set(13, 3, 7); set(12, 2, 7); set(13, 2, 7);
  set(9, 3, 6);
  function drawTile(g, x, y, s, t) {
    if (t === 0) { return; }
    if (t === 1) { g.fillStyle = '#5cae4a'; g.fillRect(x, y, s, s); g.fillStyle = '#7a4a2b'; g.fillRect(x, y + s * .34, s, s * .66); }
    else if (t === 2) { g.fillStyle = '#7a4a2b'; g.fillRect(x, y, s, s); }
    else if (t === 3) { g.fillStyle = '#7d7d84'; g.fillRect(x, y, s, s); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + s * .5, y + s * .45, s * .3, s * .3); }
    else if (t === 4) { g.fillStyle = '#3b7dd8'; g.fillRect(x, y, s, s); }
    else if (t === 5) { g.fillStyle = '#5a3a22'; g.fillRect(x + s / 2 - 3, y + s * .4, 6, s * .6); g.fillStyle = '#2f6b33'; g.beginPath(); g.arc(x + s / 2, y + s * .3, s * .32, 0, Math.PI * 2); g.fill(); }
    else if (t === 6) { g.fillStyle = '#8a5a2b'; g.fillRect(x + 6, y + 14, s - 12, s - 18); g.fillStyle = '#e2b95f'; g.fillRect(x + 6, y + 14, s - 12, 6); }
    else if (t === 7) { g.fillStyle = '#b5895a'; g.fillRect(x, y, s, s); g.strokeStyle = 'rgba(0,0,0,.22)'; g.strokeRect(x + .5, y + .5, s - 1, s - 1); }
  }
  var start = Date.now();
  function frame() {
    var tm = times[times_i], t = (Date.now() - start) / 1000;
    var grad = ctx.createLinearGradient(0, 0, 0, cv.height);
    grad.addColorStop(0, tm.sky[0]); grad.addColorStop(1, tm.sky[1]);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, cv.width, cv.height);
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) drawTile(ctx, c * CELL, r * CELL, CELL, layout[r * COLS + c]);
    ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2;
    for (var wc = 3; wc <= 6; wc++) { var yy = 4 * CELL + CELL * (0.4 + 0.2 * Math.sin(t * 2 + wc)); ctx.beginPath(); ctx.moveTo(wc * CELL + 8, yy); ctx.lineTo(wc * CELL + CELL - 8, yy); ctx.stroke(); }
    var walk = (t * 1.5) % 1, hc = Math.floor(walk * COLS), hx = hc * CELL + CELL / 2, hy = 3 * CELL + CELL / 2;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(hx, hy + 14, CELL * .3, CELL * .13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx, hy, CELL * .3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2e7d32'; ctx.beginPath(); ctx.arc(hx, hy, CELL * .22, 0, Math.PI * 2); ctx.fill();
    if (tm.tint) { ctx.fillStyle = tm.tint; ctx.fillRect(0, 0, cv.width, cv.height); }
    var info = document.getElementById('twHeroInfo'); if (info) info.textContent = tm.name + ' · Forest';
    requestAnimationFrame(frame);
  }
  function cycle() { times_i = (times_i + 1) % times.length; }
  cv.addEventListener('click', cycle);
  var tb = document.getElementById('twHeroTime'); if (tb) tb.addEventListener('click', cycle);
  frame();
})();
