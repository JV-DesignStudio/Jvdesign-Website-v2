(function(){
  var start=document.getElementById('citadelStart');
  var exit=document.getElementById('citadelExit');
  var frame=document.querySelector('.game-frame-wrap iframe');
  function play(){
    if(frame && !frame.getAttribute('src')) frame.setAttribute('src', frame.getAttribute('data-src'));
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
})();
