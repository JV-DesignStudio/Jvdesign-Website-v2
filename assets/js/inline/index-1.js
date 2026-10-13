(function(){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  function animateCount(el, target, suffix){
    var dur=800, start=performance.now();
    el.textContent='0'+(suffix||'');
    (function step(now){
      var t=Math.min((now-start)/dur,1);
      t=1-Math.pow(1-t,3);
      el.textContent=Math.round(t*target)+(suffix||'');
      if(t<1) requestAnimationFrame(step);
    })(start);
  }
  var obs=new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(!e.isIntersecting) return;
      var p=e.target;
      p.classList.add('counted');
      var num=p.querySelector('.hero-stat-num,.stat-num');
      if(!num||num.dataset.counted) return;
      num.dataset.counted='1';
      var raw=num.textContent.trim();
      var m=raw.match(/^(\d+)(\+?)$/);
      if(m) animateCount(num,parseInt(m[1],10),m[2]);
      obs.unobserve(p);
    });
  },{threshold:0.5});
  document.querySelectorAll('.hero-stat,.stat').forEach(function(el){obs.observe(el);});
})();
