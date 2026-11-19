/* The old Godot Studio page is now a redirect to the Godot Lab. The Lab has
   the real editor and all templates, so the separate Mod Studio landing page is
   no longer advertised in the catalogue, search, sitemap or Godot hub. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}
const page = fs.readFileSync(path.join(ROOT, 'workshops', 'godot-mod-studio.html'), 'utf8');
check('old page redirects with location.replace', /location\.replace\("godot-lab\/index\.html\?project=starter"\)/.test(page));
check('old page has a meta refresh', /http-equiv="refresh" content="0; url=godot-lab\/index\.html\?project=starter"/.test(page));
check('old page is noindex', /name="robots" content="noindex/.test(page));
check('old page canonical points at the Lab', /rel="canonical" href="https:\/\/jvdesignstudio\.co\.uk\/workshops\/godot-lab\/"/.test(page));
check('old page has a CSP with the inline redirect hash', /http-equiv="Content-Security-Policy"/.test(page));

const workshops = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'workshops.json'), 'utf8'));
check('catalogue no longer lists Godot Studio', !workshops.some((w) => w.id === 'godot-mod-studio'));

for (const file of ['pages/workshop.html', 'sitemap.xml', 'search-index.json', 'workshops/engine-godot.html']) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  check(file + ' no longer links Godot Studio', text.indexOf('godot-mod-studio') === -1);
}

const lab = fs.readFileSync(path.join(ROOT, 'workshops', 'godot-lab', 'index.html'), 'utf8');
check('Lab picker is the destination', /data-gl-project/.test(lab));
check('Lab loads the project library', /projects\.json/.test(fs.readFileSync(path.join(ROOT, 'workshops', 'godot-lab', 'lab.js'), 'utf8')));

console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL PASS');
process.exit(failures ? 1 : 0);
