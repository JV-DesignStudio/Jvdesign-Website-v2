/* ============================================================================
   Scratch Studio.
   Build a Scratch game in the browser, play it live, and export a real .sb3
   project file you can drag into Scratch. Loaded by workshops/scratch-studio.html.
   No external libraries.

   .sb3 = a zip containing project.json plus costume assets named by md5 of
   their bytes. We build both here.
   ============================================================================ */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function utf8(s) { return new TextEncoder().encode(s); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* ==========================================================================
     MD5 (RFC 1321), used to name Scratch costume assets.
     ========================================================================== */
  function md5(bytes) {
    var s = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
    var K = []; for (var i = 0; i < 64; i++) K[i] = (Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
    var len = bytes.length;
    var withOne = new Uint8Array((((len + 8) >> 6) + 1) * 64);
    withOne.set(bytes); withOne[len] = 0x80;
    var bitLen = len * 8;
    var dv = new DataView(withOne.buffer);
    dv.setUint32(withOne.length - 8, bitLen >>> 0, true);
    dv.setUint32(withOne.length - 4, Math.floor(bitLen / 4294967296) >>> 0, true);
    var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    function add(x, y) { return (x + y) >>> 0; }
    function rotl(x, c) { return ((x << c) | (x >>> (32 - c))) >>> 0; }
    for (var off = 0; off < withOne.length; off += 64) {
      var M = []; for (var j = 0; j < 16; j++) M[j] = dv.getUint32(off + j * 4, true);
      var A = a0, B = b0, C = c0, D = d0;
      for (i = 0; i < 64; i++) {
        var F, g;
        if (i < 16) { F = (B & C) | (~B & D); g = i; }
        else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
        else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
        else { F = C ^ (B | ~D); g = (7 * i) % 16; }
        F = (F + A + K[i] + M[g]) >>> 0;
        A = D; D = C; C = B; B = add(B, rotl(F, s[i]));
      }
      a0 = add(a0, A); b0 = add(b0, B); c0 = add(c0, C); d0 = add(d0, D);
    }
    function hex(x) { var out = ''; for (var k = 0; k < 4; k++) { var b = (x >>> (k * 8)) & 255; out += ('0' + b.toString(16)).slice(-2); } return out; }
    return hex(a0) + hex(b0) + hex(c0) + hex(d0);
  }

  /* ==========================================================================
     ZIP (stored, no compression), same approach as the Unity Studio.
     ========================================================================== */
  var CRC = (function () { var t = [], n, k, c; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function u16(v) { return [v & 255, (v >> 8) & 255]; }
  function u32(v) { return [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]; }
  function makeZip(files) {
    var chunks = [], central = [], offset = 0;
    files.forEach(function (f) {
      var nb = utf8(f.name), data = f.data, crc = crc32(data);
      var local = [].concat(u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(nb.length), u16(0));
      var h = new Uint8Array(local.length + nb.length); h.set(local, 0); h.set(nb, local.length);
      chunks.push(h, data);
      var cd = [].concat(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(nb.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset)).concat(Array.prototype.slice.call(nb));
      central.push(new Uint8Array(cd)); offset += h.length + data.length;
    });
    var cdSize = central.reduce(function (a, c) { return a + c.length; }, 0);
    var eocd = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdSize), u32(offset), u16(0)));
    var total = chunks.reduce(function (a, c) { return a + c.length; }, 0) + cdSize + eocd.length;
    var out = new Uint8Array(total), p = 0;
    chunks.forEach(function (c) { out.set(c, p); p += c.length; });
    central.forEach(function (c) { out.set(c, p); p += c.length; });
    out.set(eocd, p); return out;
  }

  /* ==========================================================================
     Scratch block builder.
     Builds a valid Scratch 3 blocks map from a small spec tree.
     ========================================================================== */
  function SB() { this.blocks = {}; this.n = 0; }
  SB.prototype.nid = function () { return 'b' + (++this.n); };
  SB.prototype.add = function (o) { var id = this.nid(); this.blocks[id] = { opcode: o.op, next: null, parent: null, inputs: o.inputs || {}, fields: o.fields || {}, shadow: !!o.shadow, topLevel: !!o.top }; return id; };
  SB.prototype.link = function (a, b) { this.blocks[a].next = b; this.blocks[b].parent = a; };
  // convert a spec input value into a Scratch input tuple
  SB.prototype.inputVal = function (val) {
    if (typeof val === 'number') return [1, [4, String(val)]];
    if (typeof val === 'string') return [1, [10, val]];
    if (val && val.menu) { var id = this.add({ op: val.menu, shadow: true, fields: (function () { var f = {}; f[val.field] = [val.value, null]; return f; })() }); return [1, id]; }
    if (val && val.block) return [2, this.build(val.block)];
    return [1, [10, String(val)]];
  };
  SB.prototype.build = function (node) {
    var self = this;
    var inputs = {};
    if (node.inputs) Object.keys(node.inputs).forEach(function (k) { inputs[k] = self.inputVal(node.inputs[k]); });
    var id = this.add({ op: node.op, fields: node.fields, inputs: inputs, top: node.top });
    if (node.cond) { var c = this.build(node.cond); this.blocks[id].inputs['CONDITION'] = [2, c]; this.blocks[c].parent = id; }
    if (node.sub && node.sub.length) {
      var first = null, prev = null;
      node.sub.forEach(function (child) { var cid = self.build(child); if (prev === null) { self.blocks[id].inputs['SUBSTACK'] = [2, cid]; self.blocks[cid].parent = id; } else { self.link(prev, cid); } prev = cid; });
    }
    return id;
  };
  SB.prototype.script = function (root) { var id = this.build(root); this.blocks[id].topLevel = true; this.blocks[id].parent = null; return id; };

  /* ==========================================================================
     Costume SVGs
     ========================================================================== */
  function svg(w, h, inner) { return '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' + inner + '</svg>'; }
  var BACKDROP = svg(480, 360, '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ad7ff"/><stop offset="1" stop-color="#dff2ff"/></linearGradient></defs><rect width="480" height="360" fill="url(#g)"/><rect y="300" width="480" height="60" fill="#7ec850"/><text x="240" y="40" text-anchor="middle" font-family="Verdana" font-size="22" fill="#26456b">Made in the JVDesign Studio</text>');
  function catSvg(color) { color = color || '#f59e0b'; return svg(100, 100, '<polygon points="18,30 30,6 44,28" fill="' + color + '"/><polygon points="56,28 70,6 82,30" fill="' + color + '"/><circle cx="50" cy="55" r="36" fill="' + color + '"/><circle cx="38" cy="50" r="5" fill="#2b2b2b"/><circle cx="62" cy="50" r="5" fill="#2b2b2b"/><path d="M44 66 q6 6 12 0" stroke="#2b2b2b" stroke-width="3" fill="none" stroke-linecap="round"/>'); }
  function appleSvg() { return svg(60, 60, '<path d="M30 16 q-18 0 -18 20 q0 20 18 22 q18 -2 18 -22 q0 -20 -18 -20z" fill="#e23b3b"/><rect x="28" y="6" width="4" height="12" fill="#7a4a22"/><path d="M32 12 q10 -8 16 0 q-8 6 -16 2z" fill="#3fae4a"/>'); }
  function starSvg() { return svg(72, 72, '<polygon points="36,4 45,28 70,28 50,44 58,68 36,53 14,68 22,44 2,28 27,28" fill="#ffd23f" stroke="#e0a800" stroke-width="3"/>'); }
  function buttonSvg(label, color) { color = color || '#5bc0f8'; return svg(160, 60, '<rect x="4" y="4" width="152" height="52" rx="14" fill="' + color + '" stroke="#1e3a5f" stroke-width="4"/><text x="80" y="38" text-anchor="middle" font-family="Verdana" font-size="22" fill="#0a2233">' + esc(label) + '</text>'); }

  function costume(svgText, name, w, h) { var bytes = utf8(svgText), id = md5(bytes); return { bytes: bytes, asset: { assetId: id, name: name, bitmapResolution: 1, md5ext: id + '.svg', dataFormat: 'svg', rotationCenterX: w / 2, rotationCenterY: h / 2 } }; }

  /* ==========================================================================
     TEMPLATES
     ========================================================================== */
  var TEMPLATES = {};

  TEMPLATES.catch = {
    label: 'Catch the Apple', emoji: '🍎',
    blurb: 'Move the cat with the arrow keys and catch falling apples. Every catch adds a point.',
    fields: [
      { id: 'catName', label: 'Cat name', type: 'text', value: 'Cat' },
      { id: 'catColor', label: 'Cat colour', type: 'color', value: '#f59e0b' },
      { id: 'speed', label: 'Move speed', value: 10, min: 4, max: 20, step: 1 },
      { id: 'target', label: 'Score to win', value: 10, min: 1, max: 30, step: 1 }
    ],
    controls: 'Move the cat with the Left and Right arrow keys. Catch as many apples as you can.',
    guide: function (v) {
      var cat = v.catName;
      return [
        { sprite: 'Stage', blocks: ['when green flag clicked', 'set Score to 0'] },
        { sprite: cat, blocks: ['when green flag clicked', 'forever', 'if key right arrow pressed', 'change x by ' + v.speed, 'if key left arrow pressed', 'change x by -' + v.speed] },
        { sprite: 'Apple', blocks: ['when green flag clicked', 'forever', 'go to x: pick random -200 to 200 y: 180', 'repeat until touching ' + cat, 'change y by -5', 'change Score by 1'] }
      ];
    },
    project: function (v, sb) {
      var scoreId = 'scoreVar';
      var stage = stageTarget(sb, { scoreId: scoreId, scoreName: 'Score' });
      // Cat
      var catBlocks = new SB();
      catBlocks.script({ op: 'event_whenflagclicked', top: true, sub: [
        { op: 'control_forever', sub: [
          { op: 'control_if', cond: { op: 'sensing_keypressed', inputs: { KEY_OPTION: { menu: 'sensing_keyoptions', field: 'KEY_OPTION', value: 'right arrow' } } }, sub: [{ op: 'motion_changexby', inputs: { DX: v.speed } }] },
          { op: 'control_if', cond: { op: 'sensing_keypressed', inputs: { KEY_OPTION: { menu: 'sensing_keyoptions', field: 'KEY_OPTION', value: 'left arrow' } } }, sub: [{ op: 'motion_changexby', inputs: { DX: -v.speed } }] }
        ] }
      ] });
      var cat = spriteTarget(catBlocks, v.catName, [costume(catSvg(v.catColor), 'cat', 100, 100)], 0, -110);
      // Apple
      var appleBlocks = new SB();
      appleBlocks.script({ op: 'event_whenflagclicked', top: true, sub: [
        { op: 'control_forever', sub: [
          { op: 'motion_gotoxy', inputs: { X: { block: { op: 'operator_random', inputs: { FROM: -200, TO: 200 } } }, Y: 180 } },
          { op: 'control_repeat_until', cond: { op: 'sensing_touchingobject', inputs: { TOUCHINGOBJECTMENU: { menu: 'sensing_touchingobjectmenu', field: 'TOUCHINGOBJECTMENU', value: v.catName } } }, sub: [{ op: 'motion_changeyby', inputs: { DY: -5 } }] },
          { op: 'data_changevariableby', fields: { VARIABLE: ['Score', scoreId] }, inputs: { VALUE: 1 } },
          { op: 'control_if', cond: { op: 'operator_gt', inputs: { OPERAND1: { block: { op: 'data_variable', fields: { VARIABLE: ['Score', scoreId] } } }, OPERAND2: v.target } }, sub: [{ op: 'looks_sayforsecs', inputs: { MESSAGE: 'You win!', SECS: 2 } }] }
        ] }
      ] });
      var apple = spriteTarget(appleBlocks, 'Apple', [costume(appleSvg(), 'apple', 60, 60)], 0, 120);
      return { stage: stage, sprites: [cat, apple], monitors: [monitor(scoreId, 'Score')] };
    },
    build: function (v) { return { v: v, t: 0, score: 0, win: false, cat: { x: 0, y: -110 }, apple: { x: 0, y: 170 } }; },
    sim: function (s, dt, input) {
      if (s.win) return;
      var v = s.v;
      if (input.left) { s.cat.x -= v.speed * 6 * dt; input.left = false; }
      if (input.right) { s.cat.x += v.speed * 6 * dt; input.right = false; }
      s.cat.x = Math.max(-220, Math.min(220, s.cat.x));
      s.apple.y -= 90 * dt;
      if (Math.abs(s.apple.x - s.cat.x) < 34 && Math.abs(s.apple.y - s.cat.y) < 34) { s.score++; s.apple.x = (Math.random() * 400 - 200); s.apple.y = 170; }
      if (s.apple.y < -170) { s.apple.x = (Math.random() * 400 - 200); s.apple.y = 170; }
      if (s.score >= v.target) s.win = true;
      s.t += dt;
    },
    draw: function (ctx, s) {
      drawStage(ctx);
      ctx.font = '16px Verdana'; ctx.fillStyle = '#1b4b1b'; ctx.textAlign = 'left'; ctx.fillText('Score: ' + s.score + ' / ' + s.v.target, 12, 24);
      drawSprite(ctx, s.cat.x, s.cat.y, 44, 44, s.v.catColor, 'cat');
      drawSprite(ctx, s.apple.x, s.apple.y, 30, 30, '#e23b3b', 'apple');
      if (s.win) { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 0, 480, 360); ctx.fillStyle = '#fff'; ctx.font = 'bold 26px Verdana'; ctx.textAlign = 'center'; ctx.fillText('You win!', 240, 180); }
    }
  };

  TEMPLATES.clicker = {
    label: 'Clicker', emoji: '👆',
    blurb: 'Click the star to earn points. Classic beginner Scratch: one sprite, one variable, one click.',
    fields: [
      { id: 'spriteName', label: 'Sprite name', type: 'text', value: 'Star' },
      { id: 'points', label: 'Points per click', value: 1, min: 1, max: 10, step: 1 },
      { id: 'target', label: 'Score to win', value: 20, min: 1, max: 100, step: 1 }
    ],
    controls: 'Click the star. Each click adds points.',
    guide: function (v) {
      return [
        { sprite: 'Stage', blocks: ['when green flag clicked', 'set Score to 0'] },
        { sprite: v.spriteName, blocks: ['when green flag clicked', 'forever', 'if Score >= ' + v.target, 'say "You win!"'] },
        { sprite: v.spriteName, blocks: ['when this sprite clicked', 'change Score by ' + v.points] }
      ];
    },
    project: function (v, sb) {
      var scoreId = 'scoreVar';
      var stage = stageTarget(sb, { scoreId: scoreId, scoreName: 'Score' });
      var blockA = new SB();
      blockA.script({ op: 'event_whenflagclicked', top: true, sub: [{ op: 'data_setvariableto', fields: { VARIABLE: ['Score', scoreId] }, inputs: { VALUE: 0 } }] });
      var clickBlocks = new SB();
      clickBlocks.script({ op: 'event_whenthisspriteclicked', top: true, sub: [{ op: 'data_changevariableby', fields: { VARIABLE: ['Score', scoreId] }, inputs: { VALUE: v.points } }] });
      var winBlocks = new SB();
      winBlocks.script({ op: 'event_whenflagclicked', top: true, sub: [{ op: 'control_forever', sub: [{ op: 'control_if', cond: { op: 'operator_gt', inputs: { OPERAND1: { block: { op: 'data_variable', fields: { VARIABLE: ['Score', scoreId] } } }, OPERAND2: v.target } }, sub: [{ op: 'looks_sayforsecs', inputs: { MESSAGE: 'You win!', SECS: 2 } }] }] }] });
      // merge the two scripts onto the one sprite
      var star = spriteTarget(mergeBlocks(blockA, clickBlocks, winBlocks), v.spriteName, [costume(starSvg(), 'star', 72, 72)], 0, 0);
      return { stage: stage, sprites: [star], monitors: [monitor(scoreId, 'Score')] };
    },
    build: function (v) { return { v: v, score: 0, win: false, pulse: 0 }; },
    sim: function (s, dt, input) { if (input.click) { input.click = false; s.score += s.v.points; s.pulse = 1; } s.pulse = Math.max(0, s.pulse - dt * 2); if (s.score >= s.v.target) s.win = true; },
    draw: function (ctx, s) {
      drawStage(ctx);
      ctx.font = '16px Verdana'; ctx.fillStyle = '#1b4b1b'; ctx.textAlign = 'left'; ctx.fillText('Score: ' + s.score + ' / ' + s.v.target, 12, 24);
      var r = 40 + s.pulse * 10;
      ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#e0a800'; ctx.lineWidth = 3;
      ctx.beginPath(); for (var i = 0; i < 10; i++) { var ang = Math.PI / 5 * i - Math.PI / 2, rr = i % 2 ? r * .45 : r; var x = 240 + Math.cos(ang) * rr, y = 180 + Math.sin(ang) * rr; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.fill(); ctx.stroke();
      if (s.win) { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 0, 480, 360); ctx.fillStyle = '#fff'; ctx.font = 'bold 26px Verdana'; ctx.textAlign = 'center'; ctx.fillText('You win!', 240, 180); }
    }
  };

  TEMPLATES.quiz = {
    label: 'Quiz', emoji: '❓',
    blurb: 'Ask a question with the ask block, check the answer with an if, and keep score. A classic school-friendly Scratch project.',
    fields: [
      { id: 'question', label: 'Question', type: 'text', value: 'What is 2 + 2?' },
      { id: 'answer', label: 'Correct answer', type: 'text', value: '4' },
      { id: 'spriteName', label: 'Sprite name', type: 'text', value: 'Button' },
      { id: 'target', label: 'Correct answers to win', value: 3, min: 1, max: 10, step: 1 }
    ],
    controls: 'Click the button to be asked the question. Type the answer in the play box.',
    guide: function (v) {
      return [
        { sprite: 'Stage', blocks: ['when green flag clicked', 'set Score to 0'] },
        { sprite: v.spriteName, blocks: ['when this sprite clicked', 'ask "' + v.question + '" and wait', 'if answer = ' + v.answer, 'change Score by 1', 'say "Correct!"', 'else', 'say "Try again"'] }
      ];
    },
    project: function (v, sb) {
      var scoreId = 'scoreVar';
      var stage = stageTarget(sb, { scoreId: scoreId, scoreName: 'Score' });
      var blocks = new SB();
      blocks.script({ op: 'event_whenthisspriteclicked', top: true, sub: [
        { op: 'sensing_askandwait', inputs: { QUESTION: v.question } },
        { op: 'control_if_else',
          cond: { op: 'operator_equals', inputs: { OPERAND1: { block: { op: 'sensing_answer' } }, OPERAND2: v.answer } },
          sub: [{ op: 'data_changevariableby', fields: { VARIABLE: ['Score', scoreId] }, inputs: { VALUE: 1 } }, { op: 'looks_sayforsecs', inputs: { MESSAGE: 'Correct!', SECS: 1.5 } }] }
      ] });
      // add the else branch manually
      var ifElseId = Object.keys(blocks.blocks).filter(function (k) { return blocks.blocks[k].opcode === 'control_if_else'; })[0];
      var sayId = blocks.add({ op: 'looks_sayforsecs', inputs: {} }); blocks.blocks[sayId].inputs.MESSAGE = [1, [10, 'Try again']]; blocks.blocks[sayId].inputs.SECS = [1, [4, '1.5']];
      blocks.blocks[ifElseId].inputs.SUBSTACK2 = [2, sayId]; blocks.blocks[sayId].parent = ifElseId;
      var button = spriteTarget(blocks, v.spriteName, [costume(buttonSvg('Answer', '#5bc0f8'), 'button', 160, 60)], 0, -120);
      return { stage: stage, sprites: [button], monitors: [monitor(scoreId, 'Score')] };
    },
    build: function (v) { return { v: v, score: 0, win: false, asking: false, typed: '', feedback: '' }; },
    sim: function (s, dt, input) {
      if (input.click) { input.click = false; s.asking = true; s.feedback = ''; s.typed = ''; }
      if (s.asking) { if (input.key === 'Enter' && s.typed) { if (s.typed.trim().toLowerCase() === String(s.v.answer).trim().toLowerCase()) { s.score++; s.feedback = 'Correct!'; } else { s.feedback = 'Try again'; } s.asking = false; if (s.score >= s.v.target) s.win = true; } }
    },
    draw: function (ctx, s) {
      drawStage(ctx);
      ctx.font = '16px Verdana'; ctx.fillStyle = '#1b4b1b'; ctx.textAlign = 'left'; ctx.fillText('Score: ' + s.score + ' / ' + s.v.target, 12, 24);
      ctx.fillStyle = '#5bc0f8'; roundRect(ctx, 160, 140, 160, 60, 14); ctx.fill();
      ctx.fillStyle = '#0a2233'; ctx.font = '22px Verdana'; ctx.textAlign = 'center'; ctx.fillText('Answer', 240, 178);
      if (s.asking) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, 480, 360); ctx.fillStyle = '#fff'; ctx.font = '20px Verdana'; ctx.fillText(s.v.question, 240, 150); ctx.font = '18px Verdana'; ctx.fillText('Type the answer and press Enter', 240, 190); ctx.fillStyle = '#ffd23f'; ctx.fillText('> ' + s.typed, 240, 225); }
      if (s.feedback) { ctx.fillStyle = s.feedback === 'Correct!' ? '#22c55e' : '#f87171'; ctx.font = 'bold 20px Verdana'; ctx.fillText(s.feedback, 240, 250); }
      if (s.win) { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 0, 480, 360); ctx.fillStyle = '#fff'; ctx.font = 'bold 26px Verdana'; ctx.fillText('You win!', 240, 180); }
    }
  };

  /* ---------- target helpers ---------- */
  function stageTarget(sb, opts) {
    var vars = {};
    vars[opts.scoreId] = [opts.scoreName, 0];
    // when green flag -> set Score to 0
    sb.script({ op: 'event_whenflagclicked', top: true, sub: [{ op: 'data_setvariableto', fields: { VARIABLE: [opts.scoreName, opts.scoreId] }, inputs: { VALUE: 0 } }] });
    var bc = costume(BACKDROP, 'backdrop1', 480, 360);
    return { isStage: true, name: 'Stage', variables: vars, lists: {}, broadcasts: {}, blocks: sb.blocks, comments: {}, currentCostume: 0, costumes: [bc.asset], sounds: [], volume: 100, layerOrder: 0, tempo: 60, videoTransparency: 50, videoState: 'off', textToSpeechLanguage: null };
  }
  function spriteTarget(sb, name, costumes, x, y) {
    return { isStage: false, name: name, variables: {}, lists: {}, broadcasts: {}, blocks: sb.blocks, comments: {}, currentCostume: 0, costumes: costumes.map(function (c) { return c.asset; }), sounds: [], volume: 100, layerOrder: 1, visible: true, x: x || 0, y: y || 0, size: 100, direction: 90, draggable: false, rotationStyle: 'all around' };
  }
  function mergeBlocks() {
    var out = new SB();
    var n = 0;
    for (var i = 0; i < arguments.length; i++) {
      var src = arguments[i].blocks;
      Object.keys(src).forEach(function (k) { out.blocks['m' + (++n)] = src[k]; });
    }
    return out;
  }
  function monitor(id, name) { return { id: id, mode: 'default', opcode: 'data_variable', params: { VARIABLE: name }, spriteName: null, value: 0, width: 0, height: 0, x: 5, y: 5, visible: true }; }

  /* ---------- stage draw helpers (preview) ---------- */
  function drawStage(ctx) {
    var g = ctx.createLinearGradient(0, 0, 0, 360); g.addColorStop(0, '#9ad7ff'); g.addColorStop(1, '#dff2ff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 480, 360);
    ctx.fillStyle = '#7ec850'; ctx.fillRect(0, 300, 480, 60);
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function drawSprite(ctx, x, y, w, h, color, kind) {
    var cx = 240 + x, cy = 180 - y;
    if (kind === 'cat') { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, cy, w / 2, 0, 6.283); ctx.fill(); ctx.fillStyle = '#2b2b2b'; ctx.beginPath(); ctx.arc(cx - 8, cy - 4, 3, 0, 6.283); ctx.arc(cx + 8, cy - 4, 3, 0, 6.283); ctx.fill(); }
    else if (kind === 'apple') { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, cy, w / 2, 0, 6.283); ctx.fill(); ctx.fillStyle = '#3fae4a'; ctx.fillRect(cx - 2, cy - h / 2 - 4, 4, 8); }
  }

  /* ==========================================================================
     UI
     ========================================================================== */
  var state = { game: 'catch', values: {}, sprites: [] };
  var sim = null, raf = null, last = 0;
  var input = { left: false, right: false, click: false, key: null };

  function defaults(id) { var o = {}, t = TEMPLATES[id]; t.fields.forEach(function (f) { o[f.id] = f.value; }); return o; }
  function readValues() { var o = {}, t = TEMPLATES[state.game]; t.fields.forEach(function (f) { var e = $(f.id); o[f.id] = !e ? f.value : (f.type === 'check' ? e.checked : (f.type === 'text' || f.type === 'color' ? e.value : (parseFloat(e.value) || f.value))); }); return o; }
  function currentValues() { var o = {}, t = TEMPLATES[state.game]; t.fields.forEach(function (f) { o[f.id] = state.values[f.id] !== undefined ? state.values[f.id] : f.value; }); return o; }

  function renderInspector() {
    var t = TEMPLATES[state.game], box = $('ssInspector'); if (!box) return; box.innerHTML = '';
    var card = el('div', 'ss-card');
    card.appendChild(el('div', 'ss-obj-head', '<span class="ss-obj-emoji">' + t.emoji + '</span> ' + t.label + ' <span class="ss-chip">Sprites &amp; values</span>'));
    var body = el('div'); body.style.display = 'block';
    t.fields.forEach(function (f) {
      var row = el('div', 'ss-field'); var lab = el('label', null, f.label); lab.setAttribute('for', f.id); row.appendChild(lab);
      var inp;
      if (f.type === 'color') { inp = el('input'); inp.type = 'color'; inp.value = currentValues()[f.id]; }
      else if (f.type === 'text') { inp = el('input'); inp.type = 'text'; inp.value = currentValues()[f.id]; }
      else { inp = el('input'); inp.type = 'number'; inp.value = currentValues()[f.id]; inp.min = f.min; inp.max = f.max; inp.step = f.step || 1; }
      inp.id = f.id;
      inp.addEventListener('input', function () { state.values[f.id] = f.type === 'text' || f.type === 'color' ? inp.value : (parseFloat(inp.value) || f.value); renderBlocks(); if (raf) startPlay(); });
      row.appendChild(inp); body.appendChild(row);
    });
    card.appendChild(body); box.appendChild(card);
  }

  function renderBlocks() {
    var t = TEMPLATES[state.game], box = $('ssBlocks'); if (!box) return; box.innerHTML = '';
    t.guide(currentValues()).forEach(function (group) {
      var card = el('div', 'ss-card');
      card.appendChild(el('div', 'ss-obj-head', '🐱 ' + esc(group.sprite)));
      var ul = el('div', 'ss-blocklist');
      group.blocks.forEach(function (b, i) { ul.appendChild(el('div', 'ss-block' + (i === 0 ? ' ss-hat' : ''), esc(b))); });
      card.appendChild(ul); box.appendChild(card);
    });
  }

  function startPlay() {
    state.values = readValues();
    sim = TEMPLATES[state.game].build(currentValues());
    last = 0; if (raf) cancelAnimationFrame(raf); loop(performance.now());
  }
  function stopPlay() { if (raf) { cancelAnimationFrame(raf); raf = null; } }
  function loop(ts) {
    var ctx = $('ssPlay'); if (!ctx) return; var c = ctx.getContext('2d');
    if (!last) last = ts; var dt = Math.min(.032, (ts - last) / 1000); last = ts;
    if (sim) { TEMPLATES[state.game].sim(sim, dt, input); TEMPLATES[state.game].draw(c, sim); }
    raf = requestAnimationFrame(loop);
  }

  function switchGame(id) {
    if (!TEMPLATES[id]) id = 'catch';
    state.game = id; state.values = defaults(id);
    var t = TEMPLATES[id];
    var blurb = $('ssBlurb'); if (blurb) blurb.textContent = t.blurb;
    var ctrl = $('ssControls'); if (ctrl) ctrl.textContent = t.controls;
    [].forEach.call(document.querySelectorAll('.ss-game-btn'), function (b) { b.classList.toggle('is-active', b.getAttribute('data-game') === id); });
    renderInspector(); renderBlocks(); refreshTree();
  }

  /* ==========================================================================
     EXPORT
     ========================================================================== */
  function buildSb3() {
    var t = TEMPLATES[state.game], v = currentValues();
    var stageSb = new SB();
    var assembled = t.project(v, stageSb);
    var targets = [assembled.stage].concat(assembled.sprites);
    var project = { targets: targets, monitors: assembled.monitors || [], extensions: [], meta: { semver: '3.0.0', vm: '0.2.0', agent: 'JVDataStudio Scratch Studio' } };
    // collect assets
    var files = [{ name: 'project.json', data: utf8(JSON.stringify(project)) }];
    var seen = {};
    [assembled.stage].concat(assembled.sprites).forEach(function (tg) { tg.costumes.forEach(function (c) { if (!seen[c.md5ext]) { seen[c.md5ext] = 1; } }); });
    // we stored only asset metadata; pull bytes from a fresh build
    var cost = collectCostumes(v, t);
    Object.keys(cost).forEach(function (md5ext) { files.push({ name: md5ext, data: cost[md5ext] }); });
    return { project: project, files: files };
  }
  function collectCostumes(v, t) {
    var out = {};
    function add(c) { out[c.asset.md5ext] = c.bytes; }
    add(costume(BACKDROP, 'backdrop1', 480, 360));
    if (state.game === 'catch') { add(costume(catSvg(v.catColor), 'cat', 100, 100)); add(costume(appleSvg(), 'apple', 60, 60)); }
    else if (state.game === 'clicker') { add(costume(starSvg(), 'star', 72, 72)); }
    else if (state.game === 'quiz') { add(costume(buttonSvg('Answer', '#5bc0f8'), 'button', 160, 60)); }
    return out;
  }

  function guideHtml() {
    var t = TEMPLATES[state.game], v = currentValues();
    var rows = t.guide(v).map(function (g) {
      return '<h3>' + esc(g.sprite) + '</h3><ul>' + g.blocks.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>';
    }).join('');
    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>' + esc(t.label) + ' blocks guide</title><style>body{font-family:Verdana,Arial,sans-serif;max-width:640px;margin:24px auto;padding:0 16px;color:#1b2a3a}h1{color:#ff7700}li{margin:4px 0}</style></head><body><h1>🐱 ' + esc(t.label) + ' blocks guide</h1><p>Build these blocks in Scratch, or open the .sb3 file to get them already made.</p>' + rows + '<p>Full guide: https://jvdesignstudio.co.uk/workshops/my-first-scratch-game.html</p></body></html>';
  }

  function refreshTree() {
    var tree = $('ssTree'); if (!tree) return;
    var name = ($('xProject') && $('xProject').value || 'MyScratchGame').replace(/[^A-Za-z0-9_.-]/g, '') || 'MyScratchGame';
    var t = TEMPLATES[state.game];
    var files = buildSb3().files;
    tree.textContent = name + '.sb3\n' + files.map(function (f) { return '├── ' + f.name; }).join('\n');
  }

  var msg = null;
  function download(name, bytes, type) {
    var blob = new Blob([bytes], { type: type });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
  }

  function boot() {
    msg = $('ssMsg');
    [].forEach.call(document.querySelectorAll('.ss-game-btn'), function (b) { b.addEventListener('click', function () { switchGame(b.getAttribute('data-game')); }); });
    [].forEach.call(document.querySelectorAll('.ss-tab'), function (btn) {
      btn.addEventListener('click', function () {
        [].forEach.call(document.querySelectorAll('.ss-tab'), function (b) { b.classList.remove('is-active'); });
        [].forEach.call(document.querySelectorAll('.ss-panel'), function (p) { p.classList.remove('is-active'); });
        btn.classList.add('is-active'); var p = $('panel-' + btn.getAttribute('data-tab')); if (p) p.classList.add('is-active');
        var tab = btn.getAttribute('data-tab');
        if (tab === 'play') startPlay(); else stopPlay();
        if (tab === 'export') refreshTree();
        if (tab === 'blocks') renderBlocks();
      });
    });
    var op = $('ssOpenPlay'); if (op) op.addEventListener('click', function () { var t = document.querySelector('.ss-tab[data-tab="play"]'); if (t) t.click(); });
    var rb = $('ssReset'); if (rb) rb.addEventListener('click', startPlay);
    var dl = $('xDownload'); if (dl) dl.addEventListener('click', function () {
      try {
        var name = (($('xProject') && $('xProject').value) || 'MyScratchGame').replace(/[^A-Za-z0-9_.-]/g, '') || 'MyScratchGame';
        var sb3 = buildSb3();
        download(name + '.sb3', makeZip(sb3.files), 'application/octet-stream');
        try { var c = parseInt(localStorage.getItem('jvds_tool_export_scratch-studio') || '0', 10) + 1; localStorage.setItem('jvds_tool_export_scratch-studio', String(c)); } catch (e) {}
        if (msg) { msg.className = 'ss-msg ok'; msg.textContent = 'Downloaded ' + name + '.sb3. Open scratch.mit.edu, then File and Load from your computer.'; }
      } catch (e) { if (msg) { msg.className = 'ss-msg bad'; msg.textContent = 'Something went wrong building the project. Try again.'; } }
    });
    var gl = $('xGuide'); if (gl) gl.addEventListener('click', function () {
      var name = (($('xProject') && $('xProject').value) || 'MyScratchGame').replace(/[^A-Za-z0-9_.-]/g, '') || 'MyScratchGame';
      download(name + '-blocks-guide.html', utf8(guideHtml()), 'text/html');
      if (msg) { msg.className = 'ss-msg ok'; msg.textContent = 'Downloaded the blocks guide. You can also print it.'; }
    });
    var xp = $('xProject'); if (xp) xp.addEventListener('input', refreshTree);
    // preview input
    var cp = $('ssPlay');
    if (cp) cp.addEventListener('click', function () { input.click = true; });
    document.addEventListener('keydown', function (e) { if (e.target && /input|textarea|select/i.test(e.target.tagName)) return; if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') input.left = true; if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') input.right = true; if (state.game === 'quiz') { if (e.key === 'Enter') input.key = 'Enter'; else if (e.key.length === 1) { /* typing handled by quiz via prompt below */ } } });
    document.addEventListener('keyup', function (e) { if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') input.left = false; if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') input.right = false; });
    // quiz typing: capture on window for the preview
    document.addEventListener('keypress', function (e) { if (state.game === 'quiz' && sim && sim.asking && e.key.length === 1) sim.typed += e.key; });
    document.addEventListener('keydown', function (e) { if (state.game === 'quiz' && sim && sim.asking && e.key === 'Backspace') sim.typed = sim.typed.slice(0, -1); });
    var want = (new URLSearchParams(location.search)).get('game');
    switchGame(TEMPLATES[want] ? want : 'catch');
  }

  if (typeof document === 'undefined') { if (typeof module !== 'undefined' && module.exports) module.exports = { md5: md5, makeZip: makeZip, TEMPLATES: TEMPLATES, buildSb3For: function (id, v) { state.game = id; state.values = v || defaults(id); return buildSb3(); } }; return; }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
