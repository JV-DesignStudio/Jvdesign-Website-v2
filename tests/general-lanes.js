#!/usr/bin/env node
// tests/general-lanes.js (A3099)
// Every General catalogue page is classified as a build-along or a reference,
// and every software build-along carries a school lane, a real-project lane
// and a checkpoint for each step. Fast, no browser needed.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const ROOT = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'general-lanes.json'), 'utf8'));
const workshops = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'workshops.json'), 'utf8'));
const script = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'general-lanes.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'style-general-lanes.css'), 'utf8');
const enhancements = fs.readFileSync(path.join(ROOT, 'workshop-enhancements.js'), 'utf8');

const general = workshops.filter((w) => w.engine === 'General');
const pages = data.pages || {};
const ids = general.map((w) => w.id);
assert.equal(Object.keys(pages).length, general.length, 'one register entry per General page (' + Object.keys(pages).length + '/' + general.length + ')');
for (const id of ids) assert.ok(pages[id], 'register covers ' + id);

assert.ok(/\.gl-lane\{/.test(css) && /\.gl-mode\{/.test(css), 'lane and mode styles exist');
assert.ok(/fetch\('\/content\/general-lanes\.json'/.test(script), 'lane script reads the register');
assert.ok(/data-gl-done/.test(script), 'lane script adds a checkpoint tick');
assert.ok(/general-lanes\.js/.test(enhancements), 'enhancements load the General script');

const kinds = new Set(['build-along', 'reference']);
const modes = new Set(['software', 'browser', 'builder', 'guide', 'overview']);
const problems = [];
const counts = {};
for (const [id, page] of Object.entries(pages)) {
  if (!kinds.has(page.kind)) problems.push(id + ': bad kind ' + page.kind);
  if (!modes.has(page.mode)) problems.push(id + ': bad mode ' + page.mode);
  counts[page.mode] = (counts[page.mode] || 0) + 1;
  if (page.kind === 'build-along' && page.mode === 'software') {
    if (!Array.isArray(page.steps) || !page.steps.length) { problems.push(id + ': software build-along has no steps'); continue; }
    const file = path.join(ROOT, 'workshops', id + '.html');
    if (!fs.existsSync(file)) { problems.push(id + ': page file missing'); continue; }
    const html = fs.readFileSync(file, 'utf8');
    const cards = (html.match(/class="step-card[^"]*"[^>]*data-step=/g) || []).length;
    if (cards !== page.steps.length) problems.push(id + ': page has ' + cards + ' steps, register has ' + page.steps.length);
    page.steps.forEach((step, i) => {
      if (step.n !== i + 1) problems.push(id + ': step numbering at ' + (i + 1));
      for (const field of ['school', 'home', 'file', 'section', 'line', 'check']) {
        if (!step[field] || !String(step[field]).trim()) problems.push(id + ' step ' + (i + 1) + ': empty ' + field);
      }
    });
  } else if (!page.note || page.note.length < 15) {
    problems.push(id + ': missing completion-mode note');
  }
}
assert.deepEqual(problems, [], 'General register is complete: ' + problems.slice(0, 4).join(' | '));

const software = counts.software || 0;
assert.ok(software >= 5, 'at least five software build-alongs (' + software + ')');
assert.ok(counts.builder >= 10 && counts.guide >= 5, 'builders and guides are classified');

console.log('PASS general-lanes: ' + Object.keys(pages).length + ' pages classified, ' +
  software + ' software build-alongs with two lanes, ' + (counts.builder || 0) + ' builders, ' +
  (counts.guide || 0) + ' reference guides');
