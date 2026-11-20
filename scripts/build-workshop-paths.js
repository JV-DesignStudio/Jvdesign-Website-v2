#!/usr/bin/env node
/**
 * scripts/build-workshop-paths.js (A2194)
 *
 * Generates assets/js/workshop-path-data.js for every workshop in
 * content/workshops.json. The four slots are derived from content the page
 * already carries: the previous step in its course, a cheat sheet or studio
 * link on the page, the outcome extend line, and the page's own next-step link
 * (or the next course step).
 *
 * Curated entries in the current data file are preserved for a small allowlist
 * so the reference page keeps its hand-written wording.
 *
 * Run:   node scripts/build-workshop-paths.js
 * Check: node scripts/build-workshop-paths.js --check
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const WORKSHOPS = path.join(ROOT, 'content', 'workshops.json');
const OUTCOMES = path.join(ROOT, 'content', 'workshop-outcomes.json');
const COURSES = path.join(ROOT, 'content', 'courses.json');
const OUT = path.join(ROOT, 'assets', 'js', 'workshop-path-data.js');
const CHECK = process.argv.includes('--check');
const CURATED = new Set(['my-first-browser-game', 'character-design']);
const HUB_SKIP = /^(?:workshop|my-first-series|my-progress|learning-lab|tiny-learners|learn|start-here)$/;

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel.replace(/^\//, '').split('?')[0])); }
function clean(text) {
  return String(text || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&rarr;|→/g, '').replace(/\s+/g, ' ').trim();
}
function pageKey(url) { return String(url || '').replace(/^\/workshops\//, '').replace(/\.html$/, ''); }
function pageHtml(slug) {
  const file = path.join(ROOT, 'workshops', slug + '.html');
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}
function internalHref(raw, current) {
  if (!raw) return null;
  let href = String(raw).trim();
  if (/^(?:https?:)?\/\//i.test(href) || /^(?:mailto:|tel:|#)/i.test(href)) return null;
  href = href.split('#')[0].split('?')[0];
  if (href.startsWith('/workshops/')) { /* keep */ }
  else if (href.startsWith('/')) return href;
  else if (/^[a-z0-9-]+\.html$/i.test(href)) href = '/workshops/' + href;
  else return null;
  const slug = pageKey(href);
  if (slug === current) return null;
  if (/^engine-[a-z0-9-]+$/.test(slug)) return null;
  if (HUB_SKIP.test(slug)) return null;
  if (!exists(href) && href !== '/workshop') return null;
  return href;
}

function linkEntries(html) {
  const out = [];
  const re = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) out.push({ tag: m[0], href: m[1], text: clean(m[2]) });
  return out;
}

function loadCurated() {
  try {
    const src = fs.readFileSync(OUT, 'utf8');
    const sandbox = { window: {} };
    vm.runInNewContext(src, sandbox, { timeout: 1000 });
    return (sandbox.window && sandbox.window.JVDS_WORKSHOP_PATHS) || {};
  } catch { return {}; }
}

function courseIndex(courses) {
  const map = new Map();
  for (const course of courses.courses || []) {
    (course.steps || []).forEach((step, i) => {
      if (!step || !step.slug) return;
      if (!map.has(step.slug)) map.set(step.slug, { course, index: i, steps: course.steps });
    });
  }
  return map;
}

