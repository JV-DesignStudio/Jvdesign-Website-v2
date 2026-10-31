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
  "js-breakout-canvas.html": "js-breakout-workshop.html",
  "js-flappy-canvas.html": "js-flappy-workshop.html",
  "js-memory-canvas.html": "js-memory-workshop.html",
  "js-platformer-part2-canvas.html": "js-platformer-part2-workshop.html",
  "js-snake-canvas.html": "js-snake-workshop.html",
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
  "roblox-adventure-canvas.html": "roblox-adventure-workshop.html",
  "roblox-battle-canvas.html": "roblox-battle-workshop.html",
  "roblox-collapse-obby-canvas.html": "roblox-collapse-obby-workshop.html",
  "roblox-corruption-obby-canvas.html": "roblox-corruption-obby-workshop.html",
  "roblox-horror-canvas.html": "roblox-horror-workshop.html",
  "roblox-obby-canvas.html": "roblox-obby-workshop.html",
  "roblox-pirate-canvas.html": "roblox-pirate-workshop.html",
  "roblox-sim-lockdown-1-canvas.html": "roblox-sim-lockdown-1-workshop.html",
  "roblox-sim-lockdown-2-canvas.html": "roblox-sim-lockdown-2-workshop.html",
  "roblox-sim-lockdown-3-canvas.html": "roblox-sim-lockdown-3-workshop.html",
  "roblox-simulator-canvas.html": "roblox-simulator-workshop.html",
  "roblox-tycoon-canvas.html": "roblox-tycoon-workshop.html",
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
  },
  "js-breakout-canvas.html": {
    "href": "js-flappy-canvas.html",
    "label": "JS Flappy"
  },
  "js-flappy-canvas.html": {
    "href": "js-memory-canvas.html",
    "label": "JS Memory"
  },
  "js-memory-canvas.html": {
    "href": "js-snake-canvas.html",
    "label": "JS Snake"
  },
  "js-snake-canvas.html": {
    "href": "js-breakout-canvas.html",
    "label": "JS Breakout"
  },
  "roblox-obby-canvas.html": {
    "href": "roblox-tycoon-canvas.html",
    "label": "Roblox Tycoon"
  },
  "roblox-tycoon-canvas.html": {
    "href": "roblox-adventure-canvas.html",
    "label": "Roblox Adventure"
  },
  "roblox-adventure-canvas.html": {
    "href": "roblox-battle-canvas.html",
    "label": "Roblox Battle"
  },
  "roblox-battle-canvas.html": {
    "href": "roblox-simulator-canvas.html",
    "label": "Roblox Simulator"
  },
  "roblox-simulator-canvas.html": {
    "href": "roblox-horror-canvas.html",
    "label": "Roblox Horror"
  },
  "roblox-horror-canvas.html": {
    "href": "roblox-pirate-canvas.html",
    "label": "Roblox Pirate"
  },
  "roblox-pirate-canvas.html": {
    "href": "roblox-collapse-obby-canvas.html",
    "label": "Roblox Collapse Obby"
  },
  "roblox-collapse-obby-canvas.html": {
    "href": "roblox-corruption-obby-canvas.html",
    "label": "Roblox Corruption Obby"
  },
  "roblox-corruption-obby-canvas.html": {
    "href": "roblox-sim-lockdown-1-canvas.html",
    "label": "Roblox Sim Lockdown 1"
  },
  "roblox-sim-lockdown-1-canvas.html": {
    "href": "roblox-sim-lockdown-2-canvas.html",
    "label": "Roblox Sim Lockdown 2"
  },
  "roblox-sim-lockdown-2-canvas.html": {
    "href": "roblox-sim-lockdown-3-canvas.html",
    "label": "Roblox Sim Lockdown 3"
  },
  "roblox-sim-lockdown-3-canvas.html": {
    "href": "roblox-obby-canvas.html",
    "label": "Roblox Obby"
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
  "my-first-pico8-game-canvas.html": { "href": "pico8-studio.html", "label": "PICO-8 Studio" },
  "defold-dungeon-canvas.html": { "href": "defold-mod-studio.html", "label": "Defold Mod Studio" },
  "defold-platformer-canvas.html": { "href": "defold-mod-studio.html", "label": "Defold Mod Studio" },
  "defold-pong-canvas.html": { "href": "defold-mod-studio.html", "label": "Defold Mod Studio" },
  "defold-puzzle-canvas.html": { "href": "defold-mod-studio.html", "label": "Defold Mod Studio" },
  "defold-shooter-canvas.html": { "href": "defold-mod-studio.html", "label": "Defold Mod Studio" },
  "defold-snake-canvas.html": { "href": "defold-mod-studio.html", "label": "Defold Mod Studio" },
  "my-first-defold-game-canvas.html": { "href": "defold-mod-studio.html", "label": "Defold Mod Studio" },
  "java-breakout-canvas.html": { "href": "java-mod-studio.html", "label": "Java Mod Studio" },
  "java-platformer-canvas.html": { "href": "java-mod-studio.html", "label": "Java Mod Studio" },
  "java-pong-canvas.html": { "href": "java-mod-studio.html", "label": "Java Mod Studio" },
  "java-rpg-part1-canvas.html": { "href": "java-mod-studio.html", "label": "Java Mod Studio" },
  "java-rpg-part2-canvas.html": { "href": "java-mod-studio.html", "label": "Java Mod Studio" },
  "java-rpg-part3-canvas.html": { "href": "java-mod-studio.html", "label": "Java Mod Studio" },
  "java-space-canvas.html": { "href": "java-mod-studio.html", "label": "Java Mod Studio" },
  "gml-breakout-canvas.html": { "href": "gml-mod-studio.html", "label": "GameMaker Mod Studio" },
  "gml-platformer-canvas.html": { "href": "gml-mod-studio.html", "label": "GameMaker Mod Studio" },
  "gml-pong-canvas.html": { "href": "gml-mod-studio.html", "label": "GameMaker Mod Studio" },
  "gml-rpg-canvas.html": { "href": "gml-mod-studio.html", "label": "GameMaker Mod Studio" },
  "gdevelop-adventure-canvas.html": { "href": "gdevelop-mod-studio.html", "label": "GDevelop Mod Studio" },
  "gdevelop-platformer-canvas.html": { "href": "gdevelop-mod-studio.html", "label": "GDevelop Mod Studio" },
  "gdevelop-pointclick-canvas.html": { "href": "gdevelop-mod-studio.html", "label": "GDevelop Mod Studio" },
  "gdevelop-pong-canvas.html": { "href": "gdevelop-mod-studio.html", "label": "GDevelop Mod Studio" },
  "gdevelop-shooter-canvas.html": { "href": "gdevelop-mod-studio.html", "label": "GDevelop Mod Studio" },
  "gdevelop-snake-canvas.html": { "href": "gdevelop-mod-studio.html", "label": "GDevelop Mod Studio" },
  "my-first-gdevelop-game-canvas.html": { "href": "gdevelop-mod-studio.html", "label": "GDevelop Mod Studio" },
  "roblox-obby-canvas.html": { "href": "roblox-mod-studio.html", "label": "Roblox Mod Studio" },
  "roblox-tycoon-canvas.html": { "href": "roblox-mod-studio.html", "label": "Roblox Mod Studio" },
  "roblox-adventure-canvas.html": { "href": "roblox-mod-studio.html", "label": "Roblox Mod Studio" },
  "roblox-battle-canvas.html": { "href": "roblox-mod-studio.html", "label": "Roblox Mod Studio" },
  "roblox-simulator-canvas.html": { "href": "roblox-mod-studio.html", "label": "Roblox Mod Studio" },
  "roblox-horror-canvas.html": { "href": "roblox-mod-studio.html", "label": "Roblox Mod Studio" },
  "roblox-pirate-canvas.html": { "href": "roblox-mod-studio.html", "label": "Roblox Mod Studio" },
  "roblox-collapse-obby-canvas.html": { "href": "roblox-mod-studio.html", "label": "Roblox Mod Studio" },
  "roblox-corruption-obby-canvas.html": { "href": "roblox-mod-studio.html", "label": "Roblox Mod Studio" },
  "roblox-sim-lockdown-1-canvas.html": { "href": "roblox-mod-studio.html", "label": "Roblox Mod Studio" },
  "roblox-sim-lockdown-2-canvas.html": { "href": "roblox-mod-studio.html", "label": "Roblox Mod Studio" },
  "roblox-sim-lockdown-3-canvas.html": { "href": "roblox-mod-studio.html", "label": "Roblox Mod Studio" }
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
var cwXpLocal = 0;

/* ── LIVE "WHAT YOUR CODE DID" LAYER ──
   Purely additive. Names the current step over the canvas and, as the learner
   types, shows a live line under the editor naming what the step still needs.
   It never changes checkStep / quiz behaviour, so existing build-alongs keep
   working exactly as before. */
var LIVE_CSS = '<style id="cw-live-style">' +
  '.cw-what{font-family:Fredoka,cursive;font-size:.85rem;color:#ffd166;margin:0 0 12px;padding:8px 12px;' +
  'background:rgba(255,209,102,.08);border:1px solid rgba(255,209,102,.22);border-radius:9px;line-height:1.4}' +
  '.cw-live{margin-top:8px;font-size:.8rem;line-height:1.45;display:none}' +
  '.cw-live.todo{display:block;color:#ffb020}' +
  '.cw-live.ok{display:block;color:#4ade80}' +
  '.cw-live code{background:rgba(255,255,255,.08);border-radius:4px;padding:1px 5px;font-size:.78rem}' +
  '.cw-remix{margin-top:14px;padding:12px 14px;border-radius:11px;background:rgba(74,222,128,.08);' +
  'border:1px solid rgba(74,222,128,.28);font-size:.82rem;color:#e8eaf2;line-height:1.5}' +
  '.cw-remix strong{color:#4ade80}' +
  '.cw-remix a{color:#4ade80;font-weight:700}' +
  '</style>';
function ensureLiveStyle() {
  try { if (!document.getElementById('cw-live-style') && document.head) document.head.insertAdjacentHTML('beforeend', LIVE_CSS); } catch (e) {}
}

function ensureWhat() {
  var panel = document.getElementById('canvasPanel');
  if (!panel) return null;
  var el = document.getElementById('cwWhat');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cwWhat';
    el.className = 'cw-what';
    var prog = panel.querySelector('.cw-progress');
    if (prog && prog.parentNode === panel) panel.insertBefore(el, prog.nextSibling);
    else panel.insertBefore(el, panel.firstChild);
  }
  return el;
}

