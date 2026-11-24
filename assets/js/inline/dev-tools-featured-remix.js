(function(){
  fetch('/tools/featured-games.json').then(function(r){return r.ok?r.json():null;}).then(function(games){
    if(!Array.isArray(games)||!games.length)return;
    var idx=Math.floor(Date.now()/864e5)%games.length;
    var g=games[idx];
    var sec=document.getElementById('featuredRemix');
    if(!sec)return;
    var title=sec.querySelector('#featuredRemixTitle');
    var desc=sec.querySelector('.featured-remix__desc');
    var play=sec.querySelector('[data-remix-play]');
    var go=sec.querySelector('[data-remix-go]');
    if(title)title.textContent=g.title||'Remix this game';
    if(desc)desc.textContent='A '+((g.genre||'').toLowerCase()||'game')+' made in Arcade Game Maker. Load it, change something, make it yours.';
    if(play&&g.playUrl)play.href=g.playUrl;
    if(go&&g.remixUrl)go.href=g.remixUrl;
  }).catch(function(){});
})();