function build() {
  const workshops = readJson(WORKSHOPS);
  const outcomes = new Map(readJson(OUTCOMES).map((o) => [o.id, o]));
  const byId = new Map(workshops.map((w) => [w.id, w]));
  const courses = courseIndex(readJson(COURSES));
  const curated = loadCurated();
  const data = {};

  for (const w of workshops) {
    const slug = w.id;
    if (CURATED.has(slug) && curated[slug]) { data[slug] = curated[slug]; continue; }

    const html = pageHtml(slug);
    const links = linkEntries(html);
    const outcome = outcomes.get(slug);
    const course = courses.get(slug);

    // Before
    let before;
    if (course && course.index > 0) {
      const prev = course.steps[course.index - 1];
      const prevTitle = (byId.get(prev.slug) && byId.get(prev.slug).title) || prev.title || prev.slug;
      before = {
        label: 'Before',
        title: 'Do the previous episode',
        text: 'Start with ' + clean(prevTitle).split(':')[0] + ' so this step makes sense.',
        href: '/workshops/' + prev.slug + '.html',
        linkLabel: 'Open the previous step'
      };
    } else {
      before = {
        label: 'Before',
        title: 'New to this workshop?',
        text: 'The starting guide shows you where to begin and what you need.',
        href: '/workshops/start-here.html',
        linkLabel: 'Open the starting guide'
      };
    }

    // During
    const cheat = links.find((l) => /cheatsheet/i.test(l.href) && internalHref(l.href, slug));
    const studio = links.find((l) => /(?:mod-studio|-studio)\.html/i.test(l.href) && internalHref(l.href, slug));
    let during;
    if (cheat) {
      during = {
        label: 'During',
        title: 'Keep the cheat sheet open',
        text: 'It shows the code, file names and shortcuts used in this workshop.',
        href: internalHref(cheat.href, slug),
        linkLabel: 'Open the cheat sheet'
      };
    } else if (studio) {
      during = {
        label: 'During',
        title: 'Use the browser studio',
        text: 'Try the same step in the browser, then take it to the real tool.',
        href: internalHref(studio.href, slug),
        linkLabel: 'Open the studio'
      };
    } else {
      during = {
        label: 'During',
        title: 'Keep the reference close',
        text: 'The workshop hub has the cheat sheets, tools and studio pages.',
        href: '/workshop',
        linkLabel: 'Open the workshop hub'
      };
    }

    // After
    const extend = outcome && outcome.extend ? clean(outcome.extend).replace(/\.$/, '') : '';
    const toolLink = links.map((l) => internalHref(l.href, slug)).find((h) => h && h.startsWith('/tools/'));
    const afterHref = toolLink && exists(toolLink) ? toolLink : '/workshop';
    const after = {
      label: 'After',
      title: 'Make it yours',
      text: extend ? 'Try ' + extend + '.' : 'Change one thing the guide did not ask for, then share what happened.',
      href: afterHref,
      linkLabel: afterHref === '/workshop' ? 'See all workshops' : 'Open a tool'
    };

    // Next
    let nextHref = null;
    const nextLink = links.find((l) => /(?:next-ep-btn|ws-finish-next)/.test(l.tag) && internalHref(l.href, slug));
    if (nextLink) nextHref = internalHref(nextLink.href, slug);
    if (!nextHref && course && course.index < course.steps.length - 1) {
      const next = course.steps[course.index + 1];
      nextHref = '/workshops/' + next.slug + '.html';
    }
    if (!nextHref) nextHref = '/workshop';
    const nextSlug = pageKey(nextHref);
    const nextTitle = (byId.get(nextSlug) && byId.get(nextSlug).title) || '';
    const next = {
      label: 'Next',
      title: nextTitle ? clean(nextTitle).split(':')[0] : 'Keep going',
      text: nextHref === '/workshop'
        ? 'Pick another workshop from the hub when you are ready.'
        : 'Next in the pathway. Finish this one before you start it.',
      href: nextHref,
      linkLabel: nextHref === '/workshop' ? 'See all workshops' : 'Open the next workshop'
    };

    data[slug] = { before, during, after, next };
  }

  // Keep any curated key that is not in the catalogue (character-design).
  for (const [key, value] of Object.entries(curated)) {
    if (!data[key]) data[key] = value;
  }

  const sorted = {};
  for (const key of Object.keys(data).sort()) sorted[key] = data[key];
  return sorted;
}

function render(data) {
  return 'window.JVDS_WORKSHOP_PATHS = ' + JSON.stringify(data) + ';\n';
}

function main() {
  const data = build();
  const out = render(data);
  let have = '';
  try { have = fs.readFileSync(OUT, 'utf8'); } catch { /* first run */ }
  if (CHECK) {
    if (have !== out) {
      console.log('  [FAIL] workshop path data is out of date: run node scripts/build-workshop-paths.js');
      process.exit(1);
    }
    console.log('  [PASS] workshop path data is in sync (' + Object.keys(data).length + ' pages)');
    return;
  }
  if (have !== out) fs.writeFileSync(OUT, out);
  console.log((have === out ? '  [PASS] workshop path data already in sync' : '  [OK] wrote assets/js/workshop-path-data.js') + ' (' + Object.keys(data).length + ' pages)');
}

if (require.main === module) main();
module.exports = { build };
