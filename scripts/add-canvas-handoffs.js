#!/usr/bin/env node
/**
 * A1363 - pair every workshop guide with its browser build-along, both ways.
 *
 * Guides  (workshops/<base>-workshop.html or <base>.html)  ->  a "Build it in the
 * browser" callout linking the matching workshops/<base>-canvas.html.
 * Canvases (workshops/<base>-canvas.html)                  ->  a back-link to the
 * guide, injected once from the shared engine so all pages inherit it.
 *
 * Idempotent. Run with --dry-run to preview without writing.
 *   node scripts/add-canvas-handoffs.js [--dry-run]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const W = path.join(ROOT, 'workshops');
const ENGINE = path.join(ROOT, 'workshop-canvas-engine.js');
const CSS = path.join(ROOT, 'workshop-canvas.css');
const DRY = process.argv.includes('--dry-run');

const GUIDE_MARK = 'A1363:canvas-callout:';
const START = '/* A1363:CANVAS_GUIDES:start */';
const END = '/* A1363:CANVAS_GUIDES:end */';
const RUNTIME_MARK = 'A1363:canvas-back-link';
const CSS_MARK = '/* A1363:canvas-back-link */';

const all = fs.readdirSync(W).filter((f) => f.endsWith('.html'));
const set = new Set(all);
const canvases = all.filter((f) => /-canvas\.html$/.test(f)).sort();

// A few canvases whose guide is not a simple <base>-workshop.html.
const EXTRAS = {
  'godot-racing-2-canvas.html': 'godot-racing-workshop-2.html',
  'godot-tutorial-canvas.html': 'godot_tutorial.html',
};

const MAP = {};
for (const c of canvases) {
  const base = c.replace(/-canvas\.html$/, '');
  const guide = [base + '-workshop.html', base + '.html'].find((x) => set.has(x)) || EXTRAS[c];
  if (guide && set.has(guide)) MAP[c] = guide;
}

const uniqueGuides = [...new Set(Object.values(MAP))];

// ── 1. guide -> canvas callout ───────────────────────────────────────────────
let guidesPatched = 0;
const guideSkipped = [];
for (const guide of uniqueGuides) {
  const file = path.join(W, guide);
  if (!fs.existsSync(file)) { guideSkipped.push(guide + ' (missing)'); continue; }
  let html = fs.readFileSync(file, 'utf8');
  if (html.includes(GUIDE_MARK)) continue;
  const canvas = Object.keys(MAP).find((k) => MAP[k] === guide);
  if (html.includes(canvas)) continue;
  const block =
    '\n<!-- ' + GUIDE_MARK + canvas + ' -->\n' +
    '<section style="max-width:780px;margin:0 auto 40px;padding:0 20px;">\n' +
    '<div class="tool-callout" role="complementary" aria-label="Build this project in the browser">\n' +
    '  <div class="tool-callout-inner">\n' +
    '    <div class="tool-callout-icon">\u{1F579}\uFE0F</div>\n' +
    '    <div class="tool-callout-body">\n' +
    '      <p class="tool-callout-head">Build it in the browser first</p>\n' +
    '      <p class="tool-callout-desc">Try this project step by step right here: write the code, watch it run, then download it and keep building in your engine.</p>\n' +
    '    </div>\n' +
    '    <a href="/workshops/' + canvas + '" class="tool-callout-btn">Open the build canvas \u2192</a>\n' +
    '  </div>\n' +
    '</div>\n</section>\n';
  if (html.includes('<!-- BUILD:footer-content -->')) {
    html = html.replace('<!-- BUILD:footer-content -->', block + '<!-- BUILD:footer-content -->');
  } else {
    const at = html.lastIndexOf('</body>');
    if (at === -1) { guideSkipped.push(guide + ' (no insert point)'); continue; }
    html = html.slice(0, at) + block + html.slice(at);
  }
  if (!DRY) fs.writeFileSync(file, html, 'utf8');
  guidesPatched++;
}

