(function(){
  function applyBadges(){
    document.querySelectorAll('.article-card[href]').forEach(function(card){
      var href = card.getAttribute('href') || '';
      var match = href.match(/\/?(workshops\/)?([^/]+)\.html$/);
      if(!match) return;
      var id = match[2];
      var thumb = card.querySelector('.article-thumb');
      if(!thumb || thumb.querySelector('.ws-card-done,.ws-card-progress')) return;
      try{
        var raw = localStorage.getItem('jvds-'+id);
        if(!raw) return;
        var data = JSON.parse(raw);
        var done = Array.isArray(data.completed) ? data.completed.length : 0;
        var total = data.total || 0;
        if(!total) return;
        thumb.style.position = 'relative';
        thumb.style.overflow = 'hidden';
        if(done >= total){
          var badge = document.createElement('span');
          badge.className = 'ws-card-done';
          badge.textContent = '✓ Done';
          thumb.appendChild(badge);
        } else if(done > 0){
          var bar = document.createElement('div');
          bar.className = 'ws-card-progress';
          var fill = document.createElement('div');
          fill.className = 'ws-card-progress-fill';
          fill.style.width = Math.round(done/total*100)+'%';
          fill.title = done+' of '+total+' steps done';
          bar.appendChild(fill);
          thumb.appendChild(bar);
        }
      }catch(e){}
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',applyBadges);
  else applyBadges();
})();
