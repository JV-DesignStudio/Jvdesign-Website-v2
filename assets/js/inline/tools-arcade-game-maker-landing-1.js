(function(){
  var toastEl=document.getElementById('toast'),toastT;
  function toast(m){toastEl.textContent=m;toastEl.style.opacity=1;clearTimeout(toastT);toastT=setTimeout(function(){toastEl.style.opacity=0;},2200);}
  var SEEN='jvds_arcade_landing_seen';
  document.addEventListener('keydown',function(e){
    if(e.key==='?'&&!e.ctrlKey&&!e.metaKey){
      var tag=(e.target.tagName||'').toLowerCase();
      if(tag==='input'||tag==='textarea'||tag==='select') return;
      e.preventDefault();
      toast('🎮 Open Arcade Game Maker to build your game →');
    }
  });
  try{if(localStorage.getItem(SEEN)==='1') return;}catch(e){}
  try{localStorage.setItem(SEEN,'1');}catch(e){}
})();
