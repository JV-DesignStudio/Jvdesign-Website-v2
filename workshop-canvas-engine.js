/**
 * Workshop Canvas Engine
 *
 * Each workshop page sets window.CW_CONFIG before loading this script:
 *   {
 *     storageKey: 'jvds-snake-canvas',
 *     downloadName: 'my-snake-game.html',
 *     steps: [ { num, title, goal, points[], challenge, starter, solution, checks[], height, fills?, quiz? } ],
 *     templates: { 1: fn(userCode) => fullHTML, 2: fn(userCode) => fullHTML, ... },
 *     hints: [ 'Step 1 hint', 'Step 2 hint', ... ]
 *   }
 */
'use strict';
/* A1363:CANVAS_GUIDES:start */
var CANVAS_GUIDE_MAP = {
  "cpp-breakout-canvas.html": "cpp-breakout-workshop.html",
  "cpp-platformer-canvas.html": "cpp-platformer-workshop.html",
  "cpp-platformer-part2-canvas.html": "cpp-platformer-part2-workshop.html",
  "cpp-pong-canvas.html": "cpp-pong-workshop.html",
  "cpp-snake-canvas.html": "cpp-snake-workshop.html",
  "cpp-tower-part1-canvas.html": "cpp-tower-part1-workshop.html",
  "cpp-tower-part2-canvas.html": "cpp-tower-part2-workshop.html",
  "defold-dungeon-canvas.html": "defold-dungeon-workshop.html",
  "defold-platformer-canvas.html": "defold-platformer-workshop.html",
  "defold-pong-canvas.html": "defold-pong-workshop.html",
  "defold-puzzle-canvas.html": "defold-puzzle-workshop.html",
  "defold-shooter-canvas.html": "defold-shooter-workshop.html",
  "defold-snake-canvas.html": "defold-snake-workshop.html",
  "gdevelop-adventure-canvas.html": "gdevelop-adventure-workshop.html",
  "gdevelop-platformer-canvas.html": "gdevelop-platformer-workshop.html",
  "gdevelop-pointclick-canvas.html": "gdevelop-pointclick-workshop.html",
  "gdevelop-pong-canvas.html": "gdevelop-pong-workshop.html",
  "gdevelop-shooter-canvas.html": "gdevelop-shooter-workshop.html",
  "gdevelop-snake-canvas.html": "gdevelop-snake-workshop.html",
  "gml-breakout-canvas.html": "gml-breakout-workshop.html",
  "gml-platformer-canvas.html": "gml-platformer-workshop.html",
  "gml-pong-canvas.html": "gml-pong-workshop.html",
  "gml-rpg-canvas.html": "gml-rpg-workshop.html",
  "godot-gatekeeper-3d-part1-canvas.html": "godot-gatekeeper-3d-part1.html",
  "godot-gatekeeper-3d-part2-canvas.html": "godot-gatekeeper-3d-part2.html",
  "godot-gdscript-essentials-canvas.html": "godot-gdscript-essentials.html",
  "godot-racing-2-canvas.html": "godot-racing-workshop-2.html",
  "godot-racing-canvas.html": "godot-racing-workshop.html",
  "godot-tutorial-canvas.html": "godot_tutorial.html",
  "java-breakout-canvas.html": "java-breakout-workshop.html",
  "java-platformer-canvas.html": "java-platformer-workshop.html",
  "java-pong-canvas.html": "java-pong-workshop.html",
  "java-rpg-part1-canvas.html": "java-rpg-part1-workshop.html",
  "java-rpg-part2-canvas.html": "java-rpg-part2-workshop.html",
  "java-rpg-part3-canvas.html": "java-rpg-part3-workshop.html",
  "java-space-canvas.html": "java-space-workshop.html",
  "my-first-cpp-game-canvas.html": "my-first-cpp-game.html",
  "my-first-defold-game-canvas.html": "my-first-defold-game.html",
  "my-first-gdevelop-game-canvas.html": "my-first-gdevelop-game.html",
  "my-first-pico8-game-canvas.html": "my-first-pico8-game.html",
  "my-first-python-game-canvas.html": "my-first-python-game.html",
  "my-first-scratch-game-canvas.html": "my-first-scratch-game.html",
  "night-watch-canvas.html": "night-watch-workshop.html",
  "pico8-dungeon-canvas.html": "pico8-dungeon-workshop.html",
  "pico8-match3-canvas.html": "pico8-match3-workshop.html",
  "pico8-platformer-canvas.html": "pico8-platformer-workshop.html",
  "pico8-pong-canvas.html": "pico8-pong-workshop.html",
  "pico8-shooter-canvas.html": "pico8-shooter-workshop.html",
  "pico8-snake-canvas.html": "pico8-snake-workshop.html",
  "python-breakout-canvas.html": "python-breakout-workshop.html",
  "python-breakout-part2-canvas.html": "python-breakout-part2-workshop.html",
  "python-catch-canvas.html": "python-catch-workshop.html",
  "python-dodge-canvas.html": "python-dodge-workshop.html",
  "python-maze-canvas.html": "python-maze-workshop.html",
  "python-platformer-canvas.html": "python-platformer-workshop.html",
  "python-platformer-part2-canvas.html": "python-platformer-part2-workshop.html",
  "scratch-catch-canvas.html": "scratch-catch-workshop.html",
  "scratch-clicker-canvas.html": "scratch-clicker-workshop.html",
  "scratch-maze-canvas.html": "scratch-maze-workshop.html",
  "scratch-platformer-canvas.html": "scratch-platformer-workshop.html",
  "scratch-quiz-canvas.html": "scratch-quiz-workshop.html"
};
/* A1363:CANVAS_GUIDES:end */

