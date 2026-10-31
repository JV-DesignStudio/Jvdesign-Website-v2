#!/usr/bin/env node
/**
 * apply-workshop-debugging.js (A2030)
 *
 * Stamps one "Debug It" task from content/workshop-debugging.json into each
 * engine hub page, just after the hero, so every substantial coding series
 * teaches debugging with a hint-first path instead of a fix.
 *
 * Safe to re-run: the block is wrapped in WS-DEBUG markers and replaced.
 *
 * Usage:
 *   node scripts/apply-workshop-debugging.js
 *   node scripts/apply-workshop-debugging.js --check
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'content', 'workshop-debugging.json');
const START = '<!-- WS-DEBUG:START -->';
const END = '<!-- WS-DEBUG:END -->';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Inline `code` becomes <code>, fenced blocks become <pre><code>.
const rich = (s) => esc(s)
  .replace(/```([\s\S]*?)```/g, (m, body) => '<pre class="ws-debug-answer-code"><code>' + body.replace(/^\n+|\n+$/g, '') + '</code></pre>')
  .replace(/`([^`]+)`/g, '<code>$1</code>');

function block(entry) {
  return [
    START,
    `<section class="ws-debug" aria-labelledby="ws-debug-title" data-workshop-debug="${esc(entry.series.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}">`,
    '  <div class="ws-debug-inner">',
    '    <p class="ws-debug-kicker"><img src="/assets/mascots/echo-badge.webp" alt="" width="22" height="22" loading="lazy"> Echo\'s Debug It</p>',
    `    <h2 class="ws-debug-title" id="ws-debug-title">Debug It: ${esc(entry.title)}</h2>`,
    `    <p class="ws-debug-intro">${rich(entry.brief)}</p>`,
    `    <pre class="ws-debug-code"><code>${esc(entry.code)}</code></pre>`,
    '    <ol class="ws-debug-questions">',
    `      <li><strong>What did you expect?</strong> ${rich(entry.expect)}</li>`,
    `      <li><strong>What happened instead?</strong> ${rich(entry.happened)}</li>`,
    `      <li><strong>What evidence tells you where the problem is?</strong> ${rich(entry.evidence)}</li>`,
    '    </ol>',
    `    <details class="ws-debug-step"><summary>Hint 1: a nudge</summary><p>${rich(entry.hint)}</p></details>`,
    `    <details class="ws-debug-step"><summary>Hint 2: what to look for</summary><p>${rich(entry.explain)}</p></details>`,
    `    <details class="ws-debug-step ws-debug-answer"><summary>Full answer</summary><p>${rich(entry.answer)}</p></details>`,
    '    <p class="ws-debug-note">Try the hints before the answer. Finding the bug is the skill, the fix is the easy part.</p>',
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

function apply(options) {
  const check = !!(options && options.check);
  const entries = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  let updated = 0;
  let clean = 0;
  const stale = [];
  const failed = [];

  for (const entry of entries) {
    const file = path.join(ROOT, String(entry.page).replace(/^\//, ''));
    if (!fs.existsSync(file)) { failed.push(entry.series + ' (missing file)'); continue; }
    let html = fs.readFileSync(file, 'utf8');
    const want = block(entry);

    const start = html.indexOf(START);
    const end = html.indexOf(END);
    if (start >= 0 && end > start) {
      const next = html.slice(0, start) + want + html.slice(end + END.length);
      if (next === html) { clean++; continue; }
      if (check) { stale.push(entry.series); continue; }
      fs.writeFileSync(file, next);
      updated++;
      continue;
    }

    if (check) { stale.push(entry.series + ' (no block yet)'); continue; }
    const at = findInsert(html);
    if (at < 0) { failed.push(entry.series + ' (no insert point)'); continue; }
    html = html.slice(0, at) + '\n\n' + want + '\n' + html.slice(at);
    fs.writeFileSync(file, html);
    updated++;
  }

  if (check) {
    console.log(`Workshop debugging blocks: ${clean}/${entries.length} in sync`);
    if (stale.length) {
      console.error('Out of date (run without --check): ' + stale.join(', '));
      process.exitCode = 1;
    }
    return { clean, stale, failed };
  }

  console.log(`Applied workshop debugging: ${updated} pages updated, ${clean} already in sync, ${entries.length} entries`);
  if (failed.length) {
    console.error('Could not apply: ' + failed.join(', '));
    process.exitCode = 1;
  }
  return { updated, clean, failed };
}

if (require.main === module) apply({ check: process.argv.includes('--check') });
module.exports = { apply, block, findInsert };
