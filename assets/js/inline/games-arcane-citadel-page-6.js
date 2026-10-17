(function(){
  var start=document.getElementById('citadelStart');
  var exit=document.getElementById('citadelExit');
  var frame=document.querySelector('.game-frame-wrap iframe');
  var KEY='jvds_game_arcane-citadel_page';
  function progress(){ try{ return JSON.parse(localStorage.getItem(KEY)||'null')||{}; }catch(e){ return {}; } }
  function record(){
    var p=progress();
    p.lastPlayed=Date.now();
    p.plays=(p.plays||0)+1;
    try{ localStorage.setItem(KEY, JSON.stringify(p)); }catch(e){}
    try{ if(window.gameSystem && typeof gameSystem.recordGamePlay==='function') gameSystem.recordGamePlay(Date.now()); }catch(e){}
  }
  function when(t){
    var d=Math.floor((Date.now()-t)/86400000);
    if(d<=0) return 'today';
    if(d===1) return 'yesterday';
    return d+' days ago';
  }
  function showResume(){
    var p=progress();
    if(!p.lastPlayed) return;
    if(start) start.textContent='▶ Continue';
    var hint=document.getElementById('citadelResume');
    if(!hint){
      hint=document.createElement('p');
      hint.id='citadelResume';
      hint.setAttribute('role','status');
      hint.style.cssText='margin:12px 0 0;font-family:sans-serif;font-size:.85rem;color:rgba(233,221,255,.78)';
      if(start && start.parentNode) start.parentNode.insertBefore(hint, start.nextSibling);
    }
    hint.textContent='Welcome back! You last played '+when(p.lastPlayed)+'.';
  }
  function play(){
    if(frame && !frame.getAttribute('src')) frame.setAttribute('src', frame.getAttribute('data-src'));
    record();
    showResume();
    document.body.classList.add('citadel-playing');
    window.scrollTo(0,0);
    try{ var el=document.documentElement; if(el.requestFullscreen) el.requestFullscreen().catch(function(){}); }catch(e){}
  }
  function stop(){
    document.body.classList.remove('citadel-playing');
    try{ if(document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function(){}); }catch(e){}
  }
  if(start) start.addEventListener('click', play);
  if(exit) exit.addEventListener('click', stop);
  document.addEventListener('keydown', function(e){ if(e.key==='Escape' && document.body.classList.contains('citadel-playing')) stop(); });
  showResume();
  // Installed Arcade app / home-screen PWA: game-system.js marks <html> with
  // arc-appmode, and game-system.css hides .page-hero (which holds the Start
  // button). This page lazy-loads its iframe from data-src, so without a tap
  // the game never starts. Open straight into the game instead.
  if(document.documentElement.classList.contains('arc-appmode')) play();
})();