function updateWhat(step) {
  var el = ensureWhat();
  if (el && step) el.innerHTML = 'Step ' + step.num + ': ' + step.goal;
}

function updateLive(num) {
  var el = document.getElementById('live-' + num);
  var step = STEPS.find(function (s) { return s.num === num; });
  var ta = editors[num];
  if (!el || !step || !ta) return;
  var checks = step.checks || [];
  if (!checks.length) { el.className = 'cw-live'; el.innerHTML = ''; return; }
  var code = (ta.value || '').toLowerCase();
  var missing = checks.filter(function (c) { return code.indexOf(String(c).toLowerCase()) === -1; });
  if (missing.length === 0) {
    el.className = 'cw-live ok';
    el.innerHTML = '\u2705 Everything this step needs is in your code. Watch the canvas.';
  } else {
    el.className = 'cw-live todo';
    el.innerHTML = 'Your code still needs: ' + missing.map(function (m) { return '<code>' + m + '</code>'; }).join(', ');
  }
}

/* Offered once every step is complete: a plain invitation to remix and keep
   their own version, pointing at the export buttons already on the page.
   If CFG.nextStep = { url, label } is set the box also links to the
   recommended next lesson so the learner has a clear route forward. */
function offerRemix() {
  var panel = document.getElementById('canvasPanel');
  if (!panel || panel.querySelector('.cw-remix')) return;
  var box = document.createElement('div');
  box.className = 'cw-remix';
  var nextHtml = '';
  if (CFG.nextStep && CFG.nextStep.url && CFG.nextStep.label) {
    nextHtml = ' <a href="' + CFG.nextStep.url + '">Next: ' + CFG.nextStep.label + ' &rarr;</a>';
  }
  box.innerHTML = '<strong>Make it your own.</strong> You built the whole game. Change any number or colour, ' +
    'then use <em>Download My Game</em> (or the project export) to keep your version. Every build-along can become a different game. ' +
    '<a href="/me.html">See this in My Studio &rarr;</a>' + nextHtml;
  panel.appendChild(box);
}

