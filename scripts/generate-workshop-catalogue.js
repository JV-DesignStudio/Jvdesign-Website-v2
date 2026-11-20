#!/usr/bin/env node
/*
 * scripts/generate-workshop-catalogue.js (A799, A1340)
 *
 * Renders the data-driven blocks of pages/workshop.html from
 * content/workshops.json so every workshop is linked from the hub:
 *   1. Browse by engine  (BROWSE:START / BROWSE:END)
 *   2. Complete catalogue (CATALOGUE:START / CATALOGUE:END)
 * Cards carry data-engine / data-difficulty / data-age for the hub filters.
 * Run: node scripts/generate-workshop-catalogue.js
 * Check only (CI): node scripts/generate-workshop-catalogue.js --check
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'content', 'workshops.json');
const OUTCOMES = path.join(ROOT, 'content', 'workshop-outcomes.json');
const COURSES = path.join(ROOT, 'content', 'courses.json');
const ENGINE_HUBS = path.join(ROOT, 'content', 'engine-hubs.json');
const NEEDS = path.join(ROOT, 'content', 'workshop-needs.json');
const CANVAS_ENGINE = path.join(ROOT, 'workshop-canvas-engine.js');
const HUB = path.join(ROOT, 'pages', 'workshop.html');
const START = '<!-- CATALOGUE:START -->';
const END = '<!-- CATALOGUE:END -->';
const BROWSE_START = '<!-- BROWSE:START -->';
const BROWSE_END = '<!-- BROWSE:END -->';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');


const ENGINE_META = {
  'Scratch': { emoji: '🐱', color: '#FF7700' },
  'Roblox': { emoji: '🟦', color: '#00A2FF' },
  'Minecraft': { emoji: '⛏️', color: '#62b847' },
  'Godot': { emoji: '🤖', color: '#478cbf' },
  'Unity': { emoji: '🎲', color: '#5bc0f8' },
  'Unreal': { emoji: '🔵', color: '#313131' },
  'JavaScript': { emoji: '⚡', color: '#f7df1e' },
  'Python': { emoji: '🐍', color: '#3776ab' },
  'C++': { emoji: '🔧', color: '#00599c' },
  'Java': { emoji: '☕', color: '#f89820' },
  'GML/GameMaker': { emoji: '🕹️', color: '#a1c42a' },
  'GDevelop': { emoji: '🎯', color: '#00bfa5' },
  'Defold': { emoji: '⚙️', color: '#2196F3' },
  'PICO-8': { emoji: '🎮', color: '#ff004d' },
  'Blender': { emoji: '🎨', color: '#e8833a' },
  'TinkerCAD': { emoji: '🖨️', color: '#f2637a' },
  'MUGEN': { emoji: '🥊', color: '#BC4749' },
  'OpenRCT2': { emoji: '🎢', color: '#c98a2e' },
  'Stardew Valley': { emoji: '🌾', color: '#8bc34a' },
  'Terraria': { emoji: '🌳', color: '#7cb342' },
  'General': { emoji: '🧭', color: '#70A3A7' }
};

function loadOutcomes() {
  try {
    const list = JSON.parse(fs.readFileSync(OUTCOMES, 'utf8'));
    return new Map(list.map((o) => [o.id, o]));
  } catch {
    return new Map();
  }
}

// A2529: where does this workshop sit in its series? Built from
// content/courses.json, which is generated from each page's own WS-NEXT block.
function loadCourses() {
  const map = new Map();
  try {
    const data = JSON.parse(fs.readFileSync(COURSES, 'utf8'));
    for (const course of data.courses || []) {
      const steps = course.steps || [];
      steps.forEach((step, i) => {
        if (!step || !step.slug || map.has(step.slug)) return;
        map.set(step.slug, {
          name: course.name,
          index: i + 1,
          total: steps.length,
          firstTitle: (steps[0] && steps[0].title) || course.name
        });
      });
    }
  } catch { /* catalogue still renders without courses */ }
  return map;
}

