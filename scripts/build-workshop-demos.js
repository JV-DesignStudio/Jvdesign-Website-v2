#!/usr/bin/env node
/**
 * build-workshop-demos.js (A3101)
 *
 * Turns each canvas build-along's final step solution into a real, playable
 * demo page in workshops/demos/<id>.html. The canvas configs already carry a
 * templates[step](code) function that wraps the learner's code into a complete
 * page, so the finished build is the final step's solution plus that template.
 *
 * Engine workshops have no runnable code, so their demo target is chosen in
 * scripts/build-workshop-kits.js (a finished game in the same genre).
 *
 * Run: node scripts/build-workshop-demos.js [--check]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const WORKSHOPS = path.join(ROOT, 'content', 'workshops.json');
const INLINE = path.join(ROOT, 'assets', 'js', 'inline');
const OUT = path.join(ROOT, 'workshops', 'demos');
const CHECK = process.argv.includes('--check');

function configFiles(id) {
  let names = [];
  try { names = fs.readdirSync(INLINE); } catch { return []; }
  return names
    .filter((f) => f.startsWith('workshops-' + id + '-') && f.endsWith('.js'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function stubEl() {
  const el = {
    textContent: '', innerHTML: '', value: '', checked: false, style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    appendChild() {}, insertBefore() {}, removeChild() {}, remove() {},
    addEventListener() {}, removeEventListener() {},
    querySelector() { return stubEl(); }, querySelectorAll() { return []; },
    getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0 }; },
    focus() {}, click() {}, closest() { return null; },
    parentElement: null, children: [], firstChild: null, nextSibling: null,
    getContext() {
      return {
        fillRect() {}, clearRect() {}, beginPath() {}, arc() {}, fill() {}, stroke() {},
        fillText() {}, measureText() { return { width: 0 }; }, setTransform() {}, translate() {},
        rotate() {}, save() {}, restore() {}, drawImage() {}, moveTo() {}, lineTo() {}, closePath() {}
      };
    }
  };
  return el;
}

function cwBlobWrap(CSS_GAME, CANVAS_TAG, presetup, blobSrc, afterBlob) {
  const blobLiteral = JSON.stringify(blobSrc).replace(/<\//g, '<\\/');
  const loader =
    'var _cb=new Blob([' + blobLiteral + '],{type:"text/javascript"});' +
    'var _cu=URL.createObjectURL(_cb);' +
    'var _cs=document.createElement("script");_cs.src=_cu;' +
    '_cs.onload=function(){URL.revokeObjectURL(_cu);(function(){' + afterBlob + '})();};' +
    '_cs.onerror=function(){URL.revokeObjectURL(_cu);(function(){' + afterBlob + '})();};' +
    'document.head.appendChild(_cs);';
  const html = '<!DOCTYPE html><html><head><meta charset="UTF-8">' + CSS_GAME +
    '</head><body>' + CANVAS_TAG + '<script>' + presetup + loader + '</script></body></html>';
  return { html: html, cwParts: { css: CSS_GAME, canvas: CANVAS_TAG, presetup: presetup, blobSrc: blobSrc, afterBlob: afterBlob } };
}

function sandboxFor() {
  const doc = {
    getElementById() { return stubEl(); },
    querySelector() { return stubEl(); },
    querySelectorAll() { return []; },
    addEventListener() {},
    createElement() { return stubEl(); },
    body: stubEl(),
    head: stubEl(),
    documentElement: stubEl()
  };
  doc.body.classList = { add() {}, remove() {}, toggle() {} };
  const sb = {
    window: {}, document: doc, console,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    navigator: { userAgent: 'demo-build', maxTouchPoints: 0 },
    location: { href: 'https://jvdesignstudio.co.uk/', search: '' },
    requestAnimationFrame() {}, cancelAnimationFrame() {}, setTimeout() {}, clearTimeout() {},
    matchMedia() { return { matches: false, addEventListener() {}, addListener() {} }; },
    alert() {}, fetch() { return Promise.reject(new Error('offline build')); },
    URL: { createObjectURL() { return 'blob:demo'; }, revokeObjectURL() {} },
    Blob: function () {}, cwBlobWrap: cwBlobWrap
  };
  sb.window.document = doc;
  sb.window.location = sb.location;
  sb.window.matchMedia = sb.matchMedia;
  sb.window.requestAnimationFrame = sb.requestAnimationFrame;
  sb.window.cwBlobWrap = cwBlobWrap;
  vm.createContext(sb);
  return sb;
}

function inlineConfigScripts(html) {
  if (!html.includes('CW_CONFIG')) return [];
  return [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1])
    .filter((s) => s.trim().length > 0);
}

function pageUrlFor(entry) {
  return entry.url || null;
}

function pageSources(kit) {
  const url = pageUrlFor(kit);
  if (!url) return { sources: [], html: '' };
  let html = '';
  try { html = fs.readFileSync(path.join(ROOT, url.replace(/^\//, '')), 'utf8'); } catch { return { sources: [], html: '' }; }
  const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/gi)]
    .map((m) => m[1])
    .filter((s) => /\/assets\/js\/inline\/workshops-[^/]+\.js/.test(s));
  const sources = [];
  for (const src of srcs) {
    try { sources.push(fs.readFileSync(path.join(ROOT, src.replace(/^\//, '')), 'utf8')); } catch { /* missing */ }
  }
  sources.push(...inlineConfigScripts(html));
  return { sources, html };
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function demoControls(html) {
  if (/\bkey1\b/.test(html)) {
    return [
      { code: 'Digit1', label: '1' },
      { code: 'Digit2', label: '2' },
      { code: 'Digit3', label: '3' }
    ];
  }
  if (!/\b(leftHeld|rightHeld|upHeld|downHeld|spaceHeld)\b/.test(html)) return [];
  var pads = [
    { code: 'ArrowLeft', label: 'Left' },
    { code: 'ArrowRight', label: 'Right' }
  ];
  if (/\bupHeld\b/.test(html) && !/\bspaceHeld\b/.test(html)) pads.splice(0, 0, { code: 'ArrowUp', label: 'Up' });
  if (/\bdownHeld\b/.test(html)) pads.push({ code: 'ArrowDown', label: 'Down' });
  if (/\bspaceHeld\b/.test(html)) pads.push({ code: 'Space', label: 'Jump' });
  return pads;
}