/* ── SHARED WORKSHOP ENGINE BRIDGE ──
   When the page loads workshop-engine.js, award the site-wide XP/streak
   system as each build step is completed, and mirror our own progress into
   its saveProgress() so my-progress.html and the XP bar stay in sync. */
function wsAwardXp(amount, label) {
  try {
    if (window._wsEngine && window._wsEngine.awardXp) { window._wsEngine.awardXp(amount, label); return; }
    else if (window.awardXp) { window.awardXp(amount, label); return; }
  } catch (e) {}
  /* Thin-shell build-alongs load no shared XP system, so keep a local
     ledger and mirror it into the strip (A1526). */
  cwXpLocal += amount;
  try {
    var xl = document.getElementById('xpLabel');
    if (xl) xl.textContent = cwXpLocal + ' XP';
  } catch (e) {}
}
function wsSaveShared() {
  try {
    if (window._wsEngine && window._wsEngine.saveProgress) window._wsEngine.saveProgress();
    else if (window.saveProgress) window.saveProgress();
  } catch (e) {}
}
/* A1707: report a finished build-along to the shared profile ledger. Converted
   guide pages carry a profile id (body data-profile-id) but the canvas engine
   is what completes the steps, so markWorkshopCompleted() had no caller and
   completions vanished from my-progress. Mark once, only when every step is
   done, and only on pages that actually belong to a profile. */
function wsMarkProfileComplete() {
  if (Object.keys(completed).length < STEPS.length) return;
  var pid = null;
  try {
    var bd = document.body;
    pid = (bd && bd.dataset && bd.dataset.profileId) || window.WORKSHOP_PROFILE_ID || CFG.profileId || null;
    /* Converted hub pages (for example my-first-cpp-game.html) carry a legacy
       window.WORKSHOP_KEY rather than a profile id, so map that key to the id
       the profile ledger expects. */
    if (!pid && window.WORKSHOP_KEY && window.WORKSHOP_KEY_TO_ID) {
      pid = window.WORKSHOP_KEY_TO_ID[window.WORKSHOP_KEY] || null;
    }
  } catch (e) {}
  if (!pid) return;
  try {
    if (window.playerProfile && typeof window.playerProfile.markWorkshopCompleted === 'function') {
      window.playerProfile.markWorkshopCompleted(pid);
    }
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
    /* A1425: ledger fingerprint so canvas XP counts in the site totals.
       scanComponentXP only sees {xp:number, total:number, completed:[]},
       which the engine state shape is not, so mirror a tiny read-only
       ledger beside it. Same storage key family, no migration needed. */
    var doneNums = Object.keys(completed).map(function(n) { return +n; });
    localStorage.setItem(CFG.storageKey + ':ledger', JSON.stringify({
      xp: doneNums.length * wsXpPerStep(),
      total: STEPS.length,
      completed: doneNums
    }));
    savePassport(codes);
    wsMarkProfileComplete();
  } catch(e) {}
}

/* ── A1382: project passport ──
   A portable snapshot of the learner's project, so their own work can travel to
   the next lesson (or into an exported engine project) instead of starting blank.
   House rule: we carry what they built, we do not rewrite it. Written to
   localStorage, which the backpack already collects. */
var PASSPORT_SERIES = CFG.series || passportSeries(location.pathname);
var PASSPORT_LESSON = CFG.lesson || passportLesson(location.pathname);
// One passport per lesson, so starting a later lesson never clobbers an earlier
// one before the learner has chosen to bring it forward.
var PASSPORT_KEY = 'jvds.project.' + PASSPORT_SERIES + '.l' + PASSPORT_LESSON;
var PASSPORT_PREFIX = 'jvds.project.' + PASSPORT_SERIES + '.l';

