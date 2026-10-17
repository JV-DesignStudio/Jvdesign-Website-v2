(function() {
  var grid = document.getElementById('devlogPreview');
  if (!grid || typeof POSTS === 'undefined' || !POSTS.length) return;
  var tagClass = {books:'tag-books',games:'tag-games',life:'tag-life',process:'tag-process',update:'tag-update'};
  var tagLabel = {books:'\u{1F4DA} Books',games:'\u{1F3AE} Games',life:'☀️ Life',process:'\u{1F3A8} Process',update:'\u{1F4E2} Update'};
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  POSTS.slice(0,3).forEach(function(post){
    var a=document.createElement('a');
    a.href='/devlog#post-'+esc(post.id);
    a.className='nl-devlog-card reveal';
    a.innerHTML=(post.image?'<img class="nl-devlog-thumb" src="'+esc(post.image)+'" alt="" loading="lazy">':'')
      +'<div class="nl-devlog-meta">'
      +'<span class="nl-devlog-tag '+(tagClass[post.tag]||'')+'">'+( tagLabel[post.tag]||esc(post.tag) )+'</span>'
      +'<span class="nl-devlog-date">'+esc(post.date)+'</span>'
      +'</div>'
      +'<div class="nl-devlog-title">'+(post.emoji?esc(post.emoji)+' ':'')+esc(post.title)+'</div>'
      +'<div class="nl-devlog-excerpt">'+esc(post.excerpt)+'</div>'
      +'<div class="nl-devlog-read">Read note →</div>';
    grid.appendChild(a);
  });
})();
