(function(){
  var grid = document.getElementById('wsPathsGrid');
  if (!grid) return;
  function completed() {
    try {
      if (typeof playerProfile !== 'undefined' && playerProfile && playerProfile.state && Array.isArray(playerProfile.state.completedWorkshops)) {
        return playerProfile.state.completedWorkshops;
      }
      return [];
    } catch (e) { return []; }
  }
  function render(paths) {
    var done = completed();
    var fragment = document.createDocumentFragment();
    paths.forEach(function(path){
      var total = 0, finished = 0;
      path.levels.forEach(function(level){
        level.workshops.forEach(function(w){ total++; if (done.indexOf(w) !== -1) finished++; });
      });
      var pct = total ? Math.round((finished / total) * 100) : 0;

      var card = document.createElement('article');
      card.className = 'ws-path-card';
      card.style.setProperty('--path-color', path.color || '#70A3A7');

      var head = document.createElement('div');
      head.className = 'ws-path-card-head';
      var emoji = document.createElement('span');
      emoji.className = 'ws-path-card-emoji';
      emoji.setAttribute('aria-hidden', 'true');
      emoji.textContent = path.emoji || '🎮';
      var titles = document.createElement('div');
      var h3 = document.createElement('h3');
      h3.className = 'ws-path-card-title';
      h3.textContent = path.title;
      var meta = document.createElement('span');
      meta.className = 'ws-path-card-meta';
      meta.textContent = (path.engine || '') + (path.ageRange ? ' · Ages ' + path.ageRange : '');
      titles.appendChild(h3); titles.appendChild(meta);
      head.appendChild(emoji); head.appendChild(titles);
      card.appendChild(head);

      var ol = document.createElement('ol');
      ol.className = 'ws-path-levels';
      var nextMarked = false;
      path.levels.forEach(function(level, i){
        var li = document.createElement('li');
        li.className = 'ws-path-level';
        var w = level.workshops[0];
        var isDone = done.indexOf(w) !== -1;
        if (isDone) li.classList.add('is-done');
        var isNext = !isDone && !nextMarked;
        if (isNext) { nextMarked = true; li.classList.add('is-next'); }
        var badge = document.createElement('span');
        badge.className = 'ws-path-level-num';
        badge.textContent = isDone ? '✓' : (isNext ? '▶' : String(i + 1));
        var link = document.createElement('a');
        link.href = '../workshops/' + w + '.html';
        link.className = 'ws-path-level-link';
        var label = document.createElement('span');
        label.className = 'ws-path-level-title';
        label.textContent = level.title;
        link.appendChild(label);
        li.appendChild(badge); li.appendChild(link);
        ol.appendChild(li);
      });
      card.appendChild(ol);

      var foot = document.createElement('div');
      foot.className = 'ws-path-card-foot';
      var bar = document.createElement('div');
      bar.className = 'ws-path-bar';
      var fill = document.createElement('div');
      fill.className = 'ws-path-bar-fill';
      fill.style.width = pct + '%';
      bar.appendChild(fill);
      var status = document.createElement('span');
      status.className = 'ws-path-status';
      if (pct === 100 && total > 0) {
        var cert = document.createElement('a');
        var ids = [];
        path.levels.forEach(function(l){ (l.workshops || []).forEach(function(x){ ids.push(x); }); });
        var cname = '';
        try { cname = localStorage.getItem('jvds-player-name') || ''; } catch (e) { cname = ''; }
        cert.href = '../tools/certificate.html?path=' + encodeURIComponent(path.id) + '&items=' + encodeURIComponent(ids.join(',')) + (cname ? '&name=' + encodeURIComponent(cname) : '');
        cert.className = 'ws-path-cert-link';
        cert.textContent = '🏆 Get your ' + (path.certificate || 'certificate');
        status.textContent = finished + ' of ' + total + ' done · ';
        status.appendChild(cert);
      } else {
        status.textContent = finished ? finished + ' of ' + total + ' done' : path.certificate || '';
      }
      foot.appendChild(bar); foot.appendChild(status);
      card.appendChild(foot);

      fragment.appendChild(card);
    });
    grid.replaceChildren(fragment);
  }
  function start() {
    fetch('../content/paths.json', { cache: 'no-store' })
    .then(function(r){ return r.json(); })
    .then(function(paths){
      if (!Array.isArray(paths) || !paths.length) throw new Error('empty');
      render(paths);
    })
    .catch(function(){
      grid.replaceChildren();
      var p = document.createElement('p');
      p.className = 'ws-paths-loading';
      p.textContent = 'Learning paths are unavailable right now. Browse the workshops below instead.';
      grid.appendChild(p);
    });
  }
  // Wait for player-profile.js so progress badges are correct on first paint.
  var started = false;
  function startOnce() { if (started) return; started = true; start(); }
  if (typeof playerProfile !== 'undefined') { startOnce(); }
  else {
    window.addEventListener('load', startOnce);
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(startOnce, 0); });
  }
})();