function passportSeries(path) {
  var f = (path.split('/').pop() || '').replace(/\.html$/i, '');
  return f.replace(/-canvas$/i, '').replace(/-part\d+$/i, '').replace(/-p\d+$/i, '');
}
function passportLesson(path) {
  var f = (path.split('/').pop() || '');
  var m = f.match(/-part(\d+)-canvas\.html$/i) || f.match(/-p(\d+)-canvas\.html$/i);
  return m ? Number(m[1]) : 1;
}
function passportEngine() {
  var t = document.querySelector('.cw-lang-tag');
  var s = t ? (t.textContent || '').replace(/[^A-Za-z0-9+#]/g, '').trim() : '';
  return s || 'browser';
}
function buildPassport(codes) {
  if (!codes) {
    codes = {};
    STEPS.forEach(function(s) { if (editors[s.num]) codes[s.num] = editors[s.num].value; });
  }
  var page = (location.pathname.split('/').pop() || '').toLowerCase();
  var nxt = (window.CANVAS_NEXT_MAP || {})[page];
  return {
    format: 'jvds.project',
    version: 1,
    engine: passportEngine(),
    series: PASSPORT_SERIES,
    lesson: PASSPORT_LESSON,
    title: (document.title || '').replace(/\s*\|\s*JVDesignStudio\s*$/i, '').trim(),
    page: (location.pathname || ''),
    storageKey: CFG.storageKey,
    updated: new Date().toISOString(),
    completed: Object.keys(completed),
    code: codes,
    steps: STEPS.map(function(s) { return { num: s.num, title: s.title }; }),
    next: nxt ? nxt.href : null
  };
}
function savePassport(codes) {
  try { localStorage.setItem(PASSPORT_KEY, JSON.stringify(buildPassport(codes))); } catch(e) {}
}
// A1401: a compact, copy-pasteable project code for devices where downloads are blocked.
function encodeProject(p) {
  try { return 'JVP1:' + btoa(unescape(encodeURIComponent(JSON.stringify(p)))); } catch(e) { return ''; }
}
function decodeProject(code) {
  try {
    code = String(code || '').trim();
    if (code.indexOf('JVP1:') !== 0) return null;
    var p = JSON.parse(decodeURIComponent(escape(atob(code.slice(5)))));
    return (p && p.format === 'jvds.project') ? p : null;
  } catch(e) { return null; }
}
function passportNorm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

// Copy the learner's previous code into this lesson: match by step title first,
// then fall back to the same position, and leave anything unmatched alone.
function bringPassportForward(p) {
  var prevCode = p.code || {}, prev = p.steps || [], filled = 0;
  STEPS.forEach(function(s, i) {
    var code = null;
    var byTitle = prev.filter(function(ps) {
      return passportNorm(ps.title) && passportNorm(ps.title) === passportNorm(s.title);
    })[0];
    if (byTitle && prevCode[byTitle.num] != null) code = prevCode[byTitle.num];
    if (code == null && prev[i] && prevCode[prev[i].num] != null) code = prevCode[prev[i].num];
    if (code != null && editors[s.num]) { editors[s.num].value = code; filled++; }
  });
  if (filled) { saveState(); updateCanvas(); }
  return filled;
}

function maybeOfferContinue() {
  try {
    // Don't nag if the learner has already done real work in this lesson.
    try { var own = JSON.parse(localStorage.getItem(CFG.storageKey)); if (own && own.completed && Object.keys(own.completed).length) return; } catch(e) {}
    // Find the most recent earlier lesson of this series that has real progress.
    var best = null, bestLesson = 0;
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!k || k.indexOf(PASSPORT_PREFIX) !== 0) continue;
      var n = Number(k.slice(PASSPORT_PREFIX.length));
      if (!(n < PASSPORT_LESSON) || n <= bestLesson) continue;
      try {
        var cand = JSON.parse(localStorage.getItem(k));
        if (cand && cand.completed && cand.completed.length) { best = cand; bestLesson = n; }
      } catch(e) {}
    }
    if (!best) return;
    var p = best;
    var panel = document.querySelector('.cw-canvas-panel');
    if (!panel || panel.querySelector('.cw-continue')) return;
    var box = document.createElement('div');
    box.className = 'cw-continue';
    box.innerHTML = '<p class="cw-continue-head">Continue from your earlier project?</p>' +
      '<p class="cw-continue-sub">We found your <b>' + (p.title || p.series) + '</b> work (lesson ' + p.lesson + ').</p>' +
      '<div class="cw-continue-actions">' +
        '<button type="button" class="cw-continue-take">Bring my code forward</button>' +
        '<button type="button" class="cw-continue-skip">Start fresh</button>' +
      '</div>';
    panel.insertBefore(box, panel.firstChild);
    box.querySelector('.cw-continue-take').onclick = function() {
      var n = bringPassportForward(p);
      box.querySelector('.cw-continue-sub').textContent = n
        ? ('Brought ' + n + ' step' + (n === 1 ? '' : 's') + ' forward. Check each one and press Apply.')
        : 'Nothing matched closely enough. Your previous code is in the project file you exported.';
      box.classList.add('cw-continue-done');
    };
    box.querySelector('.cw-continue-skip').onclick = function() { box.remove(); };
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
          ' data-cw="checkStep" data-cw-arg="' + step.num + '"' +
          (isDone ? ' disabled' : '') + '>' +
          (isDone ? '✓ Done' : 'Apply to Canvas ▶') +
        '</button>' +
        (isDone ? '' :
          '<button class="cw-btn cw-btn-show" data-cw="showSolution" data-cw-arg="' + step.num + '">Show Solution</button>' +
          '<button class="cw-btn cw-btn-reset" data-cw="resetStep" data-cw-arg="' + step.num + '">Reset</button>'
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
          '<button class="cw-btn cw-btn-show" data-cw="checkFills" data-cw-arg="' + step.num + '">Check Blanks</button>' +
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
        qHtml += '<button type="button" class="' + cls + '"' +
          (isDone || quizPassed[step.num] ? ' disabled' : ' data-cw="selectQuiz" data-cw-arg="' + step.num + '" data-cw-arg2="' + oi + '"') +
          '><span class="cw-quiz-letter">' + letters[oi] + '</span>' + opt + '</button>';
      });
      qHtml += '</div>';
      if (!isDone && !quizPassed[step.num]) {
        qHtml += '<div class="cw-quiz-actions">' +
          '<button class="cw-btn cw-btn-check" data-cw="checkQuiz" data-cw-arg="' + step.num + '">Check Answer</button>' +
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
      var live = document.createElement('div');
      live.className = 'cw-live';
      live.id = 'live-' + step.num;
      var actions = card.querySelector('.cw-actions');
      (actions || ta).insertAdjacentElement('afterend', live);
      ta.addEventListener('input', function() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(updateCanvas, 350);
      });
      // A2009: this editor used to swallow Tab to insert two spaces, which
      // trapped keyboard users inside the textarea. Apply to Canvas, Show
      // Solution and the Knowledge Check were then unreachable, so Tab now moves
      // focus as it does everywhere else on the page. Indentation uses spaces.
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
var ART_KIT_CODE = '(function(){' +
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
  'window.CWArt=A;})()';
var ART_KIT = '<script id="cw-art">' + ART_KIT_CODE + '<\/script>';

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
function polishPreview(val) {
  if (val && val.cwParts) {
    var p = val.cwParts;
    var needsArt = (p.presetup + p.afterBlob).indexOf('CWArt') !== -1;
    return {
      cwParts: {
        css: PREVIEW_CSS + p.css,
        canvas: p.canvas,
        fxOverlay: FX_OVERLAY,
        artKit: needsArt ? ART_KIT_CODE : '',
        presetup: p.presetup,
        blobSrc: p.blobSrc,
        afterBlob: p.afterBlob
      }
    };
  }
  return injectHead(withArtKit(injectBody(val, FX_OVERLAY)), PREVIEW_CSS);
}

function hasUnfilled(code) {
  return /\?{2,}|_{3,}/.test(code);
}

/* ── CSP-safe learner-code execution (A1786) ────────────────────────────────
 * cwBlobWrap(presetup, blobSrc, afterBlob) builds a complete srcdoc HTML page
 * that runs learner code as a blob: <script> instead of eval().
 *
 * WHY blob instead of eval:
 *   eval() requires unsafe-eval in CSP. The existing canvas-preview.html
 *   sidesteps this by having no CSP at all. That works on GitHub Pages (which
 *   ignores _headers) but breaks on any host that sends a strict CSP, because
 *   a srcdoc/blob frame inherits the parent page's policy.
 *
 *   blob: URLs are already allowed by  script-src 'self' blob:  (the global
 *   CSP). Delivering learner code as a <script src="blob:..."> is therefore
 *   both CSP-safe and host-portable.
 *
 * HOW it works:
 *   presetup  - plain JS string: global vars, canvas/ctx setup. Runs first in
 *               a <script> block (part of the template, not learner-authored).
 *   blobSrc   - learner code string: delivered as a separate blob script that
 *               runs in the iframe's global scope (can read/write all vars
 *               declared with var in presetup).
 *               For steps where the learner fills in an in-loop update, wrap
 *               the code as: 'window.cwStep=function(){' + userCode + '};'
 *               and call cwStep() in afterBlob's game loop.
 *   afterBlob - plain JS string: game loop + requestAnimationFrame. Runs after
 *               the blob loads (or after a syntax-error in blobSrc is caught).
 *
 * Syntax errors in blobSrc surface via the script's onerror event; the
 * surrounding template code is never affected and the game loop still starts.
 * This is the key improvement over the splice-based approach (A1722 probe):
 * splicing user code inline makes a syntax error a parse-time failure of the
 * entire template script, which the surrounding try/catch cannot handle.
 *
 * Migration: replace every  try{eval(JSON.stringify(cppToJs(u)))}catch(e){}
 * occurrence in the per-workshop canvas JS files with the cwBlobWrap pattern.
 * See workshops-cpp-breakout-canvas-1.js for the reference implementation.
 * ─────────────────────────────────────────────────────────────────────────── */
window.cwBlobWrap = function cwBlobWrap(CSS_GAME, CANVAS_TAG, presetup, blobSrc, afterBlob) {
  // JSON.stringify gives a valid JS string literal (escaped newlines, quotes, etc.)
  // Replace </ to avoid premature </script> tag matching in the HTML parser.
  var blobLiteral = JSON.stringify(blobSrc).replace(/<\//g, '<\\/');
  var loader =
    'var _cb=new Blob([' + blobLiteral + '],{type:"text/javascript"});' +
    'var _cu=URL.createObjectURL(_cb);' +
    'var _cs=document.createElement("script");_cs.src=_cu;' +
    '_cs.onload=function(){URL.revokeObjectURL(_cu);(function(){' + afterBlob + '})();};' +
    '_cs.onerror=function(){URL.revokeObjectURL(_cu);console.error("cwBlobWrap: user code error");(function(){' + afterBlob + '})();};' +
    'document.head.appendChild(_cs);';
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">' + CSS_GAME +
    '</head><body>' + CANVAS_TAG + '<script>' + presetup + loader + '</script></body></html>';
  return { html: html, cwParts: { css: CSS_GAME, canvas: CANVAS_TAG, presetup: presetup, blobSrc: blobSrc, afterBlob: afterBlob } };
}

/* The live preview runs inside assets/canvas-preview.html, a separate host
   with no Content-Security-Policy of its own. A srcdoc (or blob) frame inherits
   the workshop page CSP, which blocks the inline game scripts and shows a blank
   canvas; the host sidesteps that while keeping the sandboxed stage.
   The stage is sandboxed with allow-scripts only (opaque origin), so the host
   cannot read its contentDocument. The host builds a bootstrap inside the stage
   that loads each code part as a blob: script (A2122), which keeps learner code
   away from the workshop page storage and cookies.
   Workshops migrated to cwBlobWrap no longer need unsafe-eval; once all
   workshops are migrated, canvas-preview.html can be served with a strict CSP
   (script-src 'self' blob:) making previews host-portable (A1722). */
var PREVIEW_RUNNER = '/assets/canvas-preview.html';
var previewReady = false;

function showPreview(val) {
  var frame = document.getElementById('gameFrame');
  if (!frame) return;
  var msg = (val && val.cwParts) ? { cwParts: val.cwParts } : { cwPreview: val };
  if (previewReady) {
    try { frame.contentWindow.postMessage(msg, '*'); } catch (e) {}
    return;
  }
  var onLoad = function () {
    frame.removeEventListener('load', onLoad);
    previewReady = true;
    try { frame.contentWindow.postMessage(msg, '*'); } catch (e) {}
  };
  frame.addEventListener('load', onLoad);
  frame.src = PREVIEW_RUNNER;
}

function updateCanvas() {
  var step = STEPS[currentStep];
  var code = editors[step.num] ? editors[step.num].value : step.starter;
  showPreview(hasUnfilled(code)
    ? polishPreview(BLANK_PLACEHOLDER)
    : polishPreview(TEMPLATES[step.num](code)));
  saveState();

  if (CFG.hints && CFG.hints[currentStep] !== undefined) {
    document.getElementById('canvasHint').textContent = CFG.hints[currentStep];
  }
  updateWhat(step);
  updateLive(step.num);
}

function updateProgress() {
  var count = Object.keys(completed).length;
  var fillEl = document.getElementById('cwProgressFill');
  var textEl = document.getElementById('cwProgressText');
  if (fillEl) fillEl.style.width = (count / STEPS.length * 100) + '%';
  if (textEl) textEl.textContent =
    count === STEPS.length ? 'Complete!' : 'Step ' + (currentStep + 1) + ' / ' + STEPS.length;
  if (count === STEPS.length) offerRemix();
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
      fb.textContent = '✓ Step ' + num + ' complete: ' + step.title + ' now works in your game.';
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
  if (next) {
    next.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Re-rendering replaces the button the learner just pressed, so focus would
    // drop to the body and a keyboard user would have to start tabbing from the
    // top again. Carry focus into the next step's editor instead.
    var nextEditor = next.querySelector('textarea');
    if (nextEditor && !nextEditor.disabled) {
      setTimeout(function() { try { nextEditor.focus({ preventScroll: true }); } catch (e) { nextEditor.focus(); } }, 60);
    }
  }
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
      mainFb.textContent = '✓ Step ' + num + ' complete: ' + step.title + ' now works in your game.';
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

function gameHtml() {
  var lastDone = 0;
  STEPS.forEach(function(s) { if (completed[s.num]) lastDone = s.num; });
  var target = lastDone || STEPS[currentStep].num;
  var code = completed[target] || editors[target].value;
  var result = TEMPLATES[target](code);
  return withArtKit((result && result.html) ? result.html : result);
}

function downloadGame() {
  var html = gameHtml();
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
  downloadGame: downloadGame,
  gameHtml: gameHtml,
  getPassport: buildPassport,
  importPassport: function(p) { try { return bringPassportForward(p); } catch(e) { return 0; } },
  projectCode: function() { try { return encodeProject(buildPassport()); } catch(e) { return ''; } },
  importCode: function(code) { var p = decodeProject(code); return p ? bringPassportForward(p) : -1; }
};

/* A1526:canvas-progress: thin-shell build-alongs carry no shared header, so
   inject a slim XP + progress strip (skipped when #progressCount exists).
   wsSyncProgress then keeps it live with no per-page changes. */
function ensureProgressStrip() {
  try {
    if (document.getElementById('progressCount')) return;
    if (!document.head || !document.body) return;
    if (!document.getElementById('cw-progress-style')) {
      var css = document.createElement('style');
      css.id = 'cw-progress-style';
      css.textContent = '.cw-progress-strip{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;max-width:100%;box-sizing:border-box;padding:6px 10px;font-size:.72rem;color:#e8eaf2;background:rgba(0,0,0,.25);border-bottom:1px solid rgba(255,255,255,.08)}#xpLabel{font-weight:800;color:#ffd166}#progressCount{opacity:.85}#cwProgressTrack{width:80px;height:6px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden}#progressFill{display:block;height:100%;width:0;background:#4ade80}#stepDots{display:flex;gap:4px;flex-wrap:wrap;justify-content:center}.step-dot{width:16px;height:16px;border-radius:50%;background:rgba(255,255,255,.12);font-size:.55rem;line-height:16px;text-align:center;cursor:pointer;color:#e8eaf2}.step-dot.done{background:#4ade80;color:#06281a}.step-dot.active{outline:1px solid #ffd166}';
      document.head.appendChild(css);
    }
    var strip = document.createElement('div');
    strip.className = 'cw-progress-strip';
    var n = (CFG.steps && CFG.steps.length) || 6;
    strip.innerHTML = '<span id="xpLabel">0 XP</span><span id="progressCount">0 / ' + n + ' steps</span>' +
      '<span id="cwProgressTrack"><span id="progressFill"></span></span><span id="stepDots"></span>';
    var anchor = document.querySelector('.cw-header');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(strip, anchor);
    else document.body.insertBefore(strip, document.body.firstChild);
    cwXpLocal = Object.keys(completed).length * wsXpPerStep();
    var xl = document.getElementById('xpLabel');
    if (xl) xl.textContent = cwXpLocal + ' XP';
  } catch (e) {}
}

/* Delegated click handler for data-cw actions (CSP-safe, no inline handlers) */
document.addEventListener('click', function(e) {
  var el = e.target.closest('[data-cw]');
  if (!el) return;
  var action = el.getAttribute('data-cw');
  var arg = Number(el.getAttribute('data-cw-arg'));
  if (action === 'checkStep') checkStep(arg);
  else if (action === 'showSolution') showSolution(arg);
  else if (action === 'resetStep') resetStep(arg);
  else if (action === 'checkFills') checkFills(arg);
  else if (action === 'selectQuiz') selectQuiz(arg, Number(el.getAttribute('data-cw-arg2')));
  else if (action === 'checkQuiz') checkQuiz(arg);
});

/* Init */
ensureLiveStyle();
loadState();
ensureProgressStrip();
renderSteps();
updateCanvas();
updateProgress();
maybeOfferContinue();

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
    chip.innerHTML='<img src="/assets/mascots/lumo-badge.webp" alt="" width="20" height="20">Build it with Lumo';
    var back=document.createElement('a');
    back.className='cw-topbar-back';
    back.href='/workshop';
    back.textContent='\u2190 All workshops';
    var prog=document.createElement('a');
    prog.className='cw-topbar-prog';
    prog.href='/workshops/my-progress.html';
    prog.textContent='My progress';
    bar.appendChild(brand); bar.appendChild(chip); bar.appendChild(prog); bar.appendChild(back);
    // Keep "Skip to main content" first in the tab order: drop the bar in after
    // it instead of becoming the very first focusable thing on the page.
    var skip = document.querySelector('.skip-link');
    if (skip && skip.parentNode) skip.parentNode.insertBefore(bar, skip.nextSibling);
    else document.body.insertBefore(bar, document.body.firstChild);
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

/* A1383:canvas-project-export - give every text engine a real project export so
   the learner owns their code in the engine's language, plus the passport and a
   CONTINUE.md. Pages that already ship their own export (C++) are left alone. */
(function(){
  try{
    if(!window.CW || typeof window.CW.getPassport!=='function') return;
    var panel=document.querySelector('.cw-canvas-panel');
    if(!panel) return;
    if(typeof window.PC_projectFiles==='function') return;
    if(panel.querySelector('.cw-project-dl')) return;

    var CRC=(function(){var t=[],n,k,c;for(n=0;n<256;n++){c=n;for(k=0;k<8;k++){c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);}t[n]=c>>>0;}return t;})();
    function crc32(b){var c=0xFFFFFFFF;for(var i=0;i<b.length;i++){c=CRC[(c^b[i])&0xFF]^(c>>>8);}return (c^0xFFFFFFFF)>>>0;}
    function u16(v){return [v&0xFF,(v>>8)&0xFF];}
    function u32(v){return [v&0xFF,(v>>8)&0xFF,(v>>16)&0xFF,(v>>>24)&0xFF];}
    function zip(files){
      var enc=new TextEncoder(),chunks=[],central=[],off=0;
      files.forEach(function(f){
        var nb=enc.encode(f.name),data=f.data,crc=crc32(data);
        var loc=[].concat(u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(nb.length),u16(0));
        var h=new Uint8Array(loc.length+nb.length);h.set(loc,0);h.set(nb,loc.length);chunks.push(h);chunks.push(data);
        var cd=[].concat(u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(nb.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(off));
        var cdh=new Uint8Array(cd.length+nb.length);cdh.set(cd,0);cdh.set(nb,cd.length);central.push(cdh);off+=h.length+data.length;
      });
      var cdSize=central.reduce(function(s,c){return s+c.length;},0);
      var eocd=new Uint8Array([].concat(u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(cdSize),u32(off),u16(0)));
      var total=chunks.reduce(function(s,c){return s+c.length;},0)+cdSize+eocd.length,out=new Uint8Array(total),p=0;
      chunks.forEach(function(c){out.set(c,p);p+=c.length;});
      central.forEach(function(c){out.set(c,p);p+=c.length;});
      out.set(eocd,p);return out;
    }
    function extFor(engine){
      var e=(engine||'').toLowerCase();
      if(e.indexOf('c++')>=0||e.indexOf('cpp')>=0)return 'cpp';
      if(e.indexOf('python')>=0)return 'py';
      if(e.indexOf('javascript')>=0||e.indexOf('js')>=0)return 'js';
      if(e.indexOf('gdscript')>=0||e.indexOf('godot')>=0)return 'gd';
      if(e.indexOf('gml')>=0||e.indexOf('gamemaker')>=0)return 'gml';
      if(e.indexOf('lua')>=0||e.indexOf('defold')>=0||e.indexOf('pico')>=0||e.indexOf('mugen')>=0||e.indexOf('roblox')>=0)return 'lua';
      return 'txt';
    }
    function commentFor(ext){return (ext==='py'||ext==='gd')?'#':(ext==='lua'?'--':'//');}
    function continueDoc(p,guide){
      var out='# Keep building: '+(p.title||'your project')+'\n\nYou made this in the browser. Continue where you left off:\n';
      if(p.next)out+='  Next project: https://jvdesignstudio.co.uk/workshops/'+p.next+'\n';
      if(guide)out+='  Step-by-step guide: https://jvdesignstudio.co.uk/workshops/'+guide+'\n';
      out+='\njvds.project.json carries your work. Open a JVDesignStudio build canvas and press\n"Bring my code forward" to pick it up again.\n';
      return out;
    }
    function readmeDoc(p,ext,guide){
      var out='# '+(p.title||'My project')+'\n\nYou built this in the JVDesignStudio browser build canvas.\n\n' +
        '## What is here\n' +
        '- game.html - your game, ready to play now (open it in any browser)\n' +
        '- main.'+ext+' - your lesson code, step by step\n' +
        '- jvds.project.json - your project passport\n' +
        '- CONTINUE.md - where to go next\n';
      if(ext==='py') out+='- requirements.txt - the Python library you need (pygame)\n';
      out+='\n## Play it now\nOpen game.html in a browser. That is your finished game.\n';
      if(ext==='py') out+='\n## Run it in Python\n1. Install Python 3.\n2. pip install -r requirements.txt\n' +
        '3. main.py holds your lesson code. When it holds the full program (the step-by-step guide shows it), run: python main.py\n';
      out+='\n## Keep building\n' +
        (guide?('Guide: https://jvdesignstudio.co.uk/workshops/'+guide+'\n'):'') +
        (p.next?('Next project: https://jvdesignstudio.co.uk/workshops/'+p.next+'\n'):'') +
        '\nYour code travels in jvds.project.json. On any build canvas press "Bring my code forward".\n';
      return out;
    }
    function projectFiles(){
      var p=window.CW.getPassport()||{},ext=extFor(p.engine),cmt=commentFor(ext);
      var slug=(p.series||'my-project');
      var lines=[cmt+' '+(p.title||'My project')+' - made in the JVDesignStudio build canvas.',
        cmt+' Engine: '+(p.engine||'browser')+' | Lesson '+(p.lesson||1),
        cmt+' Your work travels in jvds.project.json. See CONTINUE.md.',''];
      (p.steps||[]).forEach(function(s){
        lines.push(cmt+' --- Step '+s.num+': '+s.title+' ---');
        lines.push((p.code&&p.code[s.num])||'');
        lines.push('');
      });
      var page=(location.pathname.split('/').pop()||'').toLowerCase();
      var guide=(window.CANVAS_GUIDE_MAP||{})[page];
      var out=[
        {name:slug+'/game.html', text:(window.CW.gameHtml ? window.CW.gameHtml() : '')},
        {name:slug+'/main.'+ext, text:lines.join('\n')},
        {name:slug+'/jvds.project.json', text:JSON.stringify(p,null,2)+'\n'},
        {name:slug+'/CONTINUE.md', text:continueDoc(p,guide)},
        {name:slug+'/README.md', text:readmeDoc(p,ext,guide)}
      ];
      if(ext==='py') out.push({name:slug+'/requirements.txt', text:'pygame>=2.5\n'});
      return out;
    }
    function download(){
      try{
        var enc=new TextEncoder();
        var files=projectFiles().map(function(f){return {name:f.name,data:enc.encode(f.text)};});
        var blob=new Blob([zip(files)],{type:'application/zip'});
        var a=document.createElement('a');a.href=URL.createObjectURL(blob);
        a.download='my-'+(window.CW.getPassport().series||'project')+'.zip';
        document.body.appendChild(a);a.click();a.remove();
        setTimeout(function(){URL.revokeObjectURL(a.href);},1500);
      }catch(e){}
    }
    window.CW.projectFiles=projectFiles;
    window.CW.downloadProject=download;
    var btn=document.createElement('button');
    btn.type='button';btn.className='cw-btn-dl cw-project-dl';
    btn.textContent='Download my project (.zip)';btn.onclick=download;
    var codeBtn=document.createElement('button');
    codeBtn.type='button';codeBtn.className='cw-btn-dl cw-project-code';
    codeBtn.textContent='Copy my project code';
    codeBtn.onclick=function(){
      try{
        var code=window.CW.projectCode();
        if(!code) return;
        if(navigator.clipboard&&navigator.clipboard.writeText){
          navigator.clipboard.writeText(code).then(function(){codeBtn.textContent='Copied!';setTimeout(function(){codeBtn.textContent='Copy my project code';},1500);},
            function(){prompt('Copy your project code:',code);});
        } else { prompt('Copy your project code:',code); }
      }catch(e){ try{ prompt('Copy your project code:',window.CW.projectCode()); }catch(e2){} }
    };
    var dls=panel.querySelectorAll('.cw-btn-dl');
    if(dls.length){ dls[dls.length-1].insertAdjacentElement('afterend',btn); btn.insertAdjacentElement('afterend',codeBtn); }
    else { panel.appendChild(btn); panel.appendChild(codeBtn); }
  }catch(e){}
})();

/* A1386:canvas-project-import - open an exported project (jvds.project.json or
   the exported .zip) on any canvas, so a learner's work survives a different
   device or a wiped school PC. This is the hook the paid "Finish it" packs use. */
(function(){
  try{
    if(!window.CW || typeof window.CW.importPassport!=='function') return;
    var panel=document.querySelector('.cw-canvas-panel');
    if(!panel || panel.querySelector('.cw-import-btn')) return;
    var input=document.createElement('input');
    input.type='file';input.accept='.json,.zip,application/json,application/zip';
    input.className='cw-import-input';input.style.display='none';
    var btn=document.createElement('button');
    btn.type='button';btn.className='cw-btn-dl cw-import-btn';btn.textContent='Open a saved project';
    var note=document.createElement('p');note.className='cw-import-note';note.setAttribute('role','status');
    // Our exports are STORE zips; read the jvds.project.json entry directly.
    function zipPassport(bytes){
      var dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),i=0,n=bytes.length;
      while(i+30<=n){
        if(dv.getUint32(i,true)!==0x04034b50) break;
        var method=dv.getUint16(i+8,true),comp=dv.getUint32(i+18,true),nameLen=dv.getUint16(i+26,true),extraLen=dv.getUint16(i+28,true);
        var ns=i+30,name=new TextDecoder().decode(bytes.subarray(ns,ns+nameLen)),ds=ns+nameLen+extraLen;
        if(method!==0) return null;
        if(/jvds\.project\.json$/i.test(name)) return new TextDecoder().decode(bytes.subarray(ds,ds+comp));
        i=ds+comp;
      }
      return null;
    }
    function readPassportText(name,bytes){
      if(/\.json$/i.test(name)) return new TextDecoder().decode(bytes);
      if(/\.zip$/i.test(name)) return zipPassport(bytes);
      return null;
    }
    function handleFile(file){
      if(!file) return;
      var reader=new FileReader();
      reader.onload=function(){
        try{
          var txt=readPassportText(file.name,new Uint8Array(reader.result));
          if(!txt) throw new Error('no passport');
          var p=JSON.parse(txt);
          if(!p||p.format!=='jvds.project') throw new Error('not a JVDS project');
          var n=window.CW.importPassport(p);
          note.textContent=n ? ('Opened '+(p.title||'your project')+'. Brought '+n+' step'+(n===1?'':'s')+' forward. Check each one and press Apply.') : 'Opened the project, but nothing matched this canvas closely enough to fill in.';
        }catch(e){ note.textContent='That file is not a JVDS project. Use the .zip or jvds.project.json you exported.'; }
      };
      reader.readAsArrayBuffer(file);
    }
    input.onchange=function(){ handleFile(input.files&&input.files[0]); input.value=''; };
    btn.onclick=function(){ input.click(); };
    var pasteBtn=document.createElement('button');
    pasteBtn.type='button';pasteBtn.className='cw-btn-dl cw-import-code';pasteBtn.textContent='Paste a project code';
    pasteBtn.onclick=function(){
      var code=prompt('Paste your project code:');
      if(!code) return;
      var n=window.CW.importCode(code);
      note.textContent = n>0 ? ('Opened your project. Brought '+n+' step'+(n===1?'':'s')+' forward. Check each one and press Apply.')
        : (n===0 ? 'Opened the project, but nothing matched this canvas closely enough to fill in.' : 'That is not a JVDS project code.');
    };
    var dls=panel.querySelectorAll('.cw-btn-dl');
    if(dls.length){ dls[dls.length-1].insertAdjacentElement('afterend',btn); btn.insertAdjacentElement('afterend',pasteBtn); }
    else { panel.appendChild(btn); panel.appendChild(pasteBtn); }
    pasteBtn.insertAdjacentElement('afterend',note);
    panel.appendChild(input);
    panel.addEventListener('dragover',function(e){e.preventDefault();panel.classList.add('cw-drop');});
    panel.addEventListener('dragleave',function(){panel.classList.remove('cw-drop');});
    panel.addEventListener('drop',function(e){e.preventDefault();panel.classList.remove('cw-drop');handleFile(e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0]);});
    window.CW.openProject=handleFile;
  }catch(e){}
})();