function blockPanel(steps) {
  return steps.map(function (step, i) {
    var open = i === steps.length - 1 ? ' open' : '';
    return '<details class="demo-block"' + open + '>' +
      '<summary>Step ' + step.num + ': ' + escapeHtml(step.title) + '</summary>' +
      '<pre><code>' + escapeHtml(step.solution || '') + '</code></pre>' +
      '</details>';
  }).join('');
}

/* The generated finished build is the whole point of the See it tab, so give it
   a real shell instead of a bare canvas: title, what to try, touch controls for
   phones and a panel that shows the Scratch blocks behind the game. */
function scratchShell(html, kit, cfg, step) {
  var canvas = (html.match(/<canvas\b[^>]*><\/canvas>/i) || [])[0];
  var script = (html.match(/<script[^>]*>([\s\S]*?)<\/script>/i) || [])[1];
  if (!canvas || !script) return null;
  var controls = demoControls(html);
  var pad = controls.map(function (c) {
    return '<button type="button" class="demo-key" data-key="' + c.code + '">' + c.label + '</button>';
  }).join('');
  var padNote = controls.length && controls[0].code.indexOf('Digit') === 0
    ? 'Tap an answer or press 1, 2 or 3.'
    : 'Or use the arrow keys. Press R to restart.';
  var padHtml = pad
    ? '<div class="demo-pad" role="group" aria-label="On-screen controls">' + pad +
      '<p class="demo-pad-note">' + padNote + '</p></div>'
    : '';
  var tip = escapeHtml(step.goal || 'Play the finished build before you make it.');
  var title = escapeHtml(kit.title || 'Finished build');
  var blocks = blockPanel(cfg.steps || []);
  return '<!DOCTYPE html><html lang="en"><head>' +
    '<meta charset="UTF-8">' +
    '<meta name="robots" content="noindex">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Finished build: ' + escapeHtml(kit.id) + '</title>' +
    '<style>' +
    ':root{color-scheme:dark}' +
    '*{box-sizing:border-box}' +
    'body{margin:0;min-height:100vh;padding:14px;display:flex;align-items:flex-start;justify-content:center;' +
    'background:radial-gradient(900px 480px at 50% -10%,rgba(255,119,0,.18),transparent 60%),' +
    'radial-gradient(800px 420px at 50% 120%,rgba(96,165,250,.14),transparent 60%),#0f1220;' +
    'color:#e8eaf2;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif}' +
    '.demo-shell{width:100%;max-width:560px}' +
    '.demo-top{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;margin:0 0 10px}' +
    '.demo-kicker{margin:0 0 3px;font-size:.68rem;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#ffb020}' +
    '.demo-top h1{margin:0 0 4px;font-size:1.05rem;line-height:1.25}' +
    '.demo-tip{margin:0;font-size:.8rem;line-height:1.45;color:rgba(232,234,242,.78)}' +
    '.demo-code-btn{flex:0 0 auto;min-height:40px;padding:9px 13px;border-radius:9px;border:1.5px solid rgba(255,255,255,.2);' +
    'background:rgba(255,255,255,.06);color:#fff;font:700 .78rem Inter,system-ui,sans-serif;cursor:pointer}' +
    '.demo-code-btn[aria-pressed="true"]{background:#b34d00;border-color:#b34d00}' +
    '.demo-stage{border:1.5px solid rgba(255,255,255,.12);border-radius:14px;overflow:hidden;background:#171226;' +
    'box-shadow:0 14px 38px rgba(0,0,0,.45)}' +
    '.demo-stage canvas{display:block;width:100%;height:auto;touch-action:none}' +
    '.demo-pad{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;padding:10px}' +
    '.demo-key{min-width:64px;min-height:46px;padding:8px 14px;border-radius:12px;border:1.5px solid rgba(255,255,255,.22);' +
    'background:rgba(255,255,255,.09);color:#fff;font:800 .85rem Inter,system-ui,sans-serif;cursor:pointer;touch-action:none;user-select:none}' +
    '.demo-key:active,.demo-key.is-down{background:#b34d00;border-color:#b34d00}' +
    '.demo-pad-note{flex-basis:100%;margin:2px 0 0;text-align:center;font-size:.74rem;color:rgba(232,234,242,.6)}' +
    '.demo-code{margin:12px 0 0;border:1.5px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.04);padding:12px 14px}' +
    '.demo-code[hidden]{display:none}' +
    '.demo-code h2{margin:0 0 4px;font-size:.95rem}' +
    '.demo-code p{margin:0 0 10px;font-size:.78rem;line-height:1.5;color:rgba(232,234,242,.7)}' +
    '.demo-code a{color:#ffb020;font-weight:800}' +
    '.demo-block{border-top:1px solid rgba(255,255,255,.1);padding:8px 0}' +
    '.demo-block summary{cursor:pointer;font-size:.82rem;font-weight:700}' +
    '.demo-block pre{margin:8px 0 0;padding:10px 12px;border-radius:9px;background:#0a0d16;color:#ffd7a8;overflow:auto;font-size:.76rem;line-height:1.5}' +
    '@media(max-width:430px){body{padding:10px}.demo-top{flex-direction:column}.demo-code-btn{width:100%}}' +
    '</style></head><body>' +
    '<main class="demo-shell">' +
      '<header class="demo-top"><div>' +
        '<p class="demo-kicker">Pip\'s finished build</p>' +
        '<h1>' + title + '</h1>' +
        '<p class="demo-tip">Try it: ' + tip + '</p>' +
      '</div>' +
      '<button type="button" class="demo-code-btn" id="demoCodeBtn" aria-pressed="false" aria-controls="demoCode">See the blocks</button>' +
      '</header>' +
      '<div class="demo-stage">' + canvas + padHtml + '</div>' +
      '<section class="demo-code" id="demoCode" hidden>' +
        '<h2>What makes it work</h2>' +
        '<p>These are the Scratch blocks behind the game. Open <a href="/workshops/scratch-studio.html">Scratch Studio</a> to build your own version, or drag the same blocks on scratch.mit.edu.</p>' +
        blocks +
      '</section>' +
    '</main>' +
    '<script>' + script + '<\/script>' +
    '<script>(function(){' +
      'var stage=document.querySelector(".demo-stage");' +
      'var codeBtn=document.getElementById("demoCodeBtn");' +
      'var code=document.getElementById("demoCode");' +
      'if(codeBtn&&code){codeBtn.addEventListener("click",function(){var open=!code.hidden;code.hidden=open;codeBtn.setAttribute("aria-pressed",open?"false":"true");});}' +
      'function key(type,code){try{document.dispatchEvent(new KeyboardEvent(type,{code:code,bubbles:true}));}catch(e){}}' +
      'document.querySelectorAll(".demo-key").forEach(function(btn){' +
        'var pressed=false;' +
        'function down(e){if(e&&e.preventDefault)e.preventDefault();if(pressed)return;pressed=true;btn.classList.add("is-down");key("keydown",btn.dataset.key);}' +
        'function up(){if(!pressed)return;pressed=false;btn.classList.remove("is-down");key("keyup",btn.dataset.key);}' +
        'btn.addEventListener("pointerdown",down);' +
        'btn.addEventListener("pointerup",up);' +
        'btn.addEventListener("pointerleave",up);' +
        'btn.addEventListener("pointercancel",up);' +
        'btn.addEventListener("keydown",function(e){if(e.code==="Enter"||e.code===" ")down(e);});' +
        'btn.addEventListener("keyup",function(e){if(e.code==="Enter"||e.code===" ")up();});' +
      '});' +
      'if(stage){stage.addEventListener("pointerdown",function(){try{window.focus();}catch(e){}});}' +
    '})();<\/script>' +
    '</body></html>';
}

