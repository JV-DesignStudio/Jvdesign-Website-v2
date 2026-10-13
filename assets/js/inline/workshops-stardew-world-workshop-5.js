/* Living-world hero + progress dashboard for the Stardew World Workshop hub. */
(function () {
  var EPISODES = ['jvds-stardew-world-ep1-v2','jvds-stardew-world-ep2-v2','jvds-stardew-world-ep3-v2','jvds-stardew-world-ep4-v2','jvds-stardew-world-ep5-v2','jvds-stardew-world-ep6-v2','jvds-stardew-world-ep7-v2','jvds-stardew-world-ep8-v2','jvds-stardew-world-ep9-v2','jvds-stardew-world-ep10-v2','jvds-stardew-world-ep11-v2','jvds-stardew-world-ep12-v2'];
  function doneCount() { var n = 0; EPISODES.forEach(function (k) { try { var d = JSON.parse(localStorage.getItem(k) || 'null'); if (d && Array.isArray(d.completed) && typeof d.total === 'number' && d.completed.length >= d.total) n++; } catch (e) {} }); return n; }
  try {
    var n = doneCount(), total = EPISODES.length;
    var t = document.getElementById('sdProgText'); if (t) t.textContent = n + ' / ' + total + ' episodes complete';
    var f = document.getElementById('sdProgFill'); if (f) f.style.width = (n / total * 100) + '%';
    var b = document.getElementById('sdProgBadge');
    if (b) { if (n >= total) { b.className = 'sd-prog-badge earned'; b.textContent = '🧑‍🌾 Earned! You built your own world.'; } else { b.textContent = (total - n) + ' episode' + (total - n === 1 ? '' : 's') + ' to go for the badge.'; } }
    var s = document.getElementById('sdProgSub'); if (s && n > 0) s.textContent = 'Nice. Keep going, or open the Studio to practise free.';
    var p = null; try { p = JSON.parse(localStorage.getItem('jvds_profile') || 'null'); } catch (e) {}
    var xp = document.getElementById('sdProgXp'); if (xp && p) { var st = p.state || p; xp.textContent = 'Level ' + (st.level || 1) + ' · ' + (st.globalXP || 0) + ' XP across the studio'; }
  } catch (e) {}

  var cv = document.getElementById('sdHero'); if (!cv) return;
  var ctx = cv.getContext('2d');
  var COLS = 22, ROWS = 6, CELL = 50;
  var seasons = [
    { ground: '#7bb661', leaf: '#2f6b33', water: '#5aa9e6', tint: null },
    { ground: '#6fb055', leaf: '#2f7a2e', water: '#4f9fe0', tint: 'rgba(255,210,90,.10)' },
    { ground: '#9aa64a', leaf: '#b5651d', water: '#5aa9e6', tint: 'rgba(220,130,40,.14)' },
    { ground: '#cfe0e6', leaf: '#6b7d6b', water: '#9fc4e0', tint: 'rgba(200,220,255,.22)' }
  ];
  var SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];
  var times = [
    { name: 'Morning', tint: 'rgba(255,214,150,.10)' },
    { name: 'Daytime', tint: null },
    { name: 'Sunset', tint: 'rgba(255,140,60,.16)' },
    { name: 'Night', tint: 'rgba(18,26,72,.34)' }
  ];
  var season = 0, lastInfo = -1;
  var layout = new Array(COLS * ROWS).fill(0);
  function set(c, r, v) { if (c >= 0 && c < COLS && r >= 0 && r < ROWS) layout[r * COLS + c] = v; }
  for (var c = 3; c <= 8; c++) { set(c, 2, 1); set(c, 3, 1); }
  for (var x = 0; x < COLS; x++) set(x, 4, 2);
  set(2, 1, 3); set(5, 1, 3); set(9, 1, 3); set(10, 1, 3); set(18, 1, 3); set(20, 3, 3); set(1, 4, 3);
  set(15, 1, 4); set(16, 1, 4); set(15, 2, 4); set(16, 2, 4);
  set(11, 4, 5); set(12, 4, 5); set(13, 4, 5); set(19, 4, 5);
  function drawTile(g, x, y, s, t, se) {
    if (t === 0) { g.fillStyle = se.ground; g.fillRect(x, y, s, s); g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + s * .3, y + s * .7); g.lineTo(x + s * .3, y + s * .55); g.stroke(); }
    else if (t === 1) { g.fillStyle = se.water; g.fillRect(x, y, s, s); }
    else if (t === 2) { g.fillStyle = se.ground; g.fillRect(x, y, s, s); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x + 8, y + 8, s - 16, s - 16); }
    else if (t === 3) { g.fillStyle = se.ground; g.fillRect(x, y, s, s); g.fillStyle = '#5a3a22'; g.fillRect(x + s / 2 - 3, y + s - 14, 6, 12); g.fillStyle = se.leaf; g.beginPath(); g.arc(x + s / 2, y + s / 2 - 4, s * .34, 0, Math.PI * 2); g.fill(); }
    else if (t === 4) { g.fillStyle = se.ground; g.fillRect(x, y, s, s); g.fillStyle = '#6d4535'; g.fillRect(x + 4, y + 16, s - 8, s - 18); g.fillStyle = '#c98a2e'; g.beginPath(); g.moveTo(x + 2, y + 16); g.lineTo(x + s / 2, y + 3); g.lineTo(x + s - 2, y + 16); g.closePath(); g.fill(); }
    else if (t === 5) { g.fillStyle = se.ground; g.fillRect(x, y, s, s); g.fillStyle = '#fff2f8'; g.beginPath(); g.arc(x + s / 2, y + s / 2, s * .16, 0, Math.PI * 2); g.fill(); }
  }
  var start = Date.now();
  function frame() {
    var se = seasons[season], t = (Date.now() - start) / 1000;
    ctx.fillStyle = '#0b0f14'; ctx.fillRect(0, 0, cv.width, cv.height);
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) drawTile(ctx, c * CELL, r * CELL, CELL, layout[r * COLS + c], se);
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
    for (var wc = 3; wc <= 8; wc++) for (var wr = 2; wr <= 3; wr++) { var yy = (wr * CELL) + CELL * (0.4 + 0.25 * Math.sin(t * 2 + wc)); ctx.beginPath(); ctx.moveTo(wc * CELL + 8, yy); ctx.lineTo(wc * CELL + CELL - 8, yy); ctx.stroke(); }
    var walk = (t * 1.6) % 1, hc = Math.floor(walk * COLS), hx = hc * CELL + CELL / 2, hy = 4 * CELL + CELL / 2;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(hx, hy + 14, CELL * .3, CELL * .13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx, hy, CELL * .3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3f7d3a'; ctx.beginPath(); ctx.arc(hx, hy, CELL * .22, 0, Math.PI * 2); ctx.fill();
    if (se.tint) { ctx.fillStyle = se.tint; ctx.fillRect(0, 0, cv.width, cv.height); }
    var ti = Math.floor(t / 10) % times.length;
    if (times[ti].tint) { ctx.fillStyle = times[ti].tint; ctx.fillRect(0, 0, cv.width, cv.height); }
    if (Math.floor(t * 2) !== lastInfo) { lastInfo = Math.floor(t * 2); var info = document.getElementById('sdHeroInfo'); if (info) info.textContent = SEASON_NAMES[season] + ' · ' + times[ti].name; }
    requestAnimationFrame(frame);
  }
  function cycle() { season = (season + 1) % seasons.length; }
  cv.addEventListener('click', cycle);
  var sb = document.getElementById('sdHeroSeason'); if (sb) sb.addEventListener('click', cycle);
  frame();
})();
