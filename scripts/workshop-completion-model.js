'use strict';
/**
 * workshop-completion-model.js (A2037)
 *
 * One authoritative answer to "how does a learner know this workshop is
 * finished, and where do they go next?" for every published tutorial.
 *
 * Loaded by:
 *   scripts/build-workshop-completion.js   (writes content/workshop-completion.json)
 *   scripts/apply-workshop-completion.js   (stamps the finish link / finish panel)
 *   tests/workshop-completion.js           (static contract check)
 *   validate-workshops.js                  (release gate)
 *
 * Modes
 *   engine   page runs the shared workshop-engine.js, finish = every step done
 *   canvas   page runs workshop-canvas-engine.js, finish = every build step done
 *   steps    page has its own step engine with #finishBanner
 *   builder  live builder/blueprint page, finish = the build plays or downloads
 *
 * Reference pages (hubs, starter files, cheat sheets, studios) are not
 * step tutorials, so they are listed with mode "reference" and only need a
 * next step, not a completion condition.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTCOMES = path.join(ROOT, 'content', 'workshop-outcomes.json');
const CATALOGUE = path.join(ROOT, 'content', 'workshops.json');

const REFERENCE_IDS = new Set([
  'learn', 'learning-lab', 'my-achievements', 'start-here', 'tiny-learners',
  'godot_templates', 'minecraft-mod-starter-files', 'minecraft-setup-check',
  'my-first-series', 'my-first-3d-model', 'my-first-3d-prints-fidget-toy',
  'my-first-browser-game', 'my-first-cpp-game', 'my-first-defold-game',
  'my-first-fighting-game', 'my-first-gamemaker-game', 'my-first-gdevelop-game',
  'my-first-java-game', 'my-first-minecraft-mod', 'my-first-pico8-game',
  'my-first-python-game', 'my-first-roblox-studio-game', 'my-first-scratch-game',
  'my-first-unity-game', 'my-first-unreal-game', 'my-first-video-game'
]);

const ENGINE_HUBS = {
  'Blender': 'engine-blender.html',
  'C++': 'engine-cpp.html',
  'Defold': 'engine-defold.html',
  'GDevelop': 'engine-gdevelop.html',
  'General': 'engine-general.html',
  'GML/GameMaker': 'engine-gml-gamemaker.html',
  'Godot': 'engine-godot.html',
  'Java': 'engine-java.html',
  'JavaScript': 'engine-javascript.html',
  'Minecraft': 'engine-minecraft.html',
  'MUGEN': 'engine-mugen.html',
  'OpenRCT2': 'engine-openrct2.html',
  'PICO-8': 'engine-pico-8.html',
  'Python': 'engine-python.html',
  'Roblox': 'engine-roblox.html',
  'Scratch': 'engine-scratch.html',
  'Stardew Valley': 'engine-stardew-valley.html',
  'Terraria': 'engine-terraria.html',
  'TinkerCAD': 'engine-tinkercad.html',
  'Unity': 'engine-unity.html',
  'Unreal': 'engine-unreal.html'
};

function readPage(file) {
  const full = path.join(ROOT, 'workshops', file);
  if (!fs.existsSync(full)) return null;
  let all = fs.readFileSync(full, 'utf8');
  let m;
  const re = /\/assets\/js\/inline\/([A-Za-z0-9._-]+\.js)/g;
  while ((m = re.exec(all))) {
    try { all += '\n' + fs.readFileSync(path.join(ROOT, 'assets', 'js', 'inline', m[1]), 'utf8'); } catch (e) {}
  }
  return all;
}

function storageKey(src) {
  const patterns = [
    /data-workshop-key="([^"]+)"/,
    /data-workshop-key='([^']+)'/,
    /WORKSHOP_KEY\s*=\s*['"]([^'"]+)['"]/,
    /storageKey:\s*['"]([^'"]+)['"]/,
    /STORAGE_KEY\s*=\s*['"]([^'"]+)['"]/
  ];
  for (const re of patterns) {
    const m = src.match(re);
    if (m) return m[1];
  }
  return '';
}

/* The canvas engine keeps its own state under CFG.storageKey, which can differ
   from the shared engine's WORKSHOP_KEY on the same page, so pick the key the
   finish/progress code actually reads. */
function storageKeyFor(mode, src) {
  if (mode === 'canvas') {
    const m = src.match(/storageKey:\s*['"]([^'"]+)['"]/);
    if (m) return m[1];
  }
  if (mode === 'steps') {
    const m = src.match(/STORAGE_KEY\s*=\s*['"]([^'"]+)['"]/);
    if (m) return m[1];
  }
  return storageKey(src);
}

