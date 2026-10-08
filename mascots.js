// ── MASCOT CONFIG ──
var MASCOT_CFG = {
  lumo:     { name:'Lumo',     img:'/assets/mascots/lumo.jpg',     color:'#7C6CF0', pillar:'Learn' },
  ember:    { name:'Ember',    img:'/assets/mascots/ember.jpg',    color:'#F2637A', pillar:'Create' },
  play:     { name:'Echo & Pip', img:'/assets/mascots/echo.jpg',  color:'#2EB5A5', pillar:'Play', img2:'/assets/mascots/pip-hero.webp' },
  stardust: { name:'Stardust', img:'/assets/mascots/stardust-hero.webp', color:'#FFD23C', pillar:'Read' },
};
function getGuide(){ try{ return localStorage.getItem('jvds_guide'); }catch(e){ return null; } }
function setGuide(id){
  try{
    localStorage.setItem('jvds_guide', id);
    // GA4 , guide affinity (quick-win analytics)
    try{ if(window.gtag) gtag('event','guide_choose', {guide:id}); }catch(e){}
    try{ if(window.ga4Analytics && ga4Analytics.track) ga4Analytics.track('guide_choose', {guide:id}); }catch(e){}
    try{ if(window.JVDSAnalytics) JVDSAnalytics.guide = id; }catch(e){}
  }catch(e){}
}
// ── CHARACTER QUOTES ── canonical library for the whole crew.
// One source for hero bubbles, companion tips, the site-wide quote strip,
// pages/quotes.html and the five character pages. Voice notes: Stardust
// wonders, Lumo explains kindly, Ember experiments, Pip plays, Echo reflects.
// Keep lines short, in JVDS voice, and free of em-dashes.
var JVDS_QUOTES = {
  stardust: {
    name:'Stardust', pillar:'Imagine', role:'The Dream Spirit',
    img:'/assets/mascots/stardust-hero.webp', badge:'/assets/mascots/stardust-badge.webp', color:'#FFC733',
    lines:[
      "Wherever someone needs hope, I appear.",
      "Every big idea starts as a tiny spark.",
      "Wonder is the first step to making something real.",
      "A dream is just an idea waiting for you.",
      "Look up. There is always room for one more star.",
      "You do not need the whole plan. Start with a flicker.",
      "Made from dreams, kindness and tiny pieces of stars.",
      "The best stories begin with a 'what if'."
    ]
  },
  lumo: {
    name:'Lumo', pillar:'Learn', role:'The Purple Fox',
    img:'/assets/mascots/lumo-hero.webp', badge:'/assets/mascots/lumo-badge.webp', color:'#7C6CF0',
    lines:[
      "You do not have to know it yet. That is why we learn.",
      "Small steps, done kindly, add up fast.",
      "A tricky thing is just a thing you have not met your way yet.",
      "Curiosity is not a distraction. It is the whole point.",
      "Ask the question. The answer can wait.",
      "Nobody starts as an expert. Everyone starts as a beginner.",
      "It is okay to go slowly if you keep going.",
      "Psst. Let's learn something brilliant together!"
    ]
  },
  ember: {
    name:'Ember', pillar:'Create', role:'The Pink Tiger',
    img:'/assets/mascots/ember-hero.webp', badge:'/assets/mascots/ember-badge.webp', color:'#F2637A',
    lines:[
      "Creative has no limits.",
      "Start messy. Perfect can come later.",
      "Your idea counts, even before it works.",
      "Make the thing only you would make.",
      "Try it. If it breaks, that is a clue.",
      "This is your studio. Make it yours!",
      "Make something today that did not exist yesterday.",
      "No wrong answers, just wild experiments."
    ]
  },
  pip: {
    name:'Pip', pillar:'Play', role:'The Little Turtle',
    img:'/assets/mascots/pip-hero.webp', badge:'/assets/mascots/pip-badge.webp', color:'#7AC74F',
    lines:[
      "There is no wrong way to play.",
      "Try again. Games are for trying.",
      "Slow and steady still wins the fun.",
      "One more go. You are closer than you think.",
      "The best way to understand a game is to play it.",
      "Little and brave beats big and bored.",
      "Adventure is just curiosity with muddy boots.",
      "Two players? Twice the chaos!"
    ]
  },
  echo: {
    name:'Echo', pillar:'Improve', role:'The Axolotl Explorer',
    img:'/assets/mascots/echo-hero.webp', badge:'/assets/mascots/echo-badge.webp', color:'#2EB5A5',
    lines:[
      "What would you change next time?",
      "Finished is good. A little better is great.",
      "Look back kindly, then take one step forward.",
      "Every version teaches the next one.",
      "You improved just by noticing.",
      "The first try is brave. The next try is wiser.",
      "One more run? I want to see what you improve.",
      "Progress is quiet. Keep listening for it."
    ]
  }
};

