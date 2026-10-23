// compat-badge.js - school-computer compatibility badge for workshop pages
// Detects the required software from the page URL and injects a visible pill
// into the hero section so learners know what they need before starting.
(function(){
  var p = location.pathname.toLowerCase();
  // Only run on workshop pages (where style-workshop.css is loaded for pill styles)
  if (!p.includes('/workshops/')) return;

  // Canvas pages are browser-only but are companion views - skip labelling them
  if (p.endsWith('-canvas.html')) return;
  // Skip pure reference and landing pages that already explain requirements
  if (/-(cheatsheet|studio|landing|learn|start)\.html$/.test(p)) return;
  if (/^\/workshops\/(engine-|learn|start-here|my-first-series|my-progress|my-achievements|tiny-learners)/.test(p)) return;

  // Detect compatibility tier from URL
  var tier = 'browser';
  if (/minecraft-/.test(p)) tier = 'paid-game';
  else if (/stardew-/.test(p)) tier = 'paid-game';
  else if (/terraria-/.test(p)) tier = 'paid-game';
  else if (/pico8/.test(p)) tier = 'pico8';
  else if (/roblox-/.test(p)) tier = 'account';
  else if (/tinkercad-/.test(p)) tier = 'browser-account';
  else if (/scratch-/.test(p)) tier = 'browser-account';
  else if (/blender-/.test(p)) tier = 'download';
  else if (/godot-/.test(p)) tier = 'download';
  else if (/defold-/.test(p)) tier = 'download';
  else if (/gdevelop-/.test(p)) tier = 'download';
  else if (/python-/.test(p)) tier = 'download';
  else if (/\bjava-/.test(p)) tier = 'download';
  else if (/cpp-/.test(p)) tier = 'download';
  else if (/gml-/.test(p)) tier = 'download';
  else if (/unity-/.test(p)) tier = 'download';
  else if (/unreal-/.test(p)) tier = 'download';
  else if (/mugen-/.test(p)) tier = 'download';
  else if (/openrct2-/.test(p)) tier = 'download';

  // Fallback: check hero-eyebrow / hero-badge / title for engine names not in URL
  if (tier === 'browser') {
    var heroText = (document.querySelector('.hero-eyebrow,.hero-badge,.hero-inner h1') || {}).textContent || '';
    var titleText = document.title || '';
    var combined = (heroText + ' ' + titleText).toLowerCase();
    if (/godot/.test(combined)) tier = 'download';
    else if (/blender/.test(combined)) tier = 'download';
    else if (/unreal/.test(combined)) tier = 'download';
    else if (/unity/.test(combined)) tier = 'download';
    else if (/roblox/.test(combined)) tier = 'account';
    else if (/defold/.test(combined)) tier = 'download';
    else if (/gamemaker|gml/.test(combined)) tier = 'download';
    else if (/minecraft/.test(combined)) tier = 'paid-game';
    else if (/mugen/.test(combined)) tier = 'download';
    else if (/pico-8|pico8/.test(combined)) tier = 'pico8';
  }

  // Tier → display
  var map = {
    browser:         { cls: 'p-compat-browser',   text: '🟢 Works in browser' },
    'browser-account':{ cls: 'p-compat-browser',  text: '🟢 Browser + free account' },
    account:         { cls: 'p-compat-account',   text: '🔵 Free account (Roblox Studio)' },
    download:        { cls: 'p-compat-download',  text: '⬇️ Free download required' },
    pico8:           { cls: 'p-compat-download',  text: '🟢 Browser preview · ⬇️ Buy PICO-8' },
    'paid-game':     { cls: 'p-compat-paid',      text: '🎮 Paid game required' }
  };
  var info = map[tier];
  if (!info) return;

  // Don't inject twice
  if (document.querySelector('.p-compat-browser,.p-compat-download,.p-compat-account,.p-compat-paid')) return;

  var span = document.createElement('span');
  span.className = 'pill ' + info.cls;
  span.setAttribute('title', 'School computer compatibility');
  span.textContent = info.text;

  // Inject into the first .hero-pills, .badge-row, or .hero-inner > div
  var container = document.querySelector('.hero-pills, .badge-row');
  if (!container) {
    var heroDiv = document.querySelector('.hero-inner > div, .hero > div');
    if (heroDiv) container = heroDiv;
  }
  if (container) container.appendChild(span);
})();
