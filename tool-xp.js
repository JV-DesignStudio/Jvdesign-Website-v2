/* ═══════════════════════════════════════════════════════════
   Tool XP, awards player-profile XP for using the dev tools.
   Include AFTER player-profile.js:
     <script src="../player-profile.js"></script>
     <script src="../tool-xp.js"></script>

   Awards (per tool, capped per day so they can't be farmed):
   - session  +10 XP  once/day, spent time creating in a tool
   - export   +25 XP  3×/day, downloaded/exported a creation
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
    } catch (e) { /* storage full/blocked, XP still awarded */ }
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

  // A2796: after a download, offer the one-tap "Take it home" path. Shared
  // school PCs can wipe localStorage, so this is the moment to keep a copy.
  function showTakeHome() {
    if (window.__jvdsTakeHome) return;
    window.__jvdsTakeHome = true;
    window.JVDS_TAKE_HOME_ARMED = true;
    try {
      if (sessionStorage.getItem('jvds_take_home_seen') === '1') return;
      sessionStorage.setItem('jvds_take_home_seen', '1');
    } catch (e) {}
    if (location.pathname === '/me.html' || !document.body) return;

    var wrap = document.createElement('div');
    wrap.id = 'jvds-take-home';
    wrap.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:99998;display:flex;align-items:center;gap:6px;padding:6px 6px 6px 14px;border-radius:999px;background:linear-gradient(135deg,#7c3aed,#5b21b6);box-shadow:0 8px 24px rgba(124,58,237,.42);';
    var link = document.createElement('a');
    link.href = '/me.html#keep';
    link.textContent = 'Take it home';
    link.style.cssText = 'color:#fff;font:800 .82rem/1.15 Nunito,Inter,sans-serif;text-decoration:none;white-space:nowrap;';
    link.addEventListener('click', disarmUnload, { once: true });
    var close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', 'Dismiss Take it home');
    close.textContent = '\u00d7';
    close.style.cssText = 'background:rgba(255,255,255,.18);border:0;color:#fff;border-radius:999px;width:22px;height:22px;font:700 .8rem/1 sans-serif;cursor:pointer;';
    close.addEventListener('click', function () {
      wrap.remove();
      disarmUnload();
    });
    wrap.appendChild(link);
    wrap.appendChild(close);
    document.body.appendChild(wrap);

    if (!navigator.webdriver) {
      window.addEventListener('beforeunload', unloadGuard);
    }
  }
  function unloadGuard(e) {
    if (!window.JVDS_TAKE_HOME_ARMED) return;
    e.preventDefault();
    e.returnValue = '';
  }
  function disarmUnload() {
    window.JVDS_TAKE_HOME_ARMED = false;
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
      // Quest progress counts every real export/session, even after today's
      // XP cap is reached, so a capped learner can still finish a tool quest.
      trackQuestProgress(action);
      if (!underCap(action, maxPerDay)) return false;
      bumpCap(action);
      var result = playerProfile.addXP(xp, 'tool:' + TOOL_ID + ':' + action);
      showXPToast('+' + xp + ' XP, ' + (label || action));
      if (result && result.levelUp) {
        setTimeout(function () { showXPToast('🎉 Level ' + result.newLevel + '!'); }, 1200);
      }
      return true;
    }
  };

  // Offline-first tool quests (e.g. "Design a Pixel Character for Pip"):
  // persist per-tool export/session counts, then complete any quest tied to
  // this tool. questSystem is a top-level const from quest-system.js, so it
  // is not on window; check it by name.
  function trackQuestProgress(action) {
    if (action !== 'export' && action !== 'session') return;
    try {
      if (action === 'export') {
        var ek = 'jvds_tool_export_' + TOOL_ID;
        localStorage.setItem(ek, String(parseInt(localStorage.getItem(ek) || '0', 10) + 1));
      } else {
        localStorage.setItem('jvds_tool_session_' + TOOL_ID, '1');
      }
    } catch (e) { return; }
    if (typeof questSystem === 'undefined') return;
    questSystem.getAllQuests().forEach(function (quest) {
      var forThisTool = (quest.requirements || []).some(function (r) {
        return (r.type === 'tool-export' || r.type === 'tool-session') && r.toolId === TOOL_ID;
      });
      if (!forThisTool) return;
      var awarded = questSystem.awardQuest(quest.id, playerProfile);
      if (!awarded) return;
      var rw = awarded.rewards || {};
      // Toasts share one screen position: wait for the export XP toast and any
      // level-up toast (starts at 1.2s, lasts ~2.6s) to clear first.
      setTimeout(function () { showXPToast((rw.badge || awarded.title) + ' unlocked! +' + (rw.xp || 0) + ' XP'); }, 4000);
      try { document.dispatchEvent(new CustomEvent('jvds:quest-awarded', { detail: { questId: awarded.id } })); } catch (e) {}
    });
  }
  window.ToolXP = ToolXP;

  // ── Session XP: they opened a tool and stayed a little while ──
  setTimeout(function () {
    ToolXP.award('session', 10, 1, 'Creating in ' + TOOL_ID.replace(/-/g, ' '));
  }, 15000);

  // ── Export XP: catch programmatic downloads (a[download].click()) ──
  var origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.hasAttribute && this.hasAttribute('download')) {
      setTimeout(function () { ToolXP.award('export', 25, 3, 'Creation exported!'); showTakeHome(); }, 60);
    }
    return origClick.apply(this, arguments);
  };

  // ── Export XP: real user clicks on download links ──
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
    if (a) { ToolXP.award('export', 25, 3, 'Creation exported!'); showTakeHome(); }
  });

  // ── A289 Mobile touch handling: prevent scroll trap on canvases and add touch->mouse fallback for tools that only listen for mouse ──
  (function(){
    function isCanvasTarget(el){ return !!el.closest('canvas, #preview-wrap, #canvas-area, .canvas-area, #app'); }
    // Block page pan/zoom when interacting directly on a canvas viewport
    document.addEventListener('touchmove', function(e){
      if(isCanvasTarget(e.target)){
        if(e.cancelable) e.preventDefault();
      }
    }, {passive:false});
    document.addEventListener('touchstart', function(e){
      if(isCanvasTarget(e.target)){
        // Mark last touch for synthetic mouse suppression in tools that already handle it
        try{ window._lastTouch = Date.now(); }catch(_){}
      }
    }, {passive:false});
    // For canvases that only have mousedown/mousemove, synthesize equivalents from touch so drawing works with one finger
    function synthMouse(type, touch, target){
      var evt = new MouseEvent(type, {bubbles:true,cancelable:true,clientX:touch.clientX,clientY:touch.clientY,buttons:1});
      target.dispatchEvent(evt);
    }
    function bindFallback(canvas){
      if(canvas._touchFallbackBound) return;
      canvas._touchFallbackBound = true;
      canvas.addEventListener('touchstart', function(e){
        if(e.touches.length!==1) return;
        if(e.cancelable) e.preventDefault();
        synthMouse('mousedown', e.touches[0], e.target);
      }, {passive:false});
      canvas.addEventListener('touchmove', function(e){
        if(e.touches.length!==1) return;
        if(e.cancelable) e.preventDefault();
        synthMouse('mousemove', e.touches[0], e.target);
      }, {passive:false});
      canvas.addEventListener('touchend', function(e){
        if(e.cancelable) e.preventDefault();
        var t = (e.changedTouches && e.changedTouches[0]) || null;
        if(t) synthMouse('mouseup', t, e.target);
      }, {passive:false});
    }
    function scan(){
      // Tools that already have full touch handling - don't double-bind
      if(['pixel-studio','bitmap-font-maker','level-designer','particle-designer','arcade-game-maker','buildlab'].indexOf(TOOL_ID)!==-1) return;
      document.querySelectorAll('canvas').forEach(function(c){
        if(c._touchFallbackBound) return;
        bindFallback(c);
      });
    }
    if(document.readyState !== 'loading') scan();
    else document.addEventListener('DOMContentLoaded', scan);
    // Re-scan after dynamic canvas creation (e.g., tileset builder)
    try{
      var obs = new MutationObserver(function(muts){
        muts.forEach(function(m){
          m.addedNodes.forEach(function(n){
            if(n.tagName==='CANVAS') bindFallback(n);
            if(n.querySelectorAll) n.querySelectorAll('canvas').forEach(bindFallback);
          });
        });
      });
      obs.observe(document.documentElement, {childList:true, subtree:true});
    }catch(_){}
  })();
})();