// A2793: what does a learner need before they can start?
// - browser: runs in the browser with nothing to install
// - install: needs a free desktop engine or tool installed first
// - account: runs in the browser but needs a login (a barrier on school PCs)
// Browser studios (ids ending -studio / -mod-studio) are always browser.
// content/workshops.json can override any entry with an explicit "needs" field.
const BROWSER_ENGINES = new Set(['Scratch', 'JavaScript', 'General', 'TinkerCAD']);
function needsFor(entry, isStudio) {
  const explicit = entry && entry.needs;
  if (explicit === 'browser' || explicit === 'install' || explicit === 'account') return explicit;
  if (isStudio) return 'browser';
  if (BROWSER_ENGINES.has(entry && entry.engine)) return 'browser';
  return 'install';
}

const LEVEL_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

// A1979: the parent check. One plain line per card so a grown-up can decide
// before the learner starts: reading, typing, grown-up help and software.
const APP_TEXT = {
  'Godot': 'Free Godot 4',
  'Unity': 'Free Unity',
  'Unreal': 'Free Unreal Engine',
  'Blender': 'Free Blender',
  'Minecraft': 'Minecraft Java, plus free mod tools',
  'MUGEN': 'Free MUGEN',
  'Stardew Valley': 'Stardew Valley, plus free SMAPI',
  'Terraria': 'Terraria, plus free tModLoader',
  'OpenRCT2': 'Free OpenRCT2',
  'PICO-8': 'PICO-8 (paid once)',
  'Python': 'Free Python',
  'C++': 'A free C++ compiler',
  'Java': 'Free Java',
  'GML/GameMaker': 'Free GameMaker',
  'Defold': 'Free Defold',
  'GDevelop': 'Free GDevelop',
  'Roblox': 'Free Roblox Studio'
};
const CODE_ENGINES = new Set(['Godot', 'JavaScript', 'Python', 'C++', 'Java', 'GML/GameMaker', 'PICO-8', 'Unity', 'Unreal']);
const DRAG_ENGINES = new Set(['Scratch', 'TinkerCAD']);

function fitFor(e, needs) {
  const engine = e.engine || 'General';
  const level = String(e.difficulty || 'beginner').toLowerCase();
  const install = needs === 'install';
  const account = needs === 'account';
  const reading = DRAG_ENGINES.has(engine)
    ? 'Pictures and short words'
    : (level === 'advanced' || ['C++', 'Unreal', 'Java', 'Unity'].includes(engine))
      ? 'Reads some code'
      : 'Short sentences';
  const typing = DRAG_ENGINES.has(engine)
    ? 'No typing'
    : CODE_ENGINES.has(engine)
      ? 'Types code'
      : 'A few words and numbers';
  const adult = install
    ? 'A grown-up helps with the install'
    : account
      ? 'A grown-up may help with the account'
      : 'No grown-up needed';
  const software = install
    ? (APP_TEXT[engine] || ('Free ' + engine)) + (e.alternative ? ', or the browser build' : '')
    : account
      ? 'Browser and a free account'
      : 'Browser only';
  return { reading, typing, adult, software };
}

function fitRow(e, needs) {
  const f = fitFor(e, needs);
  const item = (label, value) => '          <span class="course-fit-item"><b>' + label + '</b> ' + esc(value) + '</span>\n';
  return '        <div class="course-fit" data-reading="' + esc(f.reading) + '" data-typing="' + esc(f.typing) + '" data-adult="' + esc(f.adult) + '" data-software="' + esc(f.software) + '">\n'
    + item('Reading', f.reading)
    + item('Typing', f.typing)
    + item('Grown-up', f.adult)
    + item('Software', f.software)
    + '        </div>\n';
}const NEEDS_LABEL = {
  browser: { text: 'Runs in browser', title: 'No install. Opens in a normal browser.' },
  install: { text: 'Needs install', title: 'Needs a free app on a desktop or laptop.' },
  account: { text: 'Needs login', title: 'Opens in a browser, but you sign in first.' }
};