// Derive the legacy bubble lines from the canonical library so every existing
// [data-mascot-bubble] and companion tip gets the richer set automatically.
// `play` stays for the existing Echo + Pip duo key.
var MASCOT_LINES = {
  lumo:     JVDS_QUOTES.lumo.lines,
  ember:    JVDS_QUOTES.ember.lines,
  stardust: JVDS_QUOTES.stardust.lines,
  play:     JVDS_QUOTES.pip.lines.concat(JVDS_QUOTES.echo.lines),
  pip:      JVDS_QUOTES.pip.lines,
  echo:     JVDS_QUOTES.echo.lines
};

function jvdsQuoteKeys(){ return ['stardust','lumo','ember','pip','echo']; }
function jvdsQuoteKey(){
  var g = getGuide();
  if (g === 'play') g = Math.random() < .5 ? 'pip' : 'echo';
  if (g && JVDS_QUOTES[g]) return g;
  var keys = jvdsQuoteKeys();
  return keys[Math.floor(Math.random()*keys.length)];
}
function jvdsPickLine(key){ var q=JVDS_QUOTES[key]; return q ? q.lines[Math.floor(Math.random()*q.lines.length)] : ''; }
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-mascot-bubble]').forEach(el => {
    const key = el.getAttribute('data-mascot-bubble');
    const lines = MASCOT_LINES[key];
    if (lines) el.textContent = lines[Math.floor(Math.random()*lines.length)];
  });

  // ── Workshop coach marks (Lumo for scratch/learn, Ember for tools/build) ──
  const path = location.pathname.toLowerCase();
  const isWorkshop = path.includes('/workshops/') || path.includes('/workshop');
  const isTool = path.includes('/tools/');
  if (isWorkshop || isTool){
    const coachHost = document.querySelector('.page-hero, .hero, #main-content, main');
    if (coachHost && !document.querySelector('.mascot-coach')){
      const isScratchLike = path.includes('scratch') || path.includes('tiny-learners') || path.includes('learning-lab');
      const mascot = isScratchLike ? 'lumo' : (isTool ? 'ember' : 'lumo');
      const img = mascot==='ember' ? '/assets/mascots/ember.jpg' : '/assets/mascots/lumo.jpg';
      const name = mascot==='ember' ? 'Ember' : 'Lumo';
      const line = mascot==='ember'
        ? "Need a hand? Try me , I love happy accidents. Hit the tool, tweak a knob, and see what happens."
        : "Psst , follow me step by step. Tap the blocks, try it your way, no wrong answers.";
      const coach = document.createElement('div');
      coach.className = 'mascot-coach' + (isTool ? ' mascot-coach--tool' : '');
      coach.style.setProperty('--mascot-accent', mascot==='ember' ? 'var(--mascot-ember)' : 'var(--mascot-lumo)');
      coach.innerHTML = `<img src="${img}" alt="${name}"><div class="mascot-coach-body"><strong>${name} says:</strong> ${line}</div><button class="mascot-coach-dismiss" aria-label="Dismiss">Got it</button>`;
      coachHost.insertAdjacentElement('afterend', coach);
      coach.querySelector('.mascot-coach-dismiss').addEventListener('click', () => {
        coach.remove();
        try{ localStorage.setItem('jvds_mascot_coach_dismissed','1'); }catch(e){}
      });
      try{ if(localStorage.getItem('jvds_mascot_coach_dismissed')) coach.style.display='none'; }catch(e){}
    }
  }

  // ── Empty / filtered states , mascot helpers (already baked into HTML; observer is fallback) ──
  const searchEmpty = document.getElementById('emptyState') || document.getElementById('searchEmpty') || document.querySelector('[data-search-empty]');
  if (searchEmpty && !searchEmpty.querySelector('.mascot-empty')){
    // already patched in HTML, but ensure observer keeps it if dynamically shown
  }
  const gamesEmpty = document.getElementById('gameFilterEmpty');
  // observers kept for any future filtered tool pages

  // ── Quest authorship chips (quest-board + me) ──
  document.querySelectorAll('.quest-card, .quest-item, [data-quest-card]').forEach(card=>{
    if(card.querySelector('.mascot-quest-by')) return;
    const txt = (card.textContent||'').toLowerCase();
    let m='stardust', label='Stardust', img='/assets/mascots/stardust-hero.webp';
    if (txt.includes('learn')||txt.includes('workshop')||txt.includes('scratch')||txt.includes('tiny')){ m='lumo'; label='Lumo · Learn'; img='/assets/mascots/lumo.jpg'; }
    else if (txt.includes('tool')||txt.includes('pixel')||txt.includes('build')||txt.includes('create')||txt.includes('sprite')||txt.includes('audio')){ m='ember'; label='Ember · Create'; img='/assets/mascots/ember.jpg'; }
    else if (txt.includes('play')||txt.includes('game')||txt.includes('arcade')||txt.includes('score')){ m='play'; label='Echo & Pip · Play'; img='/assets/mascots/echo.jpg'; }
    const chip=document.createElement('div');
    chip.className='mascot-quest-by';
    chip.innerHTML=`<img src="${img}" alt="" loading="lazy"><span>${label}</span>`;
    const title = card.querySelector('h3, h4, .quest-title');
    if(title) title.insertAdjacentElement('afterend', chip);
    else card.prepend(chip);
  });

  // ── CHOOSE YOUR GUIDE quiz (home) ──
  if (location.pathname==='/' || location.pathname.endsWith('index.html')){
    if (!getGuide()){
      setTimeout(showGuideQuiz, 900);
    } else {
      personalizeHome();
    }
  }

  // ── Persistent companion (workshop / tool pages) ──
  if (isWorkshop || isTool){
    const guide=getGuide()|| (isTool ? 'ember' : 'lumo');
    const cfg=MASCOT_CFG[guide] || MASCOT_CFG.lumo;
    addCompanion(cfg);
  }

  // ── Level-up celebration hook ──
  try{
    const origSet = localStorage.setItem;
    // Also watch tool-xp and player-profile via storage + custom event
    window.addEventListener('jvds_level_up', e=>{
      showCelebration(e.detail || {mascot:'stardust', title:'Level up!', text:'You earned it ✨'});
    });
    // Intercept XP writes from existing scripts (poll fallback)
    let lastXP=parseInt(localStorage.getItem('jvds_xp')||'0',10);
    setInterval(()=>{
      const cur=parseInt(localStorage.getItem('jvds_xp')||'0',10);
      if(cur> lastXP){ showCelebration({mascot: getGuide()||'stardust', title:'Level up!', text:`${cur-lastXP} XP , keep going!`}); }
      lastXP=cur;
    }, 3000);
  }catch(e){}

  // ── Easter egg: type "lumo" ──
  let eggBuf='';
  document.addEventListener('keydown', e=>{
    eggBuf=(eggBuf+e.key.toLowerCase()).slice(-8);
    if(eggBuf.endsWith('lumo')){
      showCelebration({mascot:'play', title:'Crew Assemble! ✨', text:'Lumo · Ember · Echo · Pip · Stardust , together!'});
      eggBuf='';
    }
  });

  // ── Ask Lumo / Ember , search persona ──
  const searchInput=document.getElementById('searchInput');
  if(searchInput){
    const g=getGuide();
    const persona = g==='ember' ? {name:'Ember', ph:'Ask Ember , try “pixel art” or “make a beat”…'} :
                    g==='play' ? {name:'Echo & Pip', ph:'Ask Echo & Pip , try “cozy game” or “arcade”…'} :
                    g==='stardust' ? {name:'Stardust', ph:'Ask Stardust , try “Lumo” or “belonging”…'} :
                    {name:'Lumo', ph:'Ask Lumo , try “fox” or “resilience”…'};
    // Only override if still default placeholder
    if(searchInput.placeholder.includes('fox') || searchInput.placeholder.includes('Try:')){
      searchInput.placeholder = persona.ph;
    }
    // Add tiny mascot avatar inside search box (via CSS pseudo, but JS fallback)
    const box=document.querySelector('.search-box');
    if(box && !box.querySelector('.mascot-search-avatar')){
      const av=document.createElement('img');
      av.className='mascot-search-avatar';
      av.src = g==='ember' ? '/assets/mascots/ember.jpg' : g==='play' ? '/assets/mascots/echo.jpg' : g==='stardust' ? '/assets/mascots/stardust-hero.webp' : '/assets/mascots/lumo.jpg';
      av.alt=''; av.style.cssText='width:22px;height:22px;border-radius:50%;border:1px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.12);margin-right:6px;flex-shrink:0;object-fit:cover;background:#fff';
      av.loading='lazy';
      box.insertBefore(av, box.firstChild);
    }
  }

  // ── Certificate signing , tools/certificate.html gets mascot signature ──
  if (location.pathname.includes('certificate')){
    const certHost=document.querySelector('.cert-preview, .certificate, main');
    if(certHost){
      const g=getGuide()||'stardust';
      const cfg=MASCOT_CFG[g]||MASCOT_CFG.stardust;
      // Inject small signed line if not present
      if(!document.querySelector('.mascot-cert-sign')){
        const sig=document.createElement('div');
        sig.className='mascot-cert-sign';
        sig.style.cssText='display:flex;gap:8px;align-items:center;justify-content:center;margin:12px 0 0;font-size:.82rem;color:var(--charcoal-lt)';
        sig.innerHTML=`<img src="${cfg.img}" alt="" style="width:28px;height:28px;border-radius:50%;border:1px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.1);object-fit:cover;background:#fff"> Signed with ✨ by ${cfg.name} , ${cfg.pillar}`;
        certHost.appendChild(sig);
      }
    }
  }

  // ── Loader mascots (replace .loader / .spinner) ──
  document.querySelectorAll('.loader, .spinner, [data-loader]').forEach(el=>{
    if(el.querySelector('.mascot-loader')) return;
    const kind = el.dataset.mascot || (Math.random()<.5 ? 'stardust' : 'pip');
    const img = kind==='pip' ? '/assets/mascots/pip-hero.webp' : '/assets/mascots/stardust-hero.webp';
    const wrap=document.createElement('div');
    wrap.className='mascot-loader mascot-loader--'+kind;
    wrap.innerHTML=`<img src="${img}" alt="" loading="lazy"><span>Loading…</span>`;
    el.innerHTML=''; el.appendChild(wrap);
  });

  // ── Character quotes: site-wide strip + reusable cards ──
  injectQuoteStrip();
  document.querySelectorAll('[data-quote-grid]').forEach(renderQuoteGrid);
  document.querySelectorAll('[data-quote-character]').forEach(renderCharacterQuotes);
  document.querySelectorAll('[data-quote-filter]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('[data-quote-filter]').forEach(b=>b.classList.toggle('is-active', b===btn));
      document.querySelectorAll('[data-quote-grid]').forEach(g=>{
        g.setAttribute('data-quote-grid', btn.getAttribute('data-quote-filter')||'');
        renderQuoteGrid(g);
      });
    });
  });
});