/* A1365:CANVAS_NEXT:start */
var CANVAS_NEXT_MAP = {
  "cpp-breakout-canvas.html": {
    "href": "cpp-platformer-canvas.html",
    "label": "C++ Platformer"
  },
  "cpp-platformer-canvas.html": {
    "href": "cpp-platformer-part2-canvas.html",
    "label": "C++ Platformer Part 2"
  },
  "cpp-platformer-part2-canvas.html": {
    "href": "cpp-tower-part1-canvas.html",
    "label": "C++ Tower Defence Part 1"
  },
  "cpp-pong-canvas.html": {
    "href": "cpp-snake-canvas.html",
    "label": "C++ Snake"
  },
  "cpp-snake-canvas.html": {
    "href": "cpp-breakout-canvas.html",
    "label": "C++ Breakout"
  },
  "cpp-tower-part1-canvas.html": {
    "href": "cpp-tower-part2-canvas.html",
    "label": "C++ Tower Defence Part 2"
  },
  "godot-gatekeeper-3d-part1-canvas.html": {
    "href": "godot-gatekeeper-3d-part2-canvas.html",
    "label": "Godot Gatekeeper 3D Part 2"
  },
  "java-rpg-part1-canvas.html": {
    "href": "java-rpg-part2-canvas.html",
    "label": "Java RPG Battle Canvas"
  },
  "java-rpg-part2-canvas.html": {
    "href": "java-rpg-part3-canvas.html",
    "label": "Java RPG Finale"
  },
  "python-breakout-canvas.html": {
    "href": "python-breakout-part2-canvas.html",
    "label": "Python Breakout Part 2"
  },
  "python-catch-canvas.html": {
    "href": "python-dodge-canvas.html",
    "label": "Python Dodge"
  },
  "python-dodge-canvas.html": {
    "href": "python-maze-canvas.html",
    "label": "Python Maze"
  },
  "python-maze-canvas.html": {
    "href": "python-breakout-canvas.html",
    "label": "Python Breakout"
  },
  "python-platformer-canvas.html": {
    "href": "python-platformer-part2-canvas.html",
    "label": "Python Platformer Part 2"
  }
};
/* A1365:CANVAS_NEXT:end */

