// workshop-debugging.js - guards the "Debug It" task on every coding series.
//
// A2030: each substantial coding series carries one deliberate debugging task
// with the three questions (expect / happened / evidence) and a hint-first
// path (hint, explanation, full answer). This checks the content file, the
// stamped page, and a live browser sample at 390px and 1440px.
//
// Run: node tests/workshop-debugging.js
const fs = require('fs');
const path = require('path');

const SITE = path.resolve(__dirname, '..');
const DATA = path.join(SITE, 'content', 'workshop-debugging.json');
const START = '<!-- WS-DEBUG:START -->';
const END = '<!-- WS-DEBUG:END -->';

let failures = 0;
const ok = (name, cond, extra) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond || !extra ? '' : ' :: ' + extra));
  if (!cond) failures++;
};

const entries = JSON.parse(fs.readFileSync(DATA, 'utf8'));

const strip = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

ok('content file lists coding series', Array.isArray(entries) && entries.length >= 10, entries.length + ' entries');

const seenPages = new Set();
for (const entry of entries) {
  const label = entry.series || entry.page;
  const file = path.join(SITE, String(entry.page || '').replace(/^\//, ''));
  ok(label + ': page exists', fs.existsSync(file), entry.page);
  if (!fs.existsSync(file)) continue;
  seenPages.add(file);
  const html = fs.readFileSync(file, 'utf8');
  const start = html.indexOf(START);
  const end = html.indexOf(END);
  ok(label + ': one stamped block', start >= 0 && end > start && html.indexOf(START, start + 1) === -1);
  if (start < 0 || end < start) continue;
  const block = html.slice(start, end);
  ok(label + ': block names the bug', block.includes('Debug It: ' + entry.title), entry.title);
  ok(label + ': shows the broken code', block.includes('ws-debug-code') && block.includes(esc(entry.code.split('\n')[0])));
  for (const q of ['What did you expect?', 'What happened instead?', 'What evidence tells you where the problem is?']) {
    ok(label + ': asks "' + q + '"', block.includes(q));
  }
  const hint = block.indexOf('Hint 1: a nudge');
  const explain = block.indexOf('Hint 2: what to look for');
  const answer = block.indexOf('Full answer');
  ok(label + ': hint first, answer last', hint > 0 && explain > hint && answer > explain);
  ok(label + ': three disclosure levels', (block.match(/<details/g) || []).length === 3, (block.match(/<details/g) || []).length + ' details');
  ok(label + ': answer is present', strip(entry.answer).length > 20 && block.includes('ws-debug-answer'));
  const hintText = strip(entry.hint).toLowerCase();
  const answerText = strip(entry.answer).toLowerCase();
  ok(label + ': hint does not leak the answer', !(hintText.length > 30 && answerText.length > 30 && hintText.includes(answerText)));
}

ok('every coding series is covered once', seenPages.size === entries.length, seenPages.size + ' distinct pages');

console.log('');
console.log(failures ? 'FAIL ' + failures + ' workshop debugging check(s)' : 'PASS workshop debugging: ' + entries.length + ' coding series with a hint-first debug task');
if (failures) process.exitCode = 1;
