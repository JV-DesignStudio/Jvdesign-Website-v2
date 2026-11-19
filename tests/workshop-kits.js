// workshop-kits.js - A2622
// Every workshop must have a browser track, an engine track where it needs one,
// and three "make it yours" prompts. Run: node tests/workshop-kits.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond || !extra ? '' : ' :: ' + extra));
  if (!cond) failures++;
};

const workshops = JSON.parse(read('content/workshops.json'));
const data = JSON.parse(read('content/workshop-kits.json'));
const kits = data.kits || [];
const byId = new Map(kits.map((k) => [k.id, k]));

ok('one kit per workshop (' + workshops.length + ')', kits.length === workshops.length, 'found ' + kits.length);

const missing = workshops.filter((w) => !byId.has(w.id)).map((w) => w.id);
ok('every workshop has a kit', missing.length === 0, missing.slice(0, 5).join(', '));

const noBrowser = [];
const badEngine = [];
const badRemix = [];
const badUrl = [];
for (const w of workshops) {
  const k = byId.get(w.id);
  if (!k) continue;
  if (!k.browser || !k.browser.url) { noBrowser.push(w.id); continue; }
  if (k.needs === 'install') {
    if (!k.engineTrack) badEngine.push(w.id + ' missing engine track');
    if (k.browser.self) badEngine.push(w.id + ' engine workshop claims to be browser-native');
    if (!fs.existsSync(path.join(ROOT, k.browser.url.replace(/^\//, '')))) badUrl.push(w.id + ' browser url missing: ' + k.browser.url);
  } else {
    if (k.engineTrack) badEngine.push(w.id + ' browser workshop has an engine track');
    if (!k.browser.self) badEngine.push(w.id + ' browser workshop is not marked self');
    if (k.browser.url !== w.url) badEngine.push(w.id + ' browser url should be its own page');
  }
  if (!Array.isArray(k.remix) || k.remix.length !== 3) badRemix.push(w.id + ' has ' + (k.remix || []).length + ' prompts');
  if ((k.remix || []).some((r) => !r.title || !r.body || r.title.length < 3)) badRemix.push(w.id + ' has an empty prompt');
}

ok('every workshop has a browser track', noBrowser.length === 0, noBrowser.slice(0, 5).join(', '));
ok('engine and browser tracks are assigned correctly', badEngine.length === 0, badEngine.slice(0, 5).join('; '));
ok('browser track files exist on disk', badUrl.length === 0, badUrl.slice(0, 5).join('; '));
ok('every kit has three remix prompts', badRemix.length === 0, badRemix.slice(0, 5).join('; '));

const noCover = [];
for (const w of workshops) {
  const k = byId.get(w.id);
  if (w.cover && (!k.cover || k.cover !== w.cover)) noCover.push(w.id);
  if (k.cover && !fs.existsSync(path.join(ROOT, k.cover.replace(/^\//, '')))) noCover.push(w.id + ' cover missing on disk');
}
ok('cover art is carried into the kit', noCover.length === 0, noCover.slice(0, 5).join('; '));

const badDemo = [];
const noDemoReason = [];
const demoKinds = {};
for (const k of kits) {
  if (!k.demo) {
    if (!k.demoReason) noDemoReason.push(k.id);
    continue;
  }
  demoKinds[k.demo.kind] = (demoKinds[k.demo.kind] || 0) + 1;
  if (k.demo.kind === 'external') {
    if (!/^https:\/\/scratch\.mit\.edu\/projects\/\d+/.test(k.demo.url)) badDemo.push(k.id + ' demo is not a Scratch project');
    continue;
  }
  if (k.demo.kind === 'demo' || k.demo.kind === 'game') {
    const isUrl = /^\/[^"']+/.test(k.demo.url || '');
    const file = isUrl ? path.join(ROOT, k.demo.url.replace(/^\//, '')) : '';
    if (!isUrl || !fs.existsSync(file)) badDemo.push(k.id + ' demo file missing: ' + k.demo.url);
    continue;
  }
  if (k.demo.kind !== 'self') { badDemo.push(k.id + ' unknown demo kind'); continue; }
  if (!k.demo.selector) { badDemo.push(k.id + ' self demo has no selector'); continue; }
  const pageUrl = k.engineTrack ? k.engineTrack.url : (k.browser && k.browser.url);
  const html = pageUrl ? read(pageUrl.replace(/^\//, '')) : '';
  const token = k.demo.selector.replace(/^[.#]/, '');
  if (!html.includes(token)) badDemo.push(k.id + ' demo selector not found: ' + k.demo.selector);
}
const demoCount = kits.filter((k) => k.demo).length;
ok('demo targets are real (' + demoCount + ' workshops)', badDemo.length === 0, badDemo.slice(0, 5).join('; '));
ok('every workshop without a demo has a reason', noDemoReason.length === 0, noDemoReason.slice(0, 5).join(', '));
ok('demo mix is reported', demoCount > 0, JSON.stringify(demoKinds));

const js = read('assets/js/workshop-kit.js');
const enh = read('workshop-enhancements.js');
ok('kit script fetches the manifest', js.includes('/content/workshop-kits.json'));
ok('kit script guards iframes and hub pages', /kit=embed/.test(js) && /window\.self !== window\.top/.test(js) && /HUB_SLUGS/.test(js));
ok('kit script mounts the browser frame lazily', /mountBrowserFrame/.test(js) && /loading = 'lazy'/.test(js));
ok('kit script has a mobile layout', /@media\(max-width:520px\)/.test(js));
ok('enhancements load the kit on workshop pages', enh.includes('/assets/js/workshop-kit.js'));

const direct = ['make-your-first-board-game', 'js-platformer-builder', 'minecraft-setup-check', 'stardew-modding-cheatsheet'];
const missingDirect = direct.filter((id) => {
  const p = read('content/workshops.json');
  const e = JSON.parse(p).find((w) => w.id === id);
  if (!e) return false;
  const html = read(e.url.replace(/^\//, ''));
  return !/workshop-enhancements/.test(html) && !/workshop-kit\.js/.test(html);
});
ok('workshops without the shared loader still get the kit', missingDirect.length === 0, missingDirect.join(', '));

if (failures) {
  console.log('\nFAIL workshop-kits: ' + failures + ' check(s) failed');
  process.exit(1);
}
console.log('\nPASS workshop-kits: every workshop has both tracks and three remix prompts');