/* A1378:CANVAS_STUDIO:start */
var CANVAS_STUDIO_MAP = {
  "cpp-breakout-canvas.html": { "href": "cpp-mod-studio.html", "label": "C++ Mod Studio" },
  "cpp-platformer-canvas.html": { "href": "cpp-mod-studio.html", "label": "C++ Mod Studio" },
  "cpp-platformer-part2-canvas.html": { "href": "cpp-mod-studio.html", "label": "C++ Mod Studio" },
  "cpp-pong-canvas.html": { "href": "cpp-mod-studio.html", "label": "C++ Mod Studio" },
  "cpp-snake-canvas.html": { "href": "cpp-mod-studio.html", "label": "C++ Mod Studio" },
  "cpp-tower-part1-canvas.html": { "href": "cpp-mod-studio.html", "label": "C++ Mod Studio" },
  "cpp-tower-part2-canvas.html": { "href": "cpp-mod-studio.html", "label": "C++ Mod Studio" },
  "my-first-cpp-game-canvas.html": { "href": "cpp-mod-studio.html", "label": "C++ Mod Studio" },
  "godot-gatekeeper-3d-part1-canvas.html": { "href": "godot-mod-studio.html", "label": "Godot Mod Studio" },
  "godot-gatekeeper-3d-part2-canvas.html": { "href": "godot-mod-studio.html", "label": "Godot Mod Studio" },
  "godot-gdscript-essentials-canvas.html": { "href": "godot-mod-studio.html", "label": "Godot Mod Studio" },
  "godot-platformer-canvas.html": { "href": "godot-mod-studio.html", "label": "Godot Mod Studio" },
  "godot-puzzle-canvas.html": { "href": "godot-mod-studio.html", "label": "Godot Mod Studio" },
  "godot-racing-2-canvas.html": { "href": "godot-mod-studio.html", "label": "Godot Mod Studio" },
  "godot-racing-canvas.html": { "href": "godot-mod-studio.html", "label": "Godot Mod Studio" },
  "godot-tutorial-canvas.html": { "href": "godot-mod-studio.html", "label": "Godot Mod Studio" },
  "night-watch-canvas.html": { "href": "godot-mod-studio.html", "label": "Godot Mod Studio" },
  "python-breakout-canvas.html": { "href": "python-mod-studio.html", "label": "Python Mod Studio" },
  "python-breakout-part2-canvas.html": { "href": "python-mod-studio.html", "label": "Python Mod Studio" },
  "python-catch-canvas.html": { "href": "python-mod-studio.html", "label": "Python Mod Studio" },
  "python-dodge-canvas.html": { "href": "python-mod-studio.html", "label": "Python Mod Studio" },
  "python-maze-canvas.html": { "href": "python-mod-studio.html", "label": "Python Mod Studio" },
  "python-platformer-canvas.html": { "href": "python-mod-studio.html", "label": "Python Mod Studio" },
  "python-platformer-part2-canvas.html": { "href": "python-mod-studio.html", "label": "Python Mod Studio" },
  "my-first-python-game-canvas.html": { "href": "python-mod-studio.html", "label": "Python Mod Studio" },
  "scratch-catch-canvas.html": { "href": "scratch-studio.html", "label": "Scratch Studio" },
  "scratch-clicker-canvas.html": { "href": "scratch-studio.html", "label": "Scratch Studio" },
  "scratch-maze-canvas.html": { "href": "scratch-studio.html", "label": "Scratch Studio" },
  "scratch-platformer-canvas.html": { "href": "scratch-studio.html", "label": "Scratch Studio" },
  "scratch-pong-canvas.html": { "href": "scratch-studio.html", "label": "Scratch Studio" },
  "scratch-quiz-canvas.html": { "href": "scratch-studio.html", "label": "Scratch Studio" },
  "my-first-scratch-game-canvas.html": { "href": "scratch-studio.html", "label": "Scratch Studio" },
  "pico8-dungeon-canvas.html": { "href": "pico8-studio.html", "label": "PICO-8 Studio" },
  "pico8-match3-canvas.html": { "href": "pico8-studio.html", "label": "PICO-8 Studio" },
  "pico8-platformer-canvas.html": { "href": "pico8-studio.html", "label": "PICO-8 Studio" },
  "pico8-pong-canvas.html": { "href": "pico8-studio.html", "label": "PICO-8 Studio" },
  "pico8-shooter-canvas.html": { "href": "pico8-studio.html", "label": "PICO-8 Studio" },
  "pico8-snake-canvas.html": { "href": "pico8-studio.html", "label": "PICO-8 Studio" },
  "my-first-pico8-game-canvas.html": { "href": "pico8-studio.html", "label": "PICO-8 Studio" }
};
/* A1378:CANVAS_STUDIO:end */

