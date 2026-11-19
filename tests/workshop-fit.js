#!/usr/bin/env node
// tests/workshop-fit.js (A1979)
// The parent check: every catalogue card names reading, typing, grown-up help
// and software before a learner starts, and the page explains the labels.
// Fast check, no browser needed.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const ROOT = path.resolve(__dirname, '..');
const hub = fs.readFileSync(path.join(ROOT, 'pages', 'workshop.html'), 'utf8');
const parents = fs.readFileSync(path.join(ROOT, 'parents.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'style-workshop-hub.css'), 'utf8');
const entries = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'workshops.json'), 'utf8'));

const start = hub.indexOf('<!-- CATALOGUE:START -->');
const end = hub.indexOf('<!-- CATALOGUE:END -->');
assert.ok(start > -1 && end > start, 'catalogue block exists');
const catalogue = hub.slice(start, end);

const cards = [...catalogue.matchAll(/<a href="([^"]+)" class="course-card"[\s\S]*?<\/a>/g)];
assert.equal(cards.length, entries.length, 'one card per workshop (' + cards.length + '/' + entries.length + ')');

const fields = ['reading', 'typing', 'adult', 'software'];
const missing = [];
for (const [tag, href] of cards) {
  const fit = /<div class="course-fit"([^>]*)>/.exec(tag);
  if (!fit) { missing.push(href + ': no fit block'); continue; }
  for (const field of fields) {
    const m = new RegExp('data-' + field + '="([^"]+)"').exec(fit[1]);
    if (!m || !m[1].trim()) missing.push(href + ': empty ' + field);
  }
  const items = (tag.match(/class="course-fit-item"/g) || []).length;
  if (items !== 4) missing.push(href + ': ' + items + ' fit labels');
  if (/data-software="Browser only"/.test(fit[1]) && /course-pill--install/.test(tag)) {
    missing.push(href + ': browser-only software on an install card');
  }
  if (/data-adult="No grown-up needed"/.test(fit[1]) && /course-pill--install/.test(tag)) {
    missing.push(href + ': no grown-up needed on an install card');
  }
}
assert.deepEqual(missing, [], 'every card has a complete parent check: ' + missing.slice(0, 4).join(' | '));

assert.ok(/class="ws-fit-legend"/.test(catalogue), 'catalogue explains the labels');
assert.ok(/Ages are guidance, not a rule/i.test(catalogue), 'legend says ages are guidance');
assert.ok(/\.course-fit\{/.test(css) && /\.ws-fit-legend\{/.test(css), 'fit styles are present');

assert.ok(/Choosing the right workshop/i.test(parents), 'parents page explains the labels');
assert.ok(/<h2>Choosing the right workshop<\/h2>[\s\S]*Reading[\s\S]*Typing[\s\S]*Grown-up help[\s\S]*Software/i.test(parents), 'parents page names all four labels');
assert.ok(!/Everything runs in the browser\. No downloads, no installs/i.test(parents), 'parents page no longer claims every workshop is browser-only');

console.log('PASS workshop-fit: ' + cards.length + ' cards carry reading, typing, grown-up help and software labels, legend and parents guide present');
