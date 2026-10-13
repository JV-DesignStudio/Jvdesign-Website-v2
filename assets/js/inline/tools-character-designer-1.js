(function(){
  var qs=location.search, hash=location.hash;
  var target='pixel-studio.html'+qs+hash;
  // preserve character share hash #char=... -> #char=
  setTimeout(function(){ location.replace(target); }, 900);
})();
