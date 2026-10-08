/* creation-keepsake.js - a consistent "keep your creation" strip for JVDS tools.
 *
 * Pixel Studio already shows a local "My Creations" gallery. This module gives
 * the other curated create tools the same finish step in one shared place:
 * a small bar that reminds learners their work saves on this device and offers
 * a one-tap export so a shared school PC never loses it.
 *
 * It is loaded by creation-share.js on creator tools, so no page needs its own
 * copy. Exporting here flows through the same path as a manual export, so
 * tool-xp.js still awards export XP and records jvds_tool_export_<tool>.
 *
 * API: window.JVDSKeepsake = { exportNow(), tool }
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.top !== window.self) return;
  if (window.JVDSKeepsake) return;
  if (!/^\/tools\//.test(location.pathname)) return;

  var TOOL = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');

  /* Curated create tools. Pixel Studio draws its own strip and is skipped. */
  var KEEPERS = {
    'level-designer': 1, 'trading-card-designer': 1, 'colour-palette': 1,
    'particle-designer': 1, 'bitmap-font-maker': 1, 'sprite-animator': 1,
    'arcade-game-maker': 1, 'icon-generator': 1, 'sound-studio': 1,
    'gdd-builder': 1, 'story-editor': 1, 'code-snippet-generator': 1,
    'buildlab': 1
  };
  if (!KEEPERS[TOOL]) return;
  if (document.getElementById('keepsake-strip') || document.getElementById('jvds-keepsake-strip')) return;

  /* Preferred primary export when the tool exposes a global function. */
  var EXPORT_FN = {
    'level-designer': 'exportPNG',
    'trading-card-designer': 'exportPNG',
    'colour-palette': 'exportSwatchesImage',
    'bitmap-font-maker': 'exportPNG',
    'sprite-animator': 'exportGIF',
    'icon-generator': 'downloadAll',
    'sound-studio': 'exportWAV',
    'gdd-builder': 'exportPDF',
    'story-editor': 'exportScript',
    'code-snippet-generator': 'downloadMD'
  };

  var CSS = [
    '#jvds-keepsake-strip{position:fixed;left:16px;z-index:8999;display:flex;align-items:center;gap:10px;',
    'max-width:calc(100vw - 32px);box-sizing:border-box;background:#28241e;color:#f5efe0;',
    'border:1px solid rgba(240,234,214,.18);border-radius:12px;padding:9px 12px;',
    'font:600 .78rem/1.35 Inter,system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.32)}',
    '#jvds-keepsake-strip .jk-txt{display:flex;flex-direction:column;min-width:0}',
    '#jvds-keepsake-strip .jk-txt b{font-weight:800}',
    '#jvds-keepsake-strip .jk-sub{font-size:.68rem;color:#cbbf9f}',
    '#jk-keep-export{background:#4e7d80;color:#fff;border:none;border-radius:999px;padding:8px 14px;',
    'font:700 .78rem/1 Inter,system-ui,sans-serif;cursor:pointer;white-space:nowrap;box-shadow:0 2px 0 #3d6366}',
    '#jk-keep-export:hover{filter:brightness(1.08)}',
    '#jk-keep-export:focus-visible{outline:3px solid #BC4749;outline-offset:2px}',
    '#jk-keep-cert{color:#e7c98a;text-decoration:none;font-weight:700;white-space:nowrap}',
    '#jk-keep-cert:hover{text-decoration:underline}',
    '@media (max-width:560px){#jvds-keepsake-strip{padding:7px 10px;gap:8px}#jvds-keepsake-strip .jk-sub{display:none}}'
  ].join('');

  function toast(text) {
    var t = document.createElement('div');
    t.setAttribute('role', 'status');
    t.textContent = text;
    t.style.cssText = 'position:fixed;bottom:88px;left:16px;z-index:9002;max-width:280px;' +
      'background:#28241e;color:#f5efe0;border:1px solid rgba(240,234,214,.18);border-radius:10px;' +
      'padding:10px 14px;font:600 .8rem/1.4 Inter,system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.35);';
    document.body.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .3s'; t.style.opacity = '0';
      setTimeout(function () { t.remove(); }, 320);
    }, 2800);
  }

  function sig(el) {
    return ((el.getAttribute('onclick') || '') + ' ' + (el.getAttribute('download') || '') + ' ' +
      (el.getAttribute('href') || '') + ' ' + (el.getAttribute('title') || '') + ' ' +
      (el.textContent || '')).toLowerCase();
  }

  function score(s) {
    if (!/export|download|keep|save/.test(s)) return 0;
    var n = 0;
    if (/export ?game/.test(s)) n += 9;
    if (/export ?png|export ?image|\.png|image\/png/.test(s)) n += 8;
    if (/export ?(gif|sheet|spritesheet|frame)/.test(s)) n += 6;
    if (/export ?(project|pdf|wav|script|deck|gltf|obj|json|md|csv|xml|godot|unity)/.test(s)) n += 5;
    if (/\bdownload\b/.test(s)) n += 4;
    if (/\bexport\b/.test(s)) n += 4;
    if (/\bkeep\b/.test(s)) n += 3;
    return n;
  }

  function visible(el) {
    return !!(el.offsetParent || el.getClientRects().length);
  }

  /* Find the tool's own export control (inline handler, download link or button). */
  function pickExport() {
    var nodes = document.querySelectorAll('[onclick],a[download],button,a[role="button"]');
    var bestV = null, bestVS = 0, bestH = null, bestHS = 0;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.closest && el.closest('#jvds-keepsake-strip, #jvds-share-btn, #cookie-banner, nav, header, footer')) continue;
      var s = score(sig(el));
      if (!s) continue;
      if (visible(el)) { if (s > bestVS) { bestVS = s; bestV = el; } }
      else if (s > bestHS) { bestHS = s; bestH = el; }
    }
    return bestV || bestH;
  }

  function exportNow() {
    try { window.dispatchEvent(new CustomEvent('jvds:keepsake-export', { detail: { tool: TOOL } })); } catch (e) {}
    var done = false;
    if (typeof window.JVDSKeepsakeExport === 'function') {
      try { window.JVDSKeepsakeExport(); done = true; } catch (e) {}
    }
    if (!done) {
      var fn = EXPORT_FN[TOOL];
      if (fn && typeof window[fn] === 'function') {
        try { window[fn](); done = true; } catch (e) {}
      }
    }
    if (!done) {
      var el = pickExport();
      if (el) { try { el.click(); done = true; } catch (e) {} }
    }
    if (!done) {
      toast('Open the Export buttons in the tool to save your work to this device.');
      return false;
    }
    /* Belt and braces: award export XP even if the tool downloads without an <a download>. */
    setTimeout(function () {
      try { if (window.ToolXP && window.ToolXP.award) window.ToolXP.award('export', 25, 3, 'Creation exported!'); } catch (e) {}
    }, 90);
    return true;
  }

  var strip = null;
  function place() {
    if (!strip) return;
    var banner = document.getElementById('cookie-banner');
    var base = 16 + (banner ? banner.offsetHeight + 12 : 0);
    /* Sit above the fixed feedback (bottom-left) and share (bottom-right)
       buttons so the strip never overlaps them. */
    strip.style.bottom = (base + 52) + 'px';
  }

  function build() {
    var style = document.createElement('style');
    style.id = 'jvds-keepsake-style';
    style.textContent = CSS;
    document.head.appendChild(style);

    strip = document.createElement('div');
    strip.id = 'jvds-keepsake-strip';
    strip.setAttribute('role', 'region');
    strip.setAttribute('aria-label', 'Keep your creation');
    strip.innerHTML =
      '<span class="jk-txt">' +
      '<b>Your work saves on this device</b>' +
      '<span class="jk-sub">No account needed. On shared PCs, export to keep it forever.</span>' +
      '</span>' +
      '<button id="jk-keep-export" type="button">Export to keep</button>' +
      '<a id="jk-keep-cert" href="/tools/certificate.html">Certificate</a>';
    document.body.appendChild(strip);
    document.getElementById('jk-keep-export').addEventListener('click', exportNow);
    place();
    window.addEventListener('resize', place);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();

  window.JVDSKeepsake = { exportNow: exportNow, tool: TOOL, strip: function () { return strip; } };
})();
