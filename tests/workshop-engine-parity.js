#!/usr/bin/env node
/* Engine parity rollout report and gate (A3070).
 *
 * Every new build-along must carry the same step in the real engine:
 * a downloadable starter project and, on every step, the engine name, file,
 * ordered actions and a checkpoint.
 *
 * Configs that existed before the standard live in
 * content/workshop-engine-parity-baseline.json. Each engine slice removes its
 * own configs from that baseline. A new config is never added to it.
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

function baseline() {
  try {
    const raw = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    return new Set(Array.isArray(raw.configs) ? raw.configs : []);
  } catch {
    return new Set();
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

function issuesFor(config) {
  const issues = [];
  if (!config.engineProject || !config.engineProject.href) {
    issues.push('no engineProject (downloadable starter)');
  } else {
    const href = String(config.engineProject.href);
    const file = href.startsWith('/') ? path.join(SITE, href.slice(1)) : path.resolve(SITE, href);
    if (!fs.existsSync(file)) issues.push('engineProject file missing: ' + href);
  }
  for (const step of config.steps || []) {
    const e = step && step.engine;
    if (!e || !e.name || !Array.isArray(e.do) || !e.do.length || !e.check) {
      issues.push('step ' + (step && step.num) + ' has no complete engine lane');
    }
  }
  return issues;
}

const skip = baseline();
const files = fs.readdirSync(DIR).filter((f) => /^workshops-.*\.js$/.test(f) && fs.readFileSync(path.join(DIR, f), 'utf8').includes('CW_CONFIG')).sort();
const failures = [];
const pending = [];
let ready = 0;

for (const file of files) {
  let config;
  try { config = loadConfig(file); } catch (e) { failures.push(file + ': eval error ' + e.message); continue; }
  if (!config || !Array.isArray(config.steps)) continue;
  const key = config.storageKey || file.replace(/^workshops-|\.js$/g, '');
  if (skip.has(key)) {
    pending.push(key);
    if (LIST) console.log('PENDING ' + key);
    continue;
  }
  const issues = issuesFor(config);
  if (issues.length) failures.push(key + ': ' + issues.join('; '));
  else ready++;
}

console.log('Engine parity: ' + ready + ' ready, ' + pending.length + ' on the rollout baseline, ' + failures.length + ' failing.');
if (failures.length) {
  console.log('FAIL');
  failures.forEach((f) => console.log('  ' + f));
  process.exitCode = 1;
} else {
  console.log('PASS every config outside the baseline has a starter project and an engine lane on every step');
}