// A2529: one honest duration per card so a learner can pick something that fits
// this lesson. Derived from step count (about five minutes a step) unless a
// workshop sets its own `minutes`.
function minutesFor(e) {
  const explicit = parseInt(e.minutes, 10);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const steps = parseInt(e.steps, 10);
  const base = Number.isFinite(steps) && steps > 0 ? steps * 5 : 20;
  return Math.max(10, Math.min(90, base));
}

function metaRow(e, isStudio) {
  const needs = needsFor(e, isStudio);
  const need = NEEDS_LABEL[needs] || NEEDS_LABEL.install;
  const level = LEVEL_LABEL[String(e.difficulty || '').toLowerCase()] || 'Beginner';
  const mins = minutesFor(e);
  return '        <div class="course-meta">\n'
    + '          <span class="course-pill course-pill--time" title="About ' + mins + ' minutes">~' + mins + ' min</span>\n'
    + '          <span class="course-pill course-pill--level course-pill--' + esc(String(e.difficulty || 'beginner').toLowerCase()) + '" title="' + esc(level) + ' level">' + esc(level) + '</span>\n'
    + '          <span class="course-pill course-pill--needs course-pill--' + esc(needs) + '" title="' + esc(need.title) + '">' + esc(need.text) + '</span>\n'
    + '        </div>\n';
}

function prereqRow(e, courses) {
  const course = courses.get(e.id);
  if (!course || course.total < 2) return '';
  const where = course.index > 1
    ? 'Step ' + course.index + ' of ' + course.total + ' in <strong>' + esc(course.name) + '</strong> · starts with ' + esc(course.firstTitle)
    : 'Step 1 of ' + course.total + ' in <strong>' + esc(course.name) + '</strong>';
  return '        <div class="course-prereq">' + where + '</div>\n';
}

function card(e, outcomes, courses, buildAlong) {
  const href = '../' + String(e.url).replace(/^\//, '');
  const isStudio = /-(?:mod-)?studio$/.test(e.id || '');
  const badge = (buildAlong ? 'Build-along · ' : '') + (isStudio ? '🛠 Browser studio · ' : '') + [e.engine, 'Ages ' + e.ageRange].filter(Boolean).join(' · ');
  const desc = e.desc || ('Interactive build-along for ' + e.title + '.');
  const outcome = outcomes.get(e.id);
  const outcomeLine = outcome
    ? '        <div class="course-outcome"><strong>Finish with</strong> ' + esc(outcome.finish) + '. <strong>Extend it by</strong> ' + esc(outcome.extend) + '.</div>\n'
    : '';
  const thumb = e.cover
    ? '      <div class="course-thumb"><img src="' + esc(e.cover) + '" alt="" width="320" height="180" loading="lazy" decoding="async"></div>\n'
    : '      <div class="course-thumb course-thumb--empty" aria-hidden="true">' + esc(e.engine || 'Make') + '</div>\n';
  return '    <a href="' + esc(href) + '" class="course-card"'
    + ' data-engine="' + esc(e.engine) + '"'
    + ' data-difficulty="' + esc(e.difficulty) + '"'
    + ' data-age="' + esc(e.ageRange) + '"'
    + ' data-needs="' + needsFor(e, isStudio) + '"'
    + ' data-minutes="' + minutesFor(e) + '"'
    + (isStudio ? ' data-studio="true"' : '')
    + ' data-cat="tutorial"'
    + (buildAlong ? ' data-buildalong="true"' : '')
    + '>\n'
    + thumb
    + '      <div class="course-body">\n'
    + '        <div class="course-tag">' + esc(badge) + '</div>\n'
    + '        <div class="course-title">' + esc(e.title) + '</div>\n'
    + '        <div class="course-desc">' + esc(desc) + '</div>\n'
    + metaRow(e, isStudio)
    + fitRow(e, needsFor(e, isStudio))
    + prereqRow(e, courses)
    + outcomeLine
    + '      </div>\n'
    + '    </a>';
}

function section(entries, outcomes, courses) {
  return '<section class="courses-section" id="catalogue" data-format="courses">\n'
    + '  <div class="ws-section-head reveal">\n'
    + '    <span class="ws-section-icon">📖</span>\n'
    + '    <div>\n'
    + '      <h2 class="ws-section-label">All workshops</h2>\n'
    + '      <div class="ws-section-sub">Every workshop in one place. Use the finder above to narrow it down by tool, level or age.</div>\n'
    + '    </div>\n'
    + '    <span class="ws-section-count">' + entries.length + ' Workshops</span>\n'
    + '  </div>\n'
    + '  <div class="ws-fit-legend" role="note">\n'
    + '    <p><strong>For grown-ups:</strong> every card says the reading, typing, grown-up help and software it needs. Ages are guidance, not a rule. A workshop that needs an install also shows the browser build when one exists, and every card links to the next step in its course.</p>\n'
    + '  </div>\n'
    + '  <div class="courses-grid" id="catalogueGrid">\n'
    + entries.map((e) => card(e, outcomes, courses)).join('\n')
    + '\n  </div>\n'
    + '</section>';
}

function loadCanvasTwins(entries) {
  const ids = new Set(entries.map((e) => e.id));
  const guideMap = {};
  try {
    const src = fs.readFileSync(CANVAS_ENGINE, 'utf8');
    const m = src.match(/CANVAS_GUIDE_MAP\s*=\s*\{([\s\S]*?)\}/);
    for (const mm of (m ? m[1] : '').matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)) {
      guideMap[mm[1]] = mm[2];
    }
  } catch { /* no map, treat every canvas as its own card */ }
  const twins = new Set();
  for (const e of entries) {
    if (!/-canvas$/.test(e.id)) continue;
    const file = String(e.url).split('/').pop();
    const guide = guideMap[file];
    if (guide && ids.has(guide.replace(/\.html$/, ''))) twins.add(e.id);
  }
  return twins;
}

