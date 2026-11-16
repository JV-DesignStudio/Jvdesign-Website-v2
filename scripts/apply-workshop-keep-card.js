#!/usr/bin/env node
/*
 * scripts/apply-workshop-keep-card.js (A3058)
 *
 * Adds the "keep what you made" card to workshops whose project lives inside an
 * engine. scripts/audit-workshops.js shows the shareable pillar failing on most
 * engine workshops because the page has no download or export of its own: the
 * learner's work is in Roblox Studio, Minecraft, Unity, Blender and so on.
 *
 * This wraps one shared block (workshops/workshop-keep-card.js) that draws a
 * 1200x630 card PNG on the device, so the learner leaves with something to show
 * without an account, an upload or a network request.
 *
 * Safe to re-run: the block is wrapped in WS-KEEP markers and replaced in place.
 *
 * Usage:
 *   node scripts/apply-workshop-keep-card.js
 *   node scripts/apply-workshop-keep-card.js --check
 *   node scripts/apply-workshop-keep-card.js --dry-run
 *   node scripts/apply-workshop-keep-card.js --only roblox-obby-workshop
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WS_DIR = path.join(ROOT, 'workshops');
const DATA = path.join(ROOT, 'content', 'workshops.json');
const START = '<!-- WS-KEEP:START -->';
const END = '<!-- WS-KEEP:END -->';
const CSS_TAG = '<link rel="stylesheet" href="../style-workshop-keep-card.css">';
const JS_TAG = '<script defer src="workshop-keep-card.js"></script>';

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const DRY = args.includes('--dry-run');
const onlyAt = args.indexOf('--only');
const ONLY = onlyAt !== -1 ? args[onlyAt + 1] : '';

/* Mirrors the share signal in scripts/audit-workshops.js. A page that already
   downloads or exports its own build does not need this card. */
