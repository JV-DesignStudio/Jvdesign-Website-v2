var STORAGE_KEY = 'jvds-minecraft-lucky-v2';
var TOTAL = 12;
var completed = new Set();
function saveProgress(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({completed:[...completed],total:TOTAL,xp:completed.size*20,level:Math.floor(completed.size*20/100),bestStreak:0,totalQuizzes:0,correctFirst:0}));}catch(e){}}
function loadProgress(){try{var d=JSON.parse(localStorage.getItem(STORAGE_KEY));if(d&&d.completed){d.completed.forEach(function(s){completed.add(s);var card=document.getElementById('step-'+s);if(card){card.classList.add('completed');card.classList.remove('locked','active-step','open');var st=document.getElementById('status-'+s);if(st){st.textContent='Done ✓';st.className='step-status ss-done';}var dot=document.getElementById('dot-'+s);if(dot){dot.classList.remove('active');dot.classList.add('done');dot.textContent='✓';}}});var nxt=Math.max(...d.completed)+1;if(nxt<=TOTAL){var nc=document.getElementById('step-'+nxt);if(nc){nc.classList.remove('locked');nc.classList.add('open','active-step');var ns=document.getElementById('status-'+nxt);if(ns){ns.textContent='In Progress';ns.className='step-status ss-active';}var nd=document.getElementById('dot-'+nxt);if(nd)nd.classList.add('active');}};var pct=Math.round((completed.size/TOTAL)*100);document.getElementById('progressFill').style.width=pct+'%';document.getElementById('progressCount').textContent=completed.size+' / '+TOTAL+' Steps';}}catch(e){}}

function buildDots() {
  const wrap = document.getElementById('stepDots');
  for (let i = 1; i <= TOTAL; i++) {
    const d = document.createElement('div');
    d.className = 'step-dot' + (i === 1 ? ' active' : '');
    d.textContent = i;
    d.onclick = () => scrollToStep(i);
    d.id = 'dot-' + i;
    wrap.appendChild(d);
  }
}

function scrollToStep(n) {
  const el = document.getElementById('step-' + n);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function toggleStep(n) {
  const card = document.getElementById('step-' + n);
  if (card.classList.contains('locked')) return;
  card.classList.toggle('open');
}

function toggleCheck(el) {
  el.classList.toggle('checked');
  if (el.classList.contains('checked')) el.querySelector('.check-box').textContent = '✓';
  else el.querySelector('.check-box').textContent = '';
}

function completeStep(n) {
  completed.add(n);
  const card = document.getElementById('step-' + n);
  card.classList.remove('open', 'active-step');
  card.classList.add('completed');
  document.getElementById('status-' + n).textContent = 'Done ✓';
  document.getElementById('status-' + n).className = 'step-status ss-done';
  const dot = document.getElementById('dot-' + n);
  if (dot) { dot.classList.remove('active'); dot.classList.add('done'); dot.textContent = '✓'; }

  const pct = Math.round((completed.size / TOTAL) * 100);
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressCount').textContent = completed.size + ' / ' + TOTAL + ' Steps';

  if (n < TOTAL) {
    const next = document.getElementById('step-' + (n + 1));
    if (next) {
      next.classList.remove('locked');
      next.classList.add('open', 'active-step');
      document.getElementById('status-' + (n + 1)).textContent = 'In Progress';
      document.getElementById('status-' + (n + 1)).className = 'step-status ss-active';
      const nd = document.getElementById('dot-' + (n + 1));
      if (nd) nd.classList.add('active');
      setTimeout(() => next.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    }
  }

  if (completed.size === TOTAL) {
    document.getElementById('finishBanner').classList.add('show');
    setTimeout(() => document.getElementById('finishBanner').scrollIntoView({ behavior: 'smooth' }), 300);
  }
  saveProgress();
}

buildDots();loadProgress();
(function(){try{var n=completed.size,pc=document.getElementById("progressCount"),pf=document.getElementById("progressFill");if(pc)pc.textContent=n+" / "+TOTAL+" steps";if(pf)pf.style.width=(n/TOTAL*100)+"%";}catch(e){}})();
