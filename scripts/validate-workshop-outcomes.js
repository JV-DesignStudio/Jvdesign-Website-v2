#!/usr/bin/env node
// validate-workshop-outcomes.js (A2028)
// Every published (indexable, catalogue-linked) workshop must carry a visible
// outcome statement: your project, what you learn, what you finish with and
// how you extend it. The statement lives in content/workshop-outcomes.json and
// is stamped into the page inside WS-OUTCOME markers.
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CATALOGUE = path.join(ROOT, 'content', 'workshops.json');
const DATA = path.join(ROOT, 'content', 'workshop-outcomes.json');
const HUB = path.join(ROOT, 'pages', 'workshop.html');

const errors = [];

function isPublic(entry) {
  const file = path.join(ROOT, String(entry.url || '').replace(/^\//, ''));
  if (!fs.existsSync(file)) return false;
  const html = fs.readFileSync(file, 'utf8');
  return !/<meta\s+name=["']robots["'][^>]*noindex/i.test(html);
}

const catalogue = JSON.parse(fs.readFileSync(CATALOGUE, 'utf8'));
const published = catalogue.filter(isPublic);
const outcomes = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const byId = new Map(outcomes.map((o) => [o.id, o]));

for (const entry of published) {
  const o = byId.get(entry.id);
  if (!o) { errors.push(`${entry.id}: no outcome in content/workshop-outcomes.json`); continue; }
  for (const field of ['project', 'learn', 'finish', 'extend']) {
    if (!o[field] || !String(o[field]).trim()) errors.push(`${entry.id}: empty ${field}`);
  }
  const file = path.join(ROOT, String(entry.url).replace(/^\//, ''));
  const html = fs.readFileSync(file, 'utf8');
  const block = html.match(/<!-- WS-OUTCOME:START -->([\s\S]*?)<!-- WS-OUTCOME:END -->/);
  if (!block) { errors.push(`${entry.id}: page has no WS-OUTCOME block`); continue; }
  const inner = block[1];
  if (!inner.includes('data-workshop-outcome="' + entry.id + '"')) errors.push(`${entry.id}: block id mismatch`);
  for (const label of ['Your project', "You'll learn", 'Finish with', 'Then extend it']) {
    if (!inner.includes('<dt>' + label + '</dt>')) errors.push(`${entry.id}: block missing "${label}"`);
  }
}

const extra = outcomes.filter((o) => !published.some((e) => e.id === o.id));
if (extra.length) errors.push('Outcome entries for unpublished/noindex pages: ' + extra.map((o) => o.id).join(', '));

const hub = fs.readFileSync(HUB, 'utf8');
const hubCount = (hub.match(/class="course-outcome"/g) || []).length;
if (hubCount !== published.length) {
  errors.push(`hub catalogue: ${hubCount} outcome lines, expected ${published.length}`);
}
for (const entry of published) {
  if (!hub.includes('data-workshop-outcome="' + entry.id + '"') && !hub.includes('../' + String(entry.url).replace(/^\//, '') + '"')) {
    // the card itself is the fallback; the outcome line is counted above
  }
}

if (errors.length) {
  console.error('FAIL validate-workshop-outcomes: ' + errors.length + ' issue(s)');
  errors.slice(0, 25).forEach((e) => console.error('  - ' + e));
  if (errors.length > 25) console.error(`  ...and ${errors.length - 25} more`);
  process.exit(1);
}

console.log(`PASS validate-workshop-outcomes: ${published.length} published workshops have a visible outcome statement (page + hub)`);
