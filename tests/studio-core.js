#!/usr/bin/env node
/* Studio Core static contract.
 *
 * Guards the shared layer that every creator tool now loads:
 * files exist, JavaScript parses, the documented API is present, the
 * footer partial wires it in, and the template catalogue is valid.
 *
 * Run: node tests/studio-core.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
let failures = 0;

function check(name, ok, detail) {
  console.log('  ' + (ok ? '[PASS] ' : '[FAIL] ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failures++;
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

const JS = [
  'assets/js/studio-core.js',
  'assets/js/studio/studio-storage.js',
  'assets/js/studio/studio-bundle.js',
  'assets/js/studio/studio-preview.js',
  'assets/js/studio/studio-inspector.js',
  'assets/js/studio/studio-templates.js'
];

for (const rel of JS) {
  const full = path.join(ROOT, rel);
  check(rel + ' exists', fs.existsSync(full));
  if (!fs.existsSync(full)) continue;
  try {
    execFileSync(process.execPath, ['--check', full], { stdio: 'pipe' });
    check(rel + ' parses', true);
  } catch (e) {
    check(rel + ' parses', false, String(e.stderr || e.message).split('\n')[0]);
  }
}

const cssPath = path.join(ROOT, 'assets/css/studio-core.css');
check('assets/css/studio-core.css exists', fs.existsSync(cssPath));
if (fs.existsSync(cssPath)) {
  const css = fs.readFileSync(cssPath, 'utf8');
  const required = [
    '.jvs-fab',
    '.jvs-sheet',
    '.jvs-toast',
    '.jvs-modal',
    '.jvs-meter',
    '.jvs-3pane',
    '.jvs-toolbar',
    '.jvs-inspector-list',
    '.jvs-tour',
    ':focus-visible',
    '@media print',
    'prefers-reduced-motion'
  ];
  required.forEach((token) => check('CSS defines ' + token, css.indexOf(token) !== -1));
  check('CSS scopes furniture to .jvs- classes', /\.jvs-[a-z]/.test(css));
  check('print styles hide site chrome', /@media print[\s\S]*\.site-header[\s\S]*display:\s*none/.test(css));
}

const core = fs.existsSync(path.join(ROOT, 'assets/js/studio-core.js')) ? read('assets/js/studio-core.js') : '';
[
  'S.settings',
  'S.theme',
  'S.toast',
  'S.modal',
  'S.drawer',
  'S.share',
  'S.bundle',
  'S.inspector',
  'S.templates',
  'S.quota',
  'S.autosave',
  'S.pointer',
  'S.raf',
  'S.dom',
  'S.worker',
  'S.lifecycle',
  'S.layout',
  'S.metadata',
  'S.print',
  'S.board',
  'S.help',
  'S.code'
].forEach((token) => check('studio-core exports ' + token, core.indexOf(token) !== -1));

check('studio-core exposes lazy storage and preview', /\['storage',\s*'bundle',\s*'preview'/.test(core));

check('studio-core guards against double loading', core.indexOf('window.JVDSStudio.core === true') !== -1);
check('studio-core lazy-loads modules', core.indexOf("script.src = '/assets/js/studio/studio-'") !== -1);
check('studio-core compresses share links', core.indexOf('CompressionStream') !== -1);
check('studio-core falls back to LZW', core.indexOf('lzwEncode') !== -1);
check('studio-core wraps storage writes', core.indexOf('proto.setItem = function') !== -1);
check('studio-core warns other tabs', core.indexOf("addEventListener('storage'") !== -1);
check('studio-core keeps profile and progress out of shares', core.indexOf('PERSONAL.test(key)') !== -1);
check('studio-core does not use eval', core.indexOf('eval(') === -1);

const footer = read('partials/footer-tools.html');
check('footer partial loads studio-core.css', footer.indexOf('/assets/css/studio-core.css') !== -1);
check('footer partial loads studio-core.js', footer.indexOf('/assets/js/studio-core.js') !== -1);

const templatesPath = path.join(ROOT, 'content/studio-templates.json');
check('content/studio-templates.json exists', fs.existsSync(templatesPath));
if (fs.existsSync(templatesPath)) {
  let data = null;
  try { data = JSON.parse(fs.readFileSync(templatesPath, 'utf8')); }
  catch (e) { check('template JSON parses', false, e.message); }
  if (data) {
    check('template JSON parses', true);
    const list = data.templates || [];
    check('template catalogue has at least 6 starters', list.length >= 6, String(list.length));
    const bad = list.filter((t) => !t.id || !t.title || !t.filename || (!t.body && !t.bundle));
    check('every template has id, title, filename and body', bad.length === 0, bad.map((t) => t.id || '?').join(', '));
    const ids = list.map((t) => t.id);
    check('template ids are unique', new Set(ids).size === ids.length);
  }
}

const left = read('assets/js/studio/studio-storage.js');
check('storage uses IndexedDB', left.indexOf('indexedDB') !== -1);
check('storage keeps a rolling window', left.indexOf('api.prune') !== -1);
check('storage keeps heavy assets out of localStorage', left.indexOf('putAsset') !== -1 && left.indexOf("var ASSETS = 'assets'") !== -1);

const bundle = read('assets/js/studio/studio-bundle.js');
check('bundle writes a real ZIP', bundle.indexOf('JSZip') !== -1 && bundle.indexOf('.jvzip') !== -1);
check('bundle includes a README', bundle.indexOf('README.txt') !== -1);

const inspector = read('assets/js/studio/studio-inspector.js');
['contrast', 'alt', 'tabindex', 'accessible name'].forEach((token) => {
  check('inspector checks ' + token, inspector.toLowerCase().indexOf(token) !== -1);
});

const preview = read('assets/js/studio/studio-preview.js');
check('preview is sandboxed', preview.indexOf("'allow-scripts'") !== -1);
check('preview uses its own host document', preview.indexOf('preview-host.html') !== -1);
const hostPath = path.join(ROOT, 'assets/preview-host.html');
check('preview host exists', fs.existsSync(hostPath));
if (fs.existsSync(hostPath)) {
  const host = fs.readFileSync(hostPath, 'utf8');
  check('preview host blocks the network', host.indexOf("default-src 'none'") !== -1 && host.indexOf('connect-src \'none\'') !== -1);
  check('preview host allows only blob modules', host.indexOf("script-src 'self' blob:") !== -1);
}
const hostJs = path.join(ROOT, 'assets/js/studio/preview-host.js');
check('preview host script exists', fs.existsSync(hostJs));
if (fs.existsSync(hostJs)) {
  try {
    execFileSync(process.execPath, ['--check', hostJs], { stdio: 'pipe' });
    check('preview host script parses', true);
  } catch (e) {
    check('preview host script parses', false, String(e.stderr || e.message).split('\n')[0]);
  }
  check('preview host runs blob modules, not eval', read('assets/js/studio/preview-host.js').indexOf('import(url)') !== -1);
}

if (failures) {
  console.log('\nStudio Core: ' + failures + ' failure(s).');
  process.exit(1);
}
console.log('\nStudio Core: all checks passed.');
