// nav.js , site header: announce, theme, active link, hamburger, more dropdown, profile chip
window.JVDS = window.JVDS || {};
window.JVDS.announce = (function(){
  var queue = [], busy = false, TTL = 3000;
  function next(){
    if (!queue.length) { busy = false; return; }
    busy = true;
    var el = document.getElementById('jvds-announce');
    if (!el) { busy = false; setTimeout(next, 100); return; }
    var msg = queue.shift();
    el.textContent = '';
    setTimeout(function(){
      el.textContent = String(msg);
      setTimeout(function(){
        if (el.textContent === String(msg)) el.textContent = '';
        busy = false;
        next();
      }, TTL);
    }, 60);
  }
  return function(msg){
    if (!msg) return;
    queue.push(String(msg));
    if (!busy) next();
  };
})();
(function(){
  // Safe localStorage wrapper - on locked-down school computers storage may throw.
  var store = {
    get: function(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
    set: function(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
  };
  // Theme
  if (store.get('jvds-theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  var b = document.getElementById('themeToggle');
  if (b) {
    function paint(){ b.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀' : '☾'; }
    b.addEventListener('click', function(){
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (dark) {
        document.documentElement.removeAttribute('data-theme');
        store.set('jvds-theme', 'light');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        store.set('jvds-theme', 'dark');
      }
      paint();
    });
    paint();
  }
  // Active link + aria-current
  var seg = location.pathname.split('/').pop() || 'index.html';
  var page = seg.replace(/\.html$/, '');
  document.querySelectorAll('.main-nav .nav-link[data-page]').forEach(function(a){
    var pages = (a.getAttribute('data-page')||'').split(/\s+/);
    if(pages.indexOf(page) !== -1) { a.classList.add('active'); a.setAttribute('aria-current','page'); }
  });
  if(!document.querySelector('.main-nav .nav-link.active')){
    var section = /\/tools\//.test(location.pathname) ? 'dev-tools'
                : /\/workshops\//.test(location.pathname) ? 'workshop'
                : /\/games\//.test(location.pathname) ? 'games'
                : /\/books\//.test(location.pathname) ? 'books' : null;
    if(section) document.querySelectorAll('.main-nav .nav-link[data-page]').forEach(function(a){
      if((a.getAttribute('data-page')||'').split(/\s+/).indexOf(section)!==-1) { a.classList.add('active'); a.setAttribute('aria-current','page'); }
    });
  }
  // Hamburger
  var btn = document.getElementById('navToggle');
  var nav = document.getElementById('mainNav');
  if (btn && nav) {
    function openNav() { nav.classList.add('open'); btn.textContent = '✕'; btn.setAttribute('aria-label','Close menu'); btn.setAttribute('aria-expanded','true'); }
    function closeNav() { nav.classList.remove('open'); btn.textContent = '☰'; btn.setAttribute('aria-label','Open menu'); btn.setAttribute('aria-expanded','false'); }
    btn.addEventListener('click', function(e){ e.stopPropagation(); nav.classList.contains('open') ? closeNav() : openNav(); });
    nav.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', closeNav); });
    document.addEventListener('click', function(e){ if(nav.classList.contains('open') && !nav.contains(e.target) && !btn.contains(e.target) && !e.target.closest('.nav-dropdown')) closeNav(); });
    document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeNav(); });
  }
  // More dropdown
  var moreBtn = document.getElementById('moreDropdownBtn');
  var dd = moreBtn ? moreBtn.closest('.nav-dropdown') : null;
  if(moreBtn && dd){
    function setMore(open){ dd.classList.toggle('open', open); moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
    moreBtn.addEventListener('click', function(e){
      e.preventDefault();
      setMore(!dd.classList.contains('open'));
    });
    moreBtn.addEventListener('keydown', function(e){
      if(e.key==='Enter' || e.key===' '){ e.preventDefault(); setMore(!dd.classList.contains('open')); }
      if(e.key==='Escape'){ setMore(false); moreBtn.focus(); }
      if(e.key==='ArrowDown' || e.key==='ArrowUp'){
        e.preventDefault();
        var items=dd.querySelectorAll('.nav-dropdown-menu a');
        if(!items.length) return;
        var idx=Array.from(items).indexOf(document.activeElement);
        if(e.key==='ArrowDown'){ idx=idx<items.length-1?idx+1:0; }
        else { idx=idx>0?idx-1:items.length-1; }
        items[idx].focus();
      }
      if(e.key==='Home'){ e.preventDefault(); var first=dd.querySelector('.nav-dropdown-menu a'); if(first) first.focus(); }
      if(e.key==='End'){ e.preventDefault(); var items=dd.querySelectorAll('.nav-dropdown-menu a'); if(items.length) items[items.length-1].focus(); }
    });
    dd.querySelectorAll('.nav-dropdown-menu a').forEach(function(a){
      a.addEventListener('click', function(){ setMore(false); });
    });
    document.addEventListener('click', function(e){ if(!dd.contains(e.target)) setMore(false); });
    document.addEventListener('keydown', function(e){ if(e.key==='Escape') setMore(false); });
  }
  // Profile chip
  try {
    // The real profile is jvds_profile (player-profile.js); the other two names are legacy (A256)
    var p = JSON.parse(store.get('jvds_profile') || store.get('jvds-profile') || store.get('jvds_player_profile') || 'null');
    var xp=0,lv=1,st=0;
    if(p){ xp=p.globalXP||p.xp||p.totalXP||0; lv=p.level||Math.floor(xp/100)+1||1; st=p.dailyStreak||p.streak||p.bestStreak||0; }
    else { xp=parseInt(store.get('jvds_xp')||'0',10)||0; lv=Math.floor(xp/100)+1; st=parseInt(store.get('jvds_streak')||'0',10)||0; }
    var chip = document.getElementById('navProfileChip');
    if(chip){
      chip.style.display='flex';
      document.getElementById('navProfileLevel').textContent='Lv '+lv;
      document.getElementById('navProfileStreak').textContent=st;
      var xpInLevel = xp - (lv-1)*100;
      var xpLabel = 'Level '+lv+' - '+xpInLevel+' / 100 XP to level '+(lv+1)+'. Streak: '+st+' days. View your profile.';
      chip.setAttribute('aria-label', xpLabel);
      chip.setAttribute('title', xpLabel);
    }
  } catch(e){}
})();