function showGuideQuiz(){
  const bd=document.createElement('div');
  bd.className='mascot-quiz-backdrop';
  bd.innerHTML=`
    <div class="mascot-quiz-card mascot-quiz-reveal" role="dialog" aria-labelledby="quizTitle quizQ" aria-modal="true">
      <div class="mascot-quiz-crew" aria-hidden="true"><img src="/assets/mascots/lumo.jpg" alt=""><img src="/assets/mascots/ember.jpg" alt=""><img src="/assets/mascots/echo.jpg" alt=""><img src="/assets/mascots/pip-hero.webp" alt=""><img src="/assets/mascots/stardust-hero.webp" alt=""></div>
      <h2 id="quizTitle" class="mascot-quiz-title" style="font-family:Fredoka,sans-serif;font-size:1.15rem;margin:10px 0 4px;color:var(--charcoal)">Find your creative guide</h2>
      <p class="mascot-quiz-context" style="font-size:.82rem;color:var(--charcoal-lt);margin:0 0 10px;line-height:1.4">3 quick picks - we will match you with Lumo, Ember, Echo and Pip or Stardust and personalize your homepage.</p>
      <div class="mascot-quiz-progress" aria-live="polite">Question <span id="quizStep">1</span> of 3</div>
      <div class="mascot-quiz-q" id="quizQ" role="heading" aria-level="3"></div>
      <div class="mascot-quiz-opts" id="quizOpts"></div>
      <button class="mascot-quiz-skip" id="quizSkip">Skip , let me explore</button>
    </div>`;
  document.body.appendChild(bd);
  const qs=[
    {q:"What sounds most fun right now?", opts:[
      {t:"Exploring a mystery forest", m:'lumo', img:'/assets/mascots/lumo.jpg'},
      {t:"Building something wild", m:'ember', img:'/assets/mascots/ember.jpg'},
      {t:"Playing with friends", m:'play', img:'/assets/mascots/echo.jpg'},
      {t:"Snuggling with a cozy story", m:'stardust', img:'/assets/mascots/stardust-hero.webp'},
    ]},
    {q:"How do you like to learn?", opts:[
      {t:"Try it and see what happens", m:'play', img:'/assets/mascots/pip-hero.webp'},
      {t:"Follow steps one by one", m:'lumo', img:'/assets/mascots/lumo.jpg'},
      {t:"Make it look and sound perfect", m:'ember', img:'/assets/mascots/ember.jpg'},
      {t:"Feel it in a story", m:'stardust', img:'/assets/mascots/stardust-hero.webp'},
    ]},
    {q:"Pick a superpower!", opts:[
      {t:"Curiosity , always asking why", m:'lumo', img:'/assets/mascots/lumo.jpg'},
      {t:"Creation , turning ideas real", m:'ember', img:'/assets/mascots/ember.jpg'},
      {t:"Playfulness , joy is power", m:'play', img:'/assets/mascots/echo.jpg'},
      {t:"Wonder , tiny stars, big dreams", m:'stardust', img:'/assets/mascots/stardust-hero.webp'},
    ]},
  ];
  let idx=0, votes={lumo:0,ember:0,play:0,stardust:0};
  function render(){
    bd.querySelector('#quizStep').textContent=idx+1;
    bd.querySelector('#quizQ').textContent=qs[idx].q;
    const box=bd.querySelector('#quizOpts'); box.innerHTML='';
    qs[idx].opts.forEach(o=>{
      const b=document.createElement('button');
      b.className='mascot-quiz-opt';
      b.innerHTML=`<img src="${o.img}" alt=""><span>${o.t}</span>`;
      b.addEventListener('click', ()=>{ votes[o.m]=(votes[o.m]||0)+1; idx++; if(idx<qs.length) render(); else finish(); });
      box.appendChild(b);
    });
  }
  function finish(){
    let best='lumo', max=-1; Object.entries(votes).forEach(([k,v])=>{ if(v>max){max=v;best=k;} });
    setGuide(best);
    bd.innerHTML=`
      <div class="mascot-quiz-card mascot-quiz-reveal" style="text-align:center">
        <img src="${MASCOT_CFG[best].img}" alt="" style="width:92px;height:92px;border-radius:50%;border:3px solid #fff;box-shadow:0 6px 20px rgba(0,0,0,.14);object-fit:cover;background:#fff;margin-bottom:10px">
        <h3 style="font-family:Fredoka,sans-serif;margin:6px 0 4px">${MASCOT_CFG[best].name} is your guide! ✨</h3>
        <p style="font-size:.88rem;color:var(--charcoal-lt);margin-bottom:14px">${best==='lumo'?'Lumo will nudge you toward the next workshop.':best==='ember'?'Ember will point you at the perfect tool.':best==='play'?'Echo & Pip will save your next game.':'Stardust will light up your next story.'}</p>
        <button class="mascot-quiz-opt" style="justify-content:center" id="quizGo">Let's go →</button>
        <div style="margin-top:8px"><button class="mascot-quiz-skip" id="quizClose2">Close</button></div>
      </div>`;
    bd.querySelector('#quizGo').addEventListener('click', ()=>{ bd.remove(); personalizeHome(); });
    bd.querySelector('#quizClose2').addEventListener('click', ()=> bd.remove());
  }
  bd.querySelector('#quizSkip').addEventListener('click', ()=> bd.remove());
  bd.addEventListener('click', e=>{ if(e.target===bd) bd.remove(); });
  render();
}

