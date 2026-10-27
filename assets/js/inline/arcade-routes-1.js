(function(){
  var btn = document.getElementById('arcRouteChar');
  var panel = document.getElementById('arcCharPick');
  if(!btn || !panel) return;
  btn.addEventListener('click', function(){
    var showing = !panel.hidden;
    panel.hidden = showing;
    panel.style.display = showing ? 'none' : '';
    btn.setAttribute('aria-expanded', showing ? 'false' : 'true');
    if(!showing) setTimeout(function(){ panel.querySelector('a').focus(); }, 0);
  });
})();