// repair an earlier broken emoji escape if present (idempotent)
const BROKEN_ICON = 'tool-callout-icon">U0001F579\uFE0F';
const GOOD_ICON = 'tool-callout-icon">\u{1F579}\uFE0F';
let repaired = 0;
for (const f of all) {
  const file = path.join(W, f);
  let html = fs.readFileSync(file, 'utf8');
  if (!html.includes(BROKEN_ICON)) continue;
  html = html.replace(BROKEN_ICON, GOOD_ICON);
  if (!DRY) fs.writeFileSync(file, html, 'utf8');
  repaired++;
}
if (repaired) console.log((DRY ? '[dry-run] ' : '') + 'repaired broken callout icons: ' + repaired);

// ── 2. engine: canvas -> guide map + runtime back-link ───────────────────────
let engine = fs.readFileSync(ENGINE, 'utf8');
const mapBlock = START + '\nvar CANVAS_GUIDE_MAP = ' + JSON.stringify(MAP, null, 2) + ';\n' + END + '\n';
if (engine.includes(START) && engine.includes(END)) {
  engine = engine.replace(new RegExp(escapeRe(START) + '[\\s\\S]*?' + escapeRe(END) + '\\n?'), mapBlock);
} else {
  engine = engine.replace('\n(function() {', '\n' + mapBlock + '\n(function() {');
}

const runtime =
  '\n/* ' + RUNTIME_MARK + ': one shared canvas -> step-by-step guide back-link */\n' +
  '(function(){\n' +
  '  try{\n' +
  '    if(!window.CANVAS_GUIDE_MAP) return;\n' +
  '    var here=(location.pathname.split(\'/\').pop()||\'\').toLowerCase();\n' +
  '    var guide=CANVAS_GUIDE_MAP[here];\n' +
  '    if(!guide) return;\n' +
  '    var header=document.querySelector(\'.cw-header\');\n' +
  '    if(!header) return;\n' +
  '    var a=document.createElement(\'a\');\n' +
  '    a.className=\'cw-guide-link\';\n' +
  '    a.href=\'/workshops/\'+guide;\n' +
  '    a.textContent=\'\\u2190 Read the step-by-step guide\';\n' +
  '    header.appendChild(a);\n' +
  '  }catch(e){}\n' +
  '})();\n';
if (!engine.includes(RUNTIME_MARK)) engine = engine.replace(/\s*$/, '\n') + runtime;
if (!DRY) fs.writeFileSync(ENGINE, engine, 'utf8');

// ── 3. shared css: back-link style ───────────────────────────────────────────
let css = fs.readFileSync(CSS, 'utf8');
if (!css.includes(CSS_MARK)) {
  css += '\n' + CSS_MARK + '\n' +
    '.cw-guide-link{display:inline-block;margin-top:10px;font-family:\'Fredoka\',cursive;font-size:.82rem;color:#7dd3fc;text-decoration:none;border:1px solid rgba(125,211,252,.3);background:rgba(56,189,248,.08);padding:7px 14px;border-radius:999px;transition:background .2s,transform .2s}\n' +
    '.cw-guide-link:hover{background:rgba(56,189,248,.16);transform:translateY(-1px)}\n';
  if (!DRY) fs.writeFileSync(CSS, css, 'utf8');
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

console.log((DRY ? '[dry-run] ' : '') + 'canvas->guide pairs: ' + Object.keys(MAP).length + ' / ' + canvases.length);
console.log((DRY ? '[dry-run] ' : '') + 'guides patched: ' + guidesPatched + ' / ' + uniqueGuides.length);
if (guideSkipped.length) console.log('skipped: ' + guideSkipped.join(', '));
const unmapped = canvases.filter((c) => !MAP[c]);
if (unmapped.length) console.log('canvases without a guide (left for A1364 hub link): ' + unmapped.join(', '));