function personalizeHome(){
  const guide=getGuide(); if(!guide) return;
  const paths=document.querySelectorAll('.studio-path');
  if(!paths.length) return;
  // Move guided path to front + highlight
  const order={lumo:0, play:1, ember:2, stardust:3};
  // If guide is stardust, highlight Read; otherwise highlight matched
  paths.forEach(p=>{
    const isMatch = (guide==='lumo' && p.classList.contains('path-learn')) ||
                    (guide==='stardust' && p.classList.contains('path-read')) ||
                    (guide==='ember' && p.classList.contains('path-create')) ||
                    (guide==='play' && p.classList.contains('path-play'));
    if(isMatch){ p.style.outline='2px solid '+MASCOT_CFG[guide].color; p.style.outlineOffset='2px'; }
  });
}

function addCompanion(cfg){
  const img=document.createElement('img');
  img.className='mascot-companion';
  img.src=cfg.img; img.alt=cfg.name; img.title=cfg.name+' , click for a tip';
  document.body.appendChild(img);
  let bubble=null, idleTimer=null;
  function showTip(text, ms=4200){
    if(bubble) bubble.remove();
    bubble=document.createElement('div');
    bubble.className='mascot-companion-bubble';
    bubble.textContent=text;
    document.body.appendChild(bubble);
    setTimeout(()=>{ if(bubble) bubble.remove(); bubble=null; }, ms);
  }
  img.addEventListener('click', ()=>{
    const tips=MASCOT_LINES[cfg.name.toLowerCase().includes('echo')?'play': cfg.name.toLowerCase()] || MASCOT_LINES.lumo;
    showTip(tips[Math.floor(Math.random()*tips.length)]);
  });
  function idle(){
    const sleepy=Math.random()<.5;
    img.style.filter = sleepy ? 'saturate(.85) brightness(.98)' : 'none';
    if(document.visibilityState==='visible' && !document.querySelector('.mascot-quiz-backdrop')){
      if(sleepy) showTip('Pssst , still there? Tap me if you need a nudge ✨', 3200);
    }
    scheduleIdle();
  }
  function scheduleIdle(){ clearTimeout(idleTimer); idleTimer=setTimeout(idle, 28000 + Math.random()*22000); }
  scheduleIdle();
  // React to scroll = little hop
  let lastY=window.scrollY;
  window.addEventListener('scroll', ()=>{
    const dy=window.scrollY - lastY; lastY=window.scrollY;
    if(Math.abs(dy)>40){ img.style.transform='scale(1.08) translateY(-4px)'; setTimeout(()=>img.style.transform='', 300); }
  }, {passive:true});
}