function renderDemo(kit) {
  const id = kit.id;
  let sources = pageSources(kit).sources;
  if (!sources.length) sources = configFiles(id).map((f) => fs.readFileSync(path.join(INLINE, f), 'utf8'));
  if (!sources.length) return null;

  const sb = sandboxFor();
  for (const code of sources) {
    try { vm.runInContext(code, sb, { timeout: 2000 }); } catch { /* some page scripts need a real DOM */ }
  }
  const cfg = sb.window.CW_CONFIG;
  if (!cfg || !Array.isArray(cfg.steps) || !cfg.steps.length || !cfg.templates) return null;
  const step = cfg.steps[cfg.steps.length - 1];
  const tpl = cfg.templates[step.num];
  if (typeof tpl !== 'function') return null;
  const code = String(step.solution || '');
  if (!code || code.includes('???')) return null;
  let html = '';
  try { html = tpl(code); } catch { return null; }
  if (html && typeof html === 'object' && typeof html.html === 'string') html = html.html;
  if (typeof html !== 'string' || html.length < 200) return null;
  if (!/<canvas|<script|<iframe|<svg/i.test(html)) return null;
  if (/^scratch-|^my-first-scratch-/.test(id)) {
    const rich = scratchShell(html, kit, cfg, step);
    if (rich) return rich;
  }
  return decorate(html, id);
}

