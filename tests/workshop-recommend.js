// workshop-recommend.js test - A2620
// The recommender must load on every workshop page, ignore hub pages, read the
// catalogue, respect finished workshops and render three next steps.
// Run: node tests/workshop-recommend.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond || !extra ? '' : ' :: ' + extra));
  if (!cond) failures++;
};

const js = read('assets/js/workshop-recommend.js');
const enh = read('workshop-enhancements.js');
const reader = read('assets/js/workshop-reader.js');

ok('recommender reads the workshop catalogue', js.includes('/content/workshops.json'));
ok('recommender respects finished workshops', js.includes('completedWorkshops'));
ok('recommender targets three next steps', /picks\.length\s*[<>=]+\s*3/.test(js) || /length\s*<\s*3/.test(js));
ok('recommender keeps the full catalogue one click away', js.includes("href = '/workshop'"));
ok('recommender skips hub slugs', /HUB_SLUGS/.test(js) && /'start-here'/.test(js));
ok('recommender renders a responsive grid', js.includes('ws-rec-grid') && js.includes('grid-template-columns'));
ok('recommender uses textContent (no injected HTML)', js.includes('textContent') && !/innerHTML\s*=/.test(js));
ok('enhancements load the recommender on workshop pages', enh.includes('/assets/js/workshop-recommend.js'));
ok('the old single Next Quest card is no longer injected', !/setTimeout\(buildNextQuest/.test(reader));

if (failures) {
  console.log('\nFAIL workshop-recommend: ' + failures + ' check(s) failed');
  process.exit(1);
}
console.log('\nPASS workshop-recommend: three progress-aware next steps load on every workshop page');