function showCelebration({mascot='stardust', title='You did it!', text='' }){
  const cfg=MASCOT_CFG[mascot] || MASCOT_CFG.stardust;
  const wrap=document.createElement('div');
  wrap.className='mascot-celebrate';
  wrap.innerHTML=`<div class="mascot-celebrate-card"><img src="${cfg.img}" alt="${cfg.name}"><h3 style="font-family:Fredoka,sans-serif;margin:6px 0 4px">${title}</h3><p style="font-size:.86rem;color:var(--charcoal-lt);margin:0">${text}</p></div>`;
  document.body.appendChild(wrap);
  wrap.addEventListener('click', ()=> wrap.remove());
  setTimeout(()=> wrap.remove(), 1800);
  try{ if(navigator.vibrate) navigator.vibrate(40); }catch(e){}
}

function injectEmptyMascot(host, kind, text){
  if(!host || host.querySelector('.mascot-empty')) return;
  const img = kind==='play' ? '/assets/mascots/echo.jpg' : kind==='lumo' ? '/assets/mascots/lumo.jpg' : '/assets/mascots/stardust-hero.webp';
  const wrap=document.createElement('div');
  wrap.className='mascot-empty mascot-empty--small';
  wrap.innerHTML=`<img src="${img}" alt="" loading="lazy"><div class="mascot-bubble mascot-bubble--light">${text}</div>`;
  host.prepend(wrap);
}

