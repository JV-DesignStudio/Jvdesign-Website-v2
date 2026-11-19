// workshop-hub-metadata.js - A2529
// Every catalogue card on pages/workshop.html must show a duration, a level and
// a school-PC needs badge, and the values must match content/workshops.json.
// Run: node tests/workshop-hub-metadata.js
const fs = require('fs');
const path = require('path');

const SITE = path.resolve(__dirname, '..');
const entries = JSON.parse(fs.readFileSync(path.join(SITE, 'content', 'workshops.json'), 'utf8'));
const hub = fs.readFileSync(path.join(SITE, 'pages', 'workshop.html'), 'utf8');
const css = fs.readFileSync(path.join(SITE, 'style-workshop-hub.css'), 'utf8');

let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond || !extra ? '' : ' :: ' + extra));
  if (!cond) failures++;
};

const catHtml = hub.slice(hub.indexOf('<!-- CATALOGUE:START -->'), hub.indexOf('<!-- CATALOGUE:END -->'));
const cards = [...catHtml.matchAll(/<a href="([^"]+)" class="course-card"([^>]*)>([\s\S]*?)<\/a>/g)]
  .map((m) => {
    const attrs = {};
    for (const a of m[2].matchAll(/data-([a-z]+)="([^"]*)"/g)) attrs[a[1]] = a[2];
    return { href: m[1], attrs, body: m[3] };
  });

const courses = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(SITE, 'content', 'courses.json'), 'utf8')).courses || [];
  } catch { return []; }
})();
const courseOf = new Map();
for (const c of courses) {
  (c.steps || []).forEach((s, i) => {
    if (!s || !s.slug || courseOf.has(s.slug)) return;
    courseOf.set(s.slug, { name: c.name, index: i + 1, total: (c.steps || []).length });
  });
}

const minutesFor = (e) => {
  const explicit = parseInt(e.minutes, 10);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const steps = parseInt(e.steps, 10);
  const base = Number.isFinite(steps) && steps > 0 ? steps * 5 : 20;
  return Math.max(10, Math.min(90, base));
};

ok('catalogue renders one card per workshop (' + entries.length + ')', cards.length === entries.length, 'found ' + cards.length);

const byUrl = new Map(entries.map((e) => ['../' + e.url.replace(/^\//, ''), e]));
const problems = [];
for (const c of cards) {
  const e = byUrl.get(c.href);
  if (!e) { problems.push(c.href + ' has no JSON entry'); continue; }
  const mins = c.attrs.minutes;
  if (!mins) { problems.push(c.href + ' has no data-minutes'); continue; }
  if (Number(mins) !== minutesFor(e)) problems.push(c.href + ' data-minutes ' + mins + ' != ' + minutesFor(e));
  if (!/course-pill--time/.test(c.body)) problems.push(c.href + ' has no duration pill');
  if (!/course-pill--level/.test(c.body)) problems.push(c.href + ' has no level pill');
  if (!/course-pill--needs/.test(c.body)) problems.push(c.href + ' has no needs pill');
  if (!c.body.includes('~' + mins + ' min')) problems.push(c.href + ' duration pill text is not ~' + mins + ' min');
  if (!['browser', 'install', 'account'].includes(c.attrs.needs)) problems.push(c.href + ' bad data-needs ' + c.attrs.needs);
}
ok('every card carries duration, level and needs metadata', problems.length === 0, problems.slice(0, 5).join('; '));

const thumbProblems = [];
let thumbCount = 0;
for (const c of cards) {
  const e = byUrl.get(c.href);
  if (!e) continue;
  if (e.cover) {
    thumbCount++;
    if (!c.body.includes('src="' + e.cover + '"')) thumbProblems.push(e.id + ' is missing its cover image');
    if (!fs.existsSync(path.join(SITE, e.cover.replace(/^\//, '')))) thumbProblems.push(e.id + ' cover file is missing on disk');
  } else if (!/course-thumb--empty/.test(c.body)) {
    thumbProblems.push(e.id + ' has no cover and no engine placeholder');
  }
}
ok('catalogue cards show cover art (' + thumbCount + ' images)', thumbProblems.length === 0, thumbProblems.slice(0, 5).join('; '));

ok('hub stylesheet defines the metadata pill styles',
  /\.course-meta\s*\{/.test(css) && /\.course-pill\s*\{/.test(css) && /\.course-pill--needs/.test(css));

const prereqProblems = [];
for (const c of cards) {
  const e = byUrl.get(c.href);
  if (!e) continue;
  const course = courseOf.get(e.id);
  if (course && course.total >= 2) {
    if (!/course-prereq/.test(c.body)) { prereqProblems.push(e.id + ' has no series position'); continue; }
    if (!c.body.includes('Step ' + course.index + ' of ' + course.total)) {
      prereqProblems.push(e.id + ' should say Step ' + course.index + ' of ' + course.total);
    }
  } else if (/course-prereq/.test(c.body)) {
    prereqProblems.push(e.id + ' shows a series position but is not in a multi-step course');
  }
}
const withCourse = cards.filter((c) => { const e = byUrl.get(c.href); return e && courseOf.has(e.id) && courseOf.get(e.id).total >= 2; }).length;
ok('series workshops show their position (' + withCourse + ' cards)', prereqProblems.length === 0, prereqProblems.slice(0, 5).join('; '));

const times = cards.map((c) => Number(c.attrs.minutes)).filter((n) => Number.isFinite(n));
ok('durations sit between 10 and 90 minutes', times.length > 0 && times.every((n) => n >= 10 && n <= 90),
  times.filter((n) => n < 10 || n > 90).slice(0, 5).join(', '));

if (failures) {
  console.log('\nFAIL workshop-hub-metadata: ' + failures + ' check(s) failed');
  process.exit(1);
}
console.log('\nPASS workshop-hub-metadata: every catalogue card shows duration, level and school-PC needs');
