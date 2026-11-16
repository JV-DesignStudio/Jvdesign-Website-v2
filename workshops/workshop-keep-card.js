/* workshop-keep-card.js - one offline "keep what you made" card for workshops
 * whose project lives inside an engine (Roblox Studio, Minecraft, Unity,
 * Unreal, Blender, Stardew, Terraria, MUGEN, Tinkercad).
 *
 * The learner writes what they made and one thing they learned. The page draws
 * a 1200x630 PNG card they can download, print or show a grown-up, plus a short
 * share message they can copy. Nothing is uploaded and nothing leaves the
 * device: the text is stored in localStorage and the image is drawn locally.
 *
 * The block is added by scripts/apply-workshop-keep-card.js, which also adds
 * this script and style-workshop-keep-card.css to the page.
 *
 * API: window.JVDSKeepCard = { compose(id), shareText(id), download(id),
 *                              save(id), version }
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.top !== window.self) return;
  if (window.JVDSKeepCard) return;

  var VERSION = 1;
  var W = 1200;
  var H = 630;
  var INK = '#1a1208';
  var SOFT = '#3d3224';
  var PAPER = '#fbf8f2';
  var TEAL = '#4e7d80';
  var GOLD = '#c98a2e';
  var BORDER = '#e4dccb';
  var cards = [];

  function storageKey(id) {
    return 'jvds_workshop_card_' + id;
  }

  function readSaved(id) {
    try {
      var raw = localStorage.getItem(storageKey(id));
      var data = raw ? JSON.parse(raw) : null;
      return data && typeof data === 'object' ? data : {};
    } catch (e) {
      return {};
    }
  }

  function writeSaved(id, data) {
    try {
      localStorage.setItem(storageKey(id), JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  function findCard(id) {
    for (var i = 0; i < cards.length; i++) {
      if (!id || cards[i].id === id) return cards[i];
    }
    return null;
  }

  function fields(card) {
    return {
      made: (card.madeEl && card.madeEl.value || '').trim(),
      learned: (card.learnedEl && card.learnedEl.value || '').trim()
    };
  }

  function projectName(card) {
    var v = fields(card);
    return v.made || 'My workshop project';
  }

  function workshopTitle(card) {
    return card.title || 'a JVDS workshop';
  }

  function shareTextFor(card) {
    var v = fields(card);
    var lines = ['I made ' + projectName(card) + ' in the ' + workshopTitle(card) + ' workshop at JVDesignStudio.'];
    if (v.learned) lines.push('One thing I learned: ' + v.learned + '.');
    lines.push('You can make one too at https://jvdesignstudio.co.uk/workshops/' + card.id + '.html');
    return lines.join(' ');
  }

  function fit(ctx, text, maxWidth) {
    var value = String(text || '');
    if (ctx.measureText(value).width <= maxWidth) return value;
    while (value.length > 4 && ctx.measureText(value + '...').width > maxWidth) {
      value = value.slice(0, -1);
    }
    return value.replace(/[\s,;:.-]+$/, '') + '...';
  }

  function wrap(ctx, text, maxWidth) {
    var words = String(text || '').split(/\s+/);
    var lines = [];
    var line = '';
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawCard(card) {
    if (typeof document === 'undefined' || !document.createElement) return null;
    var v = fields(card);
    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = TEAL;
    ctx.fillRect(0, 0, W, 14);

    ctx.fillStyle = GOLD;
    for (var d = 0; d < 3; d++) {
      ctx.beginPath();
      ctx.arc(W - 96 + d * 26, 64, d === 1 ? 7 : 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = GOLD;
    ctx.font = '700 26px Inter, system-ui, sans-serif';
    ctx.fillText('I MADE THIS', 72, 104);

    ctx.fillStyle = INK;
    ctx.font = '700 66px Inter, system-ui, sans-serif';
    var titleLines = wrap(ctx, projectName(card), W - 144).slice(0, 3);
    var y = 196;
    for (var t = 0; t < titleLines.length; t++) {
      ctx.fillText(titleLines[t], 72, y);
      y += 78;
    }

    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(72, y + 6);
    ctx.lineTo(W - 72, y + 6);
    ctx.stroke();

    ctx.fillStyle = SOFT;
    ctx.font = '400 34px Inter, system-ui, sans-serif';
    var learned = v.learned ? 'One thing I learned: ' + v.learned : 'One thing I learned: (add it above and download again)';
    var learnLines = wrap(ctx, learned, W - 144).slice(0, 4);
    y += 66;
    for (var l = 0; l < learnLines.length; l++) {
      ctx.fillText(learnLines[l], 72, y);
      y += 46;
    }

    ctx.fillStyle = TEAL;
    ctx.font = '700 26px Inter, system-ui, sans-serif';
    ctx.fillText(fit(ctx, 'Made with ' + workshopTitle(card) + ' at JVDesignStudio', W - 240), 72, H - 84);

    ctx.fillStyle = SOFT;
    ctx.font = '400 24px Inter, system-ui, sans-serif';
    ctx.fillText('jvdesignstudio.co.uk', 72, H - 46);

    ctx.textAlign = 'right';
    var when = new Date();
    var stamp = '';
    try {
      stamp = when.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      stamp = when.toISOString().slice(0, 10);
    }
    ctx.fillText(stamp, W - 72, H - 46);

    return canvas;
  }

  function compose(id) {
    var card = findCard(id);
    if (!card) return '';
    var canvas = drawCard(card);
    if (!canvas) return '';
    try {
      return canvas.toDataURL('image/png');
    } catch (e) {
      return '';
    }
  }

  function setStatus(card, message, tone) {
    if (!card.statusEl) return;
    card.statusEl.textContent = message;
    if (tone) card.statusEl.setAttribute('data-tone', tone);
    else card.statusEl.removeAttribute('data-tone');
  }

  function save(card) {
    var v = fields(card);
    var ok = writeSaved(card.id, {
      version: VERSION,
      made: v.made,
      learned: v.learned,
      savedAt: new Date().toISOString()
    });
    if (!ok) setStatus(card, 'This browser will not save on the device, so download your card instead.', 'warn');
    return ok;
  }

  function download(id) {
    var card = findCard(id);
    if (!card) return false;
    var canvas = drawCard(card);
    if (!canvas) return false;
    var done = function (url, revoke) {
      var a = document.createElement('a');
      a.href = url;
      a.download = 'jvds-' + card.id + '-card.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (revoke) setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    };
    try {
      if (canvas.toBlob) {
        canvas.toBlob(function (blob) {
          if (!blob) {
            done(compose(card.id));
            return;
          }
          done(URL.createObjectURL(blob), true);
        }, 'image/png');
      } else {
        done(compose(card.id));
      }
    } catch (e) {
      return false;
    }
    save(card);
    setStatus(card, 'Card downloaded. Save it with your work and show it to someone.', 'good');
    try {
      window.dispatchEvent(new CustomEvent('jvds:keep-card', {
        detail: { workshop: card.id, action: 'download' }
      }));
    } catch (e) {}
    return true;
  }

  function copy(id) {
    var card = findCard(id);
    if (!card) return false;
    var text = shareTextFor(card);
    var after = function (ok) {
      if (ok) {
        save(card);
        setStatus(card, 'Share message copied. Paste it where you want to share.', 'good');
        try {
          window.dispatchEvent(new CustomEvent('jvds:keep-card', {
            detail: { workshop: card.id, action: 'copy' }
          }));
        } catch (e) {}
      } else {
        setStatus(card, 'Copy did not work here. Download your card instead.', 'warn');
      }
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { after(true); }, function () { after(false); });
        return true;
      }
    } catch (e) {}
    try {
      var box = document.createElement('textarea');
      box.value = text;
      box.setAttribute('readonly', '');
      box.style.position = 'fixed';
      box.style.left = '-9999px';
      document.body.appendChild(box);
      box.select();
      var ok = document.execCommand && document.execCommand('copy');
      document.body.removeChild(box);
      after(!!ok);
      return !!ok;
    } catch (e) {
      after(false);
      return false;
    }
  }

  function setup(box) {
    var id = box.getAttribute('data-workshop-keep');
    if (!id) return;
    var card = {
      id: id,
      title: box.getAttribute('data-workshop-title') || '',
      box: box,
      madeEl: box.querySelector('[data-keep-made]'),
      learnedEl: box.querySelector('[data-keep-learned]'),
      statusEl: box.querySelector('[data-keep-status]'),
      downloadBtn: box.querySelector('[data-keep-download]'),
      copyBtn: box.querySelector('[data-keep-copy]')
    };
    var saved = readSaved(id);
    if (saved.made && card.madeEl) card.madeEl.value = saved.made;
    if (saved.learned && card.learnedEl) card.learnedEl.value = saved.learned;

    if (card.downloadBtn) {
      card.downloadBtn.addEventListener('click', function () { download(id); });
    }
    if (card.copyBtn) {
      card.copyBtn.addEventListener('click', function () { copy(id); });
    }
    var onEdit = function () { save(card); };
    if (card.madeEl) card.madeEl.addEventListener('change', onEdit);
    if (card.learnedEl) card.learnedEl.addEventListener('change', onEdit);

    cards.push(card);
  }

  function init() {
    var boxes = document.querySelectorAll('[data-workshop-keep]');
    for (var i = 0; i < boxes.length; i++) setup(boxes[i]);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.JVDSKeepCard = {
    version: VERSION,
    compose: compose,
    download: download,
    copy: copy,
    shareText: function (id) {
      var card = findCard(id);
      return card ? shareTextFor(card) : '';
    },
    save: function (id) {
      var card = findCard(id);
      return card ? save(card) : false;
    },
    count: function () { return cards.length; }
  };
})();