/* ── Character quotes: shared renderers ──
   Used by the site-wide strip, pages/quotes.html and the character pages. */
function injectQuoteStrip(){
  if(document.getElementById('jvds-quote-strip')) return;
  const path=location.pathname.toLowerCase();
  // Creator workspaces stay uncluttered: no strip on tools, games or arcade.
  if(path.includes('/tools/') || path.includes('/games/') || path.includes('/arcade') || path.includes('/quest-board')) return;
  const footer=document.querySelector('footer.site-footer') || document.querySelector('footer');
  if(!footer || !footer.parentNode) return;
  const strip=document.createElement('section');
  strip.id='jvds-quote-strip';
  strip.className='jvds-quote-strip';
  strip.setAttribute('aria-label','A word from the crew');
  function paint(key, animate){
    const q=JVDS_QUOTES[key]; if(!q) return;
    strip.innerHTML=
      '<img class="jvds-quote-strip-avatar" src="'+q.badge+'" alt="" width="44" height="44" loading="lazy">'+
      '<p class="jvds-quote-strip-text"><span class="jvds-quote-strip-name" style="color:'+q.color+'">'+q.name+'</span>'+
      '<span class="jvds-quote-strip-quote">&ldquo;'+jvdsPickLine(key)+'&rdquo;</span></p>'+
      '<button type="button" class="jvds-quote-strip-next" aria-label="Show another quote">Another &starf;</button>';
    if(animate){ strip.classList.remove('is-fresh'); void strip.offsetWidth; strip.classList.add('is-fresh'); }
    const btn=strip.querySelector('.jvds-quote-strip-next');
    if(btn) btn.addEventListener('click', ()=>{
      const others=jvdsQuoteKeys().filter(k=>k!==key);
      paint(others[Math.floor(Math.random()*others.length)], true);
    });
  }
  paint(jvdsQuoteKey(), false);
  footer.parentNode.insertBefore(strip, footer);
}

