/* ═══════════════════════════════════════════════════════════
   Tool XP — awards player-profile XP for using the dev tools.
   Include AFTER player-profile.js:
     <script src="../player-profile.js"></script>
     <script src="../tool-xp.js"></script>

   Awards (per tool, capped per day so they can't be farmed):
   - session  +10 XP  once/day   — spent time creating in a tool
   - export   +25 XP  3×/day     — downloaded/exported a creation
   Tools can also call ToolXP.award(action, xp, maxPerDay, label)
   for their own milestones (e.g. saving a build).
   ═══════════════════════════════════════════════════════════ */
(function () {
  if (typeof playerProfile === 'undefined') return;

  var TOOL_ID = (location.pathname.split('/').pop() || 'tool').replace(/\.html$/, '');
  var CAP_PREFIX = 'jvds_toolxp_';
  var CAP_KEY = CAP_PREFIX + new Date().toDateString();

  function capData() {
    try { return JSON.parse(localStorage.getItem(CAP_KEY) || '{}'); }
    catch (e) { return {}; }
  }

  function bumpCap(action) {
    var d = capData();
    d[TOOL_ID + ':' + action] = (d[TOOL_ID + ':' + action] || 0) + 1;
    try {
      // Prune cap records from previous days
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var k = localStorage.key(i);
        if (k && k.indexOf(CAP_PREFIX) === 0 && k !== CAP_KEY) localStorage.removeItem(k);
      }
      localStorage.setItem(CAP_KEY, JSON.stringify(d));
    } catch (e) { /* storage full/blocked — XP still awarded */ }
  }

  function underCap(action, max) {
    return (capData()[TOOL_ID + ':' + action] || 0) < max;
  }

  function showXPToast(text) {
    var t = document.createElement('div');
    t.className = 'jvds-xp-toast';
    t.textContent = text;
    t.style.cssText =
      'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(16px);' +
      'background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;' +
      'padding:10px 22px;border-radius:999px;font:700 .85rem/1.2 Nunito,Inter,sans-serif;' +
      'box-shadow:0 8px 24px rgba(124,58,237,.45);z-index:99999;pointer-events:none;' +
      'opacity:0;transition:opacity .3s,transform .3s;';
    document.body.appendChild(t);
    requestAnimationFrame(function () {
      t.style.opacity = '1';
      t.style.transform = 'translateX(-50%) translateY(0)';
    });
    setTimeout(function () {
      t.style.opacity = '0';
      t.style.transform = 'translateX(-50%) translateY(16px)';
      setTimeout(function () { t.remove(); }, 350);
    }, 2600);
  }

  var _lastAward = {};
  var ToolXP = {
    toolId: TOOL_ID,
    award: function (action, xp, maxPerDay, label) {
      maxPerDay = maxPerDay || 3;
      // Cooldown: dedupe double-fires (e.g. a download triggering both the
      // prototype hook and the click listener, or multi-file exports)
      var now = Date.now();
      if (now - (_lastAward[action] || 0) < 1500) return false;
      _lastAward[action] = now;
      if (!underCap(action, maxPerDay)) return false;
      bumpCap(action);
      var result = playerProfile.addXP(xp, 'tool:' + TOOL_ID + ':' + action);
      showXPToast('+' + xp + ' XP — ' + (label || action));
      if (result && result.levelUp) {
        setTimeout(function () { showXPToast('🎉 Level ' + result.newLevel + '!'); }, 1200);
      }
      return true;
    }
  };
  window.ToolXP = ToolXP;

  // ── Session XP: they opened a tool and stayed a little while ──
  setTimeout(function () {
    ToolXP.award('session', 10, 1, 'Creating in ' + TOOL_ID.replace(/-/g, ' '));
  }, 15000);

  // ── Export XP: catch programmatic downloads (a[download].click()) ──
  var origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.hasAttribute && this.hasAttribute('download')) {
      setTimeout(function () { ToolXP.award('export', 25, 3, 'Creation exported!'); }, 60);
    }
    return origClick.apply(this, arguments);
  };

  // ── Export XP: real user clicks on download links ──
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
    if (a) ToolXP.award('export', 25, 3, 'Creation exported!');
  });
})();