(function() {

var CFG = window.CW_CONFIG;
if (!CFG) return;

var STEPS = CFG.steps;
var TEMPLATES = CFG.templates;

var currentStep = 0;
var completed = {};
var editors = {};
var debounceTimer = null;
var codeValid = {};
var quizPassed = {};
var quizSelected = {};

/* ── SHARED WORKSHOP ENGINE BRIDGE ──
   When the page loads workshop-engine.js, award the site-wide XP/streak
   system as each build step is completed, and mirror our own progress into
   its saveProgress() so my-progress.html and the XP bar stay in sync. */
function wsAwardXp(amount, label) {
  try {
    if (window._wsEngine && window._wsEngine.awardXp) window._wsEngine.awardXp(amount, label);
    else if (window.awardXp) window.awardXp(amount, label);
  } catch (e) {}
}
function wsSaveShared() {
  try {
    if (window._wsEngine && window._wsEngine.saveProgress) window._wsEngine.saveProgress();
    else if (window.saveProgress) window.saveProgress();
  } catch (e) {}
}
function wsXpPerStep() {
  try {
    if (window._wsEngine && window._wsEngine.XP_CODE) return window._wsEngine.XP_CODE;
  } catch (e) {}
  return 20;
}
/* Mirror our step count into the shared progress bar (#progressCount,
   #progressFill, #stepDots) so the familiar header widgets stay in sync,
   and let the shared saveProgress() see our completed steps. */
function wsSyncProgress() {
  var done = Object.keys(completed).length;
  var countEl = document.getElementById('progressCount');
  var fillEl = document.getElementById('progressFill');
  var dotsEl = document.getElementById('stepDots');
  if (countEl) countEl.textContent = done + ' / ' + STEPS.length + ' steps';
  if (fillEl) fillEl.style.width = (done / STEPS.length * 100) + '%';
  if (dotsEl) {
    dotsEl.innerHTML = '';
    STEPS.forEach(function (s, i) {
      var d = document.createElement('div');
      d.className = 'step-dot' + (completed[s.num] ? ' done' : (i === currentStep ? ' active' : ''));
      d.textContent = s.num;
      d.onclick = function () {
        var card = document.getElementById('card-' + s.num);
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
      dotsEl.appendChild(d);
    });
  }
}

function loadState() {
  try {
    var state = JSON.parse(localStorage.getItem(CFG.storageKey));
    if (state) {
      currentStep = state.currentStep || 0;
      completed = state.completed || {};
    }
  } catch(e) {}
}

function saveState() {
  try {
    var codes = {};
    STEPS.forEach(function(s) {
      if (editors[s.num]) codes[s.num] = editors[s.num].value;
    });
    localStorage.setItem(CFG.storageKey, JSON.stringify({
      currentStep: currentStep,
      completed: completed,
      codes: codes
    }));
  } catch(e) {}
}

function getSavedCode(num) {
  try {
    var state = JSON.parse(localStorage.getItem(CFG.storageKey));
    return state && state.codes && state.codes[num];
  } catch(e) { return null; }
}

function renderSteps() {
  var panel = document.getElementById('stepsPanel');
  panel.innerHTML = '';
  STEPS.forEach(function(step, i) {
    var card = document.createElement('div');
    card.className = 'cw-step';
    card.id = 'card-' + step.num;
    if (i === currentStep) card.classList.add('active');
    else if (completed[step.num]) card.classList.add('completed');
    else if (i > currentStep && !completed[step.num]) card.classList.add('locked');

    var isDone = !!completed[step.num];
    var isActive = (i === currentStep);

    card.innerHTML =
      '<div class="cw-step-head">' +
        '<span class="cw-step-num">' + step.num + '</span>' +
        '<h3>' + step.title + '</h3>' +
        (step.activity ? '<span class="cw-activity">' + step.activity + '</span>' : '') +
      '</div>' +
      '<p class="cw-goal">' + step.goal + '</p>' +
      (step.checkpoint ? '<p class="cw-checkpoint"><strong>Checkpoint:</strong> ' + step.checkpoint + '</p>' : '') +
      '<ul class="cw-explain">' + step.points.map(function(p) { return '<li>' + p + '</li>'; }).join('') + '</ul>' +
      '<div class="cw-challenge">' + step.challenge + '</div>' +
      '<textarea class="cw-editor" id="editor-' + step.num + '"' +
        ' aria-label="Code editor for step ' + step.num + '"' +
        ' spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off"' +
        ' style="min-height:' + (step.height || 100) + 'px"' +
        (isDone ? ' readonly' : '') +
        (!isActive && !isDone ? ' disabled' : '') +
      '></textarea>' +
      '<div class="cw-actions">' +
        '<button class="cw-btn cw-btn-check' + (isDone ? ' done' : '') + '"' +
          ' onclick="CW.checkStep(' + step.num + ')"' +
          (isDone ? ' disabled' : '') + '>' +
          (isDone ? '✓ Done' : 'Apply to Canvas ▶') +
        '</button>' +
        (isDone ? '' :
          '<button class="cw-btn cw-btn-show" onclick="CW.showSolution(' + step.num + ')">Show Solution</button>' +
          '<button class="cw-btn cw-btn-reset" onclick="CW.resetStep(' + step.num + ')">Reset</button>'
        ) +
      '</div>' +
      '<div class="cw-feedback" id="feedback-' + step.num + '"></div>';

    if (step.fills && (isActive || isDone)) {
      var parts = step.fills.text.split('___');
      var fillHtml = '<div class="cw-fills"><div class="cw-fills-head">✏️ Fill in the Blanks</div><div class="cw-fills-sentence">';
      for (var fi = 0; fi < parts.length; fi++) {
        fillHtml += parts[fi];
        if (fi < step.fills.answers.length) {
          fillHtml += '<input class="cw-fill-blank" id="fill-' + step.num + '-' + fi + '"' +
            ' aria-label="Fill blank ' + (fi + 1) + ' for step ' + step.num + '"' +
            ' data-answer="' + step.fills.answers[fi] + '"' +
            ' placeholder="···"' +
            (isDone ? ' disabled' : '') + '>';
        }
      }
      fillHtml += '</div>';
      if (!isDone) {
        fillHtml += '<div class="cw-fills-actions">' +
          '<button class="cw-btn cw-btn-show" onclick="CW.checkFills(' + step.num + ')">Check Blanks</button>' +
          '<span class="cw-fills-fb" id="fills-fb-' + step.num + '"></span>' +
          '</div>';
      }
      fillHtml += '</div>';
      card.innerHTML += fillHtml;
    }

    if (step.quiz && (isActive || isDone)) {
      var letters = ['A', 'B', 'C', 'D'];
      var qHtml = '<div class="cw-quiz"><div class="cw-quiz-head">❓ Knowledge Check</div>' +
        '<div class="cw-quiz-question">' + step.quiz.question + '</div>' +
        '<div class="cw-quiz-opts" id="quiz-opts-' + step.num + '">';
      step.quiz.options.forEach(function(opt, oi) {
        var cls = 'cw-quiz-opt';
        if (isDone || quizPassed[step.num]) {
          if (oi === step.quiz.correct) cls += ' correct';
          else if (quizSelected[step.num] === oi) cls += ' wrong';
        } else if (quizSelected[step.num] === oi) {
          cls += ' selected';
        }
        qHtml += '<div class="' + cls + '"' +
          (isDone || quizPassed[step.num] ? '' : ' onclick="CW.selectQuiz(' + step.num + ',' + oi + ')"') +
          '><span class="cw-quiz-letter">' + letters[oi] + '</span>' + opt + '</div>';
      });
      qHtml += '</div>';
      if (!isDone && !quizPassed[step.num]) {
        qHtml += '<div class="cw-quiz-actions">' +
          '<button class="cw-btn cw-btn-check" onclick="CW.checkQuiz(' + step.num + ')">Check Answer</button>' +
          '</div>';
      }
      qHtml += '<div class="cw-quiz-fb" id="quiz-fb-' + step.num + '"></div>';
      if (codeValid[step.num] && !quizPassed[step.num] && !isDone) {
        qHtml += '<div class="cw-gate-msg">Code looks good! Answer the quiz to complete this step.</div>';
      }
      qHtml += '</div>';
      card.innerHTML += qHtml;
    }

    panel.appendChild(card);

    var ta = document.getElementById('editor-' + step.num);
    var saved = getSavedCode(step.num);
    if (isDone) {
      ta.value = completed[step.num];
    } else {
      ta.value = saved || step.starter;
    }
    editors[step.num] = ta;

    if (isActive) {
      ta.addEventListener('input', function() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(updateCanvas, 350);
      });
      ta.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
          e.preventDefault();
          var s = this.selectionStart, end = this.selectionEnd;
          this.value = this.value.substring(0, s) + '  ' + this.value.substring(end);
          this.selectionStart = this.selectionEnd = s + 2;
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(updateCanvas, 350);
        }
      });
    }
  });
}