function nextLink(src) {
  const patterns = [
    /<a[^>]*class="[^"]*next-ep-btn[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i,
    /<a[^>]*href="([^"]+)"[^>]*class="[^"]*next-ep-btn[^"]*"[^>]*>([\s\S]*?)<\/a>/i,
    /<a[^>]*class="[^"]*series-nav-link--next[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i,
    /<a[^>]*href="([^"]+)"[^>]*class="[^"]*series-nav-link--next[^"]*"[^>]*>([\s\S]*?)<\/a>/i
  ];
  for (const re of patterns) {
    const m = src.match(re);
    if (!m) continue;
    const label = m[2].replace(/<[^>]+>/g, ' ').replace(/&#?\w+;/g, ' ').replace(/\s+/g, ' ').trim();
    return { url: m[1], label: label || 'Next workshop', source: 'page' };
  }
  return null;
}

function resolveNext(entry, src, catalogueById) {
  const explicit = nextLink(src);
  if (explicit && !/^https?:/i.test(explicit.url) && !/^(#|\/me|\.\.\/me|\/pages\/workshop)/i.test(explicit.url)) {
    return explicit;
  }
  const catalogue = catalogueById[entry.id];
  const hub = catalogue && ENGINE_HUBS[catalogue.engine];
  if (hub && fs.existsSync(path.join(ROOT, 'workshops', hub))) {
    const engineName = catalogue.engine === 'General' ? 'workshops' : catalogue.engine + ' workshops';
    return { url: hub, label: 'All ' + engineName, source: 'engine-hub' };
  }
  return { url: '../pages/workshop.html', label: 'Browse all workshops', source: 'catalogue' };
}

function classify(entry, src) {
  if (entry.kind === 'series' || entry.kind === 'series-hub') return 'reference';
  if (REFERENCE_IDS.has(entry.id)) return 'reference';
  /* Some pages load both engines: the canvas engine drives the build if the
     page defines CW_CONFIG, so check that pairing before the plain engine. */
  if (/workshop-canvas-engine\.js/.test(src) && /CW_CONFIG/.test(src)) return 'canvas';
  if (/workshop-engine\.js/.test(src)) return 'engine';
  if (/id="finishBanner"/.test(src)) {
    /* Only checkbox-style page scripts get the shared step restore. Builders
       with tabs/goStep have their own restore and use the banner directly. */
    if (/class="step-card/.test(src)) return 'steps';
    return 'builder';
  }
  return 'builder';
}

const CONDITION = {
  engine: { code: 'all-steps', text: 'every step and its quiz or code check is done.', selector: '#finishBanner' },
  canvas: { code: 'all-build-steps', text: 'every build step is done and the canvas game runs on its own.', selector: '.cw-next' },
  steps: { code: 'all-steps', text: 'every step in the workshop is done.', selector: '#finishBanner' },
  builder: { code: 'final-build', text: 'your build plays or downloads as a real project file.', selector: '#wsFinish' },
  reference: { code: 'none', text: 'Reference page, no step tracking.', selector: '' }
};

function build() {
  const outcomes = JSON.parse(fs.readFileSync(OUTCOMES, 'utf8'));
  const catalogue = JSON.parse(fs.readFileSync(CATALOGUE, 'utf8'));
  const catalogueById = {};
  catalogue.forEach((c) => { catalogueById[c.id] = c; });

  const workshops = [];
  const skipped = [];
  for (const entry of outcomes) {
    if (!['workshop', 'builder', 'series', 'series-hub'].includes(entry.kind)) continue;
    const file = path.basename(entry.url || '');
    const src = file ? readPage(file) : null;
    if (!src) { skipped.push({ id: entry.id, reason: 'page missing' }); continue; }
    const mode = classify(entry, src);
    const cond = CONDITION[mode];
    workshops.push({
      id: entry.id,
      url: entry.url,
      page: 'workshops/' + file,
      kind: entry.kind,
      mode,
      condition: cond.code,
      conditionText: cond.text,
      finishSelector: cond.selector,
      storageKey: storageKeyFor(mode, src),
      hasFinishBanner: /id=["']finishBanner["']/.test(src),
      next: mode === 'reference' ? null : resolveNext(entry, src, catalogueById)
    });
  }
  workshops.sort((a, b) => a.id.localeCompare(b.id));
  return { workshops, skipped, modes: CONDITION };
}

module.exports = { build, REFERENCE_IDS, ENGINE_HUBS, CONDITION, readPage, storageKey, storageKeyFor };
