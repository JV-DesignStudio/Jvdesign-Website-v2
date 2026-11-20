#!/usr/bin/env node
// tests/offline-labels.js (A1995)
// The site must not imply offline support it does not have. Every tool that is
// marked offline in content/tool-weights.json must be in the service-worker
// precache and on the offline page with an honest label; tools that are not
// offline must not appear in the offline list. The cache version must move when
// the labels change.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const ROOT = path.resolve(__dirname, '..');
const weights = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'tool-weights.json'), 'utf8'));
const tools = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'tools.json'), 'utf8'));
const offline = fs.readFileSync(path.join(ROOT, 'offline.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const kit = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'tool-kit.js'), 'utf8');

const offlineIds = Object.entries(weights).filter(([, v]) => v.offline).map(([id]) => id).sort();
const onlineIds = Object.entries(weights).filter(([, v]) => !v.offline).map(([id]) => id).sort();
const toolById = new Map(tools.map((t) => [t.id, t]));

assert.ok(offlineIds.length >= 10, 'offline pack has tools (' + offlineIds.length + ')');
assert.ok(/injectToolOfflineBadge/.test(kit) && /tool-offline-badge/.test(kit), 'tool kit can add a tool offline badge');
assert.ok(/Available offline after one visit/.test(kit), 'offline label is explicit');
assert.ok(/Needs a connection for the first visit/.test(kit), 'online-only label is explicit');
assert.ok(/jvds-v65/.test(sw), 'service-worker cache version moved for this change');
assert.ok(!/jvds-v64/.test(sw), 'old cache version is gone');

const problems = [];
for (const id of offlineIds) {
  const url = (toolById.get(id) && toolById.get(id).url) || '/tools/' + id + '.html';
  if (!sw.includes(url)) problems.push(id + ': not in the service-worker precache');
  if (!offline.includes('href="' + url.replace(/^\//, '') + '"')) problems.push(id + ': missing from offline.html');
}
for (const id of onlineIds) {
  const url = (toolById.get(id) && toolById.get(id).url) || '/tools/' + id + '.html';
  if (offline.includes('href="' + url.replace(/^\//, '') + '"')) problems.push(id + ': online-only tool listed as offline');
}
assert.deepEqual(problems, [], 'offline labels match the data: ' + problems.slice(0, 4).join(' | '));

assert.ok(/These tools keep working after one online visit:/.test(offline), 'offline page names the verified tools');
assert.ok(/Other tools and pages need a connection for the first visit/.test(offline), 'offline page names the limit');
assert.ok(/Saved hubs:/.test(offline), 'offline page offers the saved hubs');

console.log('PASS offline-labels: ' + offlineIds.length + ' offline tools are labelled, ' +
  onlineIds.length + ' online-only tools are not claimed offline, cache is v65');
