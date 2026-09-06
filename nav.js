// nav.js — site header: announce, theme, active link, hamburger, learn dropdown, profile chip
window.JVDS = window.JVDS || {};
window.JVDS.announce = function (msg) {
  var el = document.getElementById('jvds-announce');
  if (!el || !msg) return;
  el.textContent = '';
  setTimeout(function () { el.textContent = String(msg); }, 60);
};
(function(){
  // Theme
  if (localStorage.getItem('jvds-theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  var b = document.getElementById('themeToggle');
  if (b) {
    function paint(){ b.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙'; }
    b.addEventListener('click', function(){
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (dark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('jvds-theme', 'light');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('jvds-theme', 'dark');
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
    nav.querySelectorAll('a').forEach(function(a){ if(a.id!=='learnDropdownBtn') a.addEventListener('click', closeNav); });
    document.addEventListener('click', function(e){ if(nav.classList.contains('open') && !nav.contains(e.target) && !btn.contains(e.target) && !e.target.closest('.nav-dropdown')) closeNav(); });
    document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeNav(); });
  }
  // Learn dropdown
  var learnBtn = document.getElementById('learnDropdownBtn');
  var dd = learnBtn ? learnBtn.closest('.nav-dropdown') : null;
  if(learnBtn && dd){
    function setLearn(open){ dd.classList.toggle('open', open); learnBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
    learnBtn.addEventListener('click', function(e){
      if(window.innerWidth > 1180 && !dd.classList.contains('open')){ e.preventDefault(); setLearn(true); }
      else if(dd.classList.contains('open')){ setLearn(false); }
    });
    learnBtn.addEventListener('keydown', function(e){
      if(e.key==='Enter' || e.key===' '){ e.preventDefault(); setLearn(!dd.classList.contains('open')); }
      if(e.key==='Escape'){ setLearn(false); learnBtn.focus(); }
    });
    document.addEventListener('click', function(e){ if(!dd.contains(e.target)) setLearn(false); });
    document.addEventListener('keydown', function(e){ if(e.key==='Escape') setLearn(false); });
  }
  // Profile chip
  try {
    var p = JSON.parse(localStorage.getItem('jvds-profile') || localStorage.getItem('jvds_player_profile') || 'null');
    var xp=0,lv=1,st=0;
    if(p){ xp=p.xp||p.totalXP||0; lv=p.level||Math.floor(xp/100)+1||1; st=p.streak||p.bestStreak||0; }
    else { xp=parseInt(localStorage.getItem('jvds_xp')||'0',10)||0; lv=Math.floor(xp/100)+1; st=parseInt(localStorage.getItem('jvds_streak')||'0',10)||0; }
    var chip = document.getElementById('navProfileChip');
    if(chip){ chip.style.display='flex'; document.getElementById('navProfileLevel').textContent='Lv '+lv; document.getElementById('navProfileStreak').textContent='🔥 '+st; }
  } catch(e){}
})();
