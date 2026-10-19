// canvas-workshops.js - guards the interactive Build Canvas workshop pages.
//
// Every workshops/*-canvas.html build-along must be a real page (title, shared
// engine, CW_CONFIG steps), registered in content/workshops.json, and linked
// from the workshop hub. The hub catalogue must also be in sync with the data
// so a new canvas page can never be added without being reachable.
//
// Run: node tests/canvas-workshops.js
const fs = require('fs');
const path = require('path');

const SITE = path.resolve(__dirname, '..');
const WORKSHOPS = path.join(SITE, 'workshops');
const DATA = path.join(SITE, 'content', 'workshops.json');
const HUB = path.join(SITE, 'pages', 'workshop.html');

let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond || !extra ? '' : ' :: ' + extra));
  if (!cond) failures++;
};

const files = fs.readdirSync(WORKSHOPS).filter((f) => /-canvas\.html$/.test(f)).sort();
const entries = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const hub = fs.readFileSync(HUB, 'utf8');
const registered = new Set(entries.map((e) => String(e.url).replace(/^\//, '')));

/* A1707: inline scripts are externalised (CSP), so CW_CONFIG now lives in
   assets/js/inline/*.js, not in the page HTML. Read every local script the
   page loads and search that too before calling a canvas config missing. */
function localScriptSources(html, pageDir) {
  const out = [];
  const re = /<script[^>]*\bsrc=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const src = m[1].split('?')[0];
    if (/^(https?:)?\/\//i.test(src) || src.startsWith('data:')) continue;
    const abs = src.startsWith('/') ? path.join(SITE, src) : path.join(pageDir, src);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile() && /\.js$/i.test(abs)) out.push(abs);
  }
  return out;
}

ok('canvas build-along pages exist', files.length > 0, 'found ' + files.length);

const missingTitle = [];
const missingEngine = [];
const missingConfig = [];
const notRegistered = [];
const notLinked = [];

for (const file of files) {
  const html = fs.readFileSync(path.join(WORKSHOPS, file), 'utf8');
  const external = localScriptSources(html, WORKSHOPS).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const config = html.includes('window.CW_CONFIG') || external.includes('window.CW_CONFIG');
  if (!/<title>[^<]+<\/title>/i.test(html)) missingTitle.push(file);
  if (!html.includes('workshop-canvas-engine.js')) missingEngine.push(file);
  if (!config) missingConfig.push(file);
  if (!registered.has('workshops/' + file)) notRegistered.push(file);
  if (!hub.includes('href="../workshops/' + file + '"')) notLinked.push(file);
}

ok('every canvas page has a title', missingTitle.length === 0, missingTitle.join(', '));
ok('every canvas page loads the shared engine', missingEngine.length === 0, missingEngine.join(', '));
ok('every canvas page defines CW_CONFIG steps', missingConfig.length === 0, missingConfig.join(', '));
ok('every canvas page is in content/workshops.json', notRegistered.length === 0, notRegistered.join(', '));
ok('every canvas page is linked from the hub', notLinked.length === 0, notLinked.join(', '));

const canvasEntries = entries.filter((e) => /-canvas\.html$/.test(e.url || ''));
const entryNoFile = canvasEntries.filter((e) => !fs.existsSync(path.join(SITE, '.' + e.url)));
ok('every canvas entry points at a real file', entryNoFile.length === 0, entryNoFile.map((e) => e.id).join(', '));

const { generate } = require('../scripts/generate-workshop-catalogue');
const drift = generate({ checkOnly: true });
ok('workshop hub catalogue is in sync with content/workshops.json', drift.changed === false,
  drift.changed ? 'run: node scripts/generate-workshop-catalogue.js' : '');

/* A1714: canvas pages are workshop/learn pages, so the shared topbar must carry
   Lumo (Learn), not Ember (Create). Guard the single injected chip. */
const engineSrc = fs.readFileSync(path.join(SITE, 'workshop-canvas-engine.js'), 'utf8');
const topbarChip = (engineSrc.match(/chip\.innerHTML\s*=\s*'([^']+)'/) || [])[1] || '';
ok('canvas topbar shows Lumo (learn), not Ember', /lumo-badge\.webp/.test(topbarChip) && /Build it with Lumo/i.test(topbarChip),
  topbarChip ? 'chip: ' + topbarChip : 'topbar chip not found in engine');

if (failures) {
  console.log('\nFAIL canvas-workshops: ' + failures + ' check(s) failed');
  process.exit(1);
}
console.log('\nPASS canvas-workshops: ' + files.length + ' build-along pages registered, linked and in sync');
