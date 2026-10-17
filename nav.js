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
    document.addEventListener('keydown', function(e){ if(e.key==='Escape' && !(dd && dd.classList.contains('open'))) closeNav(); });
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
    document.addEventListener('keydown', function(e){ if(e.key==='Escape' && dd.classList.contains('open')){ setMore(false); moreBtn.focus(); } });
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
// Quick-switcher (A1632): press Ctrl/Cmd+K on any page to jump to a tool, game,
// workshop or page. Reuses /search-index.json; nothing loads until first open,
// and the plain /search link still works when JS is off.
(function(){
  var INDEX_URL = '/search-index.json';
  var MAX = 9;
  var entries = null, loadPromise = null, root = null, input = null, list = null;
  var results = [], active = -1, lastFocus = null;

  function makeTag(tag, cls, text){
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function injectStyles(){
    if (document.getElementById('jvds-switcher-styles')) return;
    var css = [
      '.jvds-switcher{position:fixed;inset:0;z-index:3000;display:none}',
      '.jvds-switcher[data-open="true"]{display:block}',
      '.jvds-switcher-backdrop{position:absolute;inset:0;background:rgba(20,16,10,.55)}',
      '.jvds-switcher-panel{position:relative;width:min(640px,calc(100% - 24px));margin:9vh auto 0;background:var(--card,#fff);color:var(--charcoal,#1a1208);border:1.5px solid var(--border,rgba(64,59,51,.14));border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.35);overflow:hidden}',
      '.jvds-switcher-input{display:block;width:100%;box-sizing:border-box;border:0;border-bottom:1.5px solid var(--border,rgba(64,59,51,.14));background:transparent;color:inherit;font:inherit;font-size:1.05rem;padding:16px 18px;outline:none}',
      '.jvds-switcher-list{list-style:none;margin:0;padding:6px;max-height:52vh;overflow:auto}',
      '.jvds-switcher-empty{padding:16px 18px;color:var(--charcoal-lt,#3d3224);font-size:.9rem}',
      '.jvds-switcher-option{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:10px;cursor:pointer}',
      '.jvds-switcher-option[aria-selected="true"],.jvds-switcher-option:hover{background:var(--teal-lt,#e8f2f3)}',
      '.jvds-switcher-option-title{font-weight:700}',
      '.jvds-switcher-option-url{font-size:.78rem;color:var(--teal-dk,#4e7d80);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.jvds-switcher-hint{margin:0;padding:8px 18px 12px;font-size:.75rem;color:var(--charcoal-lt,#3d3224);border-top:1.5px solid var(--border,rgba(64,59,51,.14))}',
      '.jvds-switcher-hint kbd{font-family:inherit;border:1px solid var(--border,rgba(64,59,51,.3));border-radius:5px;padding:1px 5px;font-size:.72rem}',
      '@media(max-width:520px){.jvds-switcher-panel{margin:0;width:100%;height:100%;border-radius:0;display:flex;flex-direction:column}.jvds-switcher-list{max-height:none;flex:1}}'
    ].join('');
    var s = document.createElement('style');
    s.id = 'jvds-switcher-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function build(){
    if (root) return;
    injectStyles();
    root = makeTag('div', 'jvds-switcher');
    root.setAttribute('data-open', 'false');
    root.innerHTML = '<div class="jvds-switcher-backdrop" data-jvds-close></div>' +
      '<div class="jvds-switcher-panel" role="dialog" aria-modal="true" aria-label="Search and jump to a page">' +
        '<input class="jvds-switcher-input" id="jvdsSwitcherInput" type="text" autocomplete="off" spellcheck="false" placeholder="Jump to a tool, game, workshop or page" aria-label="Search pages" aria-controls="jvdsSwitcherList" aria-expanded="true" role="combobox">' +
        '<ul class="jvds-switcher-list" id="jvdsSwitcherList" role="listbox" aria-label="Search results"></ul>' +
        '<p class="jvds-switcher-hint"><kbd>Enter</kbd> open &middot; <kbd>Esc</kbd> close &middot; <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>K</kbd></p>' +
      '</div>';
    document.body.appendChild(root);
    input = root.querySelector('#jvdsSwitcherInput');
    list = root.querySelector('#jvdsSwitcherList');
    root.querySelector('[data-jvds-close]').addEventListener('click', close);
    input.addEventListener('input', function(){ render(input.value); });
    input.addEventListener('keydown', onKey);
    list.addEventListener('mousemove', function(e){
      var li = e.target.closest ? e.target.closest('.jvds-switcher-option') : null;
      if (li) setActive(Array.prototype.indexOf.call(list.children, li));
    });
  }

  function onKey(e){
    if (e.key === 'ArrowDown'){ e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Enter'){ e.preventDefault(); choose(active); }
    else if (e.key === 'Escape'){ e.preventDefault(); close(); }
  }

  function load(){
    if (entries) return Promise.resolve(entries);
    if (loadPromise) return loadPromise;
    loadPromise = fetch(INDEX_URL, { credentials: 'same-origin' })
      .then(function(r){ if (!r.ok) throw new Error('index ' + r.status); return r.json(); })
      .then(function(data){
        var pages = (data && data.pages) || [];
        entries = pages.map(function(p){
          var u = String(p.url || '');
          if (u && !/^(https?:|\/)/.test(u)) u = '/' + u;
          return { url: u, title: p.title || p.url || '', desc: p.desc || '' };
        });
        return entries;
      })
      .catch(function(){ entries = []; return entries; });
    return loadPromise;
  }

  function score(entry, q){
    var t = entry.title.toLowerCase(), d = entry.desc.toLowerCase();
    if (t.indexOf(q) === 0) return 100;
    if (t.indexOf(q) !== -1) return 60;
    if (d.indexOf(q) !== -1) return 25;
    var parts = q.split(/\s+/).filter(Boolean);
    if (parts.length > 1 && parts.every(function(p){ return t.indexOf(p) !== -1 || d.indexOf(p) !== -1; })) return 15;
    return -1;
  }

  function render(q){
    if (!entries){
      list.innerHTML = '';
      list.appendChild(makeTag('li', 'jvds-switcher-empty', 'Loading...'));
      active = -1;
      return;
    }
    q = (q || '').trim().toLowerCase();
    var items;
    if (!q){
      items = entries.slice(0, MAX);
    } else {
      items = entries
        .map(function(e){ return { e: e, s: score(e, q) }; })
        .filter(function(x){ return x.s >= 0; })
        .sort(function(a, b){ return b.s - a.s || a.e.title.localeCompare(b.e.title); })
        .slice(0, MAX)
        .map(function(x){ return x.e; });
    }
    results = items;
    list.innerHTML = '';
    if (!items.length){
      list.appendChild(makeTag('li', 'jvds-switcher-empty', 'No pages match "' + q + '".'));
      active = -1;
      return;
    }
    items.forEach(function(e, i){
      var li = makeTag('li', 'jvds-switcher-option');
      li.setAttribute('role', 'option');
      li.setAttribute('id', 'jvdsSwitcherOption' + i);
      li.setAttribute('aria-selected', 'false');
      li.setAttribute('data-href', e.url);
      li.appendChild(makeTag('span', 'jvds-switcher-option-title', e.title));
      li.appendChild(makeTag('span', 'jvds-switcher-option-url', e.url.replace(/^\//, '')));
      li.addEventListener('click', function(){ window.location.href = e.url; });
      list.appendChild(li);
    });
    setActive(0);
  }

  function setActive(i){
    if (!results.length){ active = -1; return; }
    if (i < 0) i = results.length - 1;
    if (i >= results.length) i = 0;
    active = i;
    Array.prototype.forEach.call(list.children, function(li, idx){
      var on = idx === i;
      li.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on){ input.setAttribute('aria-activedescendant', li.id); li.scrollIntoView({ block: 'nearest' }); }
    });
  }

  function choose(i){
    if (i < 0 || !results[i]) return;
    window.location.href = results[i].url;
  }

  function open(){
    build();
    lastFocus = document.activeElement;
    root.setAttribute('data-open', 'true');
    input.value = '';
    input.setAttribute('aria-expanded', 'true');
    document.documentElement.style.overflow = 'hidden';
    input.focus();
    load().then(function(){ if (root.getAttribute('data-open') === 'true') render(input.value); });
    if (window.JVDS && window.JVDS.announce) window.JVDS.announce('Search opened. Type to find a page.');
  }

  function close(){
    if (!root) return;
    root.setAttribute('data-open', 'false');
    document.documentElement.style.overflow = '';
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch(e){} }
  }

  function isOpen(){ return !!(root && root.getAttribute('data-open') === 'true'); }

  document.addEventListener('keydown', function(e){
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'k' || e.key === 'K')){
      e.preventDefault();
      isOpen() ? close() : open();
    } else if (e.key === 'Escape' && isOpen()){
      close();
    }
  });

  window.JVDS = window.JVDS || {};
  window.JVDS.openSwitcher = open;
  window.JVDS.closeSwitcher = close;
})();
