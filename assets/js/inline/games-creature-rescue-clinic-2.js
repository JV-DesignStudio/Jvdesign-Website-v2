(function(){
  if(!window.AudioEffects)return;
  var a=new AudioEffects(0.5);
  try{if(localStorage.getItem('soundEnabled')==='false')a.setMasterVolume(0);}catch(e){}
  var armed=false;
  function arm(){armed=true;}
  window.addEventListener('pointerdown',arm,{passive:true});
  window.addEventListener('keydown',arm);
  window.JVDSAudio={armed:function(){return armed},tap:function(){if(armed)try{a.playTap()}catch(e){}},success:function(){if(armed)try{a.playSuccess()}catch(e){}},error:function(){if(armed)try{a.playError()}catch(e){}},pop:function(){if(armed)try{a.playPop()}catch(e){}}};
  if(window.GameSystem&&GameSystem.prototype&&!GameSystem.prototype.__jvdsAudioPatched){
    GameSystem.prototype.__jvdsAudioPatched=true;
    var orig=GameSystem.prototype.addScore;
    GameSystem.prototype.addScore=function(){try{window.JVDSAudio.success()}catch(e){}return orig.apply(this,arguments)};
  }
  document.addEventListener('click',function(e){if(armed&&e.target.closest('button,.btn,a')){try{a.playTap()}catch(err){}}},true);
})();
