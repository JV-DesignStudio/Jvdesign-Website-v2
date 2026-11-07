'use strict';
/**
 * apply-workshop-completion.js (A2037)
 *
 * Gives every workshop a finish screen that says what "finished" means and a
 * link to the next thing to do.
 *
 *   engine / steps pages: a compact row inside #finishBanner, so it appears
 *   with the congratulation banner and not before.
 *   builder pages: a closing "finish line" section, because a builder has no
 *   step tracking, the finished build itself is the proof.
 *   canvas pages: nothing here, workshop-canvas-engine.js already shows its
 *   own next box after the last build step.
 *
 * Safe to re-run: the block is wrapped in WS-FINISH markers and replaced.
 *
 * Usage:
 *   node scripts/apply-workshop-completion.js
 *   node scripts/apply-workshop-completion.js --check
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'content', 'workshop-completion.json');
const START = '<!-- WS-FINISH:START -->';
const END = '<!-- WS-FINISH:END -->';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function evidenceBlock(entry) {
  const ev = entry.evidence;
  return [
    `<div class="ws-evidence" data-workshop-evidence="${esc(entry.id)}" data-evidence-engine="${esc(ev.engine)}">`,
    '  <p class="ws-evidence-title">Show what you made</p>',
    `  <p class="ws-evidence-prompt">${esc(ev.prompt)}</p>`,
    '  <label class="ws-evidence-check"><input type="checkbox" data-ws-evidence-check> I have saved this evidence</label>',
    '  <p class="ws-evidence-status" data-ws-evidence-status aria-live="polite">Your tick is saved on this device only.</p>',
    '</div>'
  ].join('\n');
}

function inlineBlock(entry) {
  const next = entry.next;
  const rows = [
    START,
    `<div class="ws-finish" data-workshop-finish="${esc(entry.id)}">`,
    `  <p class="ws-finish-condition">Finished when: ${esc(entry.conditionText)}</p>`
  ];
  if (entry.evidence) rows.push(evidenceBlock(entry));
  rows.push(
    '  <div class="ws-finish-actions">',
    `    <a class="ws-finish-next" href="${esc(next.url)}">Next step: ${esc(next.label)} &rarr;</a>`,
    '    <a class="ws-finish-progress" href="my-progress.html">See my progress</a>',
    '  </div>',
    '</div>',
    END
  );
  return rows.join('\n');
}

function closingBlock(entry) {
  const next = entry.next;
  const rows = [
    START,
    `<section class="ws-finish" id="wsFinish" aria-labelledby="ws-finish-title" data-workshop-finish="${esc(entry.id)}">`,
    '  <div class="ws-finish-inner">',
    '    <p class="ws-finish-kicker"><img src="/assets/mascots/echo-badge.webp" alt="" width="22" height="22" loading="lazy"> Echo\'s finish line</p>',
    '    <h2 class="ws-finish-title" id="ws-finish-title">You\'re finished when...</h2>',
    `    <p class="ws-finish-condition">${esc(entry.conditionText)}</p>`,
    '    <p class="ws-finish-body">That is the proof you finished: the thing you made plays or opens outside this page. Save or download it, then show it to someone.</p>'
  ];
  if (entry.evidence) rows.push(evidenceBlock(entry));
  rows.push(
    '    <div class="ws-finish-actions">',
    `      <a class="ws-finish-next" href="${esc(next.url)}">Next step: ${esc(next.label)} &rarr;</a>`,
    '      <a class="ws-finish-progress" href="my-progress.html">See my progress</a>',
    '    </div>',
    '  </div>',
    '</section>',
    END
  );
  return rows.join('\n');
}

function blockMatches(block, entry, bannerMode, html) {
  if (!block || /style=/.test(block)) return false;
  if (bannerMode) {
    const banner = html.match(/<div[^>]*id=["']finishBanner["'][^>]*>/i);
    if (!banner || html.indexOf(START) < banner.index) return false;
    if (!/<div[^>]*class="[^"]*ws-finish/.test(block)) return false;
    if (!block.includes('Finished when: ' + esc(entry.conditionText))) return false;
  } else {
    if (!/<section[^>]*id="wsFinish"/.test(block)) return false;
    if (!block.includes(esc(entry.conditionText))) return false;
  }
  if (!block.includes('href="' + esc(entry.next.url) + '"')) return false;
  if (!block.includes('my-progress.html')) return false;
  const hasEvidence = block.includes('data-workshop-evidence="' + esc(entry.id) + '"');
  if (!!entry.evidence !== hasEvidence) return false;
  if (entry.evidence && !block.includes(esc(entry.evidence.prompt))) return false;
  return true;
}

function stripBlock(html) {
  const start = html.indexOf(START);
  const end = html.indexOf(END);
  if (start < 0 || end < start) return html;
  let before = html.slice(0, start);
  let after = html.slice(end + END.length);
  /* Strip the exact newlines the inserter adds, so strip then insert returns
     the same bytes and repeated runs never drift. */
  if (before.endsWith('\n')) before = before.slice(0, -1);
  if (after.startsWith('\n')) after = after.slice(1);
  return before + after;
}

