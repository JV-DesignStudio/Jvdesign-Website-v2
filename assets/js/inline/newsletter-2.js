(function() {
  var grid = document.getElementById('devlogPreview');
  if (!grid || typeof POSTS === 'undefined' || !POSTS.length) return;
  var tagClass = {books:'tag-books',games:'tag-games',life:'tag-life',process:'tag-process',update:'tag-update'};
  var tagLabel = {books:'\u{1F4DA} Books',games:'\u{1F3AE} Games',life:'☀️ Life',process:'\u{1F3A8} Process',update:'\u{1F4E2} Update'};
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  var months = {january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11};
  function postTime(post){
    var m = String(post.date||'').match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
    return m ? Date.UTC(Number(m[3]), months[m[2].toLowerCase()] || 0, Number(m[1])) : 0;
  }
  var newest = POSTS.slice().sort(function(a,b){ return postTime(b) - postTime(a) || (Number(b.id)||0) - (Number(a.id)||0); });
  newest.slice(0,3).forEach(function(post){
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