function buildAlongSection(entries, outcomes, courses) {
  if (!entries.length) return '';
  return '<details class="ws-buildalong">\n'
    + '  <summary>Build it in the browser: ' + entries.length + ' in-page build-alongs</summary>\n'
    + '  <p class="ws-buildalong-sub">The same projects as the guides above, kept as in-page build canvases for school computers. Every link still works.</p>\n'
    + '  <div class="courses-grid">\n'
    + entries.map((e) => card(e, outcomes, courses, true)).join('\n')
    + '\n  </div>\n'
    + '</details>';
}

function engineHubs() {
  try {
    const cfg = JSON.parse(fs.readFileSync(ENGINE_HUBS, 'utf8'));
    const map = new Map();
    for (const e of cfg.engines || []) map.set(e.engine || e.name, '../workshops/engine-' + e.id + '.html');
    return map;
  } catch {
    return new Map();
  }
}

function browse(entries) {
  const counts = new Map();
  for (const e of entries) counts.set(e.engine, (counts.get(e.engine) || 0) + 1);
  const engines = [...counts.keys()].sort((a, b) => {
    if (a === 'General') return 1;
    if (b === 'General') return -1;
    return counts.get(b) - counts.get(a) || a.localeCompare(b);
  });
  const tiles = engines.map((eng) => {
    const meta = ENGINE_META[eng] || { emoji: '🎮', color: '#70A3A7' };
    const n = counts.get(eng);
    const hub = engineHubs().get(eng);
    return '      <button type="button" class="ws-engine-tile" data-engine="' + esc(eng) + '"'
      + (hub ? ' data-hub="' + esc(hub) + '"' : '')
      + ' style="--eng-color:' + meta.color + '"'
      + ' aria-label="Open the ' + esc(eng) + ' engine hub">\n'
      + '        <span class="ws-engine-emoji" aria-hidden="true">' + meta.emoji + '</span>\n'
      + '        <span class="ws-engine-name">' + esc(eng) + '</span>\n'
      + '        <span class="ws-engine-count">' + n + (n === 1 ? ' workshop' : ' workshops') + '</span>\n'
      + '      </button>';
  }).join('\n');
  return '<section class="ws-browse" id="browse-engines" aria-labelledby="ws-browse-title">\n'
    + '  <div class="ws-browse-inner">\n'
    + '    <div class="ws-browse-head">\n'
    + '      <img src="/assets/mascots/lumo-badge.webp" alt="Lumo" width="40" height="40" loading="lazy" style="border-radius:50%;margin-bottom:6px">\n'
    + '      <span class="ws-browse-tag">Browse with Lumo</span>\n'
    + '      <h2 id="ws-browse-title">Pick the tool you want to learn</h2>\n'
    + '      <p>Tap a tool to jump straight to its workshops in the catalogue below.</p>\n'
    + '    </div>\n'
    + '    <div class="ws-engine-grid">\n'
    + tiles + '\n'
    + '    </div>\n'
    + '  </div>\n'
    + '</section>';
}

