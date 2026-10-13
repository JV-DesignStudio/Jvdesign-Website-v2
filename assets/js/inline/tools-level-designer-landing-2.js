(function(){
  var t=document.getElementById('toast'),tt;
  function toast(m){t.textContent=m;t.style.opacity=1;clearTimeout(tt);tt=setTimeout(function(){t.style.opacity=0;},2200);}
  var S='jvds_level_landing_seen';
  document.addEventListener('keydown',function(e){
    if(e.key==='?'&&!e.ctrlKey&&!e.metaKey){
      var tag=(e.target.tagName||'').toLowerCase();
      if(tag==='input'||tag==='textarea'||tag==='select') return;
      e.preventDefault();
      toast('?? Open Level Designer to build 2D platformer levels →');
    }
  });
  try{if(localStorage.getItem(S)==='1') return;}catch(e){}
  try{localStorage.setItem(S,'1');}catch(e){}
})();
