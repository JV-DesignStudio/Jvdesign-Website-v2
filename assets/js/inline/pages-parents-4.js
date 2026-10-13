/* ═══ FAQ Accordion ═══ */
document.querySelectorAll('.faq-q').forEach(function(btn){
  btn.addEventListener('click', function(){
    var item = btn.closest('.faq-item');
    var isOpen = item.classList.contains('open');
    /* close all others */
    document.querySelectorAll('.faq-item.open').forEach(function(openItem){
      if(openItem !== item) openItem.classList.remove('open');
    });
    item.classList.toggle('open', !isOpen);
    btn.setAttribute('aria-expanded', !isOpen);
  });
});

/* ═══ Scroll Reveal ═══ */
(function(){
  var obs = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){
        var siblings = Array.prototype.slice.call(e.target.parentElement.querySelectorAll('.reveal'));
        var idx = siblings.indexOf(e.target);
        setTimeout(function(){ e.target.classList.add('visible'); }, Math.min(idx * 80, 400));
        obs.unobserve(e.target);
      }
    });
  }, {threshold:.08});
  document.querySelectorAll('.reveal').forEach(function(el){ obs.observe(el); });
  setTimeout(function(){ document.querySelectorAll('.reveal:not(.visible)').forEach(function(el){ el.classList.add('visible'); }); }, 2000);
})();
