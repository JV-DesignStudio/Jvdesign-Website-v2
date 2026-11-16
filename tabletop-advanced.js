/* Tabletop Studio advanced tools (A3067). Loaded on first use. */
(function () {
  window.TT_ADVANCED = function (api) {
    var advanced = {};
    with (api) {
  function exportBackup() {
    var payload = { v: 2, app: 'Tabletop Studio', exportedAt: new Date().toISOString(), boards: library.boards };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'tabletop-backup-' + new Date().toISOString().slice(0, 10) + '.json');
    toast('Backup file saved with ' + library.boards.length + ' boards.');
    announce('All boards saved to a backup file.');
  }

  function onRestoreBackup(event) {
    var file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast('That backup file is too big.');
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var parsed;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch (err) {
        toast('That file is not a Tabletop backup.');
        return;
      }
      var boards = Array.isArray(parsed) ? parsed : parsed.boards;
      if (!Array.isArray(boards) || !boards.length) {
        toast('That backup has no boards in it.');
        return;
      }
      boards = boards.filter(function (b) {
        return b && typeof b.id === 'string' && b.data && Array.isArray(b.data.tiles);
      }).slice(0, MAX_BOARDS);
      if (!boards.length) {
        toast('That backup has no usable boards.');
        return;
      }
      if (!window.confirm('Replace your ' + library.boards.length + ' saved boards with ' + boards.length + ' from this backup?')) {
        return;
      }
      library = { v: 2, activeId: boards[0].id, boards: boards };
      writeLibrary();
      clearHistory();
      applyBoardData(boards[0].data);
      emptyDismissed = true;
      firstSteps.dismissed = true;
      setBgImage(S.bg);
      syncControls();
      renderAll();
      updateSaveState('Restored', false);
      toast(library.boards.length + ' boards restored.');
      announce(library.boards.length + ' boards restored from the backup.');
    };
    reader.readAsText(file);
  }

  function renderVersions() {
    if (!versionList) return;
    versionList.textContent = '';
    var board = activeBoard();
    var versions = board && Array.isArray(board.versions) ? board.versions : [];
    if (!versions.length) {
      var empty = document.createElement('p');
      empty.className = 'tt-help';
      empty.textContent = 'No earlier versions yet. Save a few changes and Echo will keep them here.';
      versionList.appendChild(empty);
      return;
    }
    versions.slice().reverse().forEach(function (version, reversedIndex) {
      var index = versions.length - 1 - reversedIndex;
      var row = document.createElement('div');
      row.className = 'tt-version-row';
      row.setAttribute('role', 'listitem');
      var meta = document.createElement('div');
      meta.className = 'tt-version-meta';
      var strong = document.createElement('strong');
      strong.textContent = new Date(version.at).toLocaleString();
      var small = document.createElement('span');
      var data = version.data || {};
      small.textContent = (data.cols || '?') + ' x ' + (data.rows || '?') + ' · ' +
        (Array.isArray(data.tokens) ? data.tokens.length : 0) + ' pieces';
      meta.appendChild(strong);
      meta.appendChild(small);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tt-btn tt-btn--quiet';
      btn.dataset.versionIndex = String(index);
      btn.textContent = 'Restore';
      row.appendChild(meta);
      row.appendChild(btn);
      versionList.appendChild(row);
    });
  }

  function openVersions() {
    renderVersions();
    versionsEl.hidden = false;
    document.body.classList.add('tt-modal-open');
    try { versionsClose.focus({ preventScroll: true }); } catch (err) { versionsClose.focus(); }
  }

  function closeVersions() {
    if (!versionsEl || versionsEl.hidden) return;
    versionsEl.hidden = true;
    document.body.classList.remove('tt-modal-open');
    if (versionBtn) {
      try { versionBtn.focus({ preventScroll: true }); } catch (err) { versionBtn.focus(); }
    }
  }

  function restoreVersion(index) {
    var board = activeBoard();
    if (!board || !Array.isArray(board.versions)) return;
    var version = board.versions[index];
    if (!version || !version.data) return;
    if (!window.confirm('Restore the version from ' + new Date(version.at).toLocaleString() + '?')) return;
    if (dirty && !saveBoard(true)) return;
    board.data = JSON.parse(JSON.stringify(version.data));
    board.name = String(board.data.name || board.name || 'My board').slice(0, 40);
    board.updated = Date.now();
    if (!writeLibrary()) {
      toast('Could not restore that version. Browser storage may be full.');
      return;
    }
    applyBoardData(board.data);
    clearHistory();
    emptyDismissed = true;
    firstSteps.dismissed = true;
    setBgImage(S.bg);
    syncControls();
    renderAll();
    updateSaveState('Restored version', false);
    closeVersions();
    toast('Version restored.');
    announce('Previous version restored.');
  }

  function buildPlayableHTML() {
    var data = snapshot();
    data.v = 3;
    data.mode = 'play';
    data.selectedId = 0;
    var json = JSON.stringify(data).replace(/</g, '\\u003c');
    var terrainJson = JSON.stringify(TERRAIN).replace(/</g, '\\u003c');
    var title = S.name || 'My board game';
    var runtime = window.TT_PLAY_RUNTIME || '';
    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>' + escapeHtml(title) + '</title><style>' +
      'body{font-family:Inter,system-ui,sans-serif;background:#fbf8f2;color:#1a1208;margin:0;padding:14px;text-align:center}' +
      'h1{font-size:1.35rem;margin:0 0 4px}p{margin:0 0 10px;line-height:1.45;color:#3d3224}' +
      'canvas{max-width:100%;height:auto;border:2px solid #403B33;border-radius:10px;background:#f0ead6}' +
      '.bar{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;align-items:center;margin:12px 0}' +
      'button,select{font:inherit;font-weight:800;padding:10px 16px;border:0;border-radius:9px;background:#4e7d80;color:#fff;cursor:pointer;min-height:44px}' +
      'select{background:#fff;color:#1a1208;border:2px solid #403B33;padding:8px 10px}' +
      'button.secondary{background:#fff;color:#1a1208;border:2px solid #403B33}' +
      '#turn{font-weight:800}#money{font-size:.85rem;color:#3d3224}#result{font-weight:700;min-height:1.4em}' +
      '.rules{max-width:620px;margin:12px auto 0;text-align:left;font-size:.9rem;line-height:1.5;white-space:pre-wrap}' +
      '.choices,.declare{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:8px 0}' +
      '.choices[hidden]{display:none}' +
      '.log{max-width:620px;margin:10px auto 0;text-align:left;font-size:.8rem;color:#5a5449;max-height:160px;overflow:auto}' +
      '.log p{margin:0 0 4px}' +
      '</style></head><body>' +
      '<h1>' + escapeHtml(title) + '</h1>' +
      '<p>Roll and play. This game works offline.</p>' +
      '<canvas id="b" width="320" height="320" aria-label="Game board"></canvas>' +
      '<div class="bar"><select id="pawn" aria-label="Choose a pawn"></select><button id="roll">Roll</button><button id="buy" class="secondary" hidden>Buy</button><button id="skipBuy" class="secondary" hidden>Skip</button><button id="new" class="secondary">New game</button></div>' +
      '<div class="choices" id="choices" hidden></div>' +
      '<p>Next: <span id="turn">Player 1</span></p><p id="money"></p><p id="result" aria-live="polite">Ready when you are.</p>' +
      '<div class="declare" id="declare"></div>' +
      '<div class="log" id="log" aria-live="polite"></div>' +
      (S.rules ? '<div class="rules">' + escapeHtml(S.rules) + '</div>' : '') +
      '<script>var GAME=' + json + ';var TERRAIN=' + terrainJson + ';<\/script><script>' + runtime + '<\/script></body></html>';
  }

  function downloadPlayableHTML(html) {
    html = html || buildPlayableHTML();
    downloadBlob(new Blob([html], { type: 'text/html' }), safeName() + '-play.html');
    trackMilestone('export');
    toast('Playable HTML game saved.');
    announce('Playable HTML game saved. It works offline.');
  }

  function playWinLabel() {
    var mode = (S.settings && S.settings.winMode) || 'finish';
    return { finish: 'first to the finish', allPawns: 'every pawn home', mostMoney: 'most money', manual: 'you decide' }[mode] || 'first to the finish';
  }

  function playIncludes() {
    var list = ['board', 'route', 'rules', 'pieces', 'dice'];
    if ((S.customCards || []).length || (S.decks || []).some(function (deck) { return deck && deck.customCards && deck.customCards.length; })) list.push('cards');
    if ((S.meta || []).some(function (meta) { return meta && (meta.price || meta.rent || meta.owner); })) list.push('property');
    if ((S.homeLanes || []).length) list.push('home lanes');
    if (((S.settings && S.settings.pawnsPerPlayer) || 1) > 1) list.push('several pawns');
    if (S.settings && S.settings.exactFinish) list.push('exact finish');
    if (S.settings && S.settings.capture) list.push('capture');
    if (S.rollMode === 'spinner') list.push('spinner');
    if (Number(dieCount) > 1) list.push('several dice');
    return 'Includes: ' + list.join(', ') + '.';
  }

  function closePlayPreview() {
    var modal = document.getElementById('ttPlayPreview');
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('tt-modal-open');
    var trigger = document.getElementById('ttExportPlayable');
    if (trigger) {
      try { trigger.focus({ preventScroll: true }); } catch (err) { trigger.focus(); }
    }
  }

  function openPlayPreview(html) {
    var modal = document.getElementById('ttPlayPreview');
    if (!modal) { downloadPlayableHTML(html); return; }
    var frameImage = document.getElementById('ttPlayPreviewImg');
    if (frameImage) frameImage.src = boardImageData();
    var summary = document.getElementById('ttPlayPreviewSummary');
    if (summary) summary.textContent = 'Win: ' + playWinLabel() + '.';
    var includes = document.getElementById('ttPlayPreviewIncludes');
    if (includes) includes.textContent = playIncludes();
    var download = document.getElementById('ttPlayPreviewDownload');
    var close = document.getElementById('ttPlayPreviewClose');
    var keep = document.getElementById('ttPlayPreviewKeep');
    var backdrop = document.getElementById('ttPlayPreviewBackdrop');
    if (download) {
      download.onclick = function () {
        downloadPlayableHTML(html);
        closePlayPreview();
      };
    }
    if (close) close.onclick = closePlayPreview;
    if (keep) keep.onclick = closePlayPreview;
    if (backdrop) backdrop.onclick = closePlayPreview;
    modal.hidden = false;
    document.body.classList.add('tt-modal-open');
    if (download) {
      try { download.focus({ preventScroll: true }); } catch (err) { download.focus(); }
    }
    announce('Playable game preview ready. Download when you are happy.');
  }

  function exportPlayableHTML() {
    if (window.TT_PLAY_RUNTIME) {
      openPlayPreview(buildPlayableHTML());
      return;
    }
    if (playRuntimeLoading) return;
    playRuntimeLoading = true;
    toast('Getting the playable game ready.');
    var script = document.createElement('script');
    script.src = '/tabletop-play-runtime.js';
    script.onload = function () {
      playRuntimeLoading = false;
      if (window.TT_PLAY_RUNTIME) openPlayPreview(buildPlayableHTML());
      else toast('The play runtime did not load. Try again.', 'error');
    };
    script.onerror = function () {
      playRuntimeLoading = false;
      toast('The play runtime did not load. Check your connection and try again.', 'error');
    };
    document.head.appendChild(script);
  }

  function printKit() {
    var paper = printSizeInput ? printSizeInput.value : 'A4';
    var rules = String(S.rules || '').trim();
    var title = S.name || 'My tabletop game';
    var boardImg = boardImageData();
    var cardImg = cardSheetData();
    var html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
      '<title>' + escapeHtml(title) + ' - print kit</title>' +
      '<style>' +
      '@page { size: ' + (paper === 'A3' ? 'A3' : 'A4') + ' portrait; margin: 10mm; }' +
      'body { font-family: Inter, system-ui, sans-serif; color: #1a1208; background: #fff; margin: 0; }' +
      '.sheet { page-break-after: always; padding: 4mm; }' +
      '.sheet:last-child { page-break-after: auto; }' +
      'h1 { font-size: 22pt; margin: 0 0 2mm; }' +
      'h2 { font-size: 14pt; margin: 4mm 0 2mm; }' +
      '.meta { font-size: 9pt; color: #555; margin-bottom: 3mm; }' +
      '.board { width: 100%; max-height: 220mm; object-fit: contain; border: 1px solid #999; }' +
      '.rules { white-space: pre-wrap; font-size: 11pt; line-height: 1.5; margin-top: 4mm; }' +
      '.cards { width: 100%; max-height: 240mm; object-fit: contain; }' +
      '.cut { font-size: 8pt; color: #777; margin-top: 2mm; }' +
      '@media print { .no-print { display: none; } }' +
      '</style></head><body>' +
      '<section class="sheet"><h1>' + escapeHtml(title) + '</h1>' +
      '<p class="meta">JVDesignStudio Tabletop Studio - ' + S.cols + ' x ' + S.rows + ' - ' + paper + '</p>' +
      '<img class="board" alt="Board" src="' + boardImg + '">' +
      (rules ? '<h2>Rules</h2><div class="rules">' + escapeHtml(rules) + '</div>' : '') +
      '</section>' +
      '<section class="sheet"><h1>Cards</h1>' +
      '<img class="cards" alt="Card sheet" src="' + cardImg + '">' +
      '<p class="cut">Cut along the card borders. Print at 100% for the best fit.</p>' +
      '</section>' +
      '<p class="no-print">If the print dialog did not open, press Ctrl and P.</p>' +
      '</body></html>';
    var win = window.open('', '_blank');
    if (!win) {
      toast('Allow pop-ups to open the print kit.');
      return;
    }
    try {
      win.document.write(html);
      win.document.close();
      win.focus();
      window.setTimeout(function () {
        try { win.print(); } catch (err) { /* the print button is still there */ }
      }, 500);
      toast('Print kit ready in a new tab.');
      announce('Print kit ready. Choose A4 or A3 in the print dialog.');
    } catch (err) {
      toast('Could not open the print kit.');
    }
  }

  function exportPNG() {
    var size = boardSize();
    var scale = 2;
    var out = document.createElement('canvas');
    out.width = size.W * scale;
    out.height = size.H * scale;

    var o = out.getContext('2d');
    o.save();
    o.scale(scale, scale);
    drawScene(o, size.W, size.H, false);
    o.restore();

    drawTokensForExport(o, scale);

    o.fillStyle = 'rgba(64,59,51,.78)';
    o.font = '700 ' + Math.round(12 * scale) + 'px Inter, system-ui, sans-serif';
    o.textAlign = 'right';
    o.textBaseline = 'bottom';
    o.fillText('JVDesignStudio - Tabletop Studio', out.width - 14, out.height - 10);

    if (out.toBlob) {
      out.toBlob(function (blob) {
        if (!blob) {
          toast('Could not export the board image.');
          return;
        }
        downloadBlob(blob, safeName() + '.png');
        toast('Board image exported.');
        announce('Board image exported as a PNG.');
      }, 'image/png');
    } else {
      var link = document.createElement('a');
      link.href = out.toDataURL('image/png');
      link.download = safeName() + '.png';
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast('Board image exported.');
    }
  }

  function exportJSON() {
    var data = snapshot();
    data.v = 2;
    data.savedAt = Date.now();
    data.mode = S.mode;
    data.terrain = S.terrain;
    data.brush = S.brush;
    data.snap = S.snap;
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, safeName() + '.json');
    toast('Board file saved.');
    announce('Board file saved as JSON.');
  }

  function onLoadFile(event) {
    var file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast('That board file is too big.');
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try {
        data = JSON.parse(String(reader.result));
      } catch (err) {
        toast('That file is not a board file.');
        return;
      }
      var snap = snapshot();
      if (!applyBoardData(data)) {
        toast('That file is not a board file.');
        return;
      }
      pushUndoSnapshot(snap);
      emptyDismissed = true;
      firstSteps.dismissed = true;
      setBgImage(S.bg);
      syncControls();
      renderAll();
      markDirty();
      toast('Board loaded.');
      announce('Board loaded from file.');
    };
    reader.onerror = function () {
      toast('That file could not be read.');
    };
    reader.readAsText(file);
  }

  function printDesignSheet() {
    var title = S.name || 'My board game';
    var html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
      '<title>' + escapeHtml(title) + ' - design sheet</title>' +
      '<style>@page { size: A4 portrait; margin: 12mm; }' +
      'body { font-family: Inter, system-ui, sans-serif; color: #1a1208; margin: 0; }' +
      'h1 { font-size: 20pt; margin: 0 0 2mm; } h2 { font-size: 13pt; margin: 6mm 0 2mm; }' +
      '.q { border: 1px solid #999; border-radius: 3mm; padding: 4mm; margin: 3mm 0; min-height: 20mm; }' +
      '.q strong { display: block; margin-bottom: 2mm; } .meta { font-size: 9pt; color: #555; }' +
      '</style></head><body>' +
      '<h1>' + escapeHtml(title) + ' - design sheet</h1>' +
      '<p class="meta">Echo says: plan it, play it, then change one thing.</p>' +
      '<div class="q"><strong>Game name</strong></div>' +
      '<div class="q"><strong>Players and ages</strong></div>' +
      '<div class="q"><strong>How do you win?</strong></div>' +
      '<div class="q"><strong>What does a turn look like?</strong></div>' +
      '<div class="q"><strong>What can go wrong or surprise you?</strong></div>' +
      '<div class="q"><strong>What will you test first?</strong></div>' +
      '<p class="meta">If the print dialog did not open, press Ctrl and P.</p>' +
      '</body></html>';
    var win = window.open('', '_blank');
    if (!win) {
      toast('Allow pop-ups to open the design worksheet.');
      return;
    }
    try {
      win.document.write(html);
      win.document.close();
      win.focus();
      window.setTimeout(function () {
        try { win.print(); } catch (err) { /* optional */ }
      }, 500);
      toast('Design worksheet ready in a new tab.');
    } catch (err) {
      toast('Could not open the design worksheet.');
    }
  }

  function buildPlaySheetCanvas() {
    var size = boardSize();
    var scale = 2;
    var boardW = size.W * scale;
    var boardH = size.H * scale;
    var pad = 36;
    var panelW = Math.max(760, boardW);
    var rules = String(S.rules || '').trim();
    var title = S.name || 'My tabletop game';

    var boardCanvas = document.createElement('canvas');
    boardCanvas.width = boardW;
    boardCanvas.height = boardH;
    var bctx = boardCanvas.getContext('2d');
    bctx.save();
    bctx.scale(scale, scale);
    drawScene(bctx, size.W, size.H, false);
    bctx.restore();
    drawTokensForExport(bctx, scale);

    var meas = document.createElement('canvas').getContext('2d');
    meas.font = '400 16px Inter, system-ui, sans-serif';
    var lines = rules ? wrapTextLines(meas, rules, panelW - pad * 2) : [];
    var panelH = 92 + (lines.length ? lines.length * 24 + 12 : 0);

    var out = document.createElement('canvas');
    out.width = panelW;
    out.height = boardH + panelH + pad;
    var o = out.getContext('2d');
    o.fillStyle = S.bgColor || '#F0EAD6';
    o.fillRect(0, 0, out.width, out.height);
    o.drawImage(boardCanvas, Math.round((panelW - boardW) / 2), 0);

    o.textAlign = 'left';
    o.textBaseline = 'top';
    o.fillStyle = '#1a1208';
    o.font = '800 26px Inter, system-ui, sans-serif';
    o.fillText(title, pad, boardH + 24);
    o.fillStyle = '#4e4a42';
    o.font = '700 15px Inter, system-ui, sans-serif';
    o.fillText('Round ' + (S.round || 1) + ' · Turn ' + (S.turn || 1), pad, boardH + 58);
    if (lines.length) {
      o.fillStyle = '#2b2620';
      o.font = '400 16px Inter, system-ui, sans-serif';
      var y = boardH + 86;
      lines.forEach(function (line) {
        o.fillText(line, pad, y);
        y += 24;
      });
    }
    o.fillStyle = '#6b6257';
    o.font = '700 12px Inter, system-ui, sans-serif';
    o.textAlign = 'right';
    o.fillText('JVDesignStudio - Tabletop Studio', out.width - pad, out.height - 22);

    return out;
  }

  function buildPlaySheetData() {
    return buildPlaySheetCanvas().toDataURL('image/png');
  }

  function exportSheetPNG() {
    var out = buildPlaySheetCanvas();
    if (out.toBlob) {
      out.toBlob(function (blob) {
        if (!blob) {
          toast('Could not save the play sheet.');
          return;
        }
        downloadBlob(blob, safeName() + '-play-sheet.png');
        toast('Play sheet saved.');
        announce('Play sheet saved as a PNG.');
      }, 'image/png');
    } else {
      var link = document.createElement('a');
      link.href = out.toDataURL('image/png');
      link.download = safeName() + '-play-sheet.png';
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast('Play sheet saved.');
    }
  }

  function takeItHome() {
    var title = S.name || 'My board game';
    var rules = String(S.rules || '').trim();
    var boardImg = boardImageData();
    var cardImg = cardSheetData();
    var sheetImg = buildPlaySheetData();
    var win = playWinLabel();
    var html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
      '<title>' + escapeHtml(title) + ' - take it home pack</title>' +
      '<style>@page { size: A4 portrait; margin: 10mm; }' +
      'body { font-family: Inter, system-ui, sans-serif; color: #1a1208; background: #fff; margin: 0; }' +
      '.sheet { page-break-after: always; padding: 4mm; } .sheet:last-child { page-break-after: auto; }' +
      'h1 { font-size: 22pt; margin: 0 0 2mm; } h2 { font-size: 14pt; margin: 4mm 0 2mm; }' +
      '.meta { font-size: 9pt; color: #555; margin-bottom: 3mm; }' +
      '.board, .cards, .sheetimg { width: 100%; max-height: 245mm; object-fit: contain; border: 1px solid #999; }' +
      '.rules { white-space: pre-wrap; font-size: 11pt; line-height: 1.5; margin-top: 4mm; }' +
      '.cut { font-size: 8pt; color: #777; margin-top: 2mm; }' +
      '@media print { .no-print { display: none; } }' +
      '</style></head><body>' +
      '<section class="sheet"><h1>' + escapeHtml(title) + '</h1>' +
      '<p class="meta">Take it home pack - ' + S.cols + ' x ' + S.rows + ' - win: ' + escapeHtml(win) + '</p>' +
      '<img class="board" alt="Board" src="' + boardImg + '">' +
      (rules ? '<h2>Rules</h2><div class="rules">' + escapeHtml(rules) + '</div>' : '') +
      '</section>' +
      '<section class="sheet"><h1>Cards</h1><img class="cards" alt="Cards" src="' + cardImg + '">' +
      '<p class="cut">Cut along the card borders. Print at 100% for the best fit.</p></section>' +
      '<section class="sheet"><h1>Play sheet</h1><img class="sheetimg" alt="Play sheet" src="' + sheetImg + '"></section>' +
      '</body></html>';
    var pack = window.open('', '_blank');
    if (!pack) {
      downloadBlob(new Blob([html], { type: 'text/html' }), safeName() + '-take-home.html');
      toast('Take it home pack saved.');
      announce('Take it home pack saved as an HTML file.');
      return;
    }
    pack.document.write(html);
    pack.document.close();
    pack.focus();
    window.setTimeout(function () {
      try { pack.print(); } catch (err) { /* print is optional */ }
    }, 400);
    toast('Take it home pack ready. Print or save it as a PDF.');
    announce('Take it home pack ready. Print or save it as a PDF.');
  }

  /* ------------------------------------------------------------------ */
  /* SVG export for paper and 3D printing                                */
  /* ------------------------------------------------------------------ */

  function escapeXml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function svgNumber(value) {
    return String(Math.round(Number(value) * 100) / 100);
  }

  function polygonPoints(cx, cy, r, sides, rotation) {
    var points = [];
    for (var i = 0; i < sides; i++) {
      var angle = ((rotation || 0) + (360 / sides) * i) * Math.PI / 180;
      points.push(svgNumber(cx + r * Math.cos(angle)) + ',' + svgNumber(cy + r * Math.sin(angle)));
    }
    return points.join(' ');
  }

  function starPoints(cx, cy, r, innerRatio) {
    var points = [];
    for (var i = 0; i < 10; i++) {
      var radius = (i % 2) ? r * innerRatio : r;
      var angle = (-90 + i * 36) * Math.PI / 180;
      points.push(svgNumber(cx + radius * Math.cos(angle)) + ',' + svgNumber(cy + radius * Math.sin(angle)));
    }
    return points.join(' ');
  }

  function pieceSvgShape(def, r) {
    var colour = def.color || '#c98a2e';
    var kind = def.id;
    if (def.counter) {
      return '<rect x="' + svgNumber(-r) + '" y="' + svgNumber(-r) + '" width="' + svgNumber(r * 2) +
        '" height="' + svgNumber(r * 2) + '" rx="' + svgNumber(r * 0.2) + '" fill="' + colour + '"/>';
    }
    if (kind === 'treasure') return '<polygon points="' + polygonPoints(0, 0, r, 4, 0) + '" fill="' + colour + '"/>';
    if (kind === 'star') return '<polygon points="' + starPoints(0, 0, r, 0.45) + '" fill="' + colour + '"/>';
    if (kind === 'monster') return '<polygon points="' + starPoints(0, 0, r, 0.62) + '" fill="' + colour + '"/>';
    if (kind === 'flag') return '<polygon points="' + polygonPoints(0, 0, r, 3, -90) + '" fill="' + colour + '"/>';
    if (kind === 'castle' || kind === 'rock') {
      return '<rect x="' + svgNumber(-r) + '" y="' + svgNumber(-r) + '" width="' + svgNumber(r * 2) +
        '" height="' + svgNumber(r * 2) + '" rx="' + svgNumber(kind === 'castle' ? r * 0.18 : r * 0.55) +
        '" fill="' + colour + '"/>';
    }
    if (def.img) return '<polygon points="' + polygonPoints(0, 0, r, 6, 0) + '" fill="' + colour + '"/>';
    return '<circle cx="0" cy="0" r="' + svgNumber(r) + '" fill="' + colour + '"/>';
  }

  function buildBoardSVG() {
    var size = boardSize();
    var gap = 1.5;
    var mmW = (size.W / CELL) * SVG_MM_PER_CELL;
    var mmH = (size.H / CELL) * SVG_MM_PER_CELL;
    var out = [];
    out.push('<?xml version="1.0" encoding="UTF-8"?>');
    out.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size.W + ' ' + size.H +
      '" width="' + svgNumber(mmW) + 'mm" height="' + svgNumber(mmH) +
      '" role="img" aria-label="Tabletop board ready for 3D printing">');
    out.push('  <title>' + escapeXml(S.name || 'Tabletop board') + '</title>');
    out.push('  <desc>Each tile is a separate shape at 20 mm per cell. Import into Tinkercad and extrude.</desc>');
    out.push('  <g id="terrain">');
    for (var row = 0; row < S.rows; row++) {
      for (var col = 0; col < S.cols; col++) {
        var key = S.tiles[row * S.cols + col];
        if (!key || !TERRAIN[key]) continue;
        var centre = centerOf(col, row);
        if (S.shape === 'square') {
          out.push('    <rect class="tile" data-terrain="' + key +
            '" x="' + svgNumber(col * CELL + gap) + '" y="' + svgNumber(row * CELL + gap) +
            '" width="' + svgNumber(CELL - gap * 2) + '" height="' + svgNumber(CELL - gap * 2) +
            '" rx="2.5" fill="' + TERRAIN[key].color + '"/>');
        } else {
          out.push('    <polygon class="tile" data-terrain="' + key +
            '" points="' + polygonPoints(centre.x, centre.y, hexMetrics().r - gap, 6, -90) +
            '" fill="' + TERRAIN[key].color + '"/>');
        }
      }
    }
    out.push('  </g>');

    if (S.tokens.length) {
      out.push('  <g id="pieces">');
      S.tokens.forEach(function (t) {
        var transform = 'translate(' + svgNumber(t.x) + ' ' + svgNumber(t.y) + ') rotate(' +
          svgNumber(t.rot || 0) + ') scale(' + svgNumber(t.scale || 1) + ')';
        if (t.type === 'card') {
          var cw = CELL * 0.36;
          var ch = CELL * 0.5;
          out.push('    <g class="piece card" data-piece="card" transform="' + transform + '">');
          out.push('      <title>' + escapeXml(cardLabel(t)) + '</title>');
          out.push('      <rect x="' + svgNumber(-cw / 2) + '" y="' + svgNumber(-ch / 2) +
            '" width="' + svgNumber(cw) + '" height="' + svgNumber(ch) +
            '" rx="3.5" fill="' + (t.faceDown ? '#70A3A7' : cardBorder(t)) + '"/>');
          out.push('    </g>');
        } else {
          var def = pieceDef(t.kind);
          out.push('    <g class="piece" data-piece="' + def.id + '" transform="' + transform + '">');
          out.push('      <title>' + escapeXml(tokenLabel(t)) + '</title>');
          out.push('      ' + pieceSvgShape(def, CELL * 0.3));
          out.push('    </g>');
        }
      });
      out.push('  </g>');
    }
    out.push('</svg>');
    return out.join('\n');
  }

  function buildPiecesSVG() {
    var cols = 6;
    var cellW = 96;
    var cellH = 118;
    var top = 64;
    var rows = Math.ceil(PIECE_DEFS.length / cols);
    var W = cols * cellW;
    var H = top + rows * cellH;
    var mmW = (W / CELL) * SVG_MM_PER_CELL;
    var mmH = (H / CELL) * SVG_MM_PER_CELL;
    var out = [];
    out.push('<?xml version="1.0" encoding="UTF-8"?>');
    out.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H +
      '" width="' + svgNumber(mmW) + 'mm" height="' + svgNumber(mmH) +
      '" role="img" aria-label="Tabletop Studio piece sheet">');
    out.push('  <title>Tabletop Studio piece sheet</title>');
    out.push('  <text x="16" y="28" font-family="Inter, sans-serif" font-size="16" font-weight="700" fill="#1a1208">Tabletop Studio pieces</text>');
    out.push('  <text x="16" y="46" font-family="Inter, sans-serif" font-size="11" fill="#4e4a42">Extrude each shape. One board square is 20 mm.</text>');
    PIECE_DEFS.forEach(function (def, i) {
      var col = i % cols;
      var row = Math.floor(i / cols);
      var cx = col * cellW + cellW / 2;
      var cy = top + row * cellH + 32;
      out.push('  <g class="piece" data-piece="' + def.id + '" transform="translate(' + cx + ' ' + cy + ')">');
      out.push('    <title>' + escapeXml(def.label) + '</title>');
      out.push('    ' + pieceSvgShape(def, 24));
      out.push('  </g>');
      out.push('  <text x="' + cx + '" y="' + (cy + 44) +
        '" text-anchor="middle" font-family="Inter, sans-serif" font-size="10" font-weight="600" fill="#1a1208">' +
        escapeXml(def.label) + '</text>');
    });
    out.push('</svg>');
    return out.join('\n');
  }

  function downloadSvg(text, filename) {
    var blob = new Blob([text], { type: 'image/svg+xml;charset=utf-8' });
    downloadBlob(blob, filename);
  }

  function exportBoardSVG() {
    downloadSvg(buildBoardSVG(), safeName() + '-board.svg');
    toast('Board SVG saved. Open it in Tinkercad and extrude the tiles.');
    announce('Board SVG saved for 3D printing.');
  }

  function exportPiecesSVG() {
    downloadSvg(buildPiecesSVG(), safeName() + '-pieces.svg');
    toast('Piece sheet SVG saved. Extrude each piece.');
    announce('Piece sheet SVG saved for 3D printing.');
  }

  /* ------------------------------------------------------------------ */
  /* Events                                                              */
  /* ------------------------------------------------------------------ */

    }
    advanced.exportBackup = exportBackup;
    advanced.onRestoreBackup = onRestoreBackup;
    advanced.renderVersions = renderVersions;
    advanced.openVersions = openVersions;
    advanced.closeVersions = closeVersions;
    advanced.restoreVersion = restoreVersion;
    advanced.buildPlayableHTML = buildPlayableHTML;
    advanced.downloadPlayableHTML = downloadPlayableHTML;
    advanced.exportPlayableHTML = exportPlayableHTML;
    advanced.printKit = printKit;
    advanced.exportPNG = exportPNG;
    advanced.exportJSON = exportJSON;
    advanced.onLoadFile = onLoadFile;
    advanced.printDesignSheet = printDesignSheet;
    advanced.exportSheetPNG = exportSheetPNG;
    advanced.closePlayPreview = closePlayPreview;
    advanced.takeItHome = takeItHome;
    advanced.escapeXml = escapeXml;
    advanced.svgNumber = svgNumber;
    advanced.polygonPoints = polygonPoints;
    advanced.buildBoardSVG = buildBoardSVG;
    advanced.buildPiecesSVG = buildPiecesSVG;
    advanced.downloadSvg = downloadSvg;
    advanced.exportBoardSVG = exportBoardSVG;
    advanced.exportPiecesSVG = exportPiecesSVG;
    return advanced;
  };
})();