const SHARE = /workshop-canvas-engine\.js|engine-feel\.js|downloadGame|downloadProject|projectCode|CW\.projectCode|data-on=["']CW\.download/i;
const REDIRECT = /http-equiv=["']refresh["']|location\.replace\s*\(/i;

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function block(entry) {
  const id = esc(entry.id);
  const title = esc(entry.title);
  return [
    START,
    `<section class="ws-keep" data-workshop-keep="${id}" data-workshop-title="${title}" aria-labelledby="ws-keep-title-${id}">`,
    '  <div class="ws-keep-inner">',
    '    <p class="ws-keep-kicker"><img src="/assets/mascots/echo-badge.webp" alt="" width="20" height="20" loading="lazy"> Echo</p>',
    `    <h2 class="ws-keep-title" id="ws-keep-title-${id}">Keep what you made</h2>`,
    '    <p class="ws-keep-lead">This project lives in the engine, so your work is saved there. Write what you made and one thing you learned, then download a card you can print or show someone.</p>',
    '    <div class="ws-keep-fields">',
    `      <label class="ws-keep-label" for="ws-keep-made-${id}">What did you make?</label>`,
    `      <input class="ws-keep-input" id="ws-keep-made-${id}" type="text" maxlength="60" autocomplete="off" placeholder="A spooky obby with three checkpoints" data-keep-made>`,
    `      <label class="ws-keep-label" for="ws-keep-learned-${id}">One thing you learned</label>`,
    `      <input class="ws-keep-input" id="ws-keep-learned-${id}" type="text" maxlength="80" autocomplete="off" placeholder="How checkpoints save your progress" data-keep-learned>`,
    '    </div>',
    '    <div class="ws-keep-actions">',
    '      <button type="button" class="ws-keep-btn" data-keep-download>Download my card</button>',
    '      <button type="button" class="ws-keep-btn ws-keep-btn--ghost" data-keep-copy>Copy a share message</button>',
    '    </div>',
    '    <p class="ws-keep-status" data-keep-status aria-live="polite">Saved on this device only. Nothing is uploaded.</p>',
    '  </div>',
    '</section>',
    END
  ].join('\n');
}

function hasBlock(html) {
  return html.indexOf(START) !== -1 && html.indexOf(END) > html.indexOf(START);
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

function insertBlock(html, want) {
  const anchors = [
    '<!-- WS-NEXT:START -->',
    '<!-- BUILD:footer-content -->',
    '<!-- WS-FINISH:END -->'
  ];
  for (const anchor of anchors) {
    const at = html.indexOf(anchor);
    if (at !== -1) return html.slice(0, at) + want + '\n\n' + html.slice(at);
  }
  const footer = html.search(/<footer[\s>]/i);
  if (footer !== -1) return html.slice(0, footer) + want + '\n' + html.slice(footer);
  const body = html.lastIndexOf('</body>');
  if (body !== -1) return html.slice(0, body) + want + '\n' + html.slice(body);
  return null;
}

function ensureHead(html) {
  if (html.indexOf(CSS_TAG) !== -1) return html;
  const head = html.lastIndexOf('</head>');
  if (head === -1) return html;
  return html.slice(0, head) + CSS_TAG + '\n' + html.slice(head);
}

function ensureScript(html) {
  if (html.indexOf(JS_TAG) !== -1) return html;
  const body = html.lastIndexOf('</body>');
  if (body === -1) return html;
  return html.slice(0, body) + JS_TAG + '\n' + html.slice(body);
}

function wanted(html, entry) {
  const base = hasBlock(html) ? html : null;
  const want = block(entry);
  if (base) {
    const start = base.indexOf(START);
    const end = base.indexOf(END) + END.length;
    return base.slice(0, start) + want + base.slice(end);
  }
  const inserted = insertBlock(html, want);
  if (inserted == null) return null;
  return inserted;
}

function checkPage(html, entry) {
  const problems = [];
  if (!hasBlock(html)) {
    problems.push('missing WS-KEEP block');
    return problems;
  }
  const start = html.indexOf(START);
  const end = html.indexOf(END) + END.length;
  const current = html.slice(start, end);
  if (current !== block(entry)) problems.push('WS-KEEP block is out of date');
  if (html.indexOf(CSS_TAG) === -1) problems.push('missing style-workshop-keep-card.css link');
  if (html.indexOf(JS_TAG) === -1) problems.push('missing workshop-keep-card.js script');
  return problems;
}

function main() {
  const entries = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const updated = [];
  const stale = [];
  const skipped = [];
  const missing = [];
  let already = 0;

  entries.forEach((entry) => {
    if (entry.type !== 'workshop') return;
    if (ONLY && entry.id !== ONLY) return;
    const file = path.join(WS_DIR, entry.id + '.html');
    if (!fs.existsSync(file)) {
      missing.push(entry.id);
      return;
    }
    let html = fs.readFileSync(file, 'utf8');
    if (REDIRECT.test(html) || SHARE.test(html)) {
      if (hasBlock(html)) { /* a page that gained its own share should drop this card */ }
      skipped.push(entry.id);
      return;
    }

    if (CHECK) {
      const problems = checkPage(html, entry);
      if (problems.length) stale.push(entry.id + ' (' + problems.join('; ') + ')');
      else already++;
      return;
    }

    if (hasBlock(html)) already++;
    const next = wanted(html, entry);
    if (next == null) {
      missing.push(entry.id + ' (no insert point)');
      return;
    }
    let out = ensureHead(next);
    out = ensureScript(out);
    if (out !== html) {
      if (!DRY) fs.writeFileSync(file, out);
      updated.push(entry.id);
      html = out;
    }
  });

  const label = DRY ? ' (dry run, no files changed)' : '';
  if (CHECK) {
    console.log('Workshop keep card: ' + already + ' in sync, ' + stale.length + ' out of date' + label);
    if (stale.length) {
      stale.slice(0, 20).forEach((s) => console.log('  - ' + s));
      if (stale.length > 20) console.log('  ...and ' + (stale.length - 20) + ' more');
      process.exitCode = 1;
    }
    if (missing.length) {
      console.log('  missing pages: ' + missing.join(', '));
      process.exitCode = 1;
    }
  } else {
    console.log('Workshop keep card: ' + updated.length + ' page(s) updated, ' + already + ' already carried the card, ' + skipped.length + ' skipped (own share or redirect)' + label);
    if (missing.length) console.log('  missing pages: ' + missing.join(', '));
  }
}

main();
