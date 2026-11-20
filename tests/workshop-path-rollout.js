#!/usr/bin/env node
// tests/workshop-path-rollout.js (A2194)
// Every project page must have the shared before/during/after/next data, every
// link must resolve, and the one shared loader must be in place. Fast check.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const workshops = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'workshops.json'), 'utf8'));
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets', 'js', 'workshop-path-data.js'), 'utf8'), sandbox);
const data = sandbox.window.JVDS_WORKSHOP_PATHS || {};
const kit = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'tool-kit.js'), 'utf8');
const renderer = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'workshop-path.js'), 'utf8');

assert.ok(/injectWorkshopPath/.test(kit), 'tool kit loads the shared path block');
assert.ok(/workshop-path-data\.js/.test(kit) && /workshop-path\.js/.test(kit), 'tool kit loads the data and renderer');
assert.ok(/ensureMount/.test(renderer), 'renderer mounts the shared block when there is no marker');

const slots = ['before', 'during', 'after', 'next'];
const problems = [];
let realNext = 0;
for (const w of workshops) {
  const entry = data[w.id];
  if (!entry) { problems.push(w.id + ': no path entry'); continue; }
  for (const slot of slots) {
    const s = entry[slot];
    if (!s) { problems.push(w.id + ': missing ' + slot); continue; }
    for (const field of ['label', 'title', 'text', 'href', 'linkLabel']) {
      if (!s[field] || !String(s[field]).trim()) problems.push(w.id + ': ' + slot + ' empty ' + field);
    }
    if (s.href && !String(s.href).startsWith('/')) problems.push(w.id + ': ' + slot + ' href is not absolute (' + s.href + ')');
    if (s.href && s.href !== '/workshop') {
      const file = path.join(ROOT, String(s.href).replace(/^\//, ''));
      if (!fs.existsSync(file)) problems.push(w.id + ': ' + slot + ' href missing (' + s.href + ')');
    }
  }
  if (entry.next && /^\/workshops\/[^/]+\.html$/.test(entry.next.href)) realNext++;
}
assert.deepEqual(problems, [], 'path data covers every project page: ' + problems.slice(0, 4).join(' | '));
assert.ok(realNext >= 100, 'most pages point at a real next workshop (' + realNext + ')');

execFileSync(process.execPath, ['scripts/build-workshop-paths.js', '--check'], { cwd: ROOT, stdio: 'pipe' });

console.log('PASS workshop-path-rollout: ' + workshops.length + ' project pages, ' +
  realNext + ' real next-workshop links, one shared block');
