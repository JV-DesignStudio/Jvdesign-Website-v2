/* A2319: after a download, explain what the file is and what to do next.
   Watches real download links (an anchor with a download name), then shows a
   small dismissible panel. Tools opt in by loading this script. */
(function () {
  'use strict';
  if (window.ExplainExport) return;

  var TYPES = {
    png:  { label: 'PNG image', where: 'Use it in a game, a slide or a document. It keeps a transparent background.', next: { href: '/tools/arcade-game-maker.html', text: 'Use it in a game' } },
    gif:  { label: 'Animated GIF', where: 'Share it in a chat or drop it into a page. It plays on its own.', next: { href: '/tools/sprite-animator.html', text: 'Make another animation' } },
    jpg:  { label: 'JPEG image', where: 'Use it in a slide, a document or a game.', next: { href: '/tools/arcade-game-maker.html', text: 'Use it in a game' } },
    jpeg: { label: 'JPEG image', where: 'Use it in a slide, a document or a game.', next: { href: '/tools/arcade-game-maker.html', text: 'Use it in a game' } },
    svg:  { label: 'SVG picture', where: 'It stays sharp at any size. Use it in a page, a poster or a 3D print.', next: { href: '/tools/tabletop-studio.html', text: 'Print a board' } },
    json: { label: 'Project file', where: 'Open it in the same tool to carry on, or keep it as a backup.', next: { href: '/tools/backup-restore.html', text: 'Keep a backup' } },
    wav:  { label: 'WAV sound', where: 'Use it in a game, a video or a podcast. It is the highest quality audio.', next: { href: '/tools/arcade-game-maker.html', text: 'Add it to a game' } },
    ogg:  { label: 'OGG sound', where: 'A smaller sound file for games and web pages.', next: { href: '/tools/arcade-game-maker.html', text: 'Add it to a game' } },
    mp3:  { label: 'MP3 sound', where: 'Plays in almost any player, phone or video editor.', next: { href: '/tools/arcade-game-maker.html', text: 'Add it to a game' } },
    mid:  { label: 'MIDI file', where: 'Open it in a music app to change the notes and instruments.', next: { href: '/tools/sound-studio.html', text: 'Back to Audio Studio' } },
    glb:  { label: '3D model (GLB)', where: 'Open it in Blender, Godot, Unity or Unreal.', next: { href: '/tools/buildlab.html', text: 'Build another model' } },
    gltf: { label: '3D model (glTF)', where: 'Open it in Blender, Godot, Unity or Unreal.', next: { href: '/tools/buildlab.html', text: 'Build another model' } },
    obj:  { label: '3D model (OBJ)', where: 'Open it in Blender or Unreal, or send it to a 3D printer.', next: { href: '/tools/buildlab.html', text: 'Build another model' } },
    stl:  { label: '3D print file', where: 'Open it in your printer slicer and check the size before printing.', next: { href: '/tools/buildlab.html', text: 'Build another model' } },
    rbxm: { label: 'Roblox model', where: 'In Roblox Studio use Model, Insert, From Local File.', next: { href: '/workshops/my-first-roblox-studio-game.html', text: 'Make a Roblox game' } },
    html: { label: 'Playable game', where: 'Open it in any browser, or send it to a friend. It needs no install.', next: { href: '/arcade.html', text: 'Play more games' } },
    csv:  { label: 'Spreadsheet data', where: 'Open it in Excel, Google Sheets or Numbers.', next: { href: '/tools/quest-board.html', text: 'Plan your project' } },
    zip:  { label: 'Zip bundle', where: 'Unzip it to see every file, then import them into your tool or engine.', next: { href: '/tools/backup-restore.html', text: 'Keep a backup' } },
    md:   { label: 'Markdown notes', where: 'Open it in any text editor, or paste it into a notes app.', next: { href: '/pages/dev-tools.html', text: 'Find another tool' } },
    txt:  { label: 'Text file', where: 'Open it in any text editor or notes app.', next: { href: '/pages/dev-tools.html', text: 'Find another tool' } },
    ase:  { label: 'Aseprite file', where: 'Open it in Aseprite to keep editing layers and frames.', next: { href: '/tools/pixel-studio.html', text: 'Back to Pixel Studio' } },
    tmj:  { label: 'Tiled map', where: 'Open it in Tiled, or import it into a game engine.', next: { href: '/tools/level-designer.html', text: 'Back to World Builder' } }
  };
  var panel = null;

  function esc(s) {
    return String(s || '').replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function infoFor(name) {
    var ext = String(name || '').split('.').pop().toLowerCase();
    return TYPES[ext] || { label: ext ? ext.toUpperCase() + ' file' : 'Download', where: 'Open it with an app that supports this file type.', next: { href: '/tools/gallery.html', text: 'Find another tool' } };
  }

  function close() {
    if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
    panel = null;
  }

  function show(name) {
    close();
    var info = infoFor(name);
    panel = document.createElement('aside');
    panel.id = 'explain-export';
    panel.setAttribute('role', 'status');
    panel.setAttribute('aria-live', 'polite');
    panel.innerHTML =
      '<div class="ee-head"><strong>Downloaded ' + esc(name) + '</strong>' +
      '<button type="button" class="ee-close" aria-label="Close">&#10005;</button></div>' +
      '<p class="ee-type">' + esc(info.label) + '</p>' +
      '<p class="ee-where">' + esc(info.where) + '</p>' +
      '<a class="ee-next" href="' + esc(info.next.href) + '">' + esc(info.next.text) + ' &rarr;</a>';
    document.body.appendChild(panel);

    var style = document.createElement('style');
    style.id = 'explain-export-style';
    if (!document.getElementById('explain-export-style')) {
      style.textContent =
        '#explain-export{position:fixed;right:16px;bottom:16px;z-index:2147483000;width:min(360px,calc(100vw - 24px));pointer-events:auto;' +
        'background:#241f18;color:#f5efe0;border:1px solid rgba(240,234,214,.22);border-radius:14px;padding:12px 14px;' +
        'box-shadow:0 10px 30px rgba(0,0,0,.35);font:400 .82rem/1.45 Inter,system-ui,sans-serif;}' +
        '#explain-export .ee-head{display:flex;align-items:flex-start;gap:8px;font-weight:700;}' +
        '#explain-export .ee-head strong{flex:1;min-width:0;overflow-wrap:anywhere;}' +
        '#explain-export .ee-close{flex:0 0 auto;width:28px;height:28px;border-radius:50%;border:1px solid rgba(240,234,214,.3);' +
        'background:transparent;color:#f5efe0;cursor:pointer;font:inherit;}' +
        '#explain-export .ee-close:focus-visible,#explain-export .ee-next:focus-visible{outline:3px solid #7c3aed;outline-offset:2px;}' +
        '#explain-export .ee-type{margin:6px 0 2px;color:#f5c842;font-weight:700;}' +
        '#explain-export .ee-where{margin:0 0 8px;color:#d9cfbd;}' +
        '#explain-export .ee-next{display:inline-block;padding:5px 12px;border-radius:999px;background:#4e7d80;color:#fff;' +
        'font-weight:700;text-decoration:none;}' +
        '#explain-export .ee-next:hover{background:#70a3a7;}';
      document.head.appendChild(style);
    }

    panel.querySelector('.ee-close').addEventListener('click', close);
    var timer = setTimeout(close, 12000);
    panel.addEventListener('mouseenter', function () { clearTimeout(timer); });
  }

  // Capture real downloads: an anchor with a download attribute.
  var origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    var name = '';
    try { name = this.getAttribute('download') || ''; } catch (e) {}
    var result = origClick.apply(this, arguments);
    if (name) setTimeout(function () { show(name); }, 250);
    return result;
  };

  window.ExplainExport = { show: show, close: close };
})();