function insertIntoFinishBanner(html, want) {
  const m = html.match(/<div[^>]*id=["']finishBanner["'][^>]*>/i);
  if (!m) return null;
  const at = m.index + m[0].length;
  return html.slice(0, at) + '\n' + want + '\n' + html.slice(at);
}

function insertClosing(html, want) {
  const main = html.lastIndexOf('</main>');
  if (main >= 0) return html.slice(0, main) + '\n' + want + '\n' + html.slice(main);
  const footer = html.search(/<footer[\s>]/i);
  if (footer >= 0) {
    const lead = footer > 0 && html[footer - 1] !== '\n' ? '\n' : '';
    return html.slice(0, footer) + lead + want + '\n' + html.slice(footer);
  }
  const body = html.lastIndexOf('</body>');
  if (body >= 0) return html.slice(0, body) + want + '\n' + html.slice(body);
  return null;
}

function ensureStepRestore(html, key) {
  if (!key) return html;
  const body = html.match(/<body\b[^>]*>/i);
  if (body && !/data-steps-key=/.test(body[0])) {
    const tag = body[0].replace(/>$/, ' data-steps-key="' + esc(key) + '">');
    html = html.slice(0, body.index) + tag + html.slice(body.index + body[0].length);
  }
  if (!/workshop-restore-steps\.js/.test(html)) {
    const end = html.lastIndexOf('</body>');
    if (end >= 0) html = html.slice(0, end) + '<script defer src="workshop-restore-steps.js"></script>\n' + html.slice(end);
  }
  return html;
}

function ensureEvidenceScript(html) {
  if (/workshop-evidence\.js/.test(html)) return html;
  const end = html.lastIndexOf('</body>');
  if (end >= 0) return html.slice(0, end) + '<script defer src="workshop-evidence.js"></script>\n' + html.slice(end);
  return html;
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

    /* Canvas pages and reference pages must not carry a stamped block: the
       canvas engine draws its own next box, and reference pages have no steps.
       Strip any stale block left by an earlier mode. */
    if (!['engine', 'steps', 'builder'].includes(entry.mode)) {
      const html = fs.readFileSync(file, 'utf8');
      const start = html.indexOf(START);
      const end = html.indexOf(END);
      if (start >= 0 && end > start) {
        const next = stripBlock(html);
        if (check) { stale.push(entry.id + ' (block on ' + entry.mode + ' page)'); continue; }
        fs.writeFileSync(file, next);
        updated.push(entry.id);
      }
      continue;
    }

    const original = fs.readFileSync(file, 'utf8');
    const start = original.indexOf(START);
    const end = original.indexOf(END);
    const existing = start >= 0 && end > start ? original.slice(start, end) : '';
    const bannerMode = entry.mode !== 'builder' || entry.hasFinishBanner;
    /* Leave a hand-tuned block alone when it already says the right thing.
       Builder-shell pages use their own utility classes, so rewriting a
       matching block would churn another task's work. */
    if (blockMatches(existing, entry, bannerMode, original)
      && (!entry.evidence || /workshop-evidence\.js/.test(original))) { clean.push(entry.id); continue; }
    /* Always start from a page with no stamped block, then place the current
       one. That keeps a mode change (a page moving to the shared canvas
       engine, or a builder later gaining a finish banner) clean instead of
       leaving the old block at the wrong spot. */
    const stripped = stripBlock(original);
    const want = bannerMode ? inlineBlock(entry) : closingBlock(entry);
    let next = bannerMode ? insertIntoFinishBanner(stripped, want) : insertClosing(stripped, want);

    if (!next) next = insertClosing(stripped, want);
    if (!next) { failed.push(entry.id + ' (no insert point)'); continue; }
    if (entry.evidence) next = ensureEvidenceScript(next);
    if (entry.mode === 'steps') next = ensureStepRestore(next, entry.storageKey);
    if (next === original) { clean.push(entry.id); continue; }
    if (check) { stale.push(entry.id); continue; }
    fs.writeFileSync(file, next);
    updated.push(entry.id);
  }

  if (check) {
    console.log('Workshop finish blocks: ' + clean.length + ' in sync, ' + stale.length + ' out of date');
    if (stale.length) console.error('Out of date (run without --check): ' + stale.join(', '));
    if (failed.length) console.error('Could not place: ' + failed.join(', '));
    if (stale.length || failed.length) process.exitCode = 1;
    return { clean, stale, failed };
  }

  console.log('Applied workshop finish blocks: ' + updated.length + ' updated, ' + clean.length + ' already in sync');
  if (failed.length) {
    console.error('Could not place: ' + failed.join(', '));
    process.exitCode = 1;
  }
  return { updated, clean, failed };
}

if (require.main === module) apply({ check: process.argv.includes('--check') });
module.exports = { apply, inlineBlock, closingBlock };
