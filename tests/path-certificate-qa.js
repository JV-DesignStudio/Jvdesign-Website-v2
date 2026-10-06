// path-certificate-qa.js - A800: paths are real sequences and completing one
// issues a certificate carrying the learner name and completed items.
// Run: node tests/path-certificate-qa.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SITE = path.resolve(__dirname, '..');
const paths = JSON.parse(fs.readFileSync(path.join(SITE, 'content', 'paths.json'), 'utf8'));
const workshops = JSON.parse(fs.readFileSync(path.join(SITE, 'content', 'workshops.json'), 'utf8'));
const hub = fs.readFileSync(path.join(SITE, 'pages', 'workshop.html'), 'utf8');
const certHtml = fs.readFileSync(path.join(SITE, 'tools', 'certificate.html'), 'utf8');

let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond || !extra ? '' : ' :: ' + extra));
  if (!cond) failures++;
};

// 1. paths.json integrity: certificate, 2+ levels, workshops resolve
const wsIds = new Set(workshops.map((w) => w.id));
for (const p of paths) {
  ok('path ' + p.id + ' names a certificate', !!p.certificate);
  ok('path ' + p.id + ' sequences 2+ levels', p.levels.length >= 2, p.levels.length + ' levels');
  const dangling = [];
  p.levels.forEach((l) => (l.workshops || []).forEach((w) => { if (!wsIds.has(w)) dangling.push(w); }));
  ok('path ' + p.id + ' workshops all resolve', dangling.length === 0, dangling.join(','));
}

// 2. hub issues the certificate link only at 100% with path + items
ok('hub builds certificate.html?path= link', hub.includes('certificate.html?path='));
ok('hub passes completed workshop ids', hub.includes("ids.join(',')") || hub.includes('ids.join'));
ok('hub gates the link on full completion', /pct === 100/.test(hub));
ok('hub marks the next-up level (prerequisite order)', hub.includes('is-next'));

// 3. certificate page behaviour in a stub DOM
function stubEl() {
  return {
    value: '', textContent: '', innerHTML: '', hidden: false, options: [],
    kids: [], style: {},
    addEventListener() {}, appendChild(c) { this.kids.push(c); },
    classList: { add() {}, toggle() {}, remove() {} },
  };
}
async function runCert(search) {
  const blocks = [...certHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const code = blocks.find((b) => b.includes('JVDSCert'));
  const els = {};
  const documentStub = {
    getElementById: (id) => (els[id] = els[id] || stubEl()),
    createElement: () => stubEl(),
    fonts: undefined,
  };
  const store = {};
  const sandbox = {
    window: {},
    document: documentStub,
    URLSearchParams,
    Promise,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } },
    fetch: (url) => Promise.resolve({ json: () => Promise.resolve(url.includes('paths.json') ? paths : workshops) }),
  };
  sandbox.window.location = { search };
  sandbox.window.localStorage = sandbox.localStorage;
  sandbox.window.fetch = sandbox.fetch;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'certificate-inline.js' });
  await new Promise((r) => setTimeout(r, 50));
  return { els, api: sandbox.window.JVDSCert };
}

(async () => {
  // path completion: godot path, two items, named learner
  let r = await runCert('?path=godot-beginner&items=godot-racing-workshop,my-first-video-game&name=Alex');
  const godotTitles = ['godot-racing-workshop', 'my-first-video-game'].map((id) => workshops.find((w) => w.id === id).title);
  ok('cert series shows the path certificate name', r.els.certSeriesDisplay.textContent === 'Junior Godot Developer',
    JSON.stringify(r.els.certSeriesDisplay.textContent));
  ok('cert name shows the learner', r.els.certNameDisplay.textContent === 'Alex');
  ok('cert items match the completed workshops',
    JSON.stringify(r.els.certItemsList.kids.map((k) => k.textContent)) === JSON.stringify(godotTitles),
    JSON.stringify(r.els.certItemsList.kids.map((k) => k.textContent)));
  ok('cert items section unhidden', r.els.certItemsWrap.hidden === false);

  // pixel-studio ?title= case: title lands on the certificate, no items
  r = await runCert('?title=My%20Dragon%20Sprite');
  ok('?title= reaches the certificate line', r.els.certSeriesDisplay.textContent === 'My Dragon Sprite',
    JSON.stringify(r.els.certSeriesDisplay.textContent));
  ok('no items means no items section', r.els.certItemsWrap.hidden === true);

  // pure helpers
  const p = r.api.parse('?title=A&name=B&path=x&items=a, b,,c');
  ok('parse splits and trims items', JSON.stringify(p.items) === JSON.stringify(['a', 'b', 'c']));
  const d = r.api.resolve({ title: '', name: '', path: 'scratch-beginner', items: [] }, paths, workshops);
  ok('empty items resolve to the full path sequence', d.items.length === 4 && d.title === 'Scratch Creator',
    d.items.length + ' items');

  if (failures) {
    console.log('\nFAIL path-certificate-qa: ' + failures + ' check(s) failed');
    process.exit(1);
  }
  console.log('\nPASS path-certificate-qa: paths sequence, certificates carry name and items');
})().catch((e) => { console.log('FAIL path-certificate-qa harness: ' + e.message); process.exit(1); });
