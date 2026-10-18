/* Redirect stub for the retired Arcade cover page.
   Old links look like /games/play.html?g=nova-siege. The arcade now links
   straight to game files, so forward the old link to the real file (or back
   to the arcade when the id is unknown). */
(function () {
  'use strict';

  var id = null;
  try {
    id = new URLSearchParams(location.search).get('g');
  } catch (e) {
    var m = /[?&]g=([^&]+)/.exec(location.search);
    id = m ? decodeURIComponent(m[1]) : null;
  }

  var games = window.JVDS_GAMES || [];
  var game = null;
  for (var i = 0; i < games.length; i++) {
    if (games[i].id === id) { game = games[i]; break; }
  }

  location.replace(game && game.file ? game.file : '../arcade.html');
})();
