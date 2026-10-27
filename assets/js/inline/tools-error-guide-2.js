// ══════════════════════════════════════
// ENGINE TABS + SEARCH (single source of truth)
// ══════════════════════════════════════
var tabs = Array.prototype.slice.call(document.querySelectorAll('.engine-tab'));
var sections = Array.prototype.slice.call(document.querySelectorAll('.engine-section'));
var searchInput = document.getElementById('searchInput');
var searchCount = document.getElementById('searchCount');
var noResults = document.getElementById('noResults');
var noResultsTerm = document.getElementById('noResultsTerm');

function resetCards(){
  document.querySelectorAll('.error-card').forEach(function(c){ c.classList.remove('hidden'); });
  if(noResults) noResults.hidden = true;
}

function setActiveTab(engine){
  tabs.forEach(function(t){
    var on = t.getAttribute('data-engine') === engine;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
    t.setAttribute('tabindex', on ? '0' : '-1');
  });
}

// Show exactly one engine section, leaving no stale inline display/visible state.
function showEngine(engine){
  setActiveTab(engine);
  sections.forEach(function(s){
    s.style.display = '';
    s.classList.toggle('visible', s.id === 'engine-' + engine);
  });
  if(searchInput) searchInput.value = '';
  if(searchCount) searchCount.textContent = '';
  resetCards();
}

function clearSearch(){
  var active = document.querySelector('.engine-tab.active');
  showEngine(active ? active.getAttribute('data-engine') : 'scratch');
  if(searchInput) searchInput.focus();
}

tabs.forEach(function(tab, i){
  tab.addEventListener('click', function(){ showEngine(tab.getAttribute('data-engine')); });
  tab.addEventListener('keydown', function(e){
    var next = null;
    if(e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % tabs.length;
    else if(e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + tabs.length) % tabs.length;
    else if(e.key === 'Home') next = 0;
    else if(e.key === 'End') next = tabs.length - 1;
    if(next !== null){
      e.preventDefault();
      tabs[next].focus();
      showEngine(tabs[next].getAttribute('data-engine'));
    }
  });
});

if(searchInput){
  searchInput.addEventListener('input', function(){
    var q = this.value.toLowerCase().trim();
    if(!q){
      var active = document.querySelector('.engine-tab.active') || tabs[0];
      showEngine(active.getAttribute('data-engine'));
      return;
    }
    // Searching shows every engine section, then filters the cards.
    sections.forEach(function(s){ s.style.display = ''; s.classList.add('visible'); });
    var found = 0;
    document.querySelectorAll('.error-card').forEach(function(card){
      var text = (card.textContent + ' ' + (card.dataset.keywords || '')).toLowerCase();
      var hit = text.indexOf(q) !== -1;
      card.classList.toggle('hidden', !hit);
      if(hit) found++;
    });
    searchCount.textContent = found + ' error' + (found === 1 ? '' : 's') + ' found';
    if(noResults){
      if(noResultsTerm) noResultsTerm.textContent = this.value.trim();
      noResults.hidden = found !== 0;
    }
  });
  searchInput.addEventListener('keydown', function(e){
    if(e.key === 'Escape') clearSearch();
  });
}

var noResultsClear = document.getElementById('noResultsClear');
if(noResultsClear) noResultsClear.addEventListener('click', clearSearch);

// ── Quick-find chips: click a chip → fill search and trigger ──
document.querySelectorAll('.qf-chip').forEach(function(chip){
  chip.addEventListener('click', function(){
    var q = chip.getAttribute('data-search') || chip.textContent.trim();
    if(searchInput){
      searchInput.value = q;
      searchInput.dispatchEvent(new Event('input'));
      searchInput.focus();
    }
  });
});

// ── Badge counts derive from the DOM ──
sections.forEach(function(s){
  var badge = s.querySelector('.engine-badge');
  if(!badge) return;
  var n = s.querySelectorAll('.error-card').length;
  badge.textContent = n + ' Error' + (n === 1 ? '' : 's');
});

// ── Copy to clipboard ──
function flashCopied(el){
  if(!el) return;
  el.classList.add('copied');
  setTimeout(function(){ el.classList.remove('copied'); }, 1200);
}
function legacyCopy(text, done){
  try{
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy');
    document.body.removeChild(ta); done();
  }catch(e){}
}
function copyText(text, el, label){
  var done = function(){
    if(el && label){
      var old = el.textContent;
      el.textContent = 'Copied!';
      flashCopied(el);
      setTimeout(function(){ el.textContent = old; }, 1200);
    } else {
      flashCopied(el);
    }
  };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(done).catch(function(){ legacyCopy(text, done); });
  } else {
    legacyCopy(text, done);
  }
}

// Per-card "Copy fix" button.
document.querySelectorAll('.error-card').forEach(function(card){
  var title = card.querySelector('.error-title');
  if(!title || title.querySelector('.card-copy')) return;
  var heading = (title.textContent || '').trim();
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'card-copy';
  btn.textContent = 'Copy fix';
  btn.setAttribute('aria-label', 'Copy this fix to the clipboard');
  btn.addEventListener('click', function(){
    var steps = Array.prototype.map.call(card.querySelectorAll('.solution-steps li'), function(li){
      return li.textContent.replace(/\s+/g, ' ').trim();
    });
    var text = heading + '\n\n' + steps.map(function(s, i){ return (i + 1) + '. ' + s; }).join('\n');
    copyText(text, btn, true);
  });
  title.appendChild(btn);
});

// Click any code snippet to copy it.
document.querySelectorAll('.error-card code').forEach(function(code){
  code.classList.add('copyable');
  code.setAttribute('title', 'Click to copy');
  code.addEventListener('click', function(){ copyText(code.textContent, code, false); });
});
