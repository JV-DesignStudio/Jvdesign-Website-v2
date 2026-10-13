(function(){
  var eps=[
    {id:'prog-obby',      key:'jvds-roblox-obby-v2',      total:8},
    {id:'prog-tycoon',    key:'jvds-roblox-tycoon-v2',     total:10},
    {id:'prog-simulator', key:'jvds-roblox-simulator-v2',  total:11},
    {id:'prog-battle',    key:'jvds-roblox-battle-v2',     total:12},
    {id:'prog-horror',    key:'jvds-roblox-horror-v2',     total:11},
    {id:'prog-adventure', key:'jvds-roblox-adventure-v2',  total:14},
    {id:'prog-pirate',    key:'jvds-roblox-pirate-v2',     total:7},
    {id:'prog-creator',   key:'jvds-roblox-creator-journey-v2', total:6}
  ];
  var bonus=[
    {id:'prog-collapse',   key:'jvds-roblox-collapse-v2',   total:10},
    {id:'prog-corruption', key:'jvds-roblox-corruption-v1', total:8},
    {id:'prog-simlockdown1', key:'jvds-roblox-sim-lockdown-1-v1', total:6},
    {id:'prog-simlockdown2', key:'jvds-roblox-sim-lockdown-2-v1', total:6},
    {id:'prog-simlockdown3', key:'jvds-roblox-sim-lockdown-3-v1', total:6}
  ];
  function paint(list){
    var complete=0;
    list.forEach(function(ep){
      try{
        var data=JSON.parse(localStorage.getItem(ep.key)||'null');
        var el=document.getElementById(ep.id);
        if(!el||!data||!data.completed||!data.completed.length)return;
        var tot=data.total||ep.total;
        var n=data.completed.length;
        if(n>=tot){complete++;el.textContent='✅ Complete!';el.classList.add('has-progress','ep-done');}
        else{el.textContent='🔄 '+n+'/'+tot+' steps';el.classList.add('has-progress');}
      }catch(e){}
    });
    return complete;
  }
  var seriesDone=paint(eps);
  paint(bonus);
  var sb=document.getElementById('series-progress-bar');
  if(sb){sb.textContent=seriesDone+' / '+eps.length+' episodes complete';if(seriesDone>0)sb.style.opacity='1';}
})();
