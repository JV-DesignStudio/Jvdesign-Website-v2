// Lumo reacts to filter button clicks
(function() {
  var tips = {
    'all':       "Hi, I'm Lumo! 👋 Browse everything , games, tools, 3D builders and more. Not sure where to start? Try the <strong>Scratch intro</strong> for coding basics, or the <strong>Rocket Builder</strong> for hands-on 3D fun.",
    'courses':   "Great choice! 📘 Courses walk you through a topic step by step , perfect for building a solid foundation. Start with <strong>Scratch for Beginners</strong> if you're new, or jump into <strong>Godot</strong> if you've coded before.",
    'builders':  "🚀 The 3D Builders section is one of my favourites! All 10 builders run right in your browser , no downloads, no accounts. <strong>New?</strong> Start with the Rocket Builder (17 steps). <strong>Got a 3D printer?</strong> Try the Phone Stand , it exports STL!",
    'tutorials': "🎮 Tutorials are short and focused , pick a skill, build something cool. Great if you already know a bit of coding and want to level up fast.",
    'games':     "🕹️ Game builders let you play what you make. Try <strong>Race Builder</strong> for a top-down racer or <strong>Security Shift</strong> for a survival challenge. Each one has a live game you can share.",
    'tools':     "🔧 Tools and utilities , helpful little apps built in the workshop. Dig in and see what clicks!",
  };
  document.addEventListener('DOMContentLoaded', function() {
    var tipEl = document.getElementById('lumo-tip-text');
    if (!tipEl) return;
    var defaultTip = tipEl.innerHTML;
    document.querySelectorAll('.ws-filter-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var fmt = btn.getAttribute('data-format') || 'all';
        tipEl.innerHTML = tips[fmt] || defaultTip;
      });
    });
  });
})();
