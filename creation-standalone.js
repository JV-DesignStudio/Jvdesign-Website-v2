/* creation-standalone.js - one consistent "Download standalone .html" action.
 *
 * Loaded on the creator tools that can package a result as a single offline
 * file. It reuses each tool's own export path (Pixel Studio flattens its
 * frames, Sound Studio renders its mixdown) and wraps the result in one
 * dependency-free HTML page:
 *   Pixel Studio - every frame inlined as a PNG data URL, animated inline.
 *   Sound Studio - the mixdown inlined as a WAV data URL in an audio player.
 *
 * No external src or href, no network request, no account. Dispatches
 * jvds:standalone-exported so the first-creation funnel can count it.
 *
 * API: window.JVDSStandalone = {
 *   tool, BUDGET, exportNow(), download(html, filename),
 *   buildPixelsHtml(frames, fps, opts), buildAudioHtml(dataUrl, opts)
 * }
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.top !== window.self) return;
  if (window.JVDSStandalone) return;
  if (!/^\/tools\//.test(location.pathname)) return;

  var TOOL = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
  var SUPPORTED = { 'pixel-studio': 1, 'sound-studio': 1 };
  if (!SUPPORTED[TOOL]) return;

  var BUDGET = 8 * 1024 * 1024;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function stamp() {
    return new Date().toISOString().slice(0, 16).replace('T', '-').replace(/:/g, '');
  }
  function toast(text) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(text); return; } catch (e) {}
    }
    var t = document.createElement('div');
    t.setAttribute('role', 'status');
    t.textContent = text;
    t.style.cssText = 'position:fixed;bottom:150px;right:16px;z-index:9005;max-width:260px;' +
      'background:#28241e;color:#f5efe0;border:1px solid rgba(240,234,214,.18);border-radius:10px;' +
      'padding:10px 14px;font:600 .8rem/1.4 Inter,system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.35);';
    document.body.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .3s';
      t.style.opacity = '0';
      setTimeout(function () { t.remove(); }, 320);
    }, 2600);
  }
  function announce() {
    try {
      window.dispatchEvent(new CustomEvent('jvds:standalone-exported', { detail: { tool: TOOL } }));
    } catch (e) {}
  }

  var CSS = [
    'body{margin:0;background:#fbf8f2;color:#1a1208;font:400 1rem/1.55 Inter,system-ui,sans-serif}',
    '.sheet{max-width:720px;margin:0 auto;padding:24px 16px 40px;text-align:center}',
    'h1{font:700 1.35rem/1.2 Fredoka,system-ui,sans-serif;margin:0 0 6px}',
    '.sub{color:#3d3224;font-size:.9rem;margin:0 0 20px}',
    '.stage{display:inline-flex;align-items:center;justify-content:center;min-width:180px;min-height:180px;padding:18px;border-radius:16px;border:1.5px solid rgba(64,59,51,.14);background:repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 0 0/20px 20px}',
    '#frame{image-rendering:pixelated;max-width:min(70vw,420px);max-height:70vh}',
    'audio{width:min(90vw,520px);margin-top:8px}',
    '.note{color:#3d3224;font-size:.8rem;margin-top:22px}'
  ].join('\n');

  function page(title, body, script) {
    return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
      '<title>' + esc(title) + '</title>\n<style>\n' + CSS + '\n</style>\n</head>\n<body>\n' +
      '<main class="sheet">\n' + body + '\n' +
      '<p class="note">Made at JVDesignStudio. This file works offline, with no account.</p>\n' +
      '</main>\n' + (script ? '<script>\n' + script + '\n</script>\n' : '') + '</body>\n</html>\n';
  }

  function buildPixelsHtml(frames, fps, opts) {
    opts = opts || {};
    var list = Array.isArray(frames) ? frames.filter(function (u) {
      return typeof u === 'string' && /^data:image\//.test(u);
    }) : [];
    if (!list.length) return null;
    var rate = Math.max(1, Math.min(30, parseInt(fps, 10) || 8));
    var title = opts.title || 'My pixel art';
    var body = '<h1>' + esc(title) + '</h1>\n' +
      '<p class="sub">A pixel creation made in Pixel Studio</p>\n' +
      '<div class="stage"><img id="frame" alt="Pixel art animation" src="' + list[0] + '"></div>';
    var script = list.length > 1
      ? 'var frames=' + JSON.stringify(list) + ',i=0,el=document.getElementById("frame");' +
        'setInterval(function(){i=(i+1)%frames.length;el.src=frames[i];},' +
        Math.max(50, Math.round(1000 / rate)) + ');'
      : '';
    return page(title, body, script);
  }

  function buildAudioHtml(dataUrl, opts) {
    opts = opts || {};
    if (typeof dataUrl !== 'string' || !/^data:audio\//.test(dataUrl)) return null;
    var title = opts.title || 'My sound';
    var body = '<h1>' + esc(title) + '</h1>\n' +
      '<p class="sub">A sound made in Sound Studio</p>\n' +
      '<audio controls preload="metadata" src="' + dataUrl + '"></audio>\n' +
      '<p class="sub" style="margin-top:14px">Press play to listen.</p>';
    return page(title, body, '');
  }

  function download(html, filename) {
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    if (typeof window.JVDS_DOWNLOAD === 'function') {
      try { window.JVDS_DOWNLOAD(blob, filename); return; } catch (e) {}
    }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }

  function pixelsFrames() {
    var out = [];
    try {
      var count = Array.isArray(frames) ? frames.length : 0; // Pixel Studio global
      for (var i = 0; i < count; i++) {
        var c = flattenFrame(i);
        if (c && typeof c.toDataURL === 'function') out.push(c.toDataURL('image/png'));
      }
    } catch (e) {}
    return out;
  }

  function exportPixels() {
    var list = pixelsFrames();
    if (!list.length) {
      toast('Draw a pixel first, then download the standalone file.');
      return false;
    }
    var rate = typeof fps !== 'undefined' ? fps : 8;
    var html = buildPixelsHtml(list, rate, { title: 'My pixel art' });
    if (!html) return false;
    if (html.length > BUDGET) {
      toast('This creation is too large for one file. Try fewer frames.');
      return false;
    }
    download(html, 'jvds-pixel-art-' + stamp() + '.html');
    announce();
    toast('Standalone file downloaded. It plays offline.');
    return true;
  }

  function exportAudio() {
    if (typeof renderMixdown !== 'function' || typeof bufferToDataUrl !== 'function') return false;
    toast('Packaging your sound...');
    return renderMixdown().then(function (buf) {
      var dataUrl = bufferToDataUrl(buf);
      var html = buildAudioHtml(dataUrl, { title: 'My sound' });
      if (!html) {
        toast('Nothing to package yet. Add a track first.');
        return false;
      }
      if (html.length > BUDGET) {
        toast('This sound is too large for one file.');
        return false;
      }
      download(html, 'jvds-sound-' + stamp() + '.html');
      announce();
      toast('Standalone file downloaded. It plays offline.');
      return true;
    }).catch(function () {
      toast('Could not package the sound.');
      return false;
    });
  }

  function exportNow() {
    return TOOL === 'pixel-studio' ? exportPixels() : exportAudio();
  }

  var style = document.createElement('style');
  style.textContent =
    '#jvds-standalone-btn{position:fixed;left:16px;z-index:8999;background:#c98a2e;color:#fff;' +
    'border:none;border-radius:999px;padding:10px 15px;min-height:44px;' +
    'font:700 .78rem/1 Inter,system-ui,sans-serif;cursor:pointer;' +
    'box-shadow:0 2px 0 #a06e22,0 8px 24px rgba(0,0,0,.25)}' +
    '#jvds-standalone-btn:hover{filter:brightness(1.06)}' +
    '#jvds-standalone-btn:focus-visible{outline:3px solid #BC4749;outline-offset:2px}';
  document.head.appendChild(style);

  var btn = document.createElement('button');
  btn.id = 'jvds-standalone-btn';
  btn.type = 'button';
  btn.textContent = 'Download standalone .html';
  btn.title = 'Download this creation as one file that opens offline';
  btn.setAttribute('aria-label', 'Download this creation as a standalone HTML file');
  btn.addEventListener('click', exportNow);
  if (window.JVDSDock && typeof window.JVDSDock.add === 'function') window.JVDSDock.add(btn);
  else document.body.appendChild(btn);

  window.JVDSStandalone = {
    tool: TOOL,
    BUDGET: BUDGET,
    exportNow: exportNow,
    download: download,
    buildPixelsHtml: buildPixelsHtml,
    buildAudioHtml: buildAudioHtml
  };
})();
