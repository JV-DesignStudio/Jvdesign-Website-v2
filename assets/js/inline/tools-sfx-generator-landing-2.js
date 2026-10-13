(function(){
  var t=document.getElementById('toast'),tt;
  function toast(m){t.textContent=m;t.style.opacity=1;clearTimeout(tt);tt=setTimeout(function(){t.style.opacity=0;},2200);}
  var S='jvds_sfx_landing_seen';
  try{if(localStorage.getItem(S)==='1') return;}catch(e){}
  document.addEventListener('keydown',function(e){
    if(e.key==='?'&&!e.ctrlKey&&!e.metaKey){
      var tag=(e.target.tagName||'').toLowerCase();
      if(tag==='input'||tag==='textarea'||tag==='select') return;
      e.preventDefault();
      toast('🔊 Open SFX Studio to design sound effects →');
    }
  });
  try{localStorage.setItem(S,'1');}catch(e){}
})();
