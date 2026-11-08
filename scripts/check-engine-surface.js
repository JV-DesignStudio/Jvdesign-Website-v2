#!/usr/bin/env node
/*
 * scripts/check-engine-surface.js (A2648)
 *
 * Keeps the workshop catalogue to three supported engines: Scratch, Godot and
 * browser JavaScript. Every other engine hub must be marked legacy, and a new
 * workshop card may only target a legacy engine when it sets an explicit
 * `"legacyOverride": true` in content/workshops.json.
 *
 * The baseline file (content/engine-legacy-baseline.json) lists the cards that
 * already existed when the cap was introduced, so they keep working. Rebuild it
 * deliberately with `--update-baseline` after a reviewed decision.
 *
 * Run:   node scripts/check-engine-surface.js
 *        node scripts/check-engine-surface.js --update-baseline
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG = path.join(ROOT, 'content', 'engine-hubs.json');
const WORKSHOPS = path.join(ROOT, 'content', 'workshops.json');
const BASELINE = path.join(ROOT, 'content', 'engine-legacy-baseline.json');

const SUPPORTED = ['scratch', 'godot', 'javascript'];
const SUPPORTED_NAMES = { scratch: 'Scratch', godot: 'Godot', javascript: 'JavaScript' };

function load() {
  return {
    config: JSON.parse(fs.readFileSync(CONFIG, 'utf8')),
    workshops: JSON.parse(fs.readFileSync(WORKSHOPS, 'utf8')),
    baseline: JSON.parse(fs.readFileSync(BASELINE, 'utf8')),
  };
}

function buildBaseline(config, workshops) {
  const byEngine = new Map(config.engines.map((e) => [e.engine, e]));
  const legacy = {};
  const unmatched = [];
  for (const w of workshops) {
    const e = byEngine.get(w.engine);
    if (!e) { unmatched.push(w.engine); continue; }
    if (SUPPORTED.includes(e.id)) continue;
    (legacy[e.id] = legacy[e.id] || []).push(w.id);
  }
  for (const k of Object.keys(legacy)) legacy[k].sort();
  return {
    _comment: 'Baseline of workshop cards that already target a legacy engine. New cards on a legacy engine must set "legacyOverride": true in content/workshops.json. Rebuild with node scripts/check-engine-surface.js --update-baseline.',
    supported: SUPPORTED.slice(),
    legacy,
    unmatchedEngines: [...new Set(unmatched)].sort(),
  };
}

function run() {
  const { config, workshops, baseline } = load();
  const issues = [];
  const enginesById = new Map(config.engines.map((e) => [e.id, e]));

  for (const id of SUPPORTED) {
    const e = enginesById.get(id);
    if (!e) issues.push('supported engine "' + id + '" is missing from content/engine-hubs.json');
    else if (e.legacy) issues.push('supported engine "' + id + '" is marked legacy');
  }
  for (const e of config.engines) {
    if (SUPPORTED.includes(e.id)) continue;
    if (e.legacy !== true) issues.push('engine "' + e.id + '" is not supported and must set "legacy": true');
  }

  const baselineSupported = Array.isArray(baseline.supported) ? baseline.supported : [];
  if (baselineSupported.slice().sort().join(',') !== SUPPORTED.slice().sort().join(',')) {
    issues.push('baseline supported list does not match Scratch, Godot and JavaScript');
  }

  const byEngine = new Map(config.engines.map((e) => [e.engine, e]));
  const legacyById = baseline.legacy || {};
  const offenders = [];
  const unknown = [];
  for (const w of workshops) {
    const e = byEngine.get(w.engine);
    if (!e) { unknown.push(w.id + ' (' + w.engine + ')'); continue; }
    if (SUPPORTED.includes(e.id)) continue;
    const known = Array.isArray(legacyById[e.id]) && legacyById[e.id].includes(w.id);
    if (!known && w.legacyOverride !== true) offenders.push(w.id + ' (' + e.id + ')');
  }
  for (const u of unknown) issues.push('workshop targets an unknown engine: ' + u);
  for (const o of offenders) issues.push('new legacy-engine card needs "legacyOverride": true: ' + o);

  return {
    ok: issues.length === 0,
    supported: SUPPORTED.map((id) => SUPPORTED_NAMES[id] || id),
    legacy: config.engines.filter((e) => e.legacy).length,
    baselineCards: Object.values(legacyById).reduce((a, b) => a + (Array.isArray(b) ? b.length : 0), 0),
    offenders,
    issues,
  };
}

function updateBaseline() {
  const { config, workshops } = load();
  const out = buildBaseline(config, workshops);
  fs.writeFileSync(BASELINE, JSON.stringify(out, null, 2) + '\n');
  console.log('Wrote ' + path.relative(ROOT, BASELINE) + ': ' + Object.keys(out.legacy).length + ' legacy engines, ' +
    Object.values(out.legacy).reduce((a, b) => a + b.length, 0) + ' baseline cards');
}

if (require.main === module) {
  if (process.argv.includes('--update-baseline')) {
    updateBaseline();
  } else {
    const r = run();
    console.log('Engine surface: ' + r.supported.join(', ') + ' supported; ' + r.legacy + ' legacy hubs; ' + r.baselineCards + ' legacy cards grandfathered');
    if (r.ok) {
      console.log('PASS no new workshop targets a legacy engine without an explicit override');
    } else {
      console.error('FAIL ' + r.issues.length + ' engine-surface problem(s):');
      r.issues.forEach((i) => console.error('  ' + i));
      process.exitCode = 1;
    }
  }
}

module.exports = { run, buildBaseline, updateBaseline, SUPPORTED };
