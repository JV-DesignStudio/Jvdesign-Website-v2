(function(){
  var qs=location.search, hash=location.hash;
  var target='pixel-studio.html'+qs+hash;
  // preserve #art= share links coming from Easy Pixel Art
  setTimeout(function(){ location.replace(target); }, 900);
})();
