#!/usr/bin/env node
/**
 * apply-workshop-outcomes.js (A2028)
 *
 * Stamps the outcome statement from content/workshop-outcomes.json into every
 * published workshop page, just after the hero, so a learner can see what they
 * will build, learn, finish with and extend before they start.
 *
 * Safe to re-run: the block is wrapped in WS-OUTCOME markers and replaced.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'content', 'workshop-outcomes.json');
const START = '<!-- WS-OUTCOME:START -->';
const END = '<!-- WS-OUTCOME:END -->';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function block(entry) {
  return [
    START,
    `<section class="ws-outcome" aria-labelledby="ws-outcome-title" data-workshop-outcome="${esc(entry.id)}">`,
    '  <div class="ws-outcome-inner">',
    '    <p class="ws-outcome-kicker"><img src="/assets/mascots/lumo-badge.webp" alt="" width="22" height="22" loading="lazy"> Lumo\'s outcome check</p>',
    '    <h2 class="ws-outcome-title" id="ws-outcome-title">What you\'ll finish with</h2>',
    '    <dl class="ws-outcome-list">',
    `      <div class="ws-outcome-item"><dt>Your project</dt><dd>${esc(entry.project)}</dd></div>`,
    `      <div class="ws-outcome-item"><dt>You'll learn</dt><dd>${esc(entry.learn)}</dd></div>`,
    `      <div class="ws-outcome-item"><dt>Finish with</dt><dd>${esc(entry.finish)}</dd></div>`,
    `      <div class="ws-outcome-item"><dt>Then extend it</dt><dd>${esc(entry.extend)}</dd></div>`,
    '    </dl>',
    '  </div>',
    '</section>',
    END
  ].join('\n');
}

function findInsert(html) {
  const h1 = html.search(/<h1\b/i);
  if (h1 < 0) return -1;
  const candidates = [];
  for (const re of [/<\/section>/ig, /<\/header>/ig, /<main\b/ig]) {
    re.lastIndex = h1;
    const m = re.exec(html);
    if (m) candidates.push({ index: m.index, end: m.index + m[0].length, text: m[0] });
  }
  if (!candidates.length) {
    const body = html.search(/<\/body>/i);
    return body < 0 ? -1 : body;
  }
  candidates.sort((a, b) => a.index - b.index);
  const first = candidates[0];
  return /^<main/i.test(first.text) ? first.index : first.end;
}

function apply() {
  const entries = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  let updated = 0;
  const failed = [];

  for (const entry of entries) {
    const file = path.join(ROOT, String(entry.url).replace(/^\//, ''));
    if (!fs.existsSync(file)) { failed.push(entry.id + ' (missing file)'); continue; }
    let html = fs.readFileSync(file, 'utf8');
    const want = block(entry);

    const start = html.indexOf(START);
    const end = html.indexOf(END);
    if (start >= 0 && end > start) {
      const next = html.slice(0, start) + want + html.slice(end + END.length);
      if (next !== html) { fs.writeFileSync(file, next); updated++; }
      continue;
    }

    const at = findInsert(html);
    if (at < 0) { failed.push(entry.id + ' (no insert point)'); continue; }
    html = html.slice(0, at) + '\n\n' + want + '\n' + html.slice(at);
    fs.writeFileSync(file, html);
    updated++;
  }

  console.log(`Applied workshop outcomes: ${updated} pages updated, ${entries.length} entries`);
  if (failed.length) {
    console.error('Could not apply: ' + failed.join(', '));
    process.exitCode = 1;
  }
}

if (require.main === module) apply();
module.exports = { apply, block };
