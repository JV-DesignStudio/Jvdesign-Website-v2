(function(){
  var btn=document.getElementById('jvdsNavToggle');
  var nav=document.getElementById('jvdsMobileNav');
  if(!btn||!nav)return;
  function o(){nav.classList.add('open');btn.textContent='?';}
  function c(){nav.classList.remove('open');btn.textContent='?';}
  btn.addEventListener('click',function(e){e.stopPropagation();nav.classList.contains('open')?c():o();});
  nav.querySelectorAll('a').forEach(function(a){a.addEventListener('click',c);});
  document.addEventListener('click',function(e){if(nav.classList.contains('open')&&!nav.contains(e.target)&&!btn.contains(e.target))c();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')c();});
})();
