(function(){
  var eps=[
    {id:'prog-racing',      key:'jvds-godot-racing-v2',     total:6},
    {id:'prog-mario',       key:'jvds-jump-jump-mario-v2',  total:12},
    {id:'prog-shooter',     key:'jvds-nuclear-throne-v2',   total:13},
    {id:'prog-survivors',   key:'jvds-fairy-survivors-v2',  total:12},
    {id:'prog-barrel',      key:'jvds-barrel-blast-v2',     total:12},
    {id:'prog-pixel',       key:'jvds-pixel-quest-v2',      total:12},
    {id:'prog-nightwatch',  key:'jvds-night-watch-v2',      total:6},
    {id:'prog-nightwatch2', key:'jvds-night-watch-p2-v2',   total:13},
    {id:'prog-nightwatch3', key:'jvds-night-watch-p3-v2',   total:11}
  ];
  var seriesDone=0,totalSteps=0;
  eps.forEach(function(ep){
    var total=ep.total,data=null;
    try{data=JSON.parse(localStorage.getItem(ep.key)||'null');}catch(e){}
    if(data&&data.total)total=data.total;
    totalSteps+=total;
    if(!data)return;
    var done=Array.isArray(data)?data.length:(data.completed?data.completed.length:0);
    if(!done)return;
    var el=document.getElementById(ep.id);
    if(!el)return;
    if(done>=total){seriesDone++;el.textContent='✅ Complete!';el.classList.add('has-progress','ep-done');}
    else{el.textContent='🔄 '+done+'/'+total+' steps';el.classList.add('has-progress');}
  });
  var sb=document.getElementById('series-progress-bar');
  if(sb){sb.textContent=seriesDone+' / '+eps.length+' episodes complete';if(seriesDone>0)sb.style.opacity='1';}
  var ss=document.getElementById('statSteps');
  if(ss)ss.textContent=totalSteps;
})();
