(function(){
  if(!window.IntersectionObserver) return;
  var links = document.querySelectorAll('.ws-jump-link[href^="#"]');
  if(!links.length) return;
  var linkMap = {};
  links.forEach(function(a){ linkMap[a.getAttribute('href').slice(1)] = a; });
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      var a = linkMap[e.target.id];
      if(!a) return;
      if(e.isIntersecting) a.classList.add('ws-jump-link--active');
      else a.classList.remove('ws-jump-link--active');
    });
  },{rootMargin:'-20% 0px -60% 0px'});
  Object.keys(linkMap).forEach(function(id){
    var el = document.getElementById(id);
    if(el) io.observe(el);
  });
})();
