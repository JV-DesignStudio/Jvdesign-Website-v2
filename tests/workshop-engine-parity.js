#!/usr/bin/env node
/* Engine parity rollout report and gate (A3072).
 *
 * Every build-along must carry the same step in the real engine:
 * a downloadable starter project and, on every step, the engine name, the exact
 * file, at least three ordered actions and a checkpoint.
 *
 * Configs that existed before the standard live in
 * content/workshop-engine-parity-baseline.json. Each engine slice removes its
 * own configs from that baseline. A new config is never added to it, and the
 * baseline may not grow beyond its recorded max.
 *
 * Run: node tests/workshop-engine-parity.js
 *      node tests/workshop-engine-parity.js --list
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SITE = path.resolve(__dirname, '..');
const DIR = path.join(SITE, 'assets', 'js', 'inline');
const BASELINE_FILE = path.join(SITE, 'content', 'workshop-engine-parity-baseline.json');
const LIST = process.argv.includes('--list');

function readBaseline() {
  try {
    const raw = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    const configs = Array.isArray(raw.configs) ? raw.configs : [];
    return { configs: new Set(configs), max: Number.isFinite(raw.max) ? raw.max : configs.length };
  } catch {
    return { configs: new Set(), max: 0 };
  }
}

function loadConfig(file) {
  const noop = () => {};
  const el = () => ({ style: {}, dataset: {}, classList: { add: noop, remove: noop, toggle: noop }, setAttribute: noop, getAttribute: () => null, addEventListener: noop, appendChild: noop });
  const document = { getElementById: () => el(), querySelector: () => null, querySelectorAll: () => [], createElement: () => el(), addEventListener: noop, head: el(), body: el() };
  const window = { document, addEventListener: noop, localStorage: { getItem: () => null, setItem: noop }, location: { pathname: '/' }, matchMedia: () => ({ matches: false, addEventListener: noop }) };
  const sandbox = { window, document, console, localStorage: window.localStorage, location: window.location, navigator: { userAgent: 'node' }, setTimeout, clearTimeout, requestAnimationFrame: noop };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(DIR, file), 'utf8'), sandbox, { timeout: 4000 });
  return sandbox.window.CW_CONFIG || null;
}

function starterIssues(config) {
  const p = config.engineProject;
  if (!p || !p.href) return ['no engineProject (downloadable starter)'];
  const file = String(p.href).startsWith('/') ? path.join(SITE, String(p.href).slice(1)) : path.resolve(SITE, String(p.href));
  if (!fs.existsSync(file)) return ['engineProject file missing: ' + p.href];
  if (fs.statSync(file).size < 100) return ['engineProject is a placeholder: ' + p.href];
  return [];
}

function laneIssues(step) {
  const e = step && step.engine;
  if (!e) return ['step ' + (step && step.num) + ' has no engine lane'];
  const issues = [];
  if (!e.name || !String(e.name).trim()) issues.push('step ' + step.num + ' has no engine name');
  if (!e.file || !String(e.file).trim()) issues.push('step ' + step.num + ' has no exact file');
  if (!Array.isArray(e.do)) issues.push('step ' + step.num + ' has no ordered actions');
  else {
    if (e.do.length < 3) issues.push('step ' + step.num + ' has ' + e.do.length + ' action(s), needs 3');
    if (e.do.some((a) => !String(a || '').trim())) issues.push('step ' + step.num + ' has an empty action');
  }
  if (!e.check || !String(e.check).trim()) issues.push('step ' + step.num + ' has no checkpoint');
  return issues;
}

function issuesFor(config) {
  const issues = starterIssues(config);
  for (const step of config.steps || []) issues.push(...laneIssues(step));
  return issues;
}

const baseline = readBaseline();
const files = fs.readdirSync(DIR).filter((f) => /^workshops-.*\.js$/.test(f) && fs.readFileSync(path.join(DIR, f), 'utf8').includes('CW_CONFIG')).sort();
const failures = [];
const pending = [];
const pendingReady = [];
const seen = new Set();
let ready = 0;

for (const file of files) {
  let config;
  try { config = loadConfig(file); } catch (e) { failures.push(file + ': eval error ' + e.message); continue; }
  if (!config || !Array.isArray(config.steps)) continue;
  const key = config.storageKey || file.replace(/^workshops-|\.js$/g, '');
  seen.add(key);
  const issues = issuesFor(config);
  if (baseline.configs.has(key)) {
    pending.push(key);
    if (!issues.length) pendingReady.push(key);
    if (LIST) console.log('PENDING ' + key + (issues.length ? '' : ' (ready, remove from baseline)'));
    continue;
  }
  if (issues.length) failures.push(key + ': ' + issues.join('; '));
  else ready++;
}

const stale = [...baseline.configs].filter((k) => !seen.has(k));
if (stale.length) failures.push('baseline lists configs that no longer exist: ' + stale.join(', '));
if (pendingReady.length) failures.push('baseline still lists ready configs (remove them): ' + pendingReady.join(', '));
if (baseline.configs.size > baseline.max) failures.push('baseline grew to ' + baseline.configs.size + ' (max ' + baseline.max + '); new configs must not be added');

console.log('Engine parity: ' + ready + ' ready, ' + pending.length + ' on the rollout baseline, ' + failures.length + ' failing.');
console.log('Baseline: ' + baseline.configs.size + ' / max ' + baseline.max + (pendingReady.length ? ' (' + pendingReady.length + ' ready to remove)' : ''));
if (failures.length) {
  console.log('FAIL');
  failures.forEach((f) => console.log('  ' + f));
  process.exitCode = 1;
} else {
  console.log('PASS every config outside the baseline has a real starter and a complete engine lane on every step');
}
