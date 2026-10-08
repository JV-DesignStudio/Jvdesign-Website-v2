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

ok('canvas build-along pages exist', files.length > 0, 'found ' + files.length);

const missingTitle = [];
const missingEngine = [];
const missingConfig = [];
const notRegistered = [];
const notLinked = [];

for (const file of files) {
  const html = fs.readFileSync(path.join(WORKSHOPS, file), 'utf8');
  if (!/<title>[^<]+<\/title>/i.test(html)) missingTitle.push(file);
  if (!html.includes('workshop-canvas-engine.js')) missingEngine.push(file);
  if (!html.includes('window.CW_CONFIG')) missingConfig.push(file);
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

if (failures) {
  console.log('\nFAIL canvas-workshops: ' + failures + ' check(s) failed');
  process.exit(1);
}
console.log('\nPASS canvas-workshops: ' + files.length + ' build-along pages registered, linked and in sync');
