// learn-hubs.js - A803. Verifies the five /learn evergreen hubs: exist, one h1,
// clean canonical, Course/HowTo JSON-LD, >=3 workshop links, and in the sitemap.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

let fail = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) fail++; };

const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const slugs = [
  'scratch-for-kids',
  'make-a-game-on-a-school-chromebook',
  'godot-for-beginners',
  'roblox-studio-beginner-tutorials',
  'python-games-for-kids',
];

for (const slug of slugs) {
  const fp = path.join(ROOT, 'learn', slug + '.html');
  const exists = fs.existsSync(fp);
  ok('page exists: ' + slug, exists);
  if (!exists) continue;
  const html = fs.readFileSync(fp, 'utf8');
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  ok('exactly one h1: ' + slug, h1 === 1);
  const canonical = 'https://jvdesignstudio.co.uk/learn/' + slug;
  ok('clean canonical: ' + slug, html.includes(`<link rel="canonical" href="${canonical}">`));
  ok('in sitemap.xml: ' + slug, sitemap.includes(canonical + '</loc>'));
  ok('Course/HowTo JSON-LD: ' + slug, /"@type":"(Course|HowTo)"/.test(html));
  const uniqWorkshopLinks = [...new Set((html.match(/href="\/workshops\/[^"]+\.html"/g) || []))];
  ok('links >=3 workshops: ' + slug + ' (' + uniqWorkshopLinks.length + ')', uniqWorkshopLinks.length >= 3);
}

console.log(fail === 0 ? '\nALL LEARN HUB CHECKS PASSED' : '\n' + fail + ' FAILURES');
process.exit(fail ? 1 : 0);