function splice(html, startMarker, endMarker, want) {
  if (!html.includes(startMarker) || !html.includes(endMarker)) return null;
  const have = html.slice(html.indexOf(startMarker), html.indexOf(endMarker) + endMarker.length);
  return { have, want, html: html.slice(0, html.indexOf(startMarker)) + want + html.slice(html.indexOf(endMarker) + endMarker.length) };
}

function needsManifest(entries) {
  const studios = new Map();
  for (const e of entries) {
    const isStudio = /-(?:mod-)?studio$/.test(e.id || '');
    if (isStudio && !studios.has(e.engine)) studios.set(e.engine, e);
  }
  return entries.map((e) => {
    const isStudio = /-(?:mod-)?studio$/.test(e.id || '');
    const needs = needsFor(e, isStudio);
    const explicitAlt = e.alternative && e.alternative.url ? e.alternative : null;
    const alt = needs === 'install' ? (explicitAlt || studios.get(e.engine)) : null;
    return {
      url: e.url,
      id: e.id,
      engine: e.engine,
      needs,
      alternative: alt ? { title: alt.title, url: alt.url } : null
    };
  });
}

function generate({ checkOnly = false } = {}) {
  const entries = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const outcomes = loadOutcomes();
  const courses = loadCourses();
  let html = fs.readFileSync(HUB, 'utf8');
  let changed = false;

  const needsJson = JSON.stringify(needsManifest(entries), null, 2) + '\n';
  let needsChanged = true;
  try {
    needsChanged = fs.readFileSync(NEEDS, 'utf8') !== needsJson;
  } catch {
    needsChanged = true;
  }
  if (needsChanged && !checkOnly) fs.writeFileSync(NEEDS, needsJson);

  const twinIds = loadCanvasTwins(entries);
  const mainEntries = entries.filter((e) => !twinIds.has(e.id));
  const buildAlongEntries = entries.filter((e) => twinIds.has(e.id));

  const blocks = [
    [BROWSE_START, BROWSE_END, BROWSE_START + '\n' + browse(entries) + '\n' + BROWSE_END],
    [START, END, START + '\n' + section(mainEntries, outcomes, courses) + '\n' + buildAlongSection(buildAlongEntries, outcomes, courses) + '\n' + END]
  ];

  for (const [s, e, want] of blocks) {
    const res = splice(html, s, e, want);
    if (!res) throw new Error('markers missing in pages/workshop.html: ' + s);
    if (res.have !== want) {
      changed = true;
      if (!checkOnly) html = res.html;
    }
  }

  if (changed && !checkOnly) fs.writeFileSync(HUB, html);
  return { changed: changed || needsChanged, count: entries.length };
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const { changed, count } = generate({ checkOnly });
  if (checkOnly) {
    if (changed) {
      console.log('  [FAIL] catalogue/browse/needs drift: regenerate with node scripts/generate-workshop-catalogue.js');
      process.exit(1);
    }
    console.log('  [PASS] catalogue + browse + needs in sync (' + count + ' cards)');
    return;
  }
  console.log(changed
    ? '  [OK] wrote catalogue + browse + needs for ' + count + ' workshops'
    : '  [PASS] catalogue + browse + needs already in sync (' + count + ' cards)');
}

if (require.main === module) main();
module.exports = { generate };