var BLANK_PLACEHOLDER = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
  'body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;' +
  'background:#0a0e14;color:#8b96a5;font-family:system-ui,sans-serif;text-align:center;padding:24px}' +
  'strong{color:#ffc078;display:block;font-size:1.05rem;margin-bottom:6px}</style></head><body>' +
  '<div><strong>Fill in the blanks to see your game</strong>' +
  'Replace the ___ with real code, then watch this panel come alive.</div></body></html>';

/* ── Shared preview visual layer ──
   Injected into every generated preview so all build-along pages share one
   richer look: a fitted rounded canvas, a glow/vignette frame, and an optional
   drawing helper (window.CWArt) for gradients, glow and rounded shapes.
   Everything is inline (no network requests) to keep the school-computer rule. */
var ART_KIT = '<script id="cw-art">(function(){' +
  'var A={};' +
  'A.bg=function(c,w,h,top,bot){var g=c.createLinearGradient(0,0,0,h);' +
    'g.addColorStop(0,top||"#16203c");g.addColorStop(1,bot||"#0a0d18");' +
    'c.fillStyle=g;c.fillRect(0,0,w,h);};' +
  'A.grid=function(c,w,h,step,col){step=step||40;c.save();c.strokeStyle=col||"rgba(255,255,255,.05)";' +
    'c.lineWidth=1;for(var x=step;x<w;x+=step){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}' +
    'for(var y=step;y<h;y+=step){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}c.restore();};' +
  'A.glow=function(c,col,blur,fn){c.save();c.shadowColor=col||"rgba(255,119,0,.9)";c.shadowBlur=blur||14;' +
    'try{fn(c);}finally{c.restore();}};' +
  'A.roundRect=function(c,x,y,w,h,r){if(c.roundRect){c.beginPath();c.roundRect(x,y,w,h,r);return;}' +
    'r=Math.min(r||6,w/2,h/2);c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);' +
    'c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();};' +
  'A.spark=function(c,x,y,col,size){c.save();c.globalAlpha=.9;c.fillStyle=col||"#ffd166";' +
    'c.beginPath();c.arc(x,y,size||2,0,Math.PI*2);c.fill();c.restore();};' +
  'window.CWArt=A;})()<\/script>';

