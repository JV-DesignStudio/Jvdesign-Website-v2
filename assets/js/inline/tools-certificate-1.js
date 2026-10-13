(function () {
var fObs = new IntersectionObserver(function(entries){
 entries.forEach(function(entry){
  if(entry.isIntersecting){
   var sibs=[].slice.call(entry.target.parentElement.querySelectorAll('.reveal'));
   var idx=sibs.indexOf(entry.target);
   setTimeout(function(){entry.target.classList.add('visible');},Math.min(idx*80,400));
   fObs.unobserve(entry.target);
  }
 });
},{threshold:0});
document.querySelectorAll('.reveal').forEach(function(el){fObs.observe(el);});
setTimeout(function(){document.querySelectorAll('.reveal:not(.visible)').forEach(function(el){el.classList.add('visible');});},2000);
})();
