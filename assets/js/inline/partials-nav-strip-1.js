(function(){
  function jvdsOpenStrip(){document.getElementById('jvdsStrip').classList.add('open');document.getElementById('jvdsTab').classList.add('hidden');}
  function jvdsCloseStrip(){document.getElementById('jvdsStrip').classList.remove('open');document.getElementById('jvdsTab').classList.remove('hidden');}
  window.jvdsOpenStrip=jvdsOpenStrip;
  window.jvdsCloseStrip=jvdsCloseStrip;
})();