function decorate(html, id) {
  const title = '<title>Finished build: ' + id + '</title>\n<meta name="robots" content="noindex">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n';
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + '\n' + title);
  return '<!DOCTYPE html><html><head><meta charset="UTF-8">\n' + title + '</head><body>' + html + '</body></html>';
}

function renderAll({ check = false } = {}) {
  const workshops = JSON.parse(fs.readFileSync(WORKSHOPS, 'utf8'));
  if (!check) fs.mkdirSync(OUT, { recursive: true });
  let written = 0, same = 0, generated = 0;
  const failed = [];
  for (const kit of workshops) {
    const html = renderDemo(kit);
    if (!html) continue;
    generated++;
    const file = path.join(OUT, kit.id + '.html');
    const have = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (have === html) { same++; continue; }
    if (check) { failed.push(kit.id); continue; }
    fs.writeFileSync(file, html);
    written++;
  }
  return { written, same, generated, failed };
}

function main() {
  const res = renderAll({ check: CHECK });
  if (CHECK) {
    if (res.failed.length) {
      console.log('  [FAIL] workshop demos drift for ' + res.failed.length + ' workshop(s): ' + res.failed.slice(0, 8).join(', '));
      process.exit(1);
    }
    console.log('  [PASS] workshop demos in sync (' + res.generated + ' playable)');
    return;
  }
  console.log('  [OK] workshop demos: ' + res.written + ' written, ' + res.same + ' already in sync');
}

if (require.main === module) main();
module.exports = { renderDemo, renderAll, decorate };