function quoteCard(key, line){
  const q=JVDS_QUOTES[key];
  const card=document.createElement('figure');
  card.className='jvds-quote-card';
  card.style.setProperty('--q', q.color);
  card.setAttribute('data-character', key);
  card.innerHTML=
    '<img src="'+q.badge+'" alt="" width="46" height="46" loading="lazy">'+
    '<figcaption><blockquote class="jvds-quote-text">&ldquo;'+line+'&rdquo;</blockquote>'+
    '<span class="jvds-quote-name">'+q.name+' &middot; '+q.pillar+'</span></figcaption>';
  return card;
}

function renderQuoteGrid(grid){
  const only=grid.getAttribute('data-quote-grid');
  grid.classList.add('jvds-quote-grid');
  const keys=(only && JVDS_QUOTES[only]) ? [only] : jvdsQuoteKeys();
  const frag=document.createDocumentFragment();
  keys.forEach(k=>{ JVDS_QUOTES[k].lines.forEach(line=> frag.appendChild(quoteCard(k, line))); });
  grid.innerHTML=''; grid.appendChild(frag);
}

function renderCharacterQuotes(host){
  const q=JVDS_QUOTES[host.getAttribute('data-quote-character')];
  if(!q) return;
  host.innerHTML='';
  q.lines.forEach(line=> host.appendChild(quoteCard(host.getAttribute('data-quote-character'), line)));
}
