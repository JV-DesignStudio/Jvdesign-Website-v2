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

