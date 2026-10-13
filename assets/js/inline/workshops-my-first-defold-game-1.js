(function(){
  var badges=[
    {id:'prog-pong',      key:'jvds-defold-pong-v2',       total:9},
    {id:'prog-snake',     key:'jvds-defold-snake-v2',      total:10},
    {id:'prog-dungeon',   key:'jvds-defold-dungeon-v2',    total:11},
    {id:'prog-shooter',   key:'jvds-defold-shooter-v2',    total:10},
    {id:'prog-puzzle',    key:'jvds-defold-puzzle-v2',     total:10},
    {id:'prog-platformer-defold',key:'jvds-defold-platformer-v2',total:12}
  ];
  badges.forEach(function(b){
    try{
      var data=JSON.parse(localStorage.getItem(b.key)||'null');
      var done=(data&&data.completed)?data.completed.length:0;
      var el=document.getElementById(b.id);
      if(el&&done>0){el.textContent=done+'/'+b.total+' steps';el.style.background='rgba(76,175,80,.18)';el.style.color='#81c784';}
    }catch(e){}
  });
})();