var PREVIEW_CSS = '<style id="cw-polish">' +
  'html,body{height:100%;background:radial-gradient(1200px 640px at 50% -10%,rgba(255,119,0,.12),transparent 60%),' +
  'radial-gradient(1000px 560px at 50% 120%,rgba(96,165,250,.12),transparent 60%),#0f1220!important;}' +
  'body{position:relative;justify-content:center;}' +
  'canvas{max-width:100%;max-height:100%;width:auto;height:auto;border-radius:14px;' +
  'box-shadow:0 12px 34px rgba(0,0,0,.55),0 0 0 2px rgba(255,255,255,.06),0 0 46px rgba(255,119,0,.14);' +
  'filter:saturate(1.14) contrast(1.05);}' +
  '#cw-fx{position:fixed;inset:0;pointer-events:none;z-index:2147483646;' +
  'background:repeating-linear-gradient(0deg,rgba(255,255,255,.022) 0 1px,transparent 1px 3px),' +
  'radial-gradient(125% 125% at 50% 50%,transparent 52%,rgba(0,0,0,.5) 100%);}' +
  '#cw-fx::after{content:"";position:absolute;inset:0;border-radius:16px;' +
  'box-shadow:inset 0 0 0 2px rgba(255,119,0,.14);}' +
  '</style>';

var FX_OVERLAY = '<div id="cw-fx" aria-hidden="true"></div>';

function injectHead(html, markup) {
  return html.indexOf('</head>') !== -1 ? html.replace('</head>', markup + '</head>') : markup + html;
}
function injectBody(html, markup) {
  return html.indexOf('<body>') !== -1 ? html.replace('<body>', '<body>' + markup) : markup + html;
}
function withArtKit(html) {
  return html.indexOf('CWArt') !== -1 ? injectBody(html, ART_KIT) : html;
}
function polishPreview(html) {
  return injectHead(withArtKit(injectBody(html, FX_OVERLAY)), PREVIEW_CSS);
}

function hasUnfilled(code) {
  return /\?{2,}|_{3,}/.test(code);
}

function updateCanvas() {
  var step = STEPS[currentStep];
  var code = editors[step.num] ? editors[step.num].value : step.starter;
  var frame = document.getElementById('gameFrame');
  if (hasUnfilled(code)) {
    frame.srcdoc = polishPreview(BLANK_PLACEHOLDER);
  } else {
    var html = polishPreview(TEMPLATES[step.num](code));
    frame.srcdoc = html;
  }
  saveState();

  if (CFG.hints && CFG.hints[currentStep] !== undefined) {
    document.getElementById('canvasHint').textContent = CFG.hints[currentStep];
  }
}

function updateProgress() {
  var count = Object.keys(completed).length;
  var fillEl = document.getElementById('cwProgressFill');
  var textEl = document.getElementById('cwProgressText');
  if (fillEl) fillEl.style.width = (count / STEPS.length * 100) + '%';
  if (textEl) textEl.textContent =
    count === STEPS.length ? 'Complete!' : 'Step ' + (currentStep + 1) + ' / ' + STEPS.length;
  wsSyncProgress();
}

