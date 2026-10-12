#!/usr/bin/env node
/**
 * A1365 - port bridge: after a canvas build-along is exported, hand the learner
 * into the engine guide (keep building) and the next project in the series.
 *
 * Adds a CANVAS_NEXT_MAP to workshop-canvas-engine.js and a small runtime block
 * that renders the hand-off under the export buttons. Idempotent.
 *
 *   node scripts/add-canvas-next.js [--dry-run]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const W = path.join(ROOT, 'workshops');
const ENGINE = path.join(ROOT, 'workshop-canvas-engine.js');
const CSS = path.join(ROOT, 'workshop-canvas.css');
const DRY = process.argv.includes('--dry-run');

const START = '/* A1365:CANVAS_NEXT:start */';
const END = '/* A1365:CANVAS_NEXT:end */';
const RUNTIME_MARK = 'A1365:canvas-next';
const CSS_MARK = '/* A1365:canvas-next */';

const all = fs.readdirSync(W).filter((f) => f.endsWith('.html'));
const set = new Set(all);
const canvases = all.filter((f) => /-canvas\.html$/.test(f)).sort();

// Explicit "what comes next" chain for the engine verticals where the name does
// not simply end in -partN (proof: the C++ series runs pong -> snake -> breakout
// -> platformer -> platformer part 2 -> tower defence).
const EXTRAS = {
  'cpp-pong-canvas.html': 'cpp-snake-canvas.html',
  'cpp-snake-canvas.html': 'cpp-breakout-canvas.html',
  'cpp-breakout-canvas.html': 'cpp-platformer-canvas.html',
  'cpp-platformer-canvas.html': 'cpp-platformer-part2-canvas.html',
  'cpp-platformer-part2-canvas.html': 'cpp-tower-part1-canvas.html',
  'python-breakout-canvas.html': 'python-breakout-part2-canvas.html',
  'python-platformer-canvas.html': 'python-platformer-part2-canvas.html',
  'python-catch-canvas.html': 'python-dodge-canvas.html',
  'python-dodge-canvas.html': 'python-maze-canvas.html',
  'python-maze-canvas.html': 'python-breakout-canvas.html',
  'js-snake-canvas.html': 'js-platformer-canvas.html',
};

function shortTitle(file) {
  try {
    const html = fs.readFileSync(path.join(W, file), 'utf8');
    const m = html.match(/<title>([^<]+)<\/title>/i);
    if (!m) return file.replace(/-canvas\.html$/, '').replace(/-/g, ' ');
    return m[1].replace(/\s*\|\s*JVDesignStudio\s*$/i, '').replace(/\s*Build Canvas\s*$/i, '').trim();
  } catch (e) { return file; }
}

const NEXT = {};
for (const c of canvases) {
  let target = null;
  const part = c.match(/-part(\d+)-canvas\.html$/);
  if (part) {
    const n = Number(part[1]) + 1;
    const cand = c.replace(/-part\d+-canvas\.html$/, '-part' + n + '-canvas.html');
    if (set.has(cand)) target = cand;
  }
  if (!target && EXTRAS[c] && set.has(EXTRAS[c])) target = EXTRAS[c];
  if (target) NEXT[c] = { href: target, label: shortTitle(target) };
}

// ── engine map + runtime ─────────────────────────────────────────────────────
let engine = fs.readFileSync(ENGINE, 'utf8');
const mapBlock = START + '\nvar CANVAS_NEXT_MAP = ' + JSON.stringify(NEXT, null, 2) + ';\n' + END + '\n';
if (engine.includes(START) && engine.includes(END)) {
  engine = engine.replace(new RegExp(esc(START) + '[\\s\\S]*?' + esc(END) + '\\n?'), mapBlock);
} else {
  engine = engine.replace('\n(function() {', '\n' + mapBlock + '\n(function() {');
}

const runtime =
  '\n/* ' + RUNTIME_MARK + ': export hand-off to the engine guide and the next project */\n' +
  '(function(){\n' +
  '  try{\n' +
  '    if(!window.CANVAS_GUIDE_MAP) return;\n' +
  '    var here=(location.pathname.split(\'/\').pop()||\'\').toLowerCase();\n' +
  '    var guide=CANVAS_GUIDE_MAP[here];\n' +
  '    var next=(window.CANVAS_NEXT_MAP||{})[here];\n' +
  '    if(!guide && !next) return;\n' +
  '    var panel=document.querySelector(\'.cw-canvas-panel\');\n' +
  '    if(!panel) return;\n' +
  '    var tagEl=document.querySelector(\'.cw-lang-tag\');\n' +
  '    var engineName=tagEl?((tagEl.textContent||\'\').replace(/[^A-Za-z0-9+#]/g,\'\').trim()||\'your engine\'):\'your engine\';\n' +
  '    var box=document.createElement(\'div\');\n' +
  '    box.className=\'cw-next\';\n' +
  '    var html=\'<p class="cw-next-head">Kept your work? Keep going</p>\';\n' +
  '    if(guide) html+=\'<a class="cw-next-btn cw-next-btn--main" href="/workshops/\'+guide+\'">Keep building in \'+engineName+\' \\u2192</a>\';\n' +
  '    if(next) html+=\'<a class="cw-next-btn" href="/workshops/\'+next.href+\'">What to add next: \'+next.label+\' \\u2192</a>\';\n' +
  '    html+=\'<a class="cw-next-btn" href="/workshop">Browse all workshops</a>\';\n' +
  '    box.innerHTML=html;\n' +
  '    panel.appendChild(box);\n' +
  '  }catch(e){}\n' +
  '})();\n';
if (!engine.includes(RUNTIME_MARK)) engine = engine.replace(/\s*$/, '\n') + runtime;
if (!DRY) fs.writeFileSync(ENGINE, engine, 'utf8');

// ── css ──────────────────────────────────────────────────────────────────────
let css = fs.readFileSync(CSS, 'utf8');
if (!css.includes(CSS_MARK)) {
  css += '\n' + CSS_MARK + '\n' +
    '.cw-next{margin-top:18px;padding:14px;border:1px solid rgba(125,211,252,.22);background:rgba(56,189,248,.06);border-radius:14px;display:flex;flex-direction:column;gap:8px}\n' +
    '.cw-next-head{margin:0 0 2px;font-family:\'Fredoka\',cursive;font-size:.82rem;color:#7dd3fc}\n' +
    '.cw-next-btn{display:block;text-align:center;text-decoration:none;font-weight:700;font-size:.82rem;color:#cdeafe;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);padding:9px 12px;border-radius:10px;transition:background .2s,transform .2s,color .2s}\n' +
    '.cw-next-btn:hover{background:rgba(56,189,248,.14);transform:translateY(-1px)}\n' +
    '.cw-next-btn--main{color:#ffd166;border-color:rgba(255,209,102,.3);background:rgba(255,119,0,.08)}\n' +
    '.cw-next-btn--main:hover{background:rgba(255,119,0,.16)}\n';
  if (!DRY) fs.writeFileSync(CSS, css, 'utf8');
}

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

console.log((DRY ? '[dry-run] ' : '') + 'canvas next-links: ' + Object.keys(NEXT).length + ' / ' + canvases.length);
const proof = ['cpp-pong-canvas.html', 'cpp-snake-canvas.html', 'cpp-breakout-canvas.html', 'cpp-platformer-canvas.html', 'cpp-platformer-part2-canvas.html', 'cpp-tower-part1-canvas.html'];
console.log('C++ vertical:');
for (const c of proof) console.log('  ' + c + ' -> ' + (NEXT[c] ? NEXT[c].href + ' (' + NEXT[c].label + ')' : '(end)'));
