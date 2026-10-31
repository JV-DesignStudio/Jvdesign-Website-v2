'use strict';
/**
 * apply-workshop-gradual-release.js (A2029)
 *
 * Stamps the five gradual-release moves into every published tutorial, right
 * after the outcome statement, so the workshop says how to move from copying a
 * result to owning it: See it, Understand it, Build it, Fix it, Own it.
 *
 * Safe to re-run: the block is wrapped in WS-RELEASE markers and replaced.
 *
 * Usage:
 *   node scripts/apply-workshop-gradual-release.js
 *   node scripts/apply-workshop-gradual-release.js --check
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'content', 'workshop-gradual-release.json');
const START = '<!-- WS-RELEASE:START -->';
const END = '<!-- WS-RELEASE:END -->';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const STAGE_META = {
  see: { n: 1, label: 'See it', who: 'Pip' },
  understand: { n: 2, label: 'Understand it', who: 'Lumo' },
  build: { n: 3, label: 'Build it', who: 'Ember' },
  fix: { n: 4, label: 'Fix it', who: 'Echo' },
  own: { n: 5, label: 'Own it', who: 'Stardust' }
};

function stageItem(key, stage) {
  const meta = STAGE_META[key];
  const link = stage.url
    ? ' <a href="' + esc(stage.url) + '" style="color:var(--teal-dk,#4e7d80);font-weight:700">Open it</a>'
    : '';
  return [
    '      <li class="ws-release-stage" data-stage="' + key + '" style="line-height:1.6">',
    '        <strong style="display:block;font-family:Fredoka,cursive;font-size:1rem;color:var(--charcoal,#1a1208)">' + meta.n + '. ' + meta.label + ' <span style="font-family:Inter,system-ui,sans-serif;font-size:.72rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--teal-dk,#4e7d80)">' + meta.who + '</span></strong>',
    '        <span style="font-size:.9rem;color:var(--charcoal-lt,#3d3224)">' + esc(stage.text) + link + '</span>',
    '      </li>'
  ].join('\n');
}

function block(entry) {
  return [
    START,
    `<section class="ws-release" aria-labelledby="ws-release-title" data-workshop-release="${esc(entry.id)}" style="max-width:820px;margin:0 auto 40px;padding:0 20px">`,
    '  <div class="ws-release-inner" style="background:var(--beige,#F0EAD6);border:1.5px solid var(--border,rgba(64,59,51,.14));border-radius:16px;padding:24px">',
    '    <p class="ws-release-kicker" style="margin:0 0 6px;font-size:.74rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--teal-dk,#4e7d80)">Stardust\'s five moves</p>',
    '    <h2 class="ws-release-title" id="ws-release-title" style="font-family:Fredoka,cursive;font-size:1.35rem;margin:0 0 8px;color:var(--charcoal,#1a1208)">Don\'t just copy it. Own it.</h2>',
    '    <p class="ws-release-intro" style="font-size:.9rem;line-height:1.6;margin:0 0 14px;color:var(--charcoal-lt,#3d3224)">Copying the finished code proves it runs. Explaining and changing it proves you understand it. Work through these five moves.</p>',
    '    <ol class="ws-release-stages" style="margin:0;padding-left:20px;display:grid;gap:12px">',
    stageItem('see', entry.stages.see),
    stageItem('understand', entry.stages.understand),
    stageItem('build', entry.stages.build),
    stageItem('fix', entry.stages.fix),
    stageItem('own', entry.stages.own),
    '    </ol>',
    '  </div>',
    '</section>',
    END
  ].join('\n');
}

function stripBlock(html) {
  const start = html.indexOf(START);
  const end = html.indexOf(END);
  if (start < 0 || end < start) return html;
  let before = html.slice(0, start);
  let after = html.slice(end + END.length);
  if (before.endsWith('\n')) before = before.slice(0, -1);
  if (after.startsWith('\n')) after = after.slice(1);
  return before + after;
}

function insertAfterOutcome(html, want) {
  const marker = '<!-- WS-OUTCOME:END -->';
  const at = html.indexOf(marker);
  if (at < 0) return null;
  const cut = at + marker.length;
  return html.slice(0, cut) + '\n\n' + want + html.slice(cut);
}

function apply(options) {
  const check = !!(options && options.check);
  const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const updated = [];
  const clean = [];
  const stale = [];
  const failed = [];

  for (const entry of data.workshops) {
    const file = path.join(ROOT, entry.page);
    if (!fs.existsSync(file)) { failed.push(entry.id + ' (missing file)'); continue; }
    const original = fs.readFileSync(file, 'utf8');
    const stripped = stripBlock(original);
    const next = insertAfterOutcome(stripped, block(entry));

    if (!next) { failed.push(entry.id + ' (no outcome marker)'); continue; }
    if (next === original) { clean.push(entry.id); continue; }
    if (check) { stale.push(entry.id); continue; }
    fs.writeFileSync(file, next);
    updated.push(entry.id);
  }

  if (check) {
    console.log('Workshop release blocks: ' + clean.length + ' in sync, ' + stale.length + ' out of date');
    if (stale.length) console.error('Out of date (run without --check): ' + stale.join(', '));
    if (failed.length) console.error('Could not place: ' + failed.join(', '));
    if (stale.length || failed.length) process.exitCode = 1;
    return { clean, stale, failed };
  }

  console.log('Applied workshop release blocks: ' + updated.length + ' updated, ' + clean.length + ' already in sync');
  if (failed.length) {
    console.error('Could not place: ' + failed.join(', '));
    process.exitCode = 1;
  }
  return { updated, clean, failed };
}

if (require.main === module) apply({ check: process.argv.includes('--check') });
module.exports = { apply, block, stripBlock };