function checkStep(num) {
  if (completed[num]) return;
  var step = STEPS.find(function(s) { return s.num === num; });
  var code = editors[num].value.toLowerCase();
  var missing = step.checks.filter(function(c) { return code.indexOf(String(c).toLowerCase()) === -1; });
  var fb = document.getElementById('feedback-' + num);

  if (missing.length === 0) {
    codeValid[num] = true;
    fb.className = 'cw-feedback success';
    if (!step.quiz || quizPassed[num]) {
      fb.textContent = '✓ Step ' + num + ' complete! Your game just leveled up.';
      advanceStep(num);
    } else {
      renderSteps();
      var gateFb = document.getElementById('feedback-' + num);
      if (gateFb) {
        gateFb.className = 'cw-feedback success';
        gateFb.textContent = '✓ Code is correct! Now answer the Knowledge Check below.';
      }
      var quizEl = document.getElementById('quiz-opts-' + num);
      if (quizEl) quizEl.closest('.cw-quiz').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  } else {
    fb.className = 'cw-feedback error';
    fb.textContent = 'Almost! Make sure your code includes: ' +
      missing.map(function(m) { return '"' + m + '"'; }).join(', ');
  }
}

function advanceStep(num) {
  var firstTime = !completed[num];
  completed[num] = editors[num].value;
  if (currentStep < STEPS.length - 1) currentStep++;
  updateProgress();
  renderSteps();
  updateCanvas();
  if (firstTime) {
    wsAwardXp(wsXpPerStep(), 'Build step ' + num);
    wsSaveShared();
    cwCelebrate(num);
  }
  var next = document.getElementById('card-' + STEPS[currentStep].num);
  if (next) next.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ── Celebrations ── */
function cwCelebrate(num) {
  var card = document.getElementById('card-' + num);
  if (card) card.classList.add('cw-just-done');

  var frame = document.querySelector('.cw-canvas-frame');
  if (frame) {
    frame.classList.add('cw-frame-glow');
    setTimeout(function() { frame.classList.remove('cw-frame-glow'); }, 1500);
  }

  cwShowXpPopup(card);
  cwConfetti(card);

  var doneCount = Object.keys(completed).length;
  if (doneCount === STEPS.length) {
    cwMilestone('All Steps Complete!', 'You built the whole game!');
  } else if (doneCount === Math.floor(STEPS.length / 2)) {
    cwMilestone('Halfway There!', doneCount + ' of ' + STEPS.length + ' steps done');
  }
}

function cwShowXpPopup(anchor) {
  var xp = wsXpPerStep();
  var el = document.createElement('div');
  el.className = 'cw-xp-popup';
  el.textContent = '+' + xp + ' XP';
  if (anchor) {
    var r = anchor.getBoundingClientRect();
    el.style.left = (r.left + r.width / 2 - 30) + 'px';
    el.style.top = (r.top - 10) + 'px';
  } else {
    el.style.left = '50%'; el.style.top = '40%';
  }
  document.body.appendChild(el);
  setTimeout(function() { el.remove(); }, 1300);
}

function cwConfetti(anchor) {
  var container = document.createElement('div');
  container.className = 'cw-confetti';
  var colors = ['#ff7700','#ffd166','#4ade80','#60a5fa','#a78bfa','#ff5470','#22d3ee'];
  var r = anchor ? anchor.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0 };
  var cx = r.left + r.width / 2;
  var cy = r.top;
  for (var i = 0; i < 30; i++) {
    var p = document.createElement('div');
    p.className = 'cw-confetti-piece';
    p.style.background = colors[i % colors.length];
    p.style.left = (cx + (Math.random() - .5) * 200) + 'px';
    p.style.top = (cy + (Math.random() - .5) * 40) + 'px';
    p.style.width = (5 + Math.random() * 6) + 'px';
    p.style.height = (5 + Math.random() * 6) + 'px';
    p.style.animationDuration = (1 + Math.random() * .8) + 's';
    p.style.animationDelay = (Math.random() * .15) + 's';
    container.appendChild(p);
  }
  document.body.appendChild(container);
  setTimeout(function() { container.remove(); }, 2200);
}

function cwMilestone(title, sub) {
  var el = document.createElement('div');
  el.className = 'cw-milestone';
  el.innerHTML = '<div class="cw-milestone-icon">' +
    (title.indexOf('All') === 0 ? '🎉' : '🚀') +
    '</div><div class="cw-milestone-text">' + title +
    '</div><div class="cw-milestone-sub">' + sub + '</div>';
  document.body.appendChild(el);
  setTimeout(function() {
    el.style.animation = 'cwMilestoneOut .4s ease forwards';
    setTimeout(function() { el.remove(); }, 500);
  }, 2200);
}

function selectQuiz(num, idx) {
  quizSelected[num] = idx;
  var opts = document.querySelectorAll('#quiz-opts-' + num + ' .cw-quiz-opt');
  opts.forEach(function(el, i) {
    el.className = 'cw-quiz-opt' + (i === idx ? ' selected' : '');
  });
}

function checkQuiz(num) {
  var step = STEPS.find(function(s) { return s.num === num; });
  if (quizSelected[num] === undefined) return;
  var fb = document.getElementById('quiz-fb-' + num);
  if (quizSelected[num] === step.quiz.correct) {
    quizPassed[num] = true;
    fb.className = 'cw-quiz-fb pass';
    fb.textContent = '✓ Correct!';
    var opts = document.querySelectorAll('#quiz-opts-' + num + ' .cw-quiz-opt');
    opts.forEach(function(el, i) {
      el.onclick = null;
      el.style.cursor = 'default';
      if (i === step.quiz.correct) el.className = 'cw-quiz-opt correct';
      else if (i === quizSelected[num]) el.className = 'cw-quiz-opt wrong';
      else el.className = 'cw-quiz-opt';
    });
    if (codeValid[num]) {
      var mainFb = document.getElementById('feedback-' + num);
      mainFb.className = 'cw-feedback success';
      mainFb.textContent = '✓ Step ' + num + ' complete! Your game just leveled up.';
      advanceStep(num);
    }
  } else {
    fb.className = 'cw-quiz-fb fail';
    fb.textContent = 'Not quite - try again!';
    var opts = document.querySelectorAll('#quiz-opts-' + num + ' .cw-quiz-opt');
    opts.forEach(function(el, i) {
      if (i === quizSelected[num]) el.className = 'cw-quiz-opt wrong';
    });
  }
}

function checkFills(num) {
  var step = STEPS.find(function(s) { return s.num === num; });
  var allCorrect = true;
  step.fills.answers.forEach(function(ans, i) {
    var input = document.getElementById('fill-' + num + '-' + i);
    if (input.value.trim().toLowerCase() === ans.toLowerCase()) {
      input.className = 'cw-fill-blank correct';
    } else {
      input.className = 'cw-fill-blank wrong';
      allCorrect = false;
    }
  });
  var fb = document.getElementById('fills-fb-' + num);
  fb.textContent = allCorrect ? '✓ All correct!' : 'Some blanks need fixing.';
  fb.style.color = allCorrect ? '#4ade80' : '#ff7b93';
}

function showSolution(num) {
  var step = STEPS.find(function(s) { return s.num === num; });
  editors[num].value = step.solution;
  updateCanvas();
  var fb = document.getElementById('feedback-' + num);
  fb.className = 'cw-feedback success';
  fb.textContent = 'Solution filled in - study it, then click "Apply to Canvas" when ready.';
}

function resetStep(num) {
  var step = STEPS.find(function(s) { return s.num === num; });
  editors[num].value = step.starter;
  updateCanvas();
  var fb = document.getElementById('feedback-' + num);
  fb.className = 'cw-feedback';
  fb.style.display = 'none';
}

function downloadGame() {
  var lastDone = 0;
  STEPS.forEach(function(s) { if (completed[s.num]) lastDone = s.num; });
  var target = lastDone || STEPS[currentStep].num;
  var code = completed[target] || editors[target].value;
  var html = withArtKit(TEMPLATES[target](code));
  var blob = new Blob([html], { type: 'text/html' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = CFG.downloadName || 'my-game.html';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* Focus iframe on click so keyboard input works */
document.getElementById('canvasPanel').addEventListener('click', function(e) {
  if (e.target.tagName !== 'BUTTON') {
    var f = document.getElementById('gameFrame');
    if (f) f.focus();
  }
});

/* Expose public API for onclick handlers */
window.CW = {
  checkStep: checkStep,
  showSolution: showSolution,
  resetStep: resetStep,
  selectQuiz: selectQuiz,
  checkQuiz: checkQuiz,
  checkFills: checkFills,
  downloadGame: downloadGame
};

/* Init */
loadState();
renderSteps();
updateCanvas();
updateProgress();

})();

/* A1363:canvas-back-link: one shared canvas -> step-by-step guide back-link */
(function(){
  try{
    if(!window.CANVAS_GUIDE_MAP) return;
    var here=(location.pathname.split('/').pop()||'').toLowerCase();
    var guide=CANVAS_GUIDE_MAP[here];
    if(!guide) return;
    var header=document.querySelector('.cw-header');
    if(!header) return;
    var a=document.createElement('a');
    a.className='cw-guide-link';
    a.href='/workshops/'+guide;
    a.textContent='\u2190 Read the step-by-step guide';
    header.appendChild(a);
  }catch(e){}
})();

/* A1364:canvas-topbar: slim branded bar so every build-along feels part of JVDS
   and always has a way back to the workshop hub. Injected once here so all
   canvas pages (and any future one) inherit it. */
(function(){
  try{
    if(document.querySelector('.cw-topbar')) return;
    var bar=document.createElement('header');
    bar.className='cw-topbar';
    bar.setAttribute('role','banner');
    var brand=document.createElement('a');
    brand.className='cw-topbar-brand';
    brand.href='/';
    brand.innerHTML='<img src="/logo.png" alt="" width="26" height="26"><span>JVDesignStudio</span>';
    var chip=document.createElement('span');
    chip.className='cw-topbar-char';
    chip.innerHTML='<img src="/assets/mascots/ember-badge.webp" alt="" width="20" height="20">Build it with Ember';
    var back=document.createElement('a');
    back.className='cw-topbar-back';
    back.href='/workshop';
    back.textContent='\u2190 All workshops';
    bar.appendChild(brand); bar.appendChild(chip); bar.appendChild(back);
    document.body.insertBefore(bar, document.body.firstChild);
  }catch(e){}
})();

/* A1365:canvas-next: export hand-off to the engine guide and the next project */
(function(){
  try{
    if(!window.CANVAS_GUIDE_MAP) return;
    var here=(location.pathname.split('/').pop()||'').toLowerCase();
    var guide=CANVAS_GUIDE_MAP[here];
    var next=(window.CANVAS_NEXT_MAP||{})[here];
    var studio=(window.CANVAS_STUDIO_MAP||{})[here];
    if(!guide && !next && !studio) return;
    var panel=document.querySelector('.cw-canvas-panel');
    if(!panel) return;
    var tagEl=document.querySelector('.cw-lang-tag');
    var engineName=tagEl?((tagEl.textContent||'').replace(/[^A-Za-z0-9+#]/g,'').trim()||'your engine'):'your engine';
    var box=document.createElement('div');
    box.className='cw-next';
    var html='<p class="cw-next-head">Kept your work? Keep going</p>';
    if(studio) html+='<a class="cw-next-btn cw-next-btn--studio" href="/workshops/'+studio.href+'">Open the full '+studio.label+' \u2192</a>';
    if(guide) html+='<a class="cw-next-btn cw-next-btn--main" href="/workshops/'+guide+'">Keep building in '+engineName+' \u2192</a>';
    if(next) html+='<a class="cw-next-btn" href="/workshops/'+next.href+'">What to add next: '+next.label+' \u2192</a>';
    html+='<a class="cw-next-btn" href="/workshop">Browse all workshops</a>';
    box.innerHTML=html;
    panel.appendChild(box);
  }catch(e){}
})();
