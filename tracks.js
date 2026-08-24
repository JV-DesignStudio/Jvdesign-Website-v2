/* ═══════════════════════════════════════════════════════════
   JVDS Learning Tracks — shared data for guided learning paths.
   Mirrors the tracks shown on pages/learn-hub.html. Consumed by:
     - workshops/my-progress.html (certificate "next on your track")
     - workshop finish banners (e.g. scratch-catch-workshop.html)
   URLs are site-root-relative. Add new tracks here AND to learn-hub.
   ═══════════════════════════════════════════════════════════ */
(function () {
  var TRACKS = [
    {
      id: 'scratch-me',
      color: '#E8871E',
      icon: '🐱',
      title: 'Scratch & Me: Your First Game',
      steps: [
        { url: 'workshops/scratch-catch-workshop.html', name: 'Fruit Catch Game', type: 'workshop' },
        { url: 'games/echo_fruit_catch.html', name: "Echo's Fruit Catch", type: 'game' },
        { url: 'workshops/scratch-maze-workshop.html', name: 'Maze Game', type: 'workshop' },
        { url: 'workshops/scratch-platformer-workshop.html', name: 'Platformer Game', type: 'workshop' }
      ]
    },
    {
      id: 'godot-platformer',
      color: '#478CBF',
      icon: '🕹️',
      title: 'Godot: Build Your Own Platformer',
      steps: [
        { url: 'workshops/godot-racing-workshop.html', name: 'Racing Game Basics', type: 'workshop' },
        { url: 'games/sky_high_with_friends.html', name: 'Sky High With Friends', type: 'game' },
        { url: 'workshops/jump-jump-mario-workshop.html', name: 'Platformer with Jumping', type: 'workshop' }
      ]
    },
    {
      id: 'idle-empire',
      color: '#c47f00',
      icon: '🏰',
      title: 'Idle Empire: Build & Grow',
      steps: [
        { url: 'games/pips-bakery-empire.html', name: "Pip's Bakery Empire", type: 'game' },
        { url: 'games/cozy-cafe-match-game.html', name: 'Cozy Café Manager', type: 'game' }
      ]
    },
    {
      id: 'puzzle-masters',
      color: '#70A3A7',
      icon: '🧩',
      title: 'Puzzle Masters: Match & Solve',
      steps: [
        { url: 'games/pastry-match.html', name: 'Pastry Match', type: 'game' },
        { url: 'games/bread-blocks.html', name: 'Bread Blocks', type: 'game' },
        { url: 'games/dough-dash.html', name: 'Dough Dash', type: 'game' }
      ]
    },
    {
      id: 'story-adventure',
      color: '#6b4fa0',
      icon: '📖',
      title: 'Story & Adventure Games',
      steps: [
        { url: 'games/little_steps.html', name: 'Little Steps Adventure', type: 'game' }
      ]
    }
  ];

  function norm(u) { return String(u || '').replace(/^(\.\.\/)+/, '').replace(/^\/+/, '').toLowerCase(); }
  // Consumers pass either root-relative urls ('workshops/x.html') or bare
  // filenames ('x.html', as used by my-progress.html SERIES data) — compare
  // on the final path segment so both work.
  function samePage(a, b) {
    a = norm(a); b = norm(b);
    return a === b || a.endsWith('/' + b) || b.endsWith('/' + a);
  }

  // Find which track (if any) contains this page, and what comes next.
  // Returns: { track, index (0-based of current), next | null, total }
  // next = { url, name, type }. If the page isn't in a track, returns null.
  window.JVDS_trackPosition = function (pageUrl) {
    var target = norm(pageUrl);
    for (var t = 0; t < TRACKS.length; t++) {
      var track = TRACKS[t];
      for (var s = 0; s < track.steps.length; s++) {
        if (samePage(track.steps[s].url, target)) {
          return {
            track: track,
            index: s,
            total: track.steps.length,
            next: s + 1 < track.steps.length ? track.steps[s + 1] : null
          };
        }
      }
    }
    return null;
  };

  // Convenience: just the next step (or null).
  window.JVDS_nextTrackStep = function (pageUrl) {
    var pos = window.JVDS_trackPosition(pageUrl);
    return pos ? pos.next : null;
  };

  window.JVDS_TRACKS = TRACKS;
})();
