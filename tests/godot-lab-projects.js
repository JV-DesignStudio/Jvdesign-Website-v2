/* A3070: every Godot template and workshop has a real, openable Lab project.
   This checks the manifest, the normalised ZIPs (project.godot at the root and
   the main scene present), the workshop links, and that the committed library
   matches the sources. It does not boot the 96 MB editor; the page tests do
   that for the starter, Star Collector, Platformer and Who Goes There. */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const JSZip = require('../assets/vendor/jszip/jszip.min.js');

const ROOT = path.resolve(__dirname, '..');
const LAB = path.join(ROOT, 'workshops', 'godot-lab');
const MANIFEST = path.join(LAB, 'projects.json');
let failures = 0;
function check(name, ok, detail = '') {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' , ' + detail : ''));
  if (!ok) failures++;
}

(async () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const projects = manifest.projects || [];
  check('manifest has the full library', projects.length >= 17, projects.length + ' projects');
  const ids = new Set();
  const groups = new Set();
  const titles = new Set();
  for (const p of projects) {
    if (ids.has(p.id)) check('unique id', false, p.id);
    ids.add(p.id);
    groups.add(p.group);
    titles.add(p.title);
    check('project fields ' + p.id, !!(p.title && p.group && p.level && p.zip && p.download), JSON.stringify({ title: p.title, group: p.group, level: p.level }));
    const zipPath = path.join(LAB, p.zip);
    check('zip exists ' + p.id, fs.existsSync(zipPath), p.zip);
    if (!fs.existsSync(zipPath)) continue;
    const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
    const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
    check('project.godot at root ' + p.id, names.includes('project.godot'), names.slice(0, 3).join(', '));
    const projectText = await zip.file('project.godot').async('text');
    const sceneMatch = projectText.match(/run\/main_scene="res:\/\/([^"]+)"/);
    const scene = sceneMatch ? sceneMatch[1] : '';
    check('main scene ' + p.id, !!scene && names.includes(scene), scene || 'missing');
    check('no Windows separators ' + p.id, names.every((n) => n.indexOf('\\') === -1), names.find((n) => n.indexOf('\\') !== -1) || '');
    const dirs = new Set(Object.keys(zip.files).filter((n) => zip.files[n].dir).map((n) => n.replace(/\/+$/, '')));
    const nested = [...new Set(names.filter((n) => n.indexOf('/') !== -1).map((n) => n.slice(0, n.lastIndexOf('/'))))];
    const noDir = nested.filter((d) => !dirs.has(d));
    check('folder entries ' + p.id, noDir.length === 0, noDir.join(', ') || nested.join(', '));
    if (p.workshop) {
      const workshopFile = p.workshop.split('#')[0].split('?')[0].replace(/^\//, '');
      check('workshop page ' + p.id, fs.existsSync(path.join(ROOT, workshopFile)), p.workshop);
    }
  }
  check('starters group', groups.has('starters'));
  check('templates group', groups.has('templates'));
  check('workshops group', groups.has('workshops'));
  for (const title of ['2D Platformer', 'Asteroids', 'Space Invaders', 'Tower Defence', 'Zoom Zoom Racing', 'Traffic Dash', 'Jump Jump Platformer', 'Bang Bang Shooter', 'Fairy Survivors', 'Barrel Blast', 'Pixel Quest', 'GDScript Essentials', 'Low-Poly Rally', 'Night Watch', 'Who Goes There? Part 1']) {
    check('library has ' + title, titles.has(title));
  }

  const labHtml = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8');
  const labJs = fs.readFileSync(path.join(LAB, 'lab.js'), 'utf8');
  check('Lab has the project picker', /data-gl-project/.test(labHtml));
  check('Lab reads the manifest', /projects\.json/.test(labJs));
  check('Lab loads the chosen project', /project\.zip/.test(labJs));

  const built = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-godot-lab-projects.js'), '--check'], { cwd: ROOT, encoding: 'utf8' });
  check('library matches the sources', built.status === 0, (built.stdout || built.stderr || '').trim().split('\n').pop());

  console.log(failures ? ('\n' + failures + ' FAILED') : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
