#!/usr/bin/env node
// tests/unity-lanes.js (A3098)
// Every Unity workshop step has a school lane (browser Studio) and a home lane
// (real file, section and line), plus a checkpoint. Data lives in
// content/unity-lanes.json; the script injects it into the page's own step
// spine. Fast, no browser needed.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const ROOT = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'unity-lanes.json'), 'utf8'));
const script = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'workshop-lanes.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'style-workshop-lanes.css'), 'utf8');
const enhancements = fs.readFileSync(path.join(ROOT, 'workshop-enhancements.js'), 'utf8');

const pages = Object.keys(data.pages || {});
assert.ok(pages.length >= 5, 'lanes cover the 5 Unity tutorial pages (' + pages.length + ')');
assert.ok(/\.wl-lane\{/.test(css) && /\.wl-lane-progress\{/.test(css), 'lane styles exist');
assert.ok(/unity-lanes\.json/.test(script), 'lane script reads the data file');
assert.ok(/data-wl-done/.test(script), 'lane script adds a checkpoint tick');
assert.ok(/\.s-body/.test(script), 'lane script supports the Unity workshop step body');
assert.ok(/workshop-lanes\.js/.test(enhancements), 'enhancements load the lane script on Unity pages');
assert.ok(fs.existsSync(path.join(ROOT, data.studio.replace(/^\//, ''))), 'Mod Studio page exists');

const problems = [];
for (const slug of pages) {
  const file = path.join(ROOT, 'workshops', slug + '.html');
  if (!fs.existsSync(file)) { problems.push(slug + ': missing page'); continue; }
  const html = fs.readFileSync(file, 'utf8');
  const cards = (html.match(/class="step-card[^"]*"[^>]*data-step=/g) || []).length;
  const steps = data.pages[slug];
  if (cards !== steps.length) problems.push(slug + ': page has ' + cards + ' steps, data has ' + steps.length);
  if (!/workshop-enhancements\.js/.test(html)) problems.push(slug + ': does not load workshop-enhancements.js');
  steps.forEach((step, i) => {
    if (step.n !== i + 1) problems.push(slug + ': step numbering at ' + (i + 1));
    for (const field of ['school', 'home', 'file', 'section', 'line', 'check', 'tab']) {
      if (!step[field] || !String(step[field]).trim()) problems.push(slug + ' step ' + (i + 1) + ': empty ' + field);
    }
    if (/install/i.test(step.school) && !/no install|no unity install|browser/i.test(step.school)) {
      problems.push(slug + ' step ' + (i + 1) + ': school lane hints at an install');
    }
  });
}
assert.deepEqual(problems, [], 'lane data matches every step: ' + problems.slice(0, 4).join(' | '));

console.log('PASS unity-lanes: ' + pages.length + ' pages, ' +
  pages.reduce((n, slug) => n + data.pages[slug].length, 0) +
  ' steps with a browser lane, a real-file lane and a checkpoint');
