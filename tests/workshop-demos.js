// workshop-demos.js - A3101
// Every generated finished-build page must be a real, runnable page and every
// kit that points at one must resolve to a file on disk.
// Run: node tests/workshop-demos.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEMO_DIR = path.join(ROOT, 'workshops', 'demos');
const kits = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'workshop-kits.json'), 'utf8')).kits || [];

let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond || !extra ? '' : ' :: ' + extra));
  if (!cond) failures++;
};

const files = fs.existsSync(DEMO_DIR) ? fs.readdirSync(DEMO_DIR).filter((f) => f.endsWith('.html')) : [];
ok('generated finished builds exist', files.length > 0, String(files.length));

const bad = [];
for (const f of files) {
  const html = fs.readFileSync(path.join(DEMO_DIR, f), 'utf8');
  if (html.length < 300) bad.push(f + ' too small');
  if (!/<title>Finished build/.test(html)) bad.push(f + ' no demo title');
  if (!/<canvas|<script|<svg|<iframe/i.test(html)) bad.push(f + ' no runnable element');
  if (html.includes('???')) bad.push(f + ' contains unfilled ???');
}
ok('every finished build is a runnable page (' + files.length + ')', bad.length === 0, bad.slice(0, 5).join('; '));

const pointed = kits.filter((k) => k.demo && k.demo.kind === 'demo' && /^\/workshops\/demos\//.test(k.demo.url || ''));
const missing = pointed.filter((k) => !fs.existsSync(path.join(ROOT, k.demo.url.replace(/^\//, ''))));
ok('every kit demo link resolves (' + pointed.length + ' links)', missing.length === 0, missing.slice(0, 5).map((k) => k.id).join(', '));

const kinds = {};
for (const k of kits) {
  const kind = k.demo ? k.demo.kind : 'none';
  kinds[kind] = (kinds[kind] || 0) + 1;
}
ok('all workshops are classified', kits.every((k) => k.demo || k.demoReason), JSON.stringify(kinds));
console.log('  demo mix: ' + JSON.stringify(kinds));

if (failures) {
  console.log('\nFAIL workshop-demos: ' + failures + ' check(s) failed');
  process.exit(1);
}
console.log('\nPASS workshop-demos: ' + files.length + ' playable finished builds, all linked and classified');
