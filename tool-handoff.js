/* tool-handoff.js - shared Workshop panel control + Send-to-Game-Maker hand-off (A673).
 *
 * The host page supplies the workshop DOM (overlay / iframe / tabs / badge) and
 * registers the functions that apply an imported asset per slot. Any tool can
 * send art to Game Maker by calling JVDSHandoff.sendToGameMaker(slot) and then
 * saving its output to the shared 'jvds_sprite_player' key. Game Maker routes it
 * to the chosen slot when the window regains focus.
 */
(function () {
  'use strict';

  var CFG = { overlay: 'wkOverlay', iframe: 'wkIframe', badge: 'wkBadge', splitBtn: 'wkSplitBtn', tabSelector: '.wk-tab' };
  var appliers = {}; // slot -> fn(dataUrl, label)

  function el(id) { return document.getElementById(id); }

  function openWorkshop(toolSrc) {
    var ov = el(CFG.overlay); if (ov) ov.classList.add('open');
    var btn = toolSrc
      ? document.querySelector(CFG.tabSelector + '[data-src="' + toolSrc + '"]')
      : document.querySelector(CFG.tabSelector);
    if (btn) switchWorkshopTool(btn);
  }

  function closeWorkshop() {
    var ov = el(CFG.overlay);
    if (ov) { ov.classList.remove('open'); ov.classList.remove('wk-split'); }
    var btn = el(CFG.splitBtn);
    if (btn) btn.textContent = '⇤ Side-by-side';
  }

  // Dock the Workshop to the right edge so the running game stays visible.
  function toggleWorkshopSplit() {
    var ov = el(CFG.overlay), btn = el(CFG.splitBtn);
    if (!ov) return;
    var on = ov.classList.toggle('wk-split');
    if (btn) btn.textContent = on ? '⇥ Fullscreen' : '⇤ Side-by-side';
  }

  function switchWorkshopTool(btn) {
    document.querySelectorAll(CFG.tabSelector).forEach(function (t) { t.classList.remove('on'); });
    if (!btn) return;
    btn.classList.add('on');
    var f = el(CFG.iframe);
    if (f) f.src = btn.dataset.src;
  }

  function showWorkshopBadge(msg) {
    var b = el(CFG.badge);
    if (!b) return;
    b.textContent = msg;
    b.classList.add('show');
    clearTimeout(b._to);
    b._to = setTimeout(function () { b.classList.remove('show'); }, 5000);
  }

  // Send-to-Game-Maker: mark the target slot, then save art to the shared key.
  var SLOTS = { player: 'Player', enemy: 'Enemy', bullet: 'Bullet', block: 'Tile/Block', bg: 'Background' };

  function sendToGameMaker(slot) {
    localStorage.setItem('jvds_import_slot', slot || 'player');
  }

  function routeImportedSprite(dataUrl, label) {
    var slot = localStorage.getItem('jvds_import_slot') || 'player';
    localStorage.removeItem('jvds_import_slot');
    var fn = appliers[slot] || appliers.player;
    if (fn) fn(dataUrl, label);
    return SLOTS[slot] || slot;
  }

  function register(map) { Object.assign(appliers, map || {}); }

  window.JVDSHandoff = {
    CONFIG: CFG,
    register: register,
    sendToGameMaker: sendToGameMaker,
    routeImportedSprite: routeImportedSprite,
    openWorkshop: openWorkshop,
    closeWorkshop: closeWorkshop,
    toggleWorkshopSplit: toggleWorkshopSplit,
    switchWorkshopTool: switchWorkshopTool,
    showWorkshopBadge: showWorkshopBadge
  };

  // Inline onclick handlers and existing page JS call these as globals.
  window.openWorkshop = openWorkshop;
  window.closeWorkshop = closeWorkshop;
  window.toggleWorkshopSplit = toggleWorkshopSplit;
  window.switchWorkshopTool = switchWorkshopTool;
  window.showWorkshopBadge = showWorkshopBadge;
})();
